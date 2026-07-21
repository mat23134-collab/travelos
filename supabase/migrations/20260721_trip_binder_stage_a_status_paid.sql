-- ─────────────────────────────────────────────────────────────────────────────
-- Trip Binder — Stage A: richer stop status + per-stop paid amount.
--
--   • New status value 'cancelled' ("לא יצא לפועל" / didn't happen in the end)
--     on both trip_item_notes and trip_budget_items, so a stop or a budget line
--     can be marked as dropped without deleting it.
--   • Per-stop paid amount on trip_item_notes: when a stop is marked 'paid' the
--     traveler records how much, which the Binder folds into the budget's ACTUAL
--     total (per currency). paid_currency defaults to ILS like the budget.
--
-- Expand step: widening a CHECK (DROP + re-ADD with a superset) is backward-
-- compatible — every existing row still satisfies it — and the two new columns
-- are nullable, so this is purely additive. No backfill needed. Verify = new
-- value accepted + columns present, before shipping the code that uses them.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.trip_item_notes drop constraint if exists trip_item_notes_status_check;
alter table public.trip_item_notes add constraint trip_item_notes_status_check
  check (status in ('planned','booked','paid','confirmed','cancelled'));

alter table public.trip_item_notes add column if not exists paid_amount numeric(12,2);
alter table public.trip_item_notes add column if not exists paid_currency text not null default 'ILS';

alter table public.trip_budget_items drop constraint if exists trip_budget_items_status_check;
alter table public.trip_budget_items add constraint trip_budget_items_status_check
  check (status in ('planned','booked','paid','cancelled'));
