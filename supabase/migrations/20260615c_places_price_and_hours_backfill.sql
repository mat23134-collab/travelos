-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-15 (c) — Free backfill for price_tier + opening_hours (ADR-001).
--
-- Zero API / zero LLM cost. Completes the assembler columns for every non-hotel
-- venue so the deterministic builder has full data to work with.
--
--   price_tier    — category baseline, refined for FOOD venues only via keyword
--                   signals in description/vibe_label/culinary_focus:
--                     food + (michelin|haute|tasting menu)        → 4
--                     food + (luxury|fine dining|upscale|gourmet|
--                             elegant|refined|high-end|chic)      → 3
--                     food + (budget|cheap|street food|…)         → 1
--                     else category baseline (cafe/market/nature 1,
--                             nightlife 3, everything else 2)
--                   Non-food venues use the category baseline only — prose words
--                   like "fine dining" were over-tagging cafés/markets as luxury.
--
--   opening_hours — category-default weekly hours, tagged "source":"default".
--                   These are APPROXIMATE placeholders so the assembler is
--                   unblocked; they are NOT real per-venue hours. A later Google
--                   Places pass should overwrite source=default rows with real
--                   hours and set "source":"verified" (the 5 Rome demo rows are
--                   already verified). The assembler should treat source=default
--                   hours softly (deprioritise, don't hard-exclude) until then.
--
-- Idempotent: opening_hours only fills NULLs; price_tier re-derives the
-- source=default rows and leaves verified rows untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- opening_hours: category-default weekly hours (only where still NULL).
UPDATE public.places SET opening_hours =
  jsonb_build_object('mon',h.v,'tue',h.v,'wed',h.v,'thu',h.v,'fri',h.v,'sat',h.v,'sun',h.v,'source','default')
FROM (VALUES
  ('restaurant',  '[["12:00","15:00"],["19:00","23:00"]]'::jsonb),
  ('cafe',        '[["07:30","19:00"]]'::jsonb),
  ('bar',         '[["17:00","01:00"]]'::jsonb),
  ('nightlife',   '[["22:00","03:00"]]'::jsonb),
  ('attraction',  '[["09:00","18:00"]]'::jsonb),
  ('tourism_site','[["09:00","18:00"]]'::jsonb),
  ('market',      '[["08:00","14:00"]]'::jsonb),
  ('nature',      '[["00:00","23:59"]]'::jsonb),
  ('shopping',    '[["10:00","20:00"]]'::jsonb)
) AS h(cat, v)
WHERE lower(public.places.category) = h.cat
  AND public.places.opening_hours IS NULL;

-- price_tier: food-aware keyword tiers + category baseline (source=default rows).
UPDATE public.places SET price_tier = CASE
  WHEN lower(category) IN ('restaurant','cafe','bar','nightlife')
    AND (coalesce(description,'')||' '||coalesce(vibe_label,'')||' '||coalesce(array_to_string(culinary_focus,' '),''))
        ~* '(michelin|haute|tasting menu|michelin[ -]?star)' THEN 4
  WHEN lower(category) IN ('restaurant','cafe','bar','nightlife')
    AND (coalesce(description,'')||' '||coalesce(vibe_label,'')||' '||coalesce(array_to_string(culinary_focus,' '),''))
        ~* '(luxury|fine[ -]?dining|upscale|gourmet|elegant|refined|high[ -]?end|sophisticated|chic)' THEN 3
  WHEN lower(category) IN ('restaurant','cafe','bar','nightlife')
    AND (coalesce(description,'')||' '||coalesce(vibe_label,'')||' '||coalesce(array_to_string(culinary_focus,' '),''))
        ~* '(budget|cheap|street[ -]?food|affordable|no[ -]?frills|hole[ -]?in[ -]?the[ -]?wall|inexpensive)' THEN 1
  ELSE CASE lower(category)
    WHEN 'cafe' THEN 1
    WHEN 'market' THEN 1
    WHEN 'nature' THEN 1
    WHEN 'nightlife' THEN 3
    ELSE 2
  END
END
WHERE opening_hours->>'source' = 'default' AND lower(category) <> 'hotel';
