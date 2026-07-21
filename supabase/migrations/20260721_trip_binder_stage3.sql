-- ─────────────────────────────────────────────────────────────────────────────
-- Trip Binder — Stage 3: trip budget line items (planned vs. actual).
--
-- One table that turns the Binder into a budget tracker, so a traveler can see
-- planned-vs-actual spend per category instead of keeping a separate spreadsheet.
--
--   • trip_budget_items — one editable money line per trip. Optionally tied to a
--     specific stop (item_id) the same way notes/docs are, but usually trip-level
--     (flights, accommodation) with item_id null. Amounts are stored as numeric
--     minor-unit-safe decimals; currency defaults to ILS (₪) — the app's home
--     currency — but is per-row so a mixed-currency trip is representable.
--
-- Mirrors Stage 1/2 exactly:
--   • item_id is a plain uuid (the value embedded in the itinerary JSON), NOT a
--     FK to itinerary_items — swaps/regeneration must not cascade-delete a
--     traveler's own budget lines. Only itinerary_id is FK'd (ON DELETE CASCADE).
--   • status is text+CHECK, not a pg enum, to match the codebase style.
--   • Access is server-side only via the service-role client, gated on ownership
--     in the API route (authorizeTripOwnership). RLS is ENABLED with NO policies
--     — the browser can never touch this directly; the service role bypasses RLS.
--
-- Expand step (Expand→Backfill→Verify→Contract): purely additive, a new table
-- with no dependents. No backfill needed (no existing budget data to migrate);
-- Verify = table exists, RLS on, 0 policies, before any schema-dependent code
-- ships.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.trip_budget_items (
  id            uuid primary key default gen_random_uuid(),
  itinerary_id  uuid not null references public.itineraries(id) on delete cascade,
  item_id       uuid,                       -- null = trip-level line (flights, hotel…)
  user_id       uuid not null,              -- owner (= itineraries.user_id at insert)
  label         text not null,              -- "Flights TLV→NRT", "Hotel — 4 nights"…
  category      text not null default 'other'
                check (category in ('flights','accommodation','food','transport','activities','shopping','other')),
  planned_cost  numeric(12,2),              -- estimate; null = not yet estimated
  actual_cost   numeric(12,2),              -- what was actually paid; null = unpaid/unknown
  currency      text not null default 'ILS',
  paid_by       text,                       -- free text: who fronted it (split trips)
  status        text not null default 'planned'
                check (status in ('planned','booked','paid')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists trip_budget_items_itinerary_idx
  on public.trip_budget_items (itinerary_id);
create index if not exists trip_budget_items_item_idx
  on public.trip_budget_items (itinerary_id, item_id);

alter table public.trip_budget_items enable row level security;
