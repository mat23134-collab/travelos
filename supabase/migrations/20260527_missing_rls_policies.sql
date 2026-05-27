-- ============================================================
--  Fix missing RLS INSERT/UPDATE policies for:
--    legal_consents, transportation, hotel_anchors
--  Also ensures hotel_anchors table exists with correct schema.
--  Safe to re-run (all DDL is IF NOT EXISTS / idempotent).
-- ============================================================

-- ── 1. legal_consents ──────────────────────────────────────────────────────────
--  Original 20260526 migration only added a SELECT policy.
--  API route uses service-role (bypasses RLS), but add an open INSERT policy
--  as a belt-and-suspenders fallback and to enable future client-side writes.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'legal_consents'
      and policyname = 'legal_consents_insert_any'
  ) then
    create policy legal_consents_insert_any
      on public.legal_consents
      for insert
      with check (true);
  end if;
end $$;

-- ── 2. transportation ──────────────────────────────────────────────────────────
--  Original 20260514 migration only added a SELECT policy.
--  The transport scout upsert (server-side, service-role) needs INSERT + UPDATE.

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'transportation'
      and policyname = 'transportation_insert_service'
  ) then
    create policy transportation_insert_service
      on public.transportation
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'transportation'
      and policyname = 'transportation_update_service'
  ) then
    create policy transportation_update_service
      on public.transportation
      for update
      using (true)
      with check (true);
  end if;
end $$;

-- ── 3. hotel_anchors ───────────────────────────────────────────────────────────
--  Table was created outside migrations (Supabase dashboard).
--  Re-create with a CREATE TABLE IF NOT EXISTS so this is safe on a fresh DB.
--  Make lat/lng NULLABLE — AI-recommended hotels frequently have no coordinates.

create table if not exists public.hotel_anchors (
  id            uuid        primary key default gen_random_uuid(),
  itinerary_id  uuid        references public.itineraries (id) on delete cascade,
  user_id       uuid        references auth.users (id) on delete set null,
  hotel_name    text,
  address       text,
  lat           double precision,          -- nullable: coords may not be known
  lng           double precision,          -- nullable: coords may not be known
  source        text        not null default 'selected'
                check (source in ('selected', 'recommended', 'onboarding')),
  is_selected   boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- If table already existed, ensure lat/lng are nullable (ALTER is safe if already nullable).
alter table public.hotel_anchors
  alter column lat  drop not null,
  alter column lng  drop not null;

create index if not exists hotel_anchors_itinerary_idx
  on public.hotel_anchors (itinerary_id, created_at desc);

create index if not exists hotel_anchors_user_idx
  on public.hotel_anchors (user_id, created_at desc);

alter table public.hotel_anchors enable row level security;

do $$
begin
  -- INSERT: open — server uses service-role anyway, but allow anon too
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hotel_anchors'
      and policyname = 'hotel_anchors_insert_any'
  ) then
    create policy hotel_anchors_insert_any
      on public.hotel_anchors
      for insert
      with check (true);
  end if;

  -- SELECT: owner only
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename  = 'hotel_anchors'
      and policyname = 'hotel_anchors_select_own'
  ) then
    create policy hotel_anchors_select_own
      on public.hotel_anchors
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

comment on table public.hotel_anchors is
  'Selected hotel + AI-recommended alternatives per itinerary. lat/lng nullable for recommendations.';
comment on column public.hotel_anchors.lat is 'WGS-84 latitude — nullable (recommendations may have no geocoords).';
comment on column public.hotel_anchors.lng is 'WGS-84 longitude — nullable (recommendations may have no geocoords).';
comment on column public.hotel_anchors.source is '"selected" = user-entered hotel; "recommended" = AI suggestion; "onboarding" = legacy.';
