-- Link users to places they create/update in itineraries.
-- This gives a clear "who did what" audit trail.

create table if not exists public.user_place_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  itinerary_item_id uuid references public.itinerary_items(id) on delete set null,
  event_type text not null check (event_type in ('created', 'swapped')),
  place_name text not null,
  place_category text,
  lat double precision,
  lng double precision,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_place_events_user_idx
  on public.user_place_events(user_id, created_at desc);

create index if not exists user_place_events_itinerary_idx
  on public.user_place_events(itinerary_id, created_at desc);

create index if not exists user_place_events_item_idx
  on public.user_place_events(itinerary_item_id);

alter table public.user_place_events enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_place_events'
      and policyname = 'user_place_events_select_own'
  ) then
    create policy user_place_events_select_own
      on public.user_place_events
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_place_events'
      and policyname = 'user_place_events_insert_own'
  ) then
    create policy user_place_events_insert_own
      on public.user_place_events
      for insert
      with check (auth.uid() = user_id);
  end if;
end
$$;

