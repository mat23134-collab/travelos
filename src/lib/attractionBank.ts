/**
 * attractionBank — data-access helpers for `public.attraction_recommendations`.
 * Mirrors restaurantBank: snake_case ⇄ camelCase mapping, language resolution,
 * and a replace-city-then-insert write (partial-index-safe, always fresh).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AttractionEngine, AttractionRecommendation, SiteLanguage } from '@/lib/types';

const TABLE = 'attraction_recommendations';

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Engine B (walk-in) must never overlap Engine A (book-ahead) — mixing them
 * flattens the distinction the whole point of separate engines rests on.
 * Pure/deterministic so it's cheaply testable (see attractionEngines.test.ts):
 * matches by google_place_id when both sides have one (authoritative), else
 * falls back to normalized name.
 */
export function findEngineOverlap(
  a: AttractionRecommendation[],
  b: AttractionRecommendation[],
): AttractionRecommendation[] {
  const placeIds = new Set(a.map((r) => r.googlePlaceId).filter((id): id is string => !!id));
  const names = new Set(a.map((r) => normalizeName(r.name)));
  return b.filter((r) => (r.googlePlaceId && placeIds.has(r.googlePlaceId)) || names.has(normalizeName(r.name)));
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
    engine: row.engine,
    bookAheadLevel: row.book_ahead_level,
    bookingLeadTime: row.booking_lead_time,
    bestTimeOfDay: row.best_time_of_day,
    timeNeeded: row.time_needed,
    isFree: row.is_free,
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
    engine: rec.engine ?? 'book_ahead',
    book_ahead_level: rec.bookAheadLevel ?? null,
    booking_lead_time: rec.bookingLeadTime ?? null,
    best_time_of_day: rec.bestTimeOfDay ?? null,
    time_needed: rec.timeNeeded ?? null,
    is_free: rec.isFree ?? null,
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
    bookingLeadTime: loc.bookingLeadTime ?? rec.bookingLeadTime ?? null,
    bestTimeOfDay: loc.bestTimeOfDay ?? rec.bestTimeOfDay ?? null,
  };
}

/** Newest updated_at for a city's rows (ISO string), or null when none.
 *  Scoped by engine — Engine A/B refresh independently, so one going stale
 *  shouldn't be masked by the other's fresher timestamp. */
export async function cityLastUpdated(
  sb: SupabaseClient,
  city: string,
  engine: AttractionEngine = 'book_ahead',
): Promise<string | null> {
  const { data } = await sb
    .from(TABLE)
    .select('updated_at')
    .eq('city_normalized', normalizeCity(city))
    .eq('engine', engine)
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0]?.updated_at ?? null;
}

/** Read the best-scored attractions for a city (public RLS read), scoped to one engine. */
export async function fetchAttractionsForCity(
  sb: SupabaseClient,
  city: string,
  opts: { lang?: SiteLanguage; limit?: number; engine?: AttractionEngine } = {},
): Promise<AttractionRecommendation[]> {
  const { lang = 'en', limit = 12, engine = 'book_ahead' } = opts;
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('city_normalized', normalizeCity(city))
    .eq('engine', engine)
    .order('score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToRec).map((r) => localizeAttraction(r, lang));
}

/** Replace one engine's bank for a city (delete that city+engine's rows + insert
 *  fresh) — scoped by engine so re-scouting walk-in never touches book-ahead
 *  rows for the same city, and vice versa. */
export async function upsertAttractions(
  sb: SupabaseClient,
  recs: AttractionRecommendation[],
): Promise<number> {
  if (recs.length === 0) return 0;
  const cityNorm = normalizeCity(recs[0].city);
  const engine: AttractionEngine = recs[0].engine ?? 'book_ahead';

  const seen = new Set<string>();
  const rows = recs.map(recToRow).filter((r) => {
    const key = r.google_place_id ? `place:${r.google_place_id}` : `name:${r.name_normalized}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  await sb.from(TABLE).delete().eq('city_normalized', cityNorm).eq('engine', engine);
  const { error, count } = await sb.from(TABLE).insert(rows, { count: 'exact' });
  if (error) {
    console.warn('[attractionBank] insert failed:', error.message);
    return 0;
  }
  return count ?? rows.length;
}
