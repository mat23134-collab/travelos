/**
 * /api/landmarks — curated Top Sights for the Step 7 onboarding card.
 *
 *   GET /api/landmarks?city=Paris
 *
 *   Returns { sightseeing: Landmark[]; history: Landmark[]; food: Landmark[] }.
 *
 * Source of truth: public.places rows where top_pick_category IS NOT NULL.
 * On the first read for a given (name, city), missing photo_url values are
 * resolved through Google Places "Find Place From Text" and written back to
 * the row so subsequent reads are free. Failures are tolerated — the card
 * just shows a graceful placeholder.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { verifyPlaceOnGoogle } from '@/lib/placeVerification';

export const dynamic = 'force-dynamic';

export interface Landmark {
  id: string;
  name: string;
  description: string | null;
  category_emoji: string | null;
  vibe_label: string | null;
  photo_url: string | null;
  google_place_id: string | null;
  popularity_rank: number | null;
}

const CATEGORIES = ['sightseeing', 'history', 'food'] as const;
type Category = typeof CATEGORIES[number];

type Row = {
  id: string;
  name: string;
  city: string | null;
  description: string | null;
  category_emoji: string | null;
  vibe_label: string | null;
  photo_url: string | null;
  google_place_id: string | null;
  top_pick_category: Category | null;
  popularity_rank: number | null;
};

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (url && key) return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return supabase;
}

function toLandmark(row: Row): Landmark {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category_emoji: row.category_emoji,
    vibe_label: row.vibe_label,
    photo_url: row.photo_url,
    google_place_id: row.google_place_id,
    popularity_rank: row.popularity_rank,
  };
}

export async function GET(req: NextRequest) {
  const city = (req.nextUrl.searchParams.get('city') ?? '').trim();
  if (!city) {
    return NextResponse.json({ error: 'city query param required' }, { status: 400 });
  }

  const db = dbClient();
  const { data, error } = await db
    .from('places')
    .select(
      'id, name, city, description, category_emoji, vibe_label, photo_url, google_place_id, top_pick_category, popularity_rank',
    )
    .ilike('city', city)
    .not('top_pick_category', 'is', null)
    .order('popularity_rank', { ascending: true })
    .limit(60);

  if (error) {
    console.warn('[api/landmarks] places select failed:', error.message);
    return NextResponse.json({ sightseeing: [], history: [], food: [] }, { status: 500 });
  }

  const rows = (data ?? []) as Row[];

  // Bucket by category (max 6 per bucket — defensive, since the seed has 4).
  const grouped: Record<Category, Landmark[]> = { sightseeing: [], history: [], food: [] };
  for (const row of rows) {
    if (!row.top_pick_category) continue;
    if (grouped[row.top_pick_category].length >= 6) continue;
    grouped[row.top_pick_category].push(toLandmark(row));
  }

  // ── On-demand photo resolution ────────────────────────────────────────────
  // Any row that landed in the response without photo_url gets resolved via
  // Google Places in parallel. Results are written back to the row so the
  // next request for the same city is instant. Capped at 9 concurrent calls
  // to keep total wall-clock under ~5s.

  if (process.env.GOOGLE_PLACES_API_KEY) {
    const pending = ([] as Landmark[]).concat(grouped.sightseeing, grouped.history, grouped.food)
      .filter((l) => !l.photo_url);
    if (pending.length > 0) {
      await Promise.all(
        pending.map(async (landmark) => {
          try {
            const result = await verifyPlaceOnGoogle(landmark.name, city);
            if (!result.found || !result.photoUrl) return;
            landmark.photo_url = result.photoUrl;
            if (!landmark.google_place_id && result.googlePlaceId) {
              landmark.google_place_id = result.googlePlaceId;
            }
            // Write back to DB — fire-and-forget within the request lifetime.
            await db.from('places').update({
              photo_url: result.photoUrl,
              ...(result.googlePlaceId ? { google_place_id: result.googlePlaceId } : {}),
              ...(typeof result.rating === 'number' ? { google_rating: result.rating } : {}),
              ...(result.website ? { website_url: result.website } : {}),
            }).eq('id', landmark.id);
          } catch (e) {
            console.warn(`[api/landmarks] photo resolve failed for "${landmark.name}":`, e instanceof Error ? e.message : e);
          }
        }),
      );
    }
  }

  return NextResponse.json(
    {
      city,
      sightseeing: grouped.sightseeing,
      history:     grouped.history,
      food:        grouped.food,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
