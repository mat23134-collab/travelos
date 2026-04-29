import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

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


  // ── Persist to Supabase ────────────────────────────────────────────────────
  const insertPayload = {
    destination: itinerary.destination,
    hotel_info: null,
    itinerary_json: { ...itinerary, _profile: profile },
  };

  console.log('Inserting to Supabase...', JSON.stringify(insertPayload, null, 2));

  const { data: saved, error: dbErr } = await supabase
    .from('itineraries')
    .insert(insertPayload)
    .select('id')
    .single();

  console.log('Supabase Response:', dbErr ? JSON.stringify(dbErr) : 'no error');
  console.log('Supabase Data:', JSON.stringify(saved));

  if (dbErr) {
    return NextResponse.json(
      { error: `Supabase insert failed: ${dbErr.message}`, details: dbErr },
      { status: 500 }
    );
  }

  if (!saved?.id) {
    return NextResponse.json(
      { error: 'Supabase insert returned no ID — row may not have been created' },
      { status: 500 }
    );
  }

  const savedId = saved.id as string;
  console.log(`[generate] Supabase save succeeded — id: ${savedId}`);

  return NextResponse.json({ id: savedId, ...itinerary });
}
