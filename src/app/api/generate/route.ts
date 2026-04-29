import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

// Model name is read at request time so you can change it in Vercel env vars
// without a redeploy. Set GEMINI_MODEL to the exact name shown in your model list.
// Fallback order tried historically: gemini-1.5-flash → gemini-2.0-flash →
// gemini-3-flash → gemini-2.5-flash (all on v1beta with systemInstruction support)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

function parseGeminiJson(rawText: string): unknown {
  // Use a greedy regex to grab the outermost {...} block — handles BOM,
  // markdown fences, and any preamble/postamble the model adds.
  const match = rawText.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object found in response. Raw start: ' + rawText.slice(0, 200));
  return JSON.parse(match[0]);
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured.' },
      { status: 500 }
    );
  }

  let profile: TravelerProfile;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!profile.destination) {
    return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
  }

  // Three-phase chain-of-thought search
  const classifiedResults = await runChainOfThoughtSearch(profile).catch(() => []);

  // Hotel search: only runs when the user hasn't pre-booked a hotel
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
  try {
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    console.log('[generate] Using model:', modelName, '| API: v1beta');

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
          'Keep every string field under 10 words. Total output must be under 9000 characters. ' +
          SYSTEM_PROMPT,
      },
      { apiVersion: 'v1beta' },
    );

    const result = await model.generateContent(
      buildUserPrompt(profile, classifiedResults, hotelContext)
    );

    const raw = result.response.text();
    console.log('[generate] Gemini raw length:', raw.length, 'chars');
    console.log('[generate] Gemini raw start:', raw.slice(0, 300));

    try {
      itinerary = parseGeminiJson(raw);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error('[generate] JSON parse failed — ' + msg);
      console.error('[generate] First 500:', raw.slice(0, 500));
      console.error('[generate] Last  500:', raw.slice(-500));
      return NextResponse.json(
        { error: 'Malformed AI response (' + raw.length + ' chars): ' + msg },
        { status: 500 }
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'AI generation failed: ' + msg }, { status: 500 });
  }

  itinerary._meta = {
    searchEnabled: classifiedResults.length > 0,
    sourcesFound: classifiedResults.length,
    hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
    trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
    contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
  };

  // ── Persist to Supabase ────────────────────────────────────────────────────
  const itineraryIsValid =
    typeof itinerary.destination === 'string' &&
    itinerary.destination.trim().length > 0 &&
    Array.isArray(itinerary.days) &&
    itinerary.days.length > 0;

  const destinationMatches =
    itinerary.destination?.toLowerCase().includes(profile.destination.toLowerCase()) ||
    profile.destination.toLowerCase().includes(itinerary.destination?.toLowerCase() ?? '');

  if (!itineraryIsValid || !destinationMatches) {
    console.warn(
      '[generate] Supabase insert skipped — requested: "' + profile.destination +
      '", got: "' + itinerary.destination + '", days: ' + (itinerary.days?.length ?? 0)
    );
    return NextResponse.json(itinerary);
  }

  const hotelInfo =
    itinerary.basecamp?.booked?.name ??
    itinerary.basecamp?.recommendations?.[0]?.name ??
    null;

  console.log('[generate] Supabase URL:', SUPABASE_URL || 'MISSING');
  console.log('[generate] Inserting to Supabase...', itinerary.destination);

  try {
    const { data: insertedRows, error: dbErr } = await supabase
      .from('itineraries')
      .insert([{
        destination: itinerary.destination,
        hotel_info: hotelInfo,
        itinerary_json: { ...itinerary, _profile: profile },
      }])
      .select('id');

    console.log('Supabase insert error:', dbErr ? JSON.stringify(dbErr) : 'none');
    console.log('Supabase insert data:', JSON.stringify(insertedRows));

    if (dbErr) {
      return NextResponse.json(
        { error: 'Supabase insert failed: ' + dbErr.message, details: dbErr },
        { status: 500 }
      );
    }

    const insertedId = insertedRows?.[0]?.id as string | undefined;
    console.log('[generate] insertedId:', insertedId);

    if (!insertedId) {
      return NextResponse.json(
        { error: 'Supabase insert returned no ID', raw: insertedRows },
        { status: 500 }
      );
    }

    // Return id at the top level, itinerary nested — no spread collision possible
    return NextResponse.json({ id: insertedId, itinerary });
  } catch (dbException) {
    const msg = dbException instanceof Error ? dbException.message : String(dbException);
    console.error('[generate] Supabase insert threw an exception:', msg);
    return NextResponse.json(
      { error: 'Supabase insert exception: ' + msg },
      { status: 500 }
    );
  }
}
