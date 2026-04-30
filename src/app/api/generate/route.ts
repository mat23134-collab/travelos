import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

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

    const aiResult = await model.generateContent(
      buildUserPrompt(profile, classifiedResults, hotelContext)
    );
    const raw = aiResult.response.text();
    const finishReason = aiResult.response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
    console.log('Gemini Raw Output Length:', raw.length, 'chars | finishReason:', finishReason);
    if (finishReason === 'MAX_TOKENS') {
      console.warn('[generate] WARNING: response was cut off by token limit — JSON may be incomplete');
    }
    console.log('[generate] raw start:', raw.slice(0, 200));
    console.log('[generate] raw end:  ', raw.slice(-200));

    // ── Parse JSON ──────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itinerary: any = parseGeminiJson(raw);

    itinerary._meta = {
      searchEnabled: classifiedResults.length > 0,
      sourcesFound: classifiedResults.length,
      hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
      trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
      contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
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
