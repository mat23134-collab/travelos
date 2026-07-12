/**
 * restaurantBank — data-access helpers for `public.restaurant_recommendations`.
 *
 * Keeps the row ⇄ RestaurantRecommendation mapping (snake_case ⇄ camelCase) in
 * one place so the GET/scout routes stay thin. Mirrors tripTransport.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { RestaurantRecommendation, SiteLanguage } from '@/lib/types';

const TABLE = 'restaurant_recommendations';

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToRec(row: any): RestaurantRecommendation {
  return {
    id: row.id,
    city: row.city,
    name: row.name,
    description: row.description,
    cuisineStyle: row.cuisine_style,
    signatureDish: row.signature_dish,
    translations: row.translations ?? null,
    priceRange: row.price_range,
    priceLevel: row.price_level,
    neighborhood: row.neighborhood,
    reservationUrl: row.reservation_url,
    bookingPlatform: row.booking_platform,
    websiteUrl: row.website_url,
    latitude: row.latitude,
    longitude: row.longitude,
    googlePlaceId: row.google_place_id,
    rating: row.rating,
    ratingCount: row.rating_count,
    photoUrl: row.photo_url,
    source: row.source,
    score: row.score,
  };
}

function recToRow(rec: RestaurantRecommendation) {
  return {
    city: rec.city,
    city_normalized: normalizeCity(rec.city),
    name: rec.name,
    name_normalized: normalizeName(rec.name),
    description: rec.description ?? null,
    cuisine_style: rec.cuisineStyle ?? null,
    signature_dish: rec.signatureDish ?? null,
    translations: rec.translations ?? null,
    price_range: rec.priceRange ?? null,
    price_level: rec.priceLevel ?? null,
    neighborhood: rec.neighborhood ?? null,
    reservation_url: rec.reservationUrl ?? null,
    booking_platform: rec.bookingPlatform ?? null,
    website_url: rec.websiteUrl ?? null,
    latitude: rec.latitude ?? null,
    longitude: rec.longitude ?? null,
    google_place_id: rec.googlePlaceId ?? null,
    rating: rec.rating ?? null,
    rating_count: rec.ratingCount ?? null,
    photo_url: rec.photoUrl ?? null,
    source: rec.source ?? 'scout',
    score: rec.score ?? 0,
    updated_at: new Date().toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Resolve a recommendation's localizable text (description, cuisineStyle,
 * signatureDish) to the requested language, falling back to English and then to
 * whatever scalar values the row already carries.
 */
export function localizeRestaurant(
  rec: RestaurantRecommendation,
  lang: SiteLanguage,
): RestaurantRecommendation {
  // A TikTok search link is derived from the (language-neutral) name + city, so
  // it's rebuilt on every read rather than stored.
  const socialUrl =
    rec.socialUrl ??
    `https://www.tiktok.com/search?q=${encodeURIComponent(`${rec.name} ${rec.city}`)}`;

  const loc = rec.translations?.[lang] ?? rec.translations?.en ?? null;
  if (!loc) return { ...rec, socialUrl };
  return {
    ...rec,
    description: loc.description ?? rec.description ?? null,
    cuisineStyle: loc.cuisineStyle ?? rec.cuisineStyle ?? null,
    signatureDish: loc.signatureDish ?? rec.signatureDish ?? null,
    highlight: loc.highlight ?? rec.highlight ?? null,
    bookingUrgency: loc.bookingUrgency ?? rec.bookingUrgency ?? null,
    bookingLeadTime: loc.bookingLeadTime ?? rec.bookingLeadTime ?? null,
    socialUrl,
  };
}

/** Newest updated_at for a city's rows (ISO string), or null when none. */
export async function cityLastUpdated(sb: SupabaseClient, city: string): Promise<string | null> {
  const { data } = await sb
    .from(TABLE)
    .select('updated_at')
    .eq('city_normalized', normalizeCity(city))
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0]?.updated_at ?? null;
}

/** Read the best-scored recommendations for a city (public RLS read). */
export async function fetchRestaurantsForCity(
  sb: SupabaseClient,
  city: string,
  opts: { lang?: SiteLanguage; limit?: number } = {},
): Promise<RestaurantRecommendation[]> {
  const { lang = 'en', limit = 12 } = opts;
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('city_normalized', normalizeCity(city))
    .order('score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToRec).map((r) => localizeRestaurant(r, lang));
}

/**
 * Replace the recommendation bank for a city. The scout regenerates the whole
 * city list each run, so we delete the city's existing rows and insert the
 * fresh batch. This sidesteps ON CONFLICT on the partial unique indexes (which
 * Postgres can't match without the exact WHERE predicate) and guarantees the
 * bank always reflects the latest scout.
 *
 * Rows are de-duplicated within the batch: verified rows collapse on
 * google_place_id, unverified on normalized name.
 */
export async function upsertRestaurants(
  sb: SupabaseClient,
  recs: RestaurantRecommendation[],
): Promise<number> {
  if (recs.length === 0) return 0;

  const city = recs[0].city;
  const cityNorm = normalizeCity(city);

  // De-dupe within the batch so the unique indexes never trip on insert.
  const seen = new Set<string>();
  const rows = recs
    .map(recToRow)
    .filter((r) => {
      const key = r.google_place_id
        ? `place:${r.google_place_id}`
        : `name:${r.name_normalized}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Replace the city's bank atomically enough for our purposes (60s scout
  // cooldown makes concurrent writes for the same city very unlikely).
  await sb.from(TABLE).delete().eq('city_normalized', cityNorm);

  const { error, count } = await sb
    .from(TABLE)
    .insert(rows, { count: 'exact' });

  if (error) {
    console.warn('[restaurantBank] insert failed:', error.message);
    return 0;
  }
  return count ?? rows.length;
}
