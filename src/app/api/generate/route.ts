import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

// 503 = overloaded, 429 = rate-limited — both warrant a retry / fallback
function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('overloaded') ||
    msg.toLowerCase().includes('service unavailable') ||
    msg.toLowerCase().includes('rate limit')
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const delay = attempt * 2000; // 2 s, 4 s
      console.warn(`[generate] Gemini retryable error — waiting ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── OpenAI fallback (plain fetch — no extra dependency) ───────────────────────
async function callOpenAI(
  profile: TravelerProfile,
  classifiedResults: import('@/lib/types').ClassifiedResult[],
  hotelContext: string | undefined,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set — cannot use OpenAI fallback');

  const systemMsg =
    'You are a travel itinerary AI. Return ONLY a valid JSON object — no markdown, no prose. ' +
    'Your response must start with { and end with }. ' +
    SYSTEM_PROMPT;

  const userMsg = buildUserPrompt(profile, classifiedResults, hotelContext);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 16384,
      messages: [
        { role: 'system', content: systemMsg },
        { role: 'user', content: userMsg },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json() as { choices: { message: { content: string } }[] };
  return json.choices[0]?.message?.content ?? '';
}

function parseGeminiJson(rawText: string): unknown {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in AI response. Start: ' + rawText.slice(0, 200));
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  try {
    const profile: TravelerProfile = await req.json();

    if (!profile.destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    // ── RAG search ──────────────────────────────────────────────────────────────
    const classifiedResults = await runChainOfThoughtSearch(profile).catch(() => []);

    let hotelContext: string | undefined;
    if (!profile.hotelBooked?.trim()) {
      try {
        const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
        const query = 'best ' + accommodation + ' ' + profile.destination + ' ' + profile.budget + ' neighborhood review 2025 2026';
        const results = await searchWeb(query);
        if (results.length > 0) {
          hotelContext = results
            .slice(0, 4)
            .map((r) => '- ' + r.title + ': ' + r.snippet.slice(0, 220))
            .join('\n');
        }
      } catch { /* non-critical */ }
    }

    // ── Gemini generation ───────────────────────────────────────────────────────
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    console.log('[generate] model:', modelName, '| dest:', profile.destination);

    const model = genAI.getGenerativeModel(
      {
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 65536,
        },
        systemInstruction:
          'IMPORTANT: Your output MUST be a raw JSON object only. ' +
          'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
          'Start your response immediately with { and end with }. ' +
          'Your response must be a COMPLETE, valid JSON object. ' +
          'If the itinerary is long, prioritize quality over quantity to ensure the JSON structure is NEVER broken or truncated. ' +
          'Always close every array bracket and every object brace before finishing. ' +
          SYSTEM_PROMPT,
      },
      { apiVersion: 'v1beta' },
    );

    let raw: string;
    let provider = 'gemini';

    try {
      const aiResult = await withRetry(() =>
        model.generateContent(buildUserPrompt(profile, classifiedResults, hotelContext))
      );
      raw = aiResult.response.text();
      const finishReason = aiResult.response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
      console.log('Gemini Raw Output Length:', raw.length, 'chars | finishReason:', finishReason);
      if (finishReason === 'MAX_TOKENS') {
        console.warn('[generate] WARNING: Gemini response cut off by token limit');
      }
    } catch (geminiErr) {
      if (!isRetryable(geminiErr)) throw geminiErr; // hard error — don't fall back
      console.warn('[generate] FALLBACK: Gemini unavailable after 3 retries — switching to OpenAI gpt-4o-mini');
      console.warn('[generate] Gemini error was:', geminiErr instanceof Error ? geminiErr.message : String(geminiErr));
      raw = await callOpenAI(profile, classifiedResults, hotelContext);
      provider = 'openai';
      console.log('OpenAI Raw Output Length:', raw.length, 'chars');
    }

    console.log(`[generate] provider: ${provider} | raw start:`, raw.slice(0, 200));
    console.log('[generate] raw end:', raw.slice(-200));

    // ── Parse JSON ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itinerary: any = parseGeminiJson(raw);

    itinerary._meta = {
      searchEnabled: classifiedResults.length > 0,
      sourcesFound: classifiedResults.length,
      hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
      trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
      contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
      provider,
    };

    // ── Save to Supabase ────────────────────────────────────────────────────────
    const hotelInfo =
      itinerary.basecamp?.booked?.name ??
      itinerary.basecamp?.recommendations?.[0]?.name ??
      null;

    const { data, error: dbErr } = await supabase
      .from('itineraries')
      .insert([{
        destination: itinerary.destination || profile.destination,
        hotel_info: hotelInfo,
        itinerary_json: { ...itinerary, _profile: profile },
      }])
      .select('id')
      .single();

    if (dbErr) {
      console.error('[generate] Supabase insert error:', dbErr.message);
      return NextResponse.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    console.log('[generate] saved row id:', data.id);
    return NextResponse.json({ id: data.id, itinerary });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] unhandled error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
