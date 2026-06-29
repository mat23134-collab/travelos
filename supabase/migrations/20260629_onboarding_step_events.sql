-- ─────────────────────────────────────────────────────────────────────────────
-- onboarding_step_events — per-step funnel tracking for the /onboarding wizard
--
-- WHY a new table (vs the existing user_step_choices)?
--   user_step_choices.itinerary_id is NOT NULL, so a row can only be written
--   AFTER generation creates an itinerary. That makes it blind to the thing we
--   actually care about: people who quit mid-onboarding and never generate.
--
--   This table requires NO itinerary. It is keyed on a client-generated
--   `session_id` (one per onboarding attempt) so we can measure how far each
--   attempt got — even attempts that never finish. user_id is nullable on
--   purpose (defensive) though onboarding is auth-gated today.
--
-- A row is inserted each time a step is *reached*. Drop-off on a given step =
-- attempts whose furthest step_index is that step and which never reached the
-- next one. The hotel step is step_key = 'hotel' (step_index 4).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.onboarding_step_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  session_id  text not null,                 -- one id per onboarding attempt
  step_index  integer not null,              -- 0..6
  step_key    text not null,                 -- destination|dates|interests|style|hotel|dining|picks|generate
  destination text,                          -- context, nullable
  created_at  timestamptz not null default now()
);

create index if not exists onboarding_step_events_session_idx
  on public.onboarding_step_events(session_id, step_index);

create index if not exists onboarding_step_events_user_idx
  on public.onboarding_step_events(user_id, created_at desc);

create index if not exists onboarding_step_events_step_idx
  on public.onboarding_step_events(step_key, created_at desc);

alter table public.onboarding_step_events enable row level security;

-- Allow inserts (anon + authed). Mirrors the existing user_step_choices /
-- hotel_anchors insert policies. No UPDATE/DELETE policy → rows are append-only.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='onboarding_step_events'
      and policyname='onboarding_step_events_allow_insert'
  ) then
    create policy onboarding_step_events_allow_insert
      on public.onboarding_step_events
      for insert
      with check (true);
  end if;
end
$$;

-- Users can read their own events; service role (analytics) bypasses RLS.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public'
      and tablename='onboarding_step_events'
      and policyname='onboarding_step_events_select_own'
  ) then
    create policy onboarding_step_events_select_own
      on public.onboarding_step_events
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;
