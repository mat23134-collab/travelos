import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  // Temporarily disabled for Supabase connection test
  // if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
  //   return NextResponse.json(
  //     { error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local.' },
  //     { status: 500 }
  //   );
  // }

  let profile: TravelerProfile;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!profile.destination) {
    return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
  }

  // ── SUPABASE TEST MODE ── Remove this block once DB connection is confirmed ──
  const itinerary = {
    destination: profile.destination,
    totalDays: 3,
    strategicOverview: `Test itinerary for ${profile.destination}. Supabase connection test — not a real trip.`,
    days: [
      {
        day: 1,
        theme: 'Arrival & Explore',
        neighborhood: 'City Centre',
        morning: { activity: 'Check in and walk around', location: 'City Centre', duration: '2h', cost: '$0', insiderTip: 'Test tip' },
        afternoon: { activity: 'Lunch at a local spot', location: 'Old Town', duration: '1.5h', cost: '$15', insiderTip: 'Test tip' },
        evening: { activity: 'Dinner and stroll', location: 'Waterfront', duration: '2h', cost: '$30', insiderTip: 'Test tip' },
      },
    ],
    budgetSummary: { dailyAverage: '$80', totalEstimate: '$240', includes: 'Food & activities' },
    packingTips: ['Comfortable shoes', 'Light jacket'],
    bestLocalTips: ['Book restaurants in advance'],
    _meta: { searchEnabled: false, sourcesFound: 0, hiddenGems: 0, trapsFiltered: 0, contradictionsFound: 0 },
  };
  console.log('[generate] TEST MODE — skipping AI call, using mock itinerary for Supabase test');
  // ── END SUPABASE TEST MODE ──────────────────────────────────────────────────

  /*
  // Three-phase chain-of-thought search: trend research → blog mining → contradiction detection
  const classifiedResults = await runChainOfThoughtSearch(profile).catch(() => []);

  // Hotel search: only runs when the user hasn't pre-booked a hotel
  let hotelContext: string | undefined;
  if (!profile.hotelBooked?.trim()) {
    try {
      const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
      const query = `best ${accommodation} ${profile.destination} ${profile.budget} neighborhood review 2025 2026`;
      const results = await searchWeb(query);
      if (results.length > 0) {
        hotelContext = results
          .slice(0, 4)
          .map((r) => `• ${r.title}: ${r.snippet.slice(0, 220)}`)
          .join('\n');
      }
    } catch {}
  }

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
  const cleaned = raw
    .replace(/^﻿/, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .replace(/```(?:json)?\s*/gi, '')
    .trim();

  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  const jsonText = (start !== -1 && end > start) ? cleaned.slice(start, end + 1) : cleaned;

  let itinerary;
  try {
    itinerary = JSON.parse(jsonText);
  } catch (parseErr) {
    const pos = (parseErr as SyntaxError).message.match(/position (\d+)/)?.[1];
    console.error(
      `[generate] JSON parse failed — raw length: ${raw.length} chars` +
      (pos ? `, error near position ${pos}` : '') +
      `\nFirst 300 chars: ${raw.slice(0, 300)}` +
      `\nLast 300 chars:  ${raw.slice(-300)}`
    );
    let repaired: unknown = null;
    for (let i = jsonText.length - 1; i > 0; i--) {
      if (jsonText[i] === '}') {
        try { repaired = JSON.parse(jsonText.slice(0, i + 1)); break; } catch {}
      }
    }
    if (!repaired) {
      return NextResponse.json(
        { error: `Malformed AI response (length ${raw.length}). Check server logs for details.` },
        { status: 500 }
      );
    }
    itinerary = repaired;
  }

  itinerary._meta = {
    searchEnabled: classifiedResults.length > 0,
    sourcesFound: classifiedResults.length,
    hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
    trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
    contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
  };
  */

  // ── Persist to Supabase ────────────────────────────────────────────────────
  const itineraryIsValid =
    typeof itinerary.destination === 'string' &&
    itinerary.destination.trim().length > 0 &&
    Array.isArray(itinerary.days) &&
    itinerary.days.length > 0;

  const destinationMatches =
    itinerary.destination?.toLowerCase().includes(profile.destination.toLowerCase()) ||
    profile.destination.toLowerCase().includes(itinerary.destination?.toLowerCase() ?? '');

  let savedId: string | null = null;
  if (itineraryIsValid && destinationMatches) {
    console.log(
      `[generate] Attempting to save to Supabase... destination="${itinerary.destination}", days=${itinerary.days.length}`
    );
    try {
      const hotelInfo =
        (itinerary as Record<string, unknown> & { basecamp?: { booked?: { name?: string }; recommendations?: { name?: string }[] } })
          .basecamp?.booked?.name ??
        (itinerary as Record<string, unknown> & { basecamp?: { recommendations?: { name?: string }[] } })
          .basecamp?.recommendations?.[0]?.name ??
        null;

      const { data: saved, error: dbErr } = await supabase
        .from('itineraries')
        .insert({
          destination: itinerary.destination,
          hotel_info: hotelInfo,
          itinerary_json: { ...itinerary, _profile: profile },
        })
        .select('id')
        .single();

      console.log('[generate] Supabase raw response — data:', JSON.stringify(saved), '| error:', JSON.stringify(dbErr));
      if (dbErr) {
        console.error('[generate] Supabase insert error:', dbErr);
      } else if (saved) {
        savedId = saved.id as string;
        console.log(`[generate] Supabase save succeeded — id: ${savedId}`);
      }
    } catch (dbException) {
      console.error('[generate] Supabase insert threw an exception:', dbException);
    }
  } else {
    console.warn(
      `[generate] Supabase insert skipped — destination mismatch or empty itinerary.` +
      ` Requested: "${profile.destination}", got: "${itinerary.destination}", days: ${itinerary.days?.length ?? 0}`
    );
  }

  return NextResponse.json(savedId ? { id: savedId, ...itinerary } : itinerary);
}
