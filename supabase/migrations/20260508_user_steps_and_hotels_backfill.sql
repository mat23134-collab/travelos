-- 1) Ensure hotel_anchors can store both selected and recommended hotels
alter table public.hotel_anchors
  add column if not exists itinerary_id uuid references public.itineraries(id) on delete cascade,
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists hotel_name text,
  add column if not exists source text not null default 'selected'
    check (source in ('selected', 'recommended', 'onboarding')),
  add column if not exists is_selected boolean not null default false;

create index if not exists hotel_anchors_itinerary_idx
  on public.hotel_anchors(itinerary_id, created_at desc);

create index if not exists hotel_anchors_user_idx
  on public.hotel_anchors(user_id, created_at desc);

alter table public.hotel_anchors enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='hotel_anchors'
      and policyname='hotel_anchors_allow_insert'
  ) then
    create policy hotel_anchors_allow_insert
      on public.hotel_anchors
      for insert
      with check (true);
  end if;
end
$$;

-- 2) Step-level user choices table: one row per step key per itinerary
create table if not exists public.user_step_choices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  itinerary_id uuid not null references public.itineraries(id) on delete cascade,
  step_key text not null,
  step_value jsonb not null,
  created_at timestamptz not null default now(),
  unique (itinerary_id, step_key)
);

create index if not exists user_step_choices_user_idx
  on public.user_step_choices(user_id, created_at desc);

create index if not exists user_step_choices_itinerary_idx
  on public.user_step_choices(itinerary_id, created_at desc);

alter table public.user_step_choices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='user_step_choices'
      and policyname='user_step_choices_allow_insert'
  ) then
    create policy user_step_choices_allow_insert
      on public.user_step_choices
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
      and tablename='user_step_choices'
      and policyname='user_step_choices_select_own'
  ) then
    create policy user_step_choices_select_own
      on public.user_step_choices
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

-- 3) user_place_events: keep select-own, but allow server insert without JWT
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='user_place_events'
      and policyname='user_place_events_allow_insert'
  ) then
    create policy user_place_events_allow_insert
      on public.user_place_events
      for insert
      with check (true);
  end if;
end
$$;

