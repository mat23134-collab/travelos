/**
 * placeQuality.ts — value-for-money + quality + tourist-trap calibration for the
 * everyday itinerary inventory (the `places` table), mirroring what the
 * book-ahead engine does for the reservation bank.
 *
 * The old meal picker used raw google_rating and optimized purely for proximity
 * to the day's centre — which quietly FAVORS the central, landmark-adjacent,
 * often-overpriced spots. This adds three signals, all null-safe:
 *
 *   • quality  — Bayesian-shrunk rating when a review count is available (so a
 *                4.9★/40-reviews can't beat a 4.6★/4,000); raw rating otherwise.
 *   • value    — quality relative to price_tier ("worth it" > "impressive").
 *   • trap     — a ≤1 penalty for a pricey, only-okay place sitting on top of a
 *                major sight.
 *
 * Pure and dependency-free so it can be unit-tested and shared by both the
 * deterministic assembler and the LLM inventory scorer.
 */

const BAYES_C = 250;
const DEFAULT_MEAN = 4.1;

export interface QualityInput {
  googleRating?: number | null;
  /** Google user_ratings_total — enables Bayesian shrinkage; null = raw rating. */
  ratingCount?: number | null;
  /** 1 (cheap) … 4 (luxury); null = unknown. */
  priceTier?: number | null;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Bayesian-shrunk rating when a review count is known; otherwise the raw rating
 * (so behavior is unchanged for rows without a count). Falls back to the city
 * mean prior when there's no rating at all.
 */
export function placeBayesRating(input: QualityInput, cityMean = DEFAULT_MEAN): number {
  const R = input.googleRating ?? cityMean;
  const n = input.ratingCount;
  if (n == null || n <= 0) return R; // no count → trust the raw rating as-is
  return (BAYES_C * cityMean + n * R) / (BAYES_C + n);
}

/** Normalized 0..1 quality from the (Bayesian or raw) rating. */
export function placeQuality(input: QualityInput, cityMean = DEFAULT_MEAN): number {
  return clamp01((placeBayesRating(input, cityMean) - 3.5) / 1.3);
}

/** How hard price weighs against quality (tunable). */
export const VALUE_PRICE_SENSITIVITY = 0.5;

function priceNorm(priceTier: number | null | undefined): number {
  if (priceTier == null) return 0.5;
  return clamp01((priceTier - 1) / 3);
}

/**
 * Value-for-money, 0..1. Cheap-and-great tops out; expensive-and-mediocre sinks;
 * unknown price lands neutral. Same shape as the book-ahead engine's value term.
 */
export function placeValueScore(input: QualityInput, cityMean = DEFAULT_MEAN): number {
  const q = placeQuality(input, cityMean);
  return clamp01(q - VALUE_PRICE_SENSITIVITY * priceNorm(input.priceTier) + VALUE_PRICE_SENSITIVITY / 2);
}

/** A place is "on a landmark" within this many metres of a major sight. */
export const NEAR_SIGHT_M = 200;
export const TRAP_BAYES_THRESHOLD = 4.2;
export const TRAP_PENALTY = 0.7;

/**
 * Tourist-trap penalty multiplier (≤1). Fires only on a clear signal: a place
 * within ~200m of a major sight that is priced ≥3 yet rates below 4.2. Unknown
 * distance or price never penalizes.
 */
export function placeTouristTrapPenalty(
  input: QualityInput,
  nearestSightMetres: number | null | undefined,
  cityMean = DEFAULT_MEAN,
): number {
  if (nearestSightMetres == null || nearestSightMetres > NEAR_SIGHT_M) return 1;
  if ((input.priceTier ?? 0) < 3) return 1;
  if (placeBayesRating(input, cityMean) >= TRAP_BAYES_THRESHOLD) return 1;
  return TRAP_PENALTY;
}

/**
 * A single 0..1 "goodness" for a meal venue: half quality, half value, times the
 * tourist-trap penalty. Higher = a better everyday pick before proximity.
 */
export function placeGoodness(
  input: QualityInput,
  nearestSightMetres: number | null | undefined,
  cityMean = DEFAULT_MEAN,
): number {
  const base = 0.5 * placeQuality(input, cityMean) + 0.5 * placeValueScore(input, cityMean);
  return base * placeTouristTrapPenalty(input, nearestSightMetres, cityMean);
}
