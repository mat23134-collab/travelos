/**
 * restaurantScoring — the user-independent composite base score (§6.1–6.2).
 *
 * Replaces the naive `rating + log10(count) + verified + bookable` scorer. Two
 * ideas do the heavy lifting:
 *
 *   1. Bayesian-shrunk rating (§6.1) — a raw 4.9★ from 40 reviews should not
 *      outrank a 4.6★ from 4,000. We pull each rating toward the city mean by an
 *      amount that shrinks as the review count grows.
 *   2. A weighted blend (§6.2) of quality, popularity, verification, bookability
 *      and book-ahead relevance — the last term is why THIS panel exists: a
 *      superb walk-in counter belongs in the itinerary's meal slots, not here.
 *
 * Everything here is pure and synchronous so it can be unit-tested and run at
 * scout time (stored in composite_score / bayes_rating).
 */

import { RestaurantRecommendation } from '@/lib/types';
import { GENRE_BOOK_AHEAD_PRIOR, isRestaurantGenre } from '@/lib/restaurantGenre';

/** Confidence constant: below ~250 reviews the city prior dominates (§6.1). */
export const BAYES_C = 250;
/** Fallback city-mean rating when we can't compute one from the batch. */
export const DEFAULT_CITY_MEAN = 4.1;

/** Mean Google rating across a batch of rated restaurants (the §6.1 prior `m`). */
export function cityMeanRating(recs: RestaurantRecommendation[]): number {
  const rated = recs.filter((r) => typeof r.rating === 'number' && (r.ratingCount ?? 0) > 0);
  if (rated.length === 0) return DEFAULT_CITY_MEAN;
  const sum = rated.reduce((acc, r) => acc + (r.rating as number), 0);
  return sum / rated.length;
}

/** Bayesian-shrunk rating for one restaurant (§6.1). */
export function bayesRating(
  rating: number | null | undefined,
  ratingCount: number | null | undefined,
  cityMean = DEFAULT_CITY_MEAN,
): number {
  const n = ratingCount ?? 0;
  const R = rating ?? cityMean;
  return (BAYES_C * cityMean + n * R) / (BAYES_C + n);
}

/**
 * A restaurant's effective book-ahead level: the model's per-venue value when
 * present, else the genre prior, else a neutral 1. Keeps the A-term meaningful
 * for older rows the scout tagged before book_ahead_level existed.
 */
export function effectiveBookAheadLevel(r: RestaurantRecommendation): number {
  if (typeof r.bookAheadLevel === 'number') return Math.max(0, Math.min(3, r.bookAheadLevel));
  if (isRestaurantGenre(r.cuisineGenre)) return GENRE_BOOK_AHEAD_PRIOR[r.cuisineGenre];
  return 1;
}

/**
 * Composite base score (§6.2), 0..1. Deliberately stored so per-request ranking
 * only has to layer cheap personal-fit multipliers on top.
 *
 *   0.40·Q  Bayesian quality (normalized)
 * + 0.15·P  popularity      (log10 review count, capped)
 * + 0.15·V  verification    (has a google_place_id)
 * + 0.15·B  bookability     (reservation link > website > none)
 * + 0.15·A  book-ahead relevance (why the panel exists)
 */
export function computeCompositeScore(
  r: RestaurantRecommendation,
  cityMean = DEFAULT_CITY_MEAN,
): number {
  const bayes = bayesRating(r.rating, r.ratingCount, cityMean);
  const Q = clamp01((bayes - 3.5) / 1.3);
  const n = r.ratingCount ?? 0;
  const P = n > 0 ? Math.min(1, Math.log10(n) / 4) : 0;
  const V = r.googlePlaceId ? 1 : 0;
  const B = r.reservationUrl ? 1 : r.websiteUrl ? 0.6 : 0;
  const A = effectiveBookAheadLevel(r) / 3;
  return round3(0.4 * Q + 0.15 * P + 0.15 * V + 0.15 * B + 0.15 * A);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
function round3(x: number): number {
  return Number(x.toFixed(3));
}
