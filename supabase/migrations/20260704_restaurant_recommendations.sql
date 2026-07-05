-- ─────────────────────────────────────────────────────────────────────────────
-- restaurant_recommendations — per-city bank of reservable restaurants
--
-- Populated by the restaurant scout pipeline (Exa web search → Gemini synthesis
-- → Google Places verification → scoring). The Smart Toolbar on the itinerary
-- page reads from this table to let travelers lock a real, bookable restaurant
-- into a day (which then triggers auto-rescheduling around the reservation).
--
-- One row = one restaurant in one city. Rows are upserted on
-- (city_normalized, google_place_id) so re-running the scout refreshes ratings
-- and links instead of duplicating. Rows without a google_place_id (unverified
-- AI suggestions) upsert on (city_normalized, name_normalized) instead.
--
-- Mirrors the `transportation` table conventions: service-role writes, public
-- read, city normalization for cache hits.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.restaurant_recommendations (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,                 -- display city, e.g. "Rome"
  city_normalized   text not null,                 -- lower(trim(city)) for cache lookups
  name              text not null,
  name_normalized   text not null,                 -- lower(trim(name)) for dedupe
  description       text,                          -- 1–2 sentence editorial blurb
  cuisine_style     text,                          -- e.g. "Roman trattoria", "modern Italian"
  price_range       text,                          -- display band, e.g. "€€€" or "€40–60 pp"
  price_level       smallint,                      -- 1..4 (Google price_level scale) for sorting
  neighborhood      text,
  reservation_url   text,                          -- deep-link to book (website / OTA)
  booking_platform  text,                          -- "TheFork" | "OpenTable" | "website" | ...
  website_url       text,                          -- official site (from Google Places)
  latitude          double precision,
  longitude         double precision,
  google_place_id   text,                          -- null when unverified
  rating            real,                          -- Google aggregate (1–5)
  rating_count      integer,                       -- Google user_ratings_total
  photo_url         text,
  source            text not null default 'scout', -- 'scout' | 'manual'
  score             real not null default 0,       -- ranking score from the algorithm
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Fast city lookups, best-scored first (the read query orders by score desc).
create index if not exists restaurant_recommendations_city_score_idx
  on public.restaurant_recommendations(city_normalized, score desc);

-- Upsert targets: verified rows dedupe on place_id, unverified on name.
create unique index if not exists restaurant_recommendations_city_place_uidx
  on public.restaurant_recommendations(city_normalized, google_place_id)
  where google_place_id is not null;

create unique index if not exists restaurant_recommendations_city_name_uidx
  on public.restaurant_recommendations(city_normalized, name_normalized)
  where google_place_id is null;

alter table public.restaurant_recommendations enable row level security;

-- Public read (same posture as transportation / places): anyone may read the
-- recommendation bank. Writes happen only via the service-role key in the scout
-- endpoint, which bypasses RLS — so there is intentionally no INSERT/UPDATE
-- policy for anon or authed roles.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'restaurant_recommendations'
      and policyname = 'restaurant_recommendations_public_read'
  ) then
    create policy restaurant_recommendations_public_read
      on public.restaurant_recommendations
      for select
      using (true);
  end if;
end $$;
