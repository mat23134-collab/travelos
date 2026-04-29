import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local.' },
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
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(profile, classifiedResults, hotelContext) }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type from AI' }, { status: 500 });
    }

    const raw = content.text;

    // Strip BOM and markdown fences, then extract the outermost JSON object
    let cleaned = raw.replace(/^﻿/, '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/i, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/```$/, '');
    }
    cleaned = cleaned.trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    const jsonText = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;

    try {
      itinerary = JSON.parse(jsonText);
    } catch (parseErr) {
      const pos = (parseErr as SyntaxError).message.match(/position (\d+)/)?.[1];
      console.error(
        '[generate] JSON parse failed — length: ' + raw.length +
        (pos ? ', error near position ' + pos : '') +
        '\nFirst 300: ' + raw.slice(0, 300)
      );

      let repaired: unknown = null;
      for (let i = jsonText.length - 1; i > 0; i--) {
        if (jsonText[i] === '}') {
          try { repaired = JSON.parse(jsonText.slice(0, i + 1)); break; } catch { /* keep walking */ }
        }
      }
      if (!repaired) {
        return NextResponse.json(
          { error: 'Malformed AI response. Check server logs for details.' },
          { status: 500 }
        );
      }
      itinerary = repaired;
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

  const insertPayload = {
    destination: itinerary.destination,
    hotel_info: hotelInfo,
    itinerary_json: { ...itinerary, _profile: profile },
  };

  console.log('[generate] Supabase URL:', SUPABASE_URL || 'MISSING');
  console.log('[generate] Inserting to Supabase...', itinerary.destination);

  const { data: saved, error: dbErr } = await supabase
    .from('itineraries')
    .insert(insertPayload)
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
