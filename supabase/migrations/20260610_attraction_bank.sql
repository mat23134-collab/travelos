-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-10 — Attractions Bank
--
-- Holds unscheduled places for a trip: a mix of AI-curated top picks (pulled
-- from public.places.top_pick_category for the trip's destination) and
-- places the user added manually. Items live here until the user schedules
-- them into a day slot (at which point they're removed from the bank and
-- written into itinerary_items via /api/swap).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attraction_bank (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id      uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  category_emoji    text,
  lat               double precision,
  lng               double precision,
  photo_url         text,
  website_url       text,
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  top_pick_category text CHECK (top_pick_category IS NULL OR top_pick_category IN ('sightseeing', 'history', 'food')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attraction_bank_itinerary_idx
  ON public.attraction_bank (itinerary_id, created_at);

ALTER TABLE public.attraction_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attraction_bank_select_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_select_own" ON public.attraction_bank
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attraction_bank_insert_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_insert_own" ON public.attraction_bank
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attraction_bank_delete_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_delete_own" ON public.attraction_bank
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.attraction_bank IS
  'Unscheduled places for a trip — AI top-picks plus user-added manual places. Removed when scheduled into itinerary_items.';
COMMENT ON COLUMN public.attraction_bank.source IS
  'ai = pulled from places.top_pick_category; manual = user-added via the bank input.';
