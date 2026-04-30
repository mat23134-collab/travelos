import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile, ClassifiedResult } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

// ── Shared system instruction (identical across all providers) ────────────────

const JSON_PREAMBLE =
  'IMPORTANT: Your output MUST be a raw JSON object only. ' +
  'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
  'Start your response immediately with { and end with }. ' +
  'Your response must be a COMPLETE, valid JSON object. ' +
  'Always close every array bracket and every object brace before finishing. ';

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseAIJson(rawText: string): unknown {
  // Direct parse first — Claude returns clean JSON so this usually succeeds
  try {
    return JSON.parse(rawText.trim());
  } catch { /* fall through to extraction */ }
  // Extract outermost {...} block (handles any preamble/postamble)
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found. Response start: ' + rawText.slice(0, 200));
  return JSON.parse(match[0]);
}

// ── Retry helper ──────────────────────────────────────────────────────────────

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

async function withRetry<T>(fn: () => Promise<T>, label: string, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const delay = attempt * 2000;
      console.warn(`[generate] ${label} retryable error — waiting ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

function isProviderFailure(err: unknown): boolean {
  if (isRetryable(err)) return true;
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('JSON') || msg.includes('parse') || msg.includes('token');
}

// ── Provider 1: Claude (PRIMARY) ──────────────────────────────────────────────

async function callClaude(
  profile: TravelerProfile,
  classifiedResults: ClassifiedResult[],
  hotelContext: string | undefined,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

  const message = await client.messages.create({
    model: modelName,
    max_tokens: 16000,
    system: JSON_PREAMBLE + SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(profile, classifiedResults, hotelContext) },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '';
}

// ── Provider 2: OpenAI gpt-4o-mini (BACKUP 1) ────────────────────────────────

async function callOpenAI(
  profile: TravelerProfile,
  classifiedResults: ClassifiedResult[],
  hotelContext: string | undefined,
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set');

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    temperature: 0.7,
    max_tokens: 16384,
    messages: [
      { role: 'system', content: JSON_PREAMBLE + SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(profile, classifiedResults, hotelContext) },
    ],
  });

  return completion.choices[0]?.message?.content ?? '';
}

// ── Provider 3: Gemini (FINAL BACKUP) ────────────────────────────────────────

async function callGemini(
  profile: TravelerProfile,
  classifiedResults: ClassifiedResult[],
  hotelContext: string | undefined,
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 65536 },
      systemInstruction: JSON_PREAMBLE + SYSTEM_PROMPT,
    },
    { apiVersion: 'v1beta' },
  );

  const result = await model.generateContent(buildUserPrompt(profile, classifiedResults, hotelContext));
  return result.response.text();
}

// ── Main route ────────────────────────────────────────────────────────────────

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itinerary: any;
    let provider = 'claude';

    // ── 1. Claude (primary) ─────────────────────────────────────────────────────
    try {
      const raw = await withRetry(
        () => callClaude(profile, classifiedResults, hotelContext),
        'Claude',
      );
      console.log('Claude Raw Output Length:', raw.length, 'chars');
      itinerary = parseAIJson(raw);
    } catch (claudeErr) {
      if (!isProviderFailure(claudeErr)) throw claudeErr;
      console.warn('[generate] Claude failed — switching to OpenAI backup');
      console.warn('[generate] Claude error:', claudeErr instanceof Error ? claudeErr.message : String(claudeErr));

      // ── 2. OpenAI (backup 1) ──────────────────────────────────────────────────
      try {
        const raw = await withRetry(
          () => callOpenAI(profile, classifiedResults, hotelContext),
          'OpenAI',
        );
        console.log('OpenAI Raw Output Length:', raw.length, 'chars');
        itinerary = parseAIJson(raw);
        provider = 'openai';
      } catch (openaiErr) {
        console.warn('[generate] OpenAI also failed — switching to Gemini final backup');
        console.warn('[generate] OpenAI error:', openaiErr instanceof Error ? openaiErr.message : String(openaiErr));

        // ── 3. Gemini (final backup) ────────────────────────────────────────────
        const raw = await withRetry(
          () => callGemini(profile, classifiedResults, hotelContext),
          'Gemini',
        );
        console.log('Gemini Raw Output Length:', raw.length, 'chars');
        itinerary = parseAIJson(raw);
        provider = 'gemini';
      }
    }

    console.log(`[generate] provider used: ${provider}`);

    // ── Metadata ────────────────────────────────────────────────────────────────
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
    console.error('[generate] all providers failed:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
