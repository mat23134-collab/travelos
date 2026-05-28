-- 2026-05-28 (c) — Allow anonymous + logged-in users to INSERT feedback.
-- SELECT stays blocked (no SELECT policy) so users can't read others' rows;
-- only the service role / feedback_report view (admin) can read.
DROP POLICY IF EXISTS "anyone can submit feedback" ON public.itinerary_feedback;
CREATE POLICY "anyone can submit feedback"
  ON public.itinerary_feedback
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
