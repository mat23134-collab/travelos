-- Trip session: display name + date anchors (written when an itinerary is created).

alter table public.trips add column if not exists username text;
alter table public.trips add column if not exists start_date date;
alter table public.trips add column if not exists end_date date;

comment on column public.trips.username is 'App profile username (public.profiles.username) at trip creation time.';
comment on column public.trips.start_date is 'Trip start date from traveler profile (date only).';
comment on column public.trips.end_date is 'Trip end date from traveler profile (date only).';
