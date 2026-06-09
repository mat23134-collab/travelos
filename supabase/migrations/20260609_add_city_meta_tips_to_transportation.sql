-- Add per-city packing_tips and local_tips cache columns to transportation table.
-- These are populated after the first AI generation for a city and injected
-- verbatim on subsequent generations, skipping that part of the AI output.

ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS packing_tips jsonb,
  ADD COLUMN IF NOT EXISTS local_tips   jsonb;

COMMENT ON COLUMN public.transportation.packing_tips IS
  'Cached AI-generated packing tips for this city (string[]). Injected verbatim on subsequent generations to skip AI output for this section.';
COMMENT ON COLUMN public.transportation.local_tips IS
  'Cached AI-generated local tips for this city (string[]). Injected verbatim on subsequent generations to skip AI output for this section.';
