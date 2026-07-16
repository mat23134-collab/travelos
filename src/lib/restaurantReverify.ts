/**
 * restaurantReverify — freshness control for the restaurant bank (§10).
 *
 * Restaurants close (~20%/yr) and ratings drift; a dead reservation link in the
 * book-ahead panel is the worst failure mode. This re-verifies the oldest-
 * verified rows per city against Google Place Details (cheap: lookup by the
 * stored place_id, no text search), refreshing rating / review count / website /
 * price_level, recomputing the composite score, stamping last_verified_at, and
 * flagging places Google reports as permanently closed.
 *
 * Runs from a nightly cron via scripts/restaurant-reverify.ts (see the admin
 * trigger route). Kept server-only: needs the service-role client + Places key.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { RestaurantRecommendation } from '@/lib/types';
import { normalizeCity } from '@/lib/restaurantBank';
import { computeCompositeScore, bayesRating, DEFAULT_CITY_MEAN } from '@/lib/restaurantScoring';

const TABLE = 'restaurant_recommendations';
const PLACES_FETCH_MS = 5_000;

interface PlaceRefresh {
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  website: string | null;
  /** Google business_status — 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY'. */
  status: string | null;
  found: boolean;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
  });
}

/** Re-fetch the mutable Place Details fields for a known place_id. Never throws. */
async function refreshPlace(placeId: string, apiKey: string): Promise<PlaceRefresh> {
  const empty: PlaceRefresh = { rating: null, ratingCount: null, priceLevel: null, website: null, status: null, found: false };
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=rating,user_ratings_total,price_level,website,business_status&key=${apiKey}`;
    const res = await withTimeout(fetch(url, { cache: 'no-store' }), PLACES_FETCH_MS);
    if (!res.ok) return empty;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const data = (await res.json()) as any;
    const r = data.result;
    if (!r) return empty;
    return {
      rating: typeof r.rating === 'number' ? r.rating : null,
      ratingCount: typeof r.user_ratings_total === 'number' ? r.user_ratings_total : null,
      priceLevel: typeof r.price_level === 'number' ? r.price_level : null,
      website: r.website ?? null,
      status: r.business_status ?? null,
      found: true,
    };
  } catch {
    return empty;
  }
}

export interface ReverifyResult {
  city: string;
  checked: number;
  updated: number;
  closed: number;
  skipped: number;
}

/**
 * Re-verify up to `limit` of a city's stalest verified rows. When `dryRun`,
 * logs what would change without writing. Rows Google reports as permanently
 * closed are deleted (a dead pick is worse than a missing one).
 */
export async function reverifyCity(
  db: SupabaseClient,
  city: string,
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<ReverifyResult> {
  const { limit = 20, dryRun = false } = opts;
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const result: ReverifyResult = { city, checked: 0, updated: 0, closed: 0, skipped: 0 };
  if (!apiKey) return result;

  const cityNorm = normalizeCity(city);
  // Oldest last_verified_at first; nulls (never verified) sort first so they get
  // priority. Only rows with a google_place_id can be re-verified by id.
  const { data, error } = await db
    .from(TABLE)
    .select('id, name, rating, rating_count, google_place_id, reservation_url, website_url, book_ahead_level, cuisine_genre')
    .eq('city_normalized', cityNorm)
    .not('google_place_id', 'is', null)
    .order('last_verified_at', { ascending: true, nullsFirst: true })
    .limit(limit);

  if (error || !data) return result;

  for (const row of data) {
    result.checked++;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const r = row as any;
    const fresh = await refreshPlace(r.google_place_id, apiKey);
    if (!fresh.found) { result.skipped++; continue; }

    if (fresh.status === 'CLOSED_PERMANENTLY') {
      result.closed++;
      if (!dryRun) await db.from(TABLE).delete().eq('id', r.id);
      continue;
    }

    // Recompute the composite off the refreshed signal.
    const merged: RestaurantRecommendation = {
      city,
      name: r.name,
      rating: fresh.rating ?? r.rating ?? null,
      ratingCount: fresh.ratingCount ?? r.rating_count ?? null,
      priceLevel: fresh.priceLevel ?? null,
      googlePlaceId: r.google_place_id,
      reservationUrl: r.reservation_url ?? null,
      websiteUrl: fresh.website ?? r.website_url ?? null,
      bookAheadLevel: r.book_ahead_level ?? null,
      cuisineGenre: r.cuisine_genre ?? null,
    };
    const composite = computeCompositeScore(merged, DEFAULT_CITY_MEAN);
    const bayes = Number(bayesRating(merged.rating, merged.ratingCount, DEFAULT_CITY_MEAN).toFixed(3));

    result.updated++;
    if (!dryRun) {
      await db
        .from(TABLE)
        .update({
          rating: merged.rating,
          rating_count: merged.ratingCount,
          website_url: merged.websiteUrl,
          bayes_rating: bayes,
          composite_score: composite,
          score: composite,
          last_verified_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id);
    }
  }

  return result;
}

/** Cities with the most stale rows to re-verify — the cron's work queue. */
export async function citiesNeedingReverify(db: SupabaseClient, ttlDays = 90): Promise<string[]> {
  const cutoff = new Date(Date.now() - ttlDays * 86_400_000).toISOString();
  const { data, error } = await db
    .from(TABLE)
    .select('city')
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`)
    .limit(2000);
  if (error || !data) return [];
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const seen = new Set<string>();
  for (const row of data as any[]) if (row.city) seen.add(row.city);
  return [...seen];
}
