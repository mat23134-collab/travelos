-- ─────────────────────────────────────────────────────────────────────────────
-- Attraction Engines — Engine A refine: explicit book-ahead level + lead time.
--
-- attractionScoutAgent already curates ONLY "booking genuinely critical"
-- attractions, but the UI could only show a vague sentence. Mirrors the
-- restaurant engine's bookAheadLevel/bookingLeadTime pattern so the UI can show
-- a concrete "Book ~2 weeks ahead" chip instead.
--
--   • book_ahead_level  — 0–3, same scale as restaurants (0 = walk-in/no
--     reservation needed [attractions at this level shouldn't be in this
--     engine's bank at all — kept for consistency/future-proofing, not
--     expected in practice given the strict curation], 3 = book 1–3 months
--     out or lottery).
--   • booking_lead_time — the qualitative phrase the scout's Gemini prompt
--     already knows how to produce for restaurants, e.g. "2–3 weeks ahead".
--
-- Expand step: two nullable columns, purely additive, no backfill needed
-- (existing rows will simply lack the new fields until re-scouted, same
-- graceful-degradation posture as every other optional field on this table —
-- the UI chip only renders when the value is present). Verify = columns
-- present before shipping the scout/API code that populates and reads them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.attraction_recommendations add column if not exists book_ahead_level smallint;
alter table public.attraction_recommendations add column if not exists booking_lead_time text;
