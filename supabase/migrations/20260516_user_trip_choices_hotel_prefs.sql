-- ────────────────────────────────────────────────────────────────────────────
-- 20260516 — Hotel-fit refinement preferences on user_trip_choices.
-- Adds the three new wizard answers (nightly budget / location / amenities)
-- captured after the "accommodation type" step. The full profile is also
-- mirrored inside itineraries.profile_json (jsonb), so this migration is
-- additive-only and is safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

alter table public.user_trip_choices
  -- Single tier: 'budget' | 'mid' | 'comfort' | 'luxury'
  add column if not exists hotel_nightly_budget text,
  -- Up to 2 values from: 'center' | 'nature' | 'quiet' | 'transit'
  add column if not exists hotel_location_pref  jsonb not null default '[]'::jsonb,
  -- Optional, any subset of:
  --   'breakfast' | 'pool' | 'parking' | 'gym' | 'pets' |
  --   'spa'      | 'suite' | 'workspace' | 'rooftop'
  add column if not exists hotel_amenities      jsonb not null default '[]'::jsonb;

-- Constrain the enum-like single-tier column so bad client payloads can't
-- pollute analytics. Drop+recreate so the migration stays idempotent.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'user_trip_choices_hotel_nightly_budget_chk'
  ) then
    alter table public.user_trip_choices
      drop constraint user_trip_choices_hotel_nightly_budget_chk;
  end if;
  alter table public.user_trip_choices
    add constraint user_trip_choices_hotel_nightly_budget_chk
    check (
      hotel_nightly_budget is null
      or hotel_nightly_budget in ('budget','mid','comfort','luxury')
    );
end
$$;

-- Cap location pref at 2 entries (mirrors the UI constraint).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'user_trip_choices_hotel_location_pref_chk'
  ) then
    alter table public.user_trip_choices
      drop constraint user_trip_choices_hotel_location_pref_chk;
  end if;
  alter table public.user_trip_choices
    add constraint user_trip_choices_hotel_location_pref_chk
    check (
      jsonb_typeof(hotel_location_pref) = 'array'
      and jsonb_array_length(hotel_location_pref) <= 2
    );
end
$$;

-- Sanity guard for the amenities array shape.
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'user_trip_choices_hotel_amenities_chk'
  ) then
    alter table public.user_trip_choices
      drop constraint user_trip_choices_hotel_amenities_chk;
  end if;
  alter table public.user_trip_choices
    add constraint user_trip_choices_hotel_amenities_chk
    check (jsonb_typeof(hotel_amenities) = 'array');
end
$$;

-- Optional: helpful indexes for "find all trips that wanted a pool" style
-- analytics. GIN over jsonb supports the `?` containment operator.
create index if not exists user_trip_choices_hotel_amenities_gin
  on public.user_trip_choices using gin (hotel_amenities jsonb_path_ops);

create index if not exists user_trip_choices_hotel_location_pref_gin
  on public.user_trip_choices using gin (hotel_location_pref jsonb_path_ops);

create index if not exists user_trip_choices_hotel_nightly_budget_idx
  on public.user_trip_choices(hotel_nightly_budget);
