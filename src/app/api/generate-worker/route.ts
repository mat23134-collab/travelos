import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

// Allow up to 60s on Vercel Hobby plan
export const maxDuration = 60;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

function parseGeminiJson(rawText: string): unknown {
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found. Raw start: ' + rawText.slice(0, 200));
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { id: string };
  const { id } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Read profile from the row created in Phase 1
  const { data: row, error: fetchErr } = await supabase
    .from('itineraries')
    .select('profile_json, status')
    .eq('id', id)
    .single();

  if (fetchErr || !row) {
    console.error('[worker] Row not found:', id);
    return NextResponse.json({ error: 'Itinerary not found' }, { status: 404 });
  }

  // Prevent duplicate generation (e.g. user refreshes during generation)
  if (row.status !== 'generating') {
    console.log('[worker] Skipping — status is already:', row.status);
    return NextResponse.json({ ok: true, skipped: true });
  }

  const profile = row.profile_json as TravelerProfile;
  console.log('[worker] Starting generation | id:', id, '| dest:', profile.destination);

  // ── RAG search ────────────────────────────────────────────────────────────────
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

  // ── Gemini generation ─────────────────────────────────────────────────────────
  const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  console.log('[worker] Using model:', modelName);

  const model = genAI.getGenerativeModel(
    {
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
      systemInstruction:
        'IMPORTANT: Your output MUST be a raw JSON object only. ' +
        'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
        'Start your response immediately with { and end with }. ' +
        SYSTEM_PROMPT,
    },
    { apiVersion: 'v1beta' },
  );

  let raw: string;
  try {
    const result = await model.generateContent(
      buildUserPrompt(profile, classifiedResults, hotelContext)
    );
    raw = result.response.text();
    console.log('[worker] RAW AI RESPONSE length:', raw.length, 'chars');
    console.log('[worker] RAW AI RESPONSE:', raw);
  } catch (genErr) {
    const msg = genErr instanceof Error ? genErr.message : String(genErr);
    console.error('[worker] Gemini error:', msg);
    await supabase.from('itineraries').update({ status: 'failed' }).eq('id', id);
    return NextResponse.json({ error: 'AI generation failed: ' + msg }, { status: 500 });
  }

  // ── Parse JSON ────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itinerary: any;
  try {
    itinerary = parseGeminiJson(raw);
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    console.error('[worker] JSON parse failed:', msg);
    await supabase.from('itineraries').update({ status: 'failed' }).eq('id', id);
    return NextResponse.json({ error: 'Parse failed: ' + msg }, { status: 500 });
  }

  itinerary._meta = {
    searchEnabled: classifiedResults.length > 0,
    sourcesFound: classifiedResults.length,
    hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
    trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
    contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
  };

  const hotelInfo =
    itinerary.basecamp?.booked?.name ??
    itinerary.basecamp?.recommendations?.[0]?.name ??
    null;

  // ── Save to Supabase ──────────────────────────────────────────────────────────
  const { error: updateErr } = await supabase
    .from('itineraries')
    .update({
      itinerary_json: { ...itinerary, _profile: profile },
      hotel_info: hotelInfo,
      status: 'done',
    })
    .eq('id', id);

  if (updateErr) {
    console.error('[worker] Supabase update error:', JSON.stringify(updateErr));
    return NextResponse.json({ error: 'Update failed: ' + updateErr.message }, { status: 500 });
  }

  console.log('[worker] Done | id:', id);
  return NextResponse.json({ ok: true });
}
