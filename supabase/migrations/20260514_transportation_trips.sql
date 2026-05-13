-- City-level transport intel (populated by transport scout when missing).
-- UI reads this by city_name; itineraries still carry optional cityTransport in JSON for offline fallback.

create table if not exists public.transportation (
  id uuid primary key default gen_random_uuid(),
  city_name text not null,
  city_norm text generated always as (lower(trim(city_name))) stored,
  guide jsonb not null default '{"options":[],"links":[]}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (city_norm)
);

comment on table public.transportation is 'Per-city mobility guide (JSON shape matches Itinerary.cityTransport / CityTransportGuide).';

alter table public.transportation enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'transportation' and policyname = 'transportation_select_public'
  ) then
    create policy transportation_select_public
      on public.transportation
      for select
      using (true);
  end if;
end
$$;

-- One row per generated itinerary / user session anchor (city denormalized for lookups).
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  itinerary_id uuid not null references public.itineraries (id) on delete cascade,
  city_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists trips_itinerary_id_key
  on public.trips (itinerary_id);

create index if not exists trips_user_created_idx
  on public.trips (user_id, created_at desc);

create index if not exists trips_city_name_idx
  on public.trips (lower(trim(city_name)));

comment on table public.trips is 'Session / trip anchor: links auth user + itinerary with canonical city_name for transport + analytics.';

alter table public.trips enable row level security;

do $$
begin
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
