import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

function repairJson(raw: string): string {
  let s = raw.trim();
  // Strip BOM
  if (s.charCodeAt(0) === 0xFEFF) s = s.slice(1);
  // Strip opening fence (```json or ```)
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?[ \t]*\r?\n?/i, '');
  }
  // Strip closing fence
  if (s.endsWith('```')) {
    s = s.replace(/\r?\n?[ \t]*```[ \t]*$/, '');
  }
  s = s.trim();
  // Extract outermost { ... } in case there is still leading/trailing prose
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last > first) s = s.slice(first, last + 1);
  return s;
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

  let itinerary;
  try {
    const model = genAI.getGenerativeModel(
      {
        model: 'gemini-3-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
        systemInstruction:
          'Respond ONLY with a compact JSON object. No markdown fences, no intro text, no outro text. ' +
          'Keep every string field under 10 words. The entire JSON must be under 9000 characters. ' +
          'SYSTEM CONTEXT: ' + SYSTEM_PROMPT,
      },
      { apiVersion: 'v1' },
    );

    const result = await model.generateContent(
      buildUserPrompt(profile, classifiedResults, hotelContext)
    );

    const raw = result.response.text();
    console.log('[generate] Gemini raw length:', raw.length, 'chars');

    // Repair: strip markdown fences if the model added them despite responseMimeType
    const cleaned = repairJson(raw);

    try {
      itinerary = JSON.parse(cleaned);
    } catch (parseErr) {
      const pos = (parseErr as SyntaxError).message.match(/position (\d+)/)?.[1];
      const posNum = pos ? parseInt(pos, 10) : -1;
      const snippet = posNum > -1
        ? cleaned.slice(Math.max(0, posNum - 120), posNum + 120)
        : '(position unknown)';
      console.error(
        '[generate] JSON parse failed\n' +
        '  raw length : ' + raw.length + ' chars\n' +
        '  cleaned len: ' + cleaned.length + ' chars\n' +
        (pos ? '  error pos : ' + pos + '\n' : '') +
        '  snippet    : ...>' + snippet + '<...\n' +
        '  first 500  : ' + cleaned.slice(0, 500) + '\n' +
        '  last  500  : ' + cleaned.slice(-500)
      );
      return NextResponse.json(
        { error: 'Malformed AI response (' + raw.length + ' chars). Check Vercel logs for snippet.' },
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

  const { data: saved, error: dbErr } = await supabase
    .from('itineraries')
    .insert({
      destination: itinerary.destination,
      hotel_info: hotelInfo,
      itinerary_json: { ...itinerary, _profile: profile },
    })
    .select('id')
    .single();

  console.log('Supabase Response:', dbErr ? JSON.stringify(dbErr) : 'no error');
  console.log('Supabase Data:', JSON.stringify(saved));

  if (dbErr) {
    return NextResponse.json(
      { error: 'Supabase insert failed: ' + dbErr.message, details: dbErr },
      { status: 500 }
    );
  }

  if (!saved?.id) {
    return NextResponse.json(
      { error: 'Supabase insert returned no ID' },
      { status: 500 }
    );
  }

  const savedId = saved.id as string;
  console.log('[generate] Supabase save succeeded — id: ' + savedId);

  return NextResponse.json({ id: savedId, ...itinerary });
}
