-- -----------------------------------------------------------------------------
-- 2026-05-27 (e) - Micro-segmentation tags for personalized recommendations.
--
-- Adds non-breaking text-array columns to venue tables. Existing rows receive
-- empty arrays, and future rows default to empty arrays as well.
--
-- This migration is intentionally conditional: `places` exists in the current
-- repo migrations, while `restaurants` may exist only in some deployed DBs.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.places') IS NOT NULL THEN
    ALTER TABLE public.places
      ADD COLUMN IF NOT EXISTS vibe text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS group_suitability text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS culinary_focus text[] NOT NULL DEFAULT '{}'::text[];

    COMMENT ON COLUMN public.places.vibe IS
      'Micro-segmentation vibe tags, e.g. quiet-luxury, trendy, energetic, dim-lit.';
    COMMENT ON COLUMN public.places.group_suitability IS
      'Traveler/group-fit tags, e.g. co-founders, romantic-couple, solo, groups.';
    COMMENT ON COLUMN public.places.culinary_focus IS
      'Food/dining focus tags, e.g. tasting-menu, street-food, fine-dining.';
  END IF;

  IF to_regclass('public.restaurants') IS NOT NULL THEN
    ALTER TABLE public.restaurants
      ADD COLUMN IF NOT EXISTS vibe text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS group_suitability text[] NOT NULL DEFAULT '{}'::text[],
      ADD COLUMN IF NOT EXISTS culinary_focus text[] NOT NULL DEFAULT '{}'::text[];

    COMMENT ON COLUMN public.restaurants.vibe IS
      'Micro-segmentation vibe tags, e.g. quiet-luxury, trendy, energetic, dim-lit.';
    COMMENT ON COLUMN public.restaurants.group_suitability IS
      'Traveler/group-fit tags, e.g. co-founders, romantic-couple, solo, groups.';
    COMMENT ON COLUMN public.restaurants.culinary_focus IS
      'Food/dining focus tags, e.g. tasting-menu, street-food, fine-dining.';
  END IF;
END $$;
