-- Attractions worth booking ahead — per-city bank, same posture as
-- restaurant_recommendations (scout writes via service role, public read).
create table if not exists public.attraction_recommendations (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,
  city_normalized   text not null,
  name              text not null,
  name_normalized   text not null,
  description       text,
  category          text,               -- e.g. "Ancient landmark", "Museum"
  price_range       text,
  neighborhood      text,
  ticket_url        text,
  booking_platform  text,               -- "official" | "GetYourGuide" | "Tiqets" | ...
  website_url       text,
  latitude          double precision,
  longitude         double precision,
  google_place_id   text,
  rating            real,
  rating_count      integer,
  photo_url         text,
  translations      jsonb,              -- per-language: description/category/highlight/bookingUrgency/insiderTip
  source            text not null default 'scout',
  score             real not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists attraction_recommendations_city_score_idx
  on public.attraction_recommendations(city_normalized, score desc);

alter table public.attraction_recommendations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'attraction_recommendations'
      and policyname = 'attraction_recommendations_public_read'
  ) then
    create policy attraction_recommendations_public_read
      on public.attraction_recommendations for select using (true);
  end if;
end $$;

-- Festivals & events — date-bounded rows; reads filter by overlap with the
-- trip window. Grounded in web snippets (source_url) to avoid hallucinations.
create table if not exists public.event_recommendations (
  id                uuid primary key default gen_random_uuid(),
  city              text not null,
  city_normalized   text not null,
  name              text not null,
  name_normalized   text not null,
  description       text,
  category          text,               -- "Music festival", "Food fair", ...
  venue             text,
  start_date        date,
  end_date          date,
  price_range       text,
  ticket_url        text,
  website_url       text,
  source_url        text,               -- the web page that grounded this event
  translations      jsonb,
  source            text not null default 'scout',
  score             real not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists event_recommendations_city_dates_idx
  on public.event_recommendations(city_normalized, start_date, end_date);

alter table public.event_recommendations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'event_recommendations'
      and policyname = 'event_recommendations_public_read'
  ) then
    create policy event_recommendations_public_read
      on public.event_recommendations for select using (true);
  end if;
end $$;
