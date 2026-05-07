-- One row per trip (itinerary) with step choices in columns.
-- This is the "wide" analytics-friendly shape requested by product.

create table if not exists public.user_trip_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  itinerary_id uuid not null unique references public.itineraries(id) on delete cascade,
  destination text,
  start_date date,
  end_date date,
  trip_times jsonb not null default '{}'::jsonb,
  hotel_anchor jsonb not null default '{}'::jsonb,
  group_type text,
  group_size int,
  budget text,
  pace text,
  interests jsonb not null default '[]'::jsonb,
  accommodation text,
  dietary_restrictions text,
  must_have text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_trip_choices_user_idx
  on public.user_trip_choices(user_id, created_at desc);

create index if not exists user_trip_choices_itinerary_idx
  on public.user_trip_choices(itinerary_id);

alter table public.user_trip_choices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='user_trip_choices'
      and policyname='user_trip_choices_allow_insert'
  ) then
    create policy user_trip_choices_allow_insert
      on public.user_trip_choices
      for insert
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='user_trip_choices'
      and policyname='user_trip_choices_allow_update'
  ) then
    create policy user_trip_choices_allow_update
      on public.user_trip_choices
      for update
      using (true)
      with check (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='user_trip_choices'
      and policyname='user_trip_choices_select_own'
  ) then
    create policy user_trip_choices_select_own
      on public.user_trip_choices
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

