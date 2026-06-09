import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import type { Itinerary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PER_CATEGORY = 5;
const CATEGORIES = ['sightseeing', 'history', 'food'] as const;

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Names already booked into the itinerary (any day, any slot). */
function namesInItinerary(itinerary: Itinerary): Set<string> {
  const names = new Set<string>();
  for (const day of itinerary.days ?? []) {
    for (const key of ['morning', 'afternoon', 'evening'] as const) {
      const act = day[key];
      if (act?.name) names.add(act.name.trim().toLowerCase());
    }
    for (const key of ['breakfast', 'lunch', 'dinner'] as const) {
      const meal = day[key];
      if (meal?.name) names.add(meal.name.trim().toLowerCase());
    }
  }
  return names;
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  let body: { itinerary_id?: string; destination?: string; itinerary?: Itinerary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const itineraryId = (body.itinerary_id ?? '').trim();
  const destination = (body.destination ?? '').trim();
  if (!itineraryId || !destination) {
    return NextResponse.json({ error: 'itinerary_id and destination are required' }, { status: 400 });
  }

  const db = dbClient();

  // Skip if this itinerary already has AI bank items.
  const { data: existing } = await db
    .from('attraction_bank')
    .select('id')
    .eq('itinerary_id', itineraryId)
    .eq('source', 'ai')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ inserted: 0, reason: 'already populated' });
  }

  // City may include a country suffix ("Paris, France") — match the leading segment.
  const cityOnly = destination.split(',')[0].trim();

  const { data: places, error: placesErr } = await db
    .from('places')
    .select('name, description, category_emoji, lat, lng, photo_url, website_url, top_pick_category, popularity_rank')
    .ilike('city', cityOnly)
    .not('top_pick_category', 'is', null)
    .order('popularity_rank', { ascending: true })
    .limit(60);

  if (placesErr) {
    return NextResponse.json({ error: placesErr.message }, { status: 500 });
  }

  const skip = body.itinerary ? namesInItinerary(body.itinerary) : new Set<string>();

  const perCategoryCount: Record<string, number> = { sightseeing: 0, history: 0, food: 0 };
  const toInsert: Array<Record<string, unknown>> = [];

  for (const place of places ?? []) {
    const cat = place.top_pick_category as (typeof CATEGORIES)[number] | null;
    if (!cat || !CATEGORIES.includes(cat)) continue;
    if (perCategoryCount[cat] >= PER_CATEGORY) continue;
    if (skip.has((place.name as string).trim().toLowerCase())) continue;

    perCategoryCount[cat]++;
    toInsert.push({
      itinerary_id: itineraryId,
      user_id: userId,
      name: place.name,
      description: place.description,
      category_emoji: place.category_emoji,
      lat: place.lat,
      lng: place.lng,
      photo_url: place.photo_url,
      website_url: place.website_url,
      source: 'ai',
      top_pick_category: cat,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, reason: 'no curated picks for city' });
  }

  const { error: insErr } = await db.from('attraction_bank').insert(toInsert);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: toInsert.length });
}
