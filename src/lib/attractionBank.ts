/**
 * attractionBank — data-access helpers for `public.attraction_recommendations`.
 * Mirrors restaurantBank: snake_case ⇄ camelCase mapping, language resolution,
 * and a replace-city-then-insert write (partial-index-safe, always fresh).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AttractionRecommendation, SiteLanguage } from '@/lib/types';

const TABLE = 'attraction_recommendations';

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToRec(row: any): AttractionRecommendation {
  return {
    id: row.id,
    city: row.city,
    name: row.name,
    description: row.description,
    category: row.category,
    translations: row.translations ?? null,
    priceRange: row.price_range,
    neighborhood: row.neighborhood,
    ticketUrl: row.ticket_url,
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

function recToRow(rec: AttractionRecommendation) {
  return {
    city: rec.city,
    city_normalized: normalizeCity(rec.city),
    name: rec.name,
    name_normalized: normalizeName(rec.name),
    description: rec.description ?? null,
    category: rec.category ?? null,
    translations: rec.translations ?? null,
    price_range: rec.priceRange ?? null,
    neighborhood: rec.neighborhood ?? null,
    ticket_url: rec.ticketUrl ?? null,
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

/** Resolve localizable text to the requested language (English fallback). */
export function localizeAttraction(
  rec: AttractionRecommendation,
  lang: SiteLanguage,
): AttractionRecommendation {
  const loc = rec.translations?.[lang] ?? rec.translations?.en ?? null;
  if (!loc) return rec;
  return {
    ...rec,
    description: loc.description ?? rec.description ?? null,
    category: loc.category ?? rec.category ?? null,
    highlight: loc.highlight ?? rec.highlight ?? null,
    bookingUrgency: loc.bookingUrgency ?? rec.bookingUrgency ?? null,
    insiderTip: loc.insiderTip ?? rec.insiderTip ?? null,
  };
}

/** Read the best-scored attractions for a city (public RLS read). */
export async function fetchAttractionsForCity(
  sb: SupabaseClient,
  city: string,
  opts: { lang?: SiteLanguage; limit?: number } = {},
): Promise<AttractionRecommendation[]> {
  const { lang = 'en', limit = 12 } = opts;
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('city_normalized', normalizeCity(city))
    .order('score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToRec).map((r) => localizeAttraction(r, lang));
}

/** Replace the attraction bank for a city (delete city rows + insert fresh). */
export async function upsertAttractions(
  sb: SupabaseClient,
  recs: AttractionRecommendation[],
): Promise<number> {
  if (recs.length === 0) return 0;
  const cityNorm = normalizeCity(recs[0].city);

  const seen = new Set<string>();
  const rows = recs.map(recToRow).filter((r) => {
    const key = r.google_place_id ? `place:${r.google_place_id}` : `name:${r.name_normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await sb.from(TABLE).delete().eq('city_normalized', cityNorm);
  const { error, count } = await sb.from(TABLE).insert(rows, { count: 'exact' });
  if (error) {
    console.warn('[attractionBank] insert failed:', error.message);
    return 0;
  }
  return count ?? rows.length;
}
