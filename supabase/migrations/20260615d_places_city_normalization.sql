-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-15 (d) — City-name normalization (ADR-001 data hygiene).
--
-- The assembler selects inventory by city, so split casing / misspellings
-- fragment a city's inventory and halve the candidate pool. Found via audit:
--   vienna + Vienna + viena  → Vienna   (105 rows; 'viena' was a misspelling)
--   amsterdam + Amsterdam    → Amsterdam (54 rows)
--   berlin + Berlin          → Berlin    (44 rows)
--
-- Verified beforehand that no (lower(name), lower(city)) collisions exist, so the
-- merge cannot violate the places_name_city_norm_key unique index.
--
-- NOTE: ingestion (scout-agent) should normalize city casing on write to prevent
-- this recurring. Tracked as a follow-up.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.places SET city = 'Vienna'    WHERE lower(city) IN ('vienna','viena');
UPDATE public.places SET city = 'Amsterdam' WHERE lower(city) = 'amsterdam';
UPDATE public.places SET city = 'Berlin'    WHERE lower(city) = 'berlin';
