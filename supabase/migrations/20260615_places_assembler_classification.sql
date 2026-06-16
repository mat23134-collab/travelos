-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-15 — Assembler classification columns for places (ADR-001).
--
-- Supports the deterministic, zero-LLM trip assembler. The assembler filters
-- and slots venues from public.places without an LLM call for well-covered
-- cities; these columns give it the data it needs.
--
-- All additive and nullable/defaulted so existing rows survive untouched.
--   price_tier    — relative price 1–4 (Google price_level aligned), budget filtering.
--   meal_slots    — which meal slots a food venue suits (slot-type matching).
--   opening_hours — structured weekly hours so the algorithm can respect the
--                   actual trip dates / day-of-week.
--
-- group_suitability already exists (text[]); the backfill standardizes its
-- vocabulary to include kids | couples | solo | groups. No schema change for it
-- here — only a GIN index for fast suitability filtering.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.places') IS NOT NULL THEN
    ALTER TABLE public.places
      ADD COLUMN IF NOT EXISTS price_tier    smallint
        CHECK (price_tier IS NULL OR price_tier BETWEEN 1 AND 4),
      ADD COLUMN IF NOT EXISTS meal_slots    text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS opening_hours jsonb;

    -- Fast array-contains filtering by meal slot and by suitability tag.
    CREATE INDEX IF NOT EXISTS places_meal_slots_gin
      ON public.places USING gin (meal_slots);
    CREATE INDEX IF NOT EXISTS places_group_suitability_gin
      ON public.places USING gin (group_suitability);

    -- Budget-range filtering.
    CREATE INDEX IF NOT EXISTS places_price_tier_idx
      ON public.places (price_tier);

    COMMENT ON COLUMN public.places.price_tier IS
      'Relative price 1-4 (1=budget … 4=luxury), aligned with Google price_level. NULL = unknown.';
    COMMENT ON COLUMN public.places.meal_slots IS
      'Meal slots a food venue suits: breakfast | brunch | lunch | dinner. Empty for non-food venues.';
    COMMENT ON COLUMN public.places.opening_hours IS
      'Structured weekly hours JSON, e.g. {"mon":[["09:00","18:00"]],"tue":[],...}. [] = closed that day. Source: Google Places; re-verified by the janitor pass.';
  END IF;
END $$;
