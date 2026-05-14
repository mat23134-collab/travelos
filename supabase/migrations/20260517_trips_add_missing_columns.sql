-- Fix trips table: add columns that the code writes but may be missing
-- from projects where the table was created manually with only id/created_at/user_id/username.
--
-- Safe to re-run — all statements use IF NOT EXISTS or DO-$$ guards.

-- ── Core columns the generate route needs ────────────────────────────────────

-- Link to the itinerary (required for upsert conflict key)
alter table public.trips
  add column if not exists itinerary_id uuid
    references public.itineraries (id) on delete cascade;

-- City name (used for transport intel lookups)
alter table public.trips
  add column if not exists city_name text;

-- Trip dates (written from profile.startDate / endDate)
alter table public.trips
  add column if not exists start_date date;

alter table public.trips
  add column if not exists end_date date;

-- Housekeeping timestamp
alter table public.trips
  add column if not exists updated_at timestamptz not null default now();

-- ── Unique index on itinerary_id (enables upsert onConflict: 'itinerary_id') ─
create unique index if not exists trips_itinerary_id_key
  on public.trips (itinerary_id)
  where itinerary_id is not null;

-- ── Composite lookup index ─────────────────────────────────────────────────
create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

create index if not exists trips_city_name_idx
  on public.trips (lower(trim(city_name)))
  where city_name is not null;

-- ── RLS policies (service role bypasses these, but add for completeness) ─────
alter table public.trips enable row level security;

do $$
begin
  -- Anyone (service role) can insert/upsert
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips' and policyname = 'trips_insert_any'
  ) then
    create policy trips_insert_any
      on public.trips
      for insert
      with check (true);
  end if;

  -- Owner can update
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips' and policyname = 'trips_update_own'
  ) then
    create policy trips_update_own
      on public.trips
      for update
      using (auth.uid() = user_id);
  end if;

  -- SELECT: own trips only (already existed — guard against duplicate)
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'trips' and policyname = 'trips_select_own'
  ) then
    create policy trips_select_own
      on public.trips
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

comment on table public.trips is
  'One row per generated itinerary — links user + itinerary + city. Used for analytics and transport-intel lookups.';
comment on column public.trips.itinerary_id is 'FK to public.itineraries — upsert conflict key.';
comment on column public.trips.city_name    is 'Canonical destination city for transport-intel cache lookups.';
comment on column public.trips.username     is 'Snapshot of profile username at trip creation time.';
