-- ─────────────────────────────────────────────────────────────────────────────
-- Book-Ahead Restaurant Engine — schema extensions
--
-- Adds the columns the smarter ranking pipeline needs (see the engine spec):
--   • cuisine_genre     — canonical genre key (fine-dining, omakase-counter, …)
--   • meal_slots        — which meals the place is for ({lunch,dinner})
--   • book_ahead_level  — 0..3 necessity of reserving ahead (0 walk-in, 3 lottery)
--   • book_ahead_days   — typical advance-booking lead time, in days
--   • dietary_tags      — vegetarian-friendly / kosher / halal / gluten-free …
--   • group_suitability — reuses the scoringEngine vocab (couple/family/group…)
--   • neighborhood_slug — normalized join key to itinerary day neighborhoods
--   • country_code      — ISO-2, drives §9 reservation-platform routing
--   • bayes_rating      — precomputed Bayesian-shrunk rating (§6.1)
--   • composite_score   — precomputed user-independent base score (§6.2)
--   • last_verified_at  — staleness control for the re-verification cron (§10)
--
-- All nullable / additive: existing rows keep working, the scout backfills the
-- new columns on its next run, and the read path treats null as "unknown" (never
-- an exclusion), matching the existing withinBudget()/price_level philosophy.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.restaurant_recommendations
  add column if not exists cuisine_genre      text,
  add column if not exists meal_slots         text[],
  add column if not exists book_ahead_level   smallint,
  add column if not exists book_ahead_days    smallint,
  add column if not exists dietary_tags       text[],
  add column if not exists group_suitability  text[],
  add column if not exists neighborhood_slug  text,
  add column if not exists country_code       text,
  add column if not exists bayes_rating       numeric(4,3),
  add column if not exists composite_score    numeric(6,3),
  add column if not exists last_verified_at   timestamptz;

-- Ranking read path filters/sorts by (city, genre, price) — see §5 diversity and
-- the budget ceiling. Complements the existing (city_normalized, score desc) idx.
create index if not exists rr_city_genre_price
  on public.restaurant_recommendations (city_normalized, cuisine_genre, price_level);

-- The re-verification cron (§10) scans the oldest-verified rows per active city.
create index if not exists rr_city_last_verified
  on public.restaurant_recommendations (city_normalized, last_verified_at);
