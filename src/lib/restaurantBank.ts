/**
 * restaurantBank — data-access helpers for `public.restaurant_recommendations`.
 *
 * Keeps the row ⇄ RestaurantRecommendation mapping (snake_case ⇄ camelCase) in
 * one place so the GET/scout routes stay thin. Mirrors tripTransport.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { BudgetLevel, RestaurantRecommendation, SiteLanguage } from '@/lib/types';

const TABLE = 'restaurant_recommendations';

/**
 * Trip budget → the highest Google price_level (1 cheap – 4 very expensive) we'll
 * surface BY DEFAULT. A traveler who picked "budget" or "mid-range" shouldn't have
 * their book-ahead panel dominated by ¥20,000+/pp tasting menus — those are an
 * opt-in ("show splurge picks too"), not the default.
 */
export const MAX_PRICE_LEVEL_BY_BUDGET: Record<BudgetLevel, number> = {
  'budget':    2,
  'mid-range': 3,
  'luxury':    4,
};

/**
 * Hard ceiling on how many restaurants a single city's bank can ever hold.
 * The book-ahead panel is a curated shortlist ("a few dozen tops"), not a
 * directory — and additive top-up runs (§ never delete existing rows) had no
 * upper bound before this, so repeated refreshes over time could grow a
 * city's bank without limit. When a write would exceed it, the
 * highest-scoring candidates win the remaining room.
 */
export const MAX_RESTAURANTS_PER_CITY = 30;

/**
 * ILS (Israeli shekel) per-person price tiers — the panel's 4 price-ladder
 * tabs are anchored to these bands, not Google's coarse 1-4 price_level scale
 * (which doesn't correlate cleanly with actual cost — a ¥1,000 ramen bowl and
 * a genuinely mid-range dinner can share the same price_level). Upper bound is
 * exclusive of the ceiling below it: cheap ≤50, mid (50,150], premium
 * (150,350], luxury (350,600].
 */
export const ILS_TIER_BOUNDS = [50, 150, 350, 600] as const;

/**
 * Anything estimated above the top tier is excluded from the book-ahead bank
 * entirely for now (explicit product decision) — not merely deprioritized.
 */
export const ILS_PRICE_CEILING = ILS_TIER_BOUNDS[ILS_TIER_BOUNDS.length - 1];

/** Which of the 4 ILS tiers (1=cheap..4=luxury) a per-person price falls into,
 *  or null when unknown or above the ceiling (shouldn't happen post-filter,
 *  but callers reading older rows should treat it as "unknown tier" too). */
export function ilsTier(pricePerPersonIls: number | null | undefined): number | null {
  if (pricePerPersonIls == null) return null;
  const idx = ILS_TIER_BOUNDS.findIndex((bound) => pricePerPersonIls <= bound);
  return idx === -1 ? null : idx + 1;
}

/** Rows with no price_level yet (older/unverified scouts) are never filtered out
 *  by budget — we only exclude what we KNOW is above the traveler's tier. */
function withinBudget(r: RestaurantRecommendation, maxPriceLevel: number): boolean {
  return r.priceLevel == null || r.priceLevel <= maxPriceLevel;
}

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/**
 * Normalize a neighborhood name into a stable slug used to join a restaurant to
 * an itinerary day's neighborhood (GeoFit, §6.5). Lower-cases, strips accents
 * and punctuation, collapses whitespace to single hyphens. Returns null for
 * empty input so callers can treat "no neighborhood" as unknown, not "".
 */
export function normalizeNeighborhoodSlug(name: string | null | undefined): string | null {
  if (!name) return null;
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')      // strip Latin diacritics
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿]+/g, '-') // keep latin + Hebrew, else hyphen
    .replace(/^-+|-+$/g, '');
  return slug || null;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Map a DB row to a RestaurantRecommendation. Exported for the backfill scripts. */
