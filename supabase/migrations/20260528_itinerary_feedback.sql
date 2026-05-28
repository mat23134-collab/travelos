-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-28 — Itinerary feedback survey.
--
-- Captures the 5-question micro-survey shown on the results page ~45s after
-- the user lands. All fields are nullable so a partial submission still saves.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.itinerary_feedback (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id    uuid,
  user_id         uuid,
  -- Q1: search accuracy (1-5 stars)
  search_accuracy   smallint CHECK (search_accuracy   BETWEEN 1 AND 5),
  -- Q2: itinerary readability (1-5 stars)
  readability       smallint CHECK (readability       BETWEEN 1 AND 5),
  -- Q3: did recommendations help — 'yes' | 'partial' | 'no'
  recommendations_helpful text CHECK (recommendations_helpful IN ('yes','partial','no')),
  -- Q4: wait time perception — 'fast' | 'fair' | 'slow'
  wait_time         text CHECK (wait_time IN ('fast','fair','slow')),
  -- Q5: free-text "what was missing" (optional)
  missing_feedback  text,
  destination       text,
  user_agent        text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS itinerary_feedback_itinerary_idx ON public.itinerary_feedback (itinerary_id);
CREATE INDEX IF NOT EXISTS itinerary_feedback_created_idx   ON public.itinerary_feedback (created_at DESC);

-- RLS: writes happen through the service-role API route, so enable RLS with no
-- public policies (service role bypasses it). This keeps the table private.
ALTER TABLE public.itinerary_feedback ENABLE ROW LEVEL SECURITY;
