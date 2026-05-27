-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-27 (f) — Warm cache columns for places.
--
-- Step 5 of the architecture refactor turns every AI-generated venue into a
-- warm-cache row in `places`. To hold the Google-verified enrichment fields,
-- the places table needs four new columns. The micro-segmentation tag
-- columns from migration (e) are re-asserted here because (e) was never
-- applied to production (only b, c, d landed).
--
-- All columns are nullable / default-empty so existing rows survive untouched.
-- The restaurants table does not exist in this deployment, so we no-op it.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF to_regclass('public.places') IS NOT NULL THEN
    -- Micro-segmentation tags (was migration e — apply defensively).
    ALTER TABLE public.places
      ADD COLUMN IF NOT EXISTS vibe              text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS group_suitability text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS culinary_focus    text[] NOT NULL DEFAULT '{}'::text[];

    -- Google Places verification enrichment (step 5 of architecture refactor).
    ALTER TABLE public.places
      ADD COLUMN IF NOT EXISTS photo_url        text,
      ADD COLUMN IF NOT EXISTS website_url      text,
      ADD COLUMN IF NOT EXISTS google_place_id  text,
      ADD COLUMN IF NOT EXISTS google_rating    double precision;

    -- Unique index on (lower(name), lower(city)) so upserts dedupe correctly.
    CREATE UNIQUE INDEX IF NOT EXISTS places_name_city_norm_key
      ON public.places (lower(name), lower(city));

    COMMENT ON COLUMN public.places.photo_url IS
      'Google Places photo CDN URL (lh3.googleusercontent.com) populated post-LLM.';
    COMMENT ON COLUMN public.places.website_url IS
      'Official website surfaced by Google Places when AI returned null.';
    COMMENT ON COLUMN public.places.google_place_id IS
      'Google Places place_id — enables deep-link to Maps and future cache enrichment.';
    COMMENT ON COLUMN public.places.google_rating IS
      'Google Places aggregate rating (1–5) captured at verification time.';
  END IF;
END $$;
