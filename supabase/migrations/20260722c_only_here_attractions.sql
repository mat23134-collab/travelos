-- ─────────────────────────────────────────────────────────────────────────────
-- Attraction Engines — Engine C: "Only Here" hidden gems (the delight layer).
--
-- Same reuse rationale as Engine B: attraction_recommendations already carries
-- the shared city-bank shape (name, description, neighborhood, lat/lng,
-- place_id, rating, photo, translations, score) and the read/RLS/upsert-replace
-- pattern; only_here needs a few extra fields on top, not a new table.
--
--   • engine CHECK widened to include 'only_here'.
--   • why_only_here  — the specific local tie that makes this NOT replicable
--     in a generic big city (the core of the anti-generic guardrail).
--   • hook_line      — the "why you didn't know you wanted this" UI hook.
--   • how_to_do_it    — practical instructions (where/when/how to actually do it).
--   • group_suitability — text[] (solo/couple/family/group), same shape as
--     restaurant_recommendations.group_suitability, feeding the personalization
--     filter (a hidden gem that clashes with a family trip shouldn't top the list).
--
-- Expand step: widening a CHECK (DROP + re-ADD with a superset) is backward-
-- compatible — every existing row (all 'book_ahead' or 'walk_in') still
-- satisfies it. Four new nullable/array columns, no backfill needed. Verify =
-- new engine value accepted + columns present, before shipping scout/API/UI code.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.attraction_recommendations drop constraint if exists attraction_recommendations_engine_check;
alter table public.attraction_recommendations add constraint attraction_recommendations_engine_check
  check (engine in ('book_ahead', 'walk_in', 'only_here'));

alter table public.attraction_recommendations add column if not exists why_only_here text;
alter table public.attraction_recommendations add column if not exists hook_line text;
alter table public.attraction_recommendations add column if not exists how_to_do_it text;
alter table public.attraction_recommendations add column if not exists group_suitability text[];
