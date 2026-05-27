-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-27 (b) — Fix the schema mismatches that were blocking 4 tables from
-- ever receiving data despite the RLS policies being in place.
--
-- Applied directly to the production DB via Supabase MCP (apply_migration)
-- on 2026-05-27 ~07:50 UTC. This file is the source-of-truth checkpoint.
-- ─────────────────────────────────────────────────────────────────────────────

-- Fix 1: transportation — code (tripTransport.ts) queries/upserts on `city_norm`,
-- but the column didn't exist. Add it as a generated column and unique-index it
-- so ON CONFLICT (city_norm) works.
ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS city_norm text
  GENERATED ALWAYS AS (lower(btrim(city_name))) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS transportation_city_norm_key
  ON public.transportation (city_norm);

-- Fix 2: hotel_anchors.session_key was NOT NULL with no default; the API code
-- never sets it (the column is a legacy from the onboarding flow). Drop the
-- constraint so recommended-hotel rows can land.
ALTER TABLE public.hotel_anchors
  ALTER COLUMN session_key SET DEFAULT '',
  ALTER COLUMN session_key DROP NOT NULL;

-- Fix 3: trips.start_date / trips.end_date were NOT NULL with no defaults. When
-- the user skips the date step, the API passes null and the insert dies with
-- 23502. Make them nullable — analytics/UI already handle null dates.
ALTER TABLE public.trips
  ALTER COLUMN start_date DROP NOT NULL,
  ALTER COLUMN end_date DROP NOT NULL;
