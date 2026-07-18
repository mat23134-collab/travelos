-- ─────────────────────────────────────────────────────────────────────────────
-- places.rating_count — Google user_ratings_total for the everyday inventory.
--
-- The book-ahead bank already stores rating_count (for Bayesian-shrunk quality).
-- The everyday itinerary picker (assembler + LLM inventory scoring) reads from
-- `places` and only had raw google_rating, so a 4.9★/40-reviews could outrank a
-- 4.6★/4,000. Adding review count lets the everyday path use the same Bayesian
-- shrinkage. Nullable/additive: quality falls back to the raw rating when null.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.places
  add column if not exists rating_count integer;
