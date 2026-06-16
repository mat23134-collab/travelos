-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-15 (b) — Free rules backfill for the assembler (ADR-001).
--
-- Zero API / zero LLM cost. Derives classification purely from the existing
-- `category` value, so it is safe to re-run and cheap to apply.
--
-- Scope of this pass:
--   meal_slots        — restaurant → {lunch,dinner}; cafe → {breakfast,brunch,lunch}.
--   group_suitability — sensible category defaults, ONLY for rows that are still
--                       empty (the scout's richer per-venue tags are preserved).
--
-- NOT in this pass (require an external source — handled separately, not free):
--   price_tier        — from Google Places `price_level` (already integrated).
--   opening_hours     — from Google Places opening hours. Never guessed: fake
--                       hours would let the assembler schedule closed venues.
--
-- Vocabulary note: group_suitability keeps the scout's existing tokens
-- (solo | romantic-couple | couples | groups | friends | families | kids |
-- parent-child | mixed-ages | remote-work). The assembler maps the app's
-- groupType onto a tolerant SET of these at query time, e.g.
--   couple → {couple,couples,romantic-couple}
--   family → {family,families,kids,parent-child,mixed-ages}
--   group  → {group,groups,friends,mixed-ages}
--   solo   → {solo,remote-work}
-- so mixed tokens across rows resolve correctly without a destructive rewrite.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) meal_slots for food venues (only where still empty).
UPDATE public.places SET meal_slots = CASE lower(category)
    WHEN 'restaurant' THEN '{lunch,dinner}'::text[]
    WHEN 'cafe'       THEN '{breakfast,brunch,lunch}'::text[]
  END
WHERE lower(category) IN ('restaurant','cafe')
  AND (meal_slots IS NULL OR array_length(meal_slots,1) IS NULL);

-- 2) group_suitability defaults for empty rows only (hotels intentionally skipped).
UPDATE public.places SET group_suitability = CASE lower(category)
    WHEN 'restaurant'   THEN '{solo,romantic-couple,groups,families,friends}'::text[]
    WHEN 'cafe'         THEN '{solo,romantic-couple,groups,families,friends,remote-work}'::text[]
    WHEN 'bar'          THEN '{solo,romantic-couple,groups,friends}'::text[]
    WHEN 'nightlife'    THEN '{romantic-couple,groups,friends}'::text[]
    WHEN 'attraction'   THEN '{solo,romantic-couple,groups,families,kids,friends}'::text[]
    WHEN 'tourism_site' THEN '{solo,romantic-couple,groups,families,kids,friends}'::text[]
    WHEN 'market'       THEN '{solo,romantic-couple,groups,families,friends}'::text[]
    WHEN 'nature'       THEN '{solo,romantic-couple,groups,families,friends}'::text[]
    WHEN 'shopping'     THEN '{solo,romantic-couple,groups,friends}'::text[]
  END
WHERE (group_suitability IS NULL OR array_length(group_suitability,1) IS NULL)
  AND lower(category) IN ('restaurant','cafe','bar','nightlife','attraction','tourism_site','market','nature','shopping');
