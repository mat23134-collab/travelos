/**
 * bookAheadRanker — request-time, per-trip ranking of the book-ahead panel
 * (§4 allocation, §6.3 personal fit, §6.4 MMR diversity, §6.5 GeoFit, §7 filter,
 * §8 slot hint). Pure and synchronous: it takes the city bank + a compact trip
 * context and returns the 4–8 picks to show, each annotated with fitReasons, a
 * "book by" date, a suggested day, and a reservation platform.
 *
 * Nothing here is stored — composite_score (user-independent) is precomputed at
 * scout time; this layer only multiplies cheap personal-fit terms on top and
 * re-orders. Kept out of any route/component so it can be unit-tested directly.
 */

import { BudgetLevel, RestaurantRecommendation, SiteLanguage } from '@/lib/types';
import { GROUP_TAGS, GroupType } from '@/services/assembler/taxonomy';
import { haversineKm, LatLng } from '@/services/assembler/geo';
import { genreFit } from '@/lib/restaurantGenre';
import { effectiveBookAheadLevel } from '@/lib/restaurantScoring';
import { routeReservation } from '@/lib/platformRouter';

export interface TripDayGeo {
  neighborhoodSlug?: string | null;
  centroid?: LatLng | null;
}

export interface RankContext {
  budget?: BudgetLevel | null;
  groupType?: string | null;
  /** Stated dietary restrictions (normalized lowercase tokens). */
  dietary?: string[];
  /** Trip culinary interests / focus tokens (drive GenreFit). */
  culinaryTags?: string[];
  /** Per-day geography for GeoFit + suggestedDay. */
  days?: TripDayGeo[];
  /** Number of trip nights — caps hero-tier picks (§4). */
  nights?: number;
  /** Trip start date (ISO YYYY-MM-DD) — powers the "book by" date. */
  startDate?: string | null;
  /** Traveler opted into pricier picks (lifts the budget-target nudge). */
  splurge?: boolean;
  /**
   * The max price level the traveler is currently browsing (1–4), from the
   * panel's price-range selector. When set ABOVE their budget's everyday
   * target, it becomes the new BudgetFit anchor — so "one level up" actually
   * surfaces that tier's picks — and relaxes the hero cap so a deliberate
   * luxury browse isn't clamped to a couple of picks.
   */
  viewMaxLevel?: number;
  lang?: SiteLanguage;
  /** Max picks to return (default 8). */
  limit?: number;
}

/** The "everyday target" price level per tier — the anchor for BudgetFit (§4.2). */
const BUDGET_TARGET_LEVEL: Record<BudgetLevel, number> = {
  budget: 2,
  'mid-range': 3,
  luxury: 3,
};
/** The hero-slot ceiling per tier (§4.1) — used to flag/prefer a splurge pick. */
const HERO_CEILING: Record<BudgetLevel, number> = {
  budget: 3,
  'mid-range': 3,
  luxury: 4,
};

const GEO_NEAR_KM = 2.5;
const MMR_LAMBDA = 0.75;
const MMR_POOL = 25;

// ── Fit terms ──────────────────────────────────────────────────────────────

function budgetFit(priceLevel: number | null | undefined, target: number): number {
  if (priceLevel == null) return 0.6; // unknown ≠ excluded (matches withinBudget())
  const d = Math.abs(priceLevel - target);
  if (d === 0) return 1.0;
  if (d === 1) return 0.7;
  return 0.3;
}

function groupFit(r: RestaurantRecommendation, groupType?: string | null): number {
  const gt = (groupType ?? '').toLowerCase() as GroupType;
  const want = GROUP_TAGS[gt];
  const have = r.groupSuitability ?? [];
  if (!want || have.length === 0) return 0.7; // unknown → neutral, no penalty
  return want.some((t) => have.includes(t)) ? 1.0 : 0.4;
}

function geoFit(
  r: RestaurantRecommendation,
  days: TripDayGeo[] | undefined,
): { fit: number; suggestedDay: number | null } {
  if (!days || days.length === 0) return { fit: 1.0, suggestedDay: null };

  // Exact neighborhood match wins.
  if (r.neighborhoodSlug) {
    const idx = days.findIndex((d) => d.neighborhoodSlug && d.neighborhoodSlug === r.neighborhoodSlug);
    if (idx >= 0) return { fit: 1.0, suggestedDay: idx };
  }

  // Else nearest day centroid by haversine.
  if (r.latitude != null && r.longitude != null) {
    const here: LatLng = { lat: r.latitude, lng: r.longitude };
    let bestIdx = -1;
    let bestKm = Infinity;
    days.forEach((d, i) => {
      if (!d.centroid) return;
      const km = haversineKm(here, d.centroid);
      if (km < bestKm) { bestKm = km; bestIdx = i; }
    });
    if (bestIdx >= 0 && bestKm <= GEO_NEAR_KM) return { fit: 0.85, suggestedDay: bestIdx };
    if (bestIdx >= 0) return { fit: 0.6, suggestedDay: bestIdx };
  }
  return { fit: 0.6, suggestedDay: null };
}

