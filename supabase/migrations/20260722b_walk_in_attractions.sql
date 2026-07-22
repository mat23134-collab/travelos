-- ─────────────────────────────────────────────────────────────────────────────
-- Attraction Engines — Engine B: Walk-In attractions.
--
-- Reuses attraction_recommendations rather than a dedicated table: the two
-- engines share ~90% of the same shape (city bank, name, description,
-- neighborhood, lat/lng, google_place_id, rating, photo, translations, score,
-- source) and the identical read-path/RLS/upsert-replace pattern already built
-- for Engine A. A dedicated table would duplicate all of that for the sake of
-- three walk-in-specific fields. `engine` tags which scout produced a row so
-- reads can filter cleanly with zero overlap between engines.
--
--   • engine            — 'book_ahead' | 'walk_in'. NOT NULL DEFAULT
--     'book_ahead' backfills every existing row (all Engine A output) in the
--     same statement — Postgres applies a constant default to existing rows
--     without a separate backfill pass.
--   • best_time_of_day  — walk-in places live or die on timing, e.g. "Before
--     10am to beat the crowds" (book-ahead attractions don't need this — a
--     timed-entry slot IS the timing).
--   • time_needed        — rough duration, e.g. "30–45 min".
--   • is_free            — true = free entry, false = pay-at-door, null =
--     unknown (book-ahead rows leave this null; they're priced via
--     price_range/ticket_url instead).
--
-- Expand + Backfill in one statement (constant DEFAULT), Contract N/A (no
-- column removal here). Verify = engine present + every existing row reads
-- 'book_ahead', before shipping the walk-in scout/API/UI code.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.attraction_recommendations
  add column if not exists engine text not null default 'book_ahead'
    check (engine in ('book_ahead', 'walk_in'));

alter table public.attraction_recommendations add column if not exists best_time_of_day text;
alter table public.attraction_recommendations add column if not exists time_needed text;
alter table public.attraction_recommendations add column if not exists is_free boolean;

-- Old (city_normalized, score) index is superseded by an engine-scoped one —
-- every read path filters by engine now.
drop index if exists attraction_recommendations_city_score_idx;
create index if not exists attraction_recommendations_city_engine_score_idx
  on public.attraction_recommendations (city_normalized, engine, score desc);
