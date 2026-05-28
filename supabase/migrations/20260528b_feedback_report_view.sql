-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-28 (b) — Human-readable feedback report view.
--
-- Joins itinerary_feedback to profiles (username / full name), auth.users
-- (email), and itineraries (destination context) so a single SELECT shows
-- WHO gave feedback and exactly WHAT they said.
--
-- Anonymous submissions (user_id NULL) still appear, with user columns null.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.feedback_report AS
SELECT
  f.id                       AS feedback_id,
  f.created_at               AS submitted_at,
  -- Who
  f.user_id,
  p.username,
  p.full_name,
  u.email,
  CASE WHEN f.user_id IS NULL THEN 'anonymous' ELSE 'registered' END AS user_kind,
  -- Context
  f.destination,
  f.itinerary_id,
  -- Answers
  f.search_accuracy,
  f.readability,
  f.recommendations_helpful,
  f.wait_time,
  f.missing_feedback,
  f.user_agent
FROM public.itinerary_feedback f
LEFT JOIN public.profiles p ON p.id = f.user_id
LEFT JOIN auth.users     u ON u.id = f.user_id
ORDER BY f.created_at DESC;

COMMENT ON VIEW public.feedback_report IS
  'Readable join of itinerary_feedback with the submitting user (profiles + auth.users) and itinerary destination. Query from the SQL editor / admin context only.';

-- The view exposes user emails — keep it off the public PostgREST API.
-- Only the service role and SQL-editor (admin) context may read it.
REVOKE ALL ON public.feedback_report FROM anon, authenticated;