/**
 * DietaryGate (§6.3): a hard 0 only for a CLEAR conflict — a stated vegetarian/
 * vegan restriction against a meat/fish-centric place that carries no
 * veg-friendly tag. Everything else passes (1): we never had reliable signal to
 * exclude on, and a false 0 empties the panel. Deliberately conservative.
 */
const MEAT_CENTRIC_GENRES = new Set(['steak-grill', 'seafood', 'omakase-counter']);
function dietaryGate(r: RestaurantRecommendation, dietary: string[] | undefined): boolean {
  if (!dietary || dietary.length === 0) return true;

  // Kosher (Israeli calibration): when the trip states a kosher need, exclude
  // places we KNOW are non-kosher (kosherStatus 'none'); keep certified,
  // kosher-style, and unknown (null) — a "kosher-style" default, conservative
  // so sparse/unlabelled banks aren't emptied. (Strict certified-only awaits a
  // structured profile toggle.)
  const wantsKosher = dietary.some((d) => /kosher|כשר/.test(d));
  if (wantsKosher && r.kosherStatus === 'none') return false;

  const wantsVeg = dietary.some((d) => /vegetarian|vegan|plant|צמחוני|טבעוני/.test(d));
  if (!wantsVeg) return true;
  const tags = r.dietaryTags ?? [];
  const vegFriendly =
    tags.some((t) => /vegetarian|vegan|plant/.test(t)) ||
    r.vegetarianFriendly === true ||
    r.veganFriendly === true ||
    r.cuisineGenre === 'vegetarian-vegan';
  if (vegFriendly) return true;
  // No veg signal AND a clearly meat/fish-centric concept → conflict.
  return !MEAT_CENTRIC_GENRES.has(r.cuisineGenre ?? '');
}

// ── fitReasons (localized) ───────────────────────────────────────────────────

const REASONS: Record<SiteLanguage, {
  taste: string; group: string; budget: string; near: (d: number) => string; hero: string; value: string;
}> = {
  en: {
    taste: 'Matches your food taste',
    group: 'Great for your group',
    budget: 'Fits your budget',
    near: (d) => `Near your Day ${d} area`,
    hero: 'Worth-the-splurge pick',
    value: 'Great value for money',
  },
  he: {
    taste: 'מתאים לטעם הקולינרי שלכם',
    group: 'מושלם להרכב שלכם',
    budget: 'מתאים לתקציב שלכם',
    near: (d) => `ליד אזור יום ${d}`,
    hero: 'שווה את הפינוק',
    value: 'תמורה מצוינת למחיר',
  },
};

/** Value score above which a pick earns the "great value" fit reason. */
const HIGH_VALUE_THRESHOLD = 0.7;

// ── Ranking ──────────────────────────────────────────────────────────────────

interface Scored {
  rec: RestaurantRecommendation;
  personal: number;
  suggestedDay: number | null;
  fitReasons: string[];
  isHero: boolean;
}

/** Bounded book-ahead-only panel filter (§7), with an empty-guard fallback. */
function filterBookAhead(restaurants: RestaurantRecommendation[]): RestaurantRecommendation[] {
  const kept = restaurants.filter((r) => effectiveBookAheadLevel(r) >= 1);
  return kept.length >= 3 ? kept : restaurants;
}

