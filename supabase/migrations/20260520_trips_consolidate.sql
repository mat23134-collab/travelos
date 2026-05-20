-- ============================================================
--  trips — full consolidation (safe to re-run / idempotent)
--  Run this once in Supabase SQL Editor.
--  Fixes: duplicate indexes, partial-index upsert failure,
--         missing columns, missing RLS policies.
-- ============================================================

-- ── 1. Ensure every column the code writes exists ─────────────────────────────

alter table public.trips
  add column if not exists user_id       uuid        references auth.users (id) on delete set null,
  add column if not exists itinerary_id  uuid        references public.itineraries (id) on delete cascade,
  add column if not exists city_name     text,
  add column if not exists username      text,
  add column if not exists start_date    date,
  add column if not exists end_date      date,
  add column if not exists updated_at    timestamptz not null default now();

-- created_at should already exist; guard anyway
alter table public.trips
  add column if not exists created_at timestamptz not null default now();

-- ── 2. Drop ALL partial / duplicate unique indexes on itinerary_id ────────────
--    (previous migrations left behind a mix of partial indexes and constraints)

drop index if exists public.trips_itinerary_id_key;   -- partial index from 20260514 + 20260517

-- ── 3. Add a full UNIQUE CONSTRAINT (PostgREST onConflict requires this) ──────
--    If it already exists this is a no-op.

do $$
begin
  if not exists (
    select 1
    from   pg_constraint
    where  conrelid = 'public.trips'::regclass
    and    contype  = 'u'
    and    conname  = 'trips_itinerary_id_key'
  ) then
    alter table public.trips
      add constraint trips_itinerary_id_key unique (itinerary_id);
  end if;
end $$;

-- ── 4. Recreate composite + city lookup indexes cleanly ───────────────────────

drop index if exists public.trips_user_created_idx;
create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

drop index if exists public.trips_city_name_idx;
create index if not exists trips_city_name_idx
  on public.trips (lower(trim(city_name)))
  where city_name is not null;

-- ── 5. RLS ────────────────────────────────────────────────────────────────────

alter table public.trips enable row level security;

do $$
begin
  -- SELECT: own rows only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
    and   policyname = 'trips_select_own'
  ) then
    create policy trips_select_own on public.trips
      for select using (auth.uid() = user_id);
  end if;

  -- INSERT: anyone (service role bypasses RLS, anon/auth users may insert own rows)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
    and   policyname = 'trips_insert_any'
  ) then
    create policy trips_insert_any on public.trips
      for insert with check (true);
  end if;

  -- UPDATE: own rows only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
    and   policyname = 'trips_update_own'
  ) then
    create policy trips_update_own on public.trips
      for update using (auth.uid() = user_id);
  end if;

  -- DELETE: own rows only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips'
    and   policyname = 'trips_delete_own'
  ) then
    create policy trips_delete_own on public.trips
      for delete using (auth.uid() = user_id);
  end if;
end $$;

-- ── 6. Remove duplicate rows (keep newest per itinerary_id) ──────────────────
--    Runs only if there are actual duplicates.

delete from public.trips t1
using  public.trips t2
where  t1.itinerary_id = t2.itinerary_id
  and  t1.created_at   < t2.created_at  -- keep the newer row
  and  t1.itinerary_id is not null;

-- ── 7. Comments ───────────────────────────────────────────────────────────────

comment on table public.trips is
  'One row per generated itinerary — links user + itinerary + city. '
  'Used for analytics, transport-intel lookups, and shared-trip username display.';

comment on column public.trips.itinerary_id is
  'FK to public.itineraries — UNIQUE CONSTRAINT (not partial index) so PostgREST upsert works.';
comment on column public.trips.city_name    is
  'Canonical destination city for transport-intel cache lookups.';
comment on column public.trips.username     is
  'Snapshot of profile username at trip creation time (denormalized for public share pages).';
comment on column public.trips.start_date   is 'Trip start date from traveler profile.';
comment on column public.trips.end_date     is 'Trip end date from traveler profile.';
comment on column public.trips.updated_at   is 'Last write timestamp (set explicitly by app code).';