export function rowToRec(row: any): RestaurantRecommendation {
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
    pricePerPersonIls: row.price_per_person_ils != null ? Number(row.price_per_person_ils) : null,
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
    cuisineGenre: row.cuisine_genre ?? null,
    mealSlots: row.meal_slots ?? null,
    bookAheadLevel: row.book_ahead_level ?? null,
    bookAheadDays: row.book_ahead_days ?? null,
    dietaryTags: row.dietary_tags ?? null,
    groupSuitability: row.group_suitability ?? null,
    neighborhoodSlug: row.neighborhood_slug ?? null,
    countryCode: row.country_code ?? null,
    bayesRating: row.bayes_rating != null ? Number(row.bayes_rating) : null,
    compositeScore: row.composite_score != null ? Number(row.composite_score) : null,
    lastVerifiedAt: row.last_verified_at ?? null,
    kosherStatus: row.kosher_status ?? null,
    vegetarianFriendly: row.vegetarian_friendly ?? null,
    veganFriendly: row.vegan_friendly ?? null,
    nearLandmark: row.near_landmark ?? null,
    landmarkDistanceM: row.landmark_distance_m ?? null,
    lastReviewAt: row.last_review_at ?? null,
    valueScore: row.value_score != null ? Number(row.value_score) : null,
    touristTrapPenalty: row.tourist_trap_penalty != null ? Number(row.tourist_trap_penalty) : null,
    hebrewSocialUrl: row.hebrew_social_url ?? null,
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
    price_per_person_ils: rec.pricePerPersonIls ?? null,
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
    cuisine_genre: rec.cuisineGenre ?? null,
    meal_slots: rec.mealSlots ?? null,
    book_ahead_level: rec.bookAheadLevel ?? null,
    book_ahead_days: rec.bookAheadDays ?? null,
    dietary_tags: rec.dietaryTags ?? null,
    group_suitability: rec.groupSuitability ?? null,
    neighborhood_slug: rec.neighborhoodSlug ?? null,
    country_code: rec.countryCode ?? null,
    bayes_rating: rec.bayesRating ?? null,
    composite_score: rec.compositeScore ?? null,
    last_verified_at: rec.lastVerifiedAt ?? null,
    kosher_status: rec.kosherStatus ?? null,
    vegetarian_friendly: rec.vegetarianFriendly ?? null,
    vegan_friendly: rec.veganFriendly ?? null,
    near_landmark: rec.nearLandmark ?? null,
    landmark_distance_m: rec.landmarkDistanceM ?? null,
    last_review_at: rec.lastReviewAt ?? null,
    value_score: rec.valueScore ?? null,
    tourist_trap_penalty: rec.touristTrapPenalty ?? null,
    hebrew_social_url: rec.hebrewSocialUrl ?? null,
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

/**
 * How many of a city's rows are actually within the traveler's budget vs. the
 * bank's total size. Cheap count-only queries (no row data pulled) so the GET
 * route can decide whether the bank needs a real top-up — e.g. a city whose
 * first scout skewed luxury (like Tokyo's initial 8 rows, 7 of which were
 * price_level 3–4) will keep failing travelers on a budget/mid-range trip
 * every time, no matter how `fetchRestaurantsForCity`'s backfill is tuned,
 * until more genuinely affordable rows exist.
 */
export async function cityBudgetStats(
  sb: SupabaseClient,
  city: string,
  maxPriceLevel: number,
): Promise<{ total: number; inBudget: number }> {
  const cityNorm = normalizeCity(city);
  const [totalRes, inBudgetRes] = await Promise.all([
    sb.from(TABLE).select('id', { count: 'exact', head: true }).eq('city_normalized', cityNorm),
    sb
      .from(TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('city_normalized', cityNorm)
      .or(`price_level.is.null,price_level.lte.${maxPriceLevel}`),
  ]);
  return { total: totalRes.count ?? 0, inBudget: inBudgetRes.count ?? 0 };
}

/**
 * Read the best-scored recommendations for a city (public RLS read).
 *
 * When `maxPriceLevel` is given, in-budget rows (price_level <= max, or unknown)
 * are returned FIRST, still ordered by score. If too few in-budget rows exist —
 * common right after this filter shipped, since older scouts skewed splurge-only
 * — we backfill with the next-best above-budget rows so the panel isn't sparse,
 * appended AFTER the in-budget ones rather than mixed in by score alone.
 */
export async function fetchRestaurantsForCity(
  sb: SupabaseClient,
  city: string,
  opts: { lang?: SiteLanguage; limit?: number; maxPriceLevel?: number } = {},
): Promise<RestaurantRecommendation[]> {
  const { lang = 'en', limit = 12, maxPriceLevel } = opts;

  // Pull a wider pool than `limit` when budget-filtering so partitioning still
  // has enough in-budget candidates to fill the panel from.
  const fetchLimit = maxPriceLevel != null ? Math.max(limit * 2, 24) : limit;
  const cityNorm = normalizeCity(city);

  // Order by the new composite_score (nulls last for un-rescouted rows), then
  // fall back to the legacy `score` so mixed old/new banks still sort sensibly.
  // The request-time ranker re-orders this pool by personal fit anyway.
  let { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('city_normalized', cityNorm)
    .order('composite_score', { ascending: false, nullsFirst: false })
    .order('score', { ascending: false })
    .limit(fetchLimit);

  // Resilience during the deploy window BEFORE the composite_score migration is
  // applied: that column won't exist yet, so the ordered query errors. Fall back
  // to the legacy score ordering so the panel never goes dark mid-rollout.
  if (error) {
    ({ data, error } = await sb
      .from(TABLE)
      .select('*')
      .eq('city_normalized', cityNorm)
      .order('score', { ascending: false })
      .limit(fetchLimit));
  }

  if (error || !data) return [];
  const all = data.map(rowToRec);

  const ordered = maxPriceLevel == null
    ? all
    : [
        ...all.filter((r) => withinBudget(r, maxPriceLevel)),
        ...all.filter((r) => !withinBudget(r, maxPriceLevel)),
      ];

  return ordered.slice(0, limit).map((r) => localizeRestaurant(r, lang));
}

/**
 * Write a batch of recommendations for a city, in one of two modes:
 *
 *   'replace'  (default) — the scout regenerates the whole city list each run,
 *      so we delete the city's existing rows and insert the fresh batch. This
 *      sidesteps ON CONFLICT on the partial unique indexes (which Postgres
 *      can't match without the exact WHERE predicate) and guarantees the bank
 *      always reflects the latest scout.
 *
 *   'additive' — used by targeted top-up runs (e.g. adding budget-tier
 *      restaurants to a city whose bank already skews luxury) that must NEVER
 *      touch existing rows. Skips the delete entirely, and also skips any
 *      incoming row that already exists in the city's bank (by
 *      google_place_id when verified, else by normalized name) so re-running
 *      the same top-up never duplicates rows.
 *
 * Rows are always de-duplicated within the incoming batch first: verified
 * rows collapse on google_place_id, unverified on normalized name.
 */
export async function upsertRestaurants(
  sb: SupabaseClient,
  recs: RestaurantRecommendation[],
  opts: { mode?: 'replace' | 'additive' } = {},
): Promise<number> {
  if (recs.length === 0) return 0;
  const { mode = 'replace' } = opts;

  const city = recs[0].city;
  const cityNorm = normalizeCity(city);

  // De-dupe within the batch so the unique indexes never trip on insert.
  const seen = new Set<string>();
  let rows = recs
    .map(recToRow)
    .filter((r) => {
      const key = r.google_place_id
        ? `place:${r.google_place_id}`
        : `name:${r.name_normalized}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // Best candidates first, so the cap below (and any later truncation) keeps
  // the highest-scoring rows rather than an arbitrary prefix.
  rows.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (mode === 'replace') {
    // Replace the city's bank atomically enough for our purposes (60s scout
    // cooldown makes concurrent writes for the same city very unlikely).
    await sb.from(TABLE).delete().eq('city_normalized', cityNorm);
    rows = rows.slice(0, MAX_RESTAURANTS_PER_CITY);
  } else {
    // Additive: never delete. Drop any incoming row that already exists in
    // this city's bank so a re-run of the same top-up can't duplicate rows or
    // touch the existing (e.g. luxury) picks.
    const { data: existing, error: existingErr } = await sb
      .from(TABLE)
      .select('google_place_id, name_normalized')
      .eq('city_normalized', cityNorm);
    if (existingErr) {
      console.warn('[restaurantBank] additive existing-rows lookup failed:', existingErr.message);
      return 0;
    }
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const existingRows = (existing ?? []) as any[];
    const existingPlaceIds = new Set(existingRows.map((r) => r.google_place_id).filter(Boolean));
    const existingNames = new Set(existingRows.map((r) => r.name_normalized).filter(Boolean));
    rows = rows.filter((r) => {
      if (r.google_place_id) return !existingPlaceIds.has(r.google_place_id);
      return !existingNames.has(r.name_normalized);
    });
    // The bank is a curated shortlist, not a directory — a top-up can only
    // fill remaining room under the city-wide cap, best scores first.
    const room = MAX_RESTAURANTS_PER_CITY - existingRows.length;
    rows = room > 0 ? rows.slice(0, room) : [];
  }

  if (rows.length === 0) return 0;

  return insertResilient(sb, rows);
}

/**
 * Insert rows, self-healing around columns that don't exist in the DB yet — the
 * deploy ships ahead of its migration (schema changes are applied out-of-band,
 * not by the app). PostgREST reports a missing column by name (code PGRST204);
 * we strip that column from every row and retry, so a fresh scout still writes
 * its core fields during the window before a new migration lands. Mirrors the
 * read-path fallback in fetchRestaurantsForCity.
 */
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
async function insertResilient(sb: SupabaseClient, rows: any[]): Promise<number> {
  let attemptRows = rows;
  for (let attempt = 0; attempt < 12; attempt++) {
    const { error, count } = await sb.from(TABLE).insert(attemptRows, { count: 'exact' });
    if (!error) return count ?? attemptRows.length;

    // "Could not find the 'X' column of 'restaurant_recommendations' in the schema cache"
    const missing = /find the '([^']+)' column/i.exec(error.message)?.[1]
      ?? /column "([^"]+)" of relation/i.exec(error.message)?.[1];
    if (!missing || !(missing in attemptRows[0])) {
      console.warn('[restaurantBank] insert failed:', error.message);
      return 0;
    }
    console.warn(`[restaurantBank] column "${missing}" not in schema yet — retrying without it`);
    attemptRows = attemptRows.map((r) => {
      const { [missing]: _drop, ...rest } = r;
      return rest;
    });
  }
  console.warn('[restaurantBank] insert failed after stripping unknown columns');
  return 0;
}