function bookByDate(startDate: string | null | undefined, leadDays: number | null | undefined): string | null {
  if (!startDate || leadDays == null || leadDays <= 0) return null;
  const start = new Date(`${startDate.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(start.getTime())) return null;
  const by = new Date(start.getTime() - leadDays * 86_400_000);
  return by.toISOString().slice(0, 10);
}

export function rankBookAhead(
  restaurants: RestaurantRecommendation[],
  ctx: RankContext,
): RestaurantRecommendation[] {
  const lang = ctx.lang ?? 'en';
  const limit = ctx.limit ?? 8;
  const budget = ctx.budget ?? null;
  const budgetTarget = budget ? BUDGET_TARGET_LEVEL[budget] : 3;
  // When the traveler browses a level above their budget, that level becomes
  // the BudgetFit anchor so its picks actually rise to the top (otherwise the
  // budget tier always dominates and "one level up" shows nothing new).
  const browsingUp = ctx.viewMaxLevel != null && ctx.viewMaxLevel > budgetTarget;
  const target = browsingUp ? ctx.viewMaxLevel! : budgetTarget;
  const heroCeiling = budget ? HERO_CEILING[budget] : 4;
  const r = REASONS[lang];

  const pool = filterBookAhead(restaurants);

  // Score every candidate with the multiplicative personal-fit model (§6.3).
  const scored: Scored[] = [];
  for (const rec of pool) {
    if (!dietaryGate(rec, ctx.dietary)) continue; // hard gate

    const gf = genreFit(ctx.culinaryTags ?? [], [rec.cuisineGenre ?? '', ...(rec.cuisineStyle ? [rec.cuisineStyle] : [])]);
    const grp = groupFit(rec, ctx.groupType);
    const bf = budgetFit(rec.priceLevel, target);
    const { fit: geo, suggestedDay } = geoFit(rec, ctx.days);
    const base = rec.compositeScore ?? rec.score ?? 0;

    const personal =
      base *
      (0.5 + 0.5 * gf) *
      (0.6 + 0.4 * grp) *
      (0.5 + 0.5 * bf) *
      geo;

    const isHero = (rec.priceLevel ?? 0) >= Math.min(heroCeiling, 4) && (rec.priceLevel ?? 0) >= 3;

    const fitReasons: string[] = [];
    // Value leads for this audience — surface it first when it's genuinely high.
    if ((rec.valueScore ?? 0) >= HIGH_VALUE_THRESHOLD) fitReasons.push(r.value);
    if (gf >= 0.5 && (ctx.culinaryTags?.length ?? 0) > 0) fitReasons.push(r.taste);
    if (grp >= 1.0) fitReasons.push(r.group);
    if (bf >= 0.7) fitReasons.push(r.budget);
    if (suggestedDay != null && geo >= 0.85) fitReasons.push(r.near(suggestedDay + 1));
    if (isHero) fitReasons.push(r.hero);

    scored.push({ rec, personal, suggestedDay, fitReasons, isHero });
  }

  scored.sort((a, b) => b.personal - a.personal);

  // Diversity re-rank via MMR over the top pool (§6.4), capping hero-tier picks
  // so the panel is a barbell, not all-splurge (§4). A deliberate browse above
  // budget lifts the cap — the traveler asked to see that pricier tier.
  const heroCap = browsingUp ? limit : Math.max(1, Math.min(3, Math.ceil((ctx.nights ?? 3) / 3)));
  const selected = mmrSelect(scored.slice(0, MMR_POOL), limit, heroCap);

  // Annotate the chosen picks with platform, book-by, suggested day, reasons.
  return selected.map(({ rec, suggestedDay, fitReasons }) => ({
    ...rec,
    suggestedDay,
    fitReasons,
    bookByDate: bookByDate(ctx.startDate, rec.bookAheadDays),
    platform: routeReservation(
      {
        name: rec.name,
        city: rec.city,
        countryCode: rec.countryCode,
        cuisineGenre: rec.cuisineGenre,
        reservationUrl: rec.reservationUrl,
        websiteUrl: rec.websiteUrl,
        googlePlaceId: rec.googlePlaceId,
        bookingPlatform: rec.bookingPlatform,
      },
      lang,
    ),
  }));
}

/** Similarity for MMR (§6.4): genre dominates, then neighborhood, then price. */
function similarity(a: RestaurantRecommendation, b: RestaurantRecommendation): number {
  let s = 0;
  if (a.cuisineGenre && a.cuisineGenre === b.cuisineGenre) s += 0.6;
  if (a.neighborhoodSlug && a.neighborhoodSlug === b.neighborhoodSlug) s += 0.25;
  if (a.priceLevel != null && a.priceLevel === b.priceLevel) s += 0.15;
  return s;
}

function mmrSelect(candidates: Scored[], limit: number, heroCap: number): Scored[] {
  if (candidates.length === 0) return [];

  const selected: Scored[] = [];
  const remaining = [...candidates];
  const maxPersonal = Math.max(...candidates.map((c) => c.personal), 1e-9);
  let heroCount = 0;

  while (selected.length < limit && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      // Skip a hero pick once we've hit the cap (unless nothing else is left).
      if (cand.isHero && heroCount >= heroCap && remaining.some((c) => !c.isHero && !selected.includes(c))) {
        continue;
      }
      const relevance = cand.personal / maxPersonal;
      const maxSim = selected.length
        ? Math.max(...selected.map((s) => similarity(cand.rec, s.rec)))
        : 0;
      const mmr = MMR_LAMBDA * relevance - (1 - MMR_LAMBDA) * maxSim;
      if (mmr > bestScore) { bestScore = mmr; bestIdx = i; }
    }
    const [chosen] = remaining.splice(bestIdx, 1);
    if (chosen.isHero) heroCount++;
    selected.push(chosen);
  }
  return selected;
}
