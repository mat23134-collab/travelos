-- ─────────────────────────────────────────────────────────────────────────────
-- Restaurant recommendations — Israeli-calibration signals
--
-- Adds the columns the value-for-money + tourist-trap + dietary calibration
-- needs. All nullable / additive: existing rows keep working, the read path
-- treats null as "unknown/neutral" (never an exclusion), and the scout + a
-- SQL backfill populate them (Expand → Backfill → Verify → Contract).
--
--   • kosher_status        — graduated: 'certified' | 'kosher-style' | 'none'
--   • vegetarian_friendly  — scannable dietary badge
--   • vegan_friendly
--   • near_landmark        — within ~200m of a major attraction (tourist-trap input)
--   • landmark_distance_m  — meters to the nearest major attraction
--   • last_review_at       — most-recent Google review time (recency signal)
--   • value_score          — precomputed price-to-quality (value-for-money), 0..1
--   • tourist_trap_penalty — precomputed penalty multiplier applied (1.0 = none)
--   • hebrew_social_url    — Israeli-community / Hebrew-source link when found
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.restaurant_recommendations
  add column if not exists kosher_status        text,
  add column if not exists vegetarian_friendly  boolean,
  add column if not exists vegan_friendly        boolean,
  add column if not exists near_landmark         boolean,
  add column if not exists landmark_distance_m   integer,
  add column if not exists last_review_at        timestamptz,
  add column if not exists value_score           numeric(4,3),
  add column if not exists tourist_trap_penalty  numeric(4,3),
  add column if not exists hebrew_social_url      text;
