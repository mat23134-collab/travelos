-- Fix: partial unique index on itinerary_id breaks PostgREST upsert onConflict.
-- PostgREST generates  ON CONFLICT (itinerary_id) DO UPDATE  (no WHERE clause),
-- but a partial index requires the predicate — so every upsert fails silently.
-- Solution: drop the partial index, add a full UNIQUE CONSTRAINT instead.

-- 1. Drop the broken partial index
drop index if exists public.trips_itinerary_id_key;

-- 2. Add a real unique constraint (PostgREST onConflict works reliably with these)
alter table public.trips
  drop constraint if exists trips_itinerary_id_key;

alter table public.trips
  add constraint trips_itinerary_id_key unique (itinerary_id);
