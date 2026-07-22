-- ─────────────────────────────────────────────────────────────────────────────
-- Trip soft-delete — "Delete this trip" on the dashboard only hides it from the
-- traveler; the row (and every Binder/budget/note table hanging off it) stays
-- fully intact for support/admin access. Nothing else references this trip's
-- data by identity in a way that would break, so no cascade concerns.
--
--   • itineraries.archived_at — null (default) = visible; a timestamp = hidden
--     from the dashboard's "My Trips" and "Shared with you" lists as of that
--     moment. A dedicated column (not overloading the existing `status`, which
--     already means something else — generation state, currently always
--     'done') keeps this unambiguous and independently queryable/reversible.
--
-- Expand step: a single nullable column, purely additive, no backfill needed
-- (every existing trip correctly starts non-archived = visible, unchanged
-- behavior). Verify = column present, every existing row still null, before
-- shipping the code that filters on it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.itineraries add column if not exists archived_at timestamptz;
