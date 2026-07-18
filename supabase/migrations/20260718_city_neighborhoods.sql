-- ─────────────────────────────────────────────────────────────────────────────
-- city_neighborhoods — spatial "contextual containers" for the Dynamic
-- Neighborhood Profiler. Each row is one neighborhood polygon; the profiler maps
-- a day's generated POIs onto these polygons to find the day's dominant
-- "Anchor Neighborhood", then enriches it with Tavily/Exa/Gemini.
--
-- Populate `boundary` from a GIS source (OSM admin boundaries, city open data);
-- polygons are NOT fabricated here — the profiler degrades gracefully to null
-- when a city has no neighborhoods loaded yet.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists postgis;

create table if not exists public.city_neighborhoods (
  id              uuid primary key default gen_random_uuid(),
  city            text not null,
  city_normalized text not null,                    -- lower(trim(city))
  name_english    text not null,
  name_hebrew     text,
  boundary        geography(Polygon, 4326) not null,
  created_at      timestamptz not null default now()
);

-- GiST index on the polygon for fast point-in-polygon containment.
create index if not exists city_neighborhoods_boundary_gix
  on public.city_neighborhoods using gist (boundary);
create index if not exists city_neighborhoods_city_idx
  on public.city_neighborhoods (city_normalized);

alter table public.city_neighborhoods enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'city_neighborhoods'
      and policyname = 'city_neighborhoods_public_read'
  ) then
    create policy city_neighborhoods_public_read
      on public.city_neighborhoods for select using (true);
  end if;
end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- dominant_neighborhood(_city_normalized, _points) → the single neighborhood
-- that contains the most of the day's POIs (the "Anchor Neighborhood"), with a
-- coverage ratio and the boundary as GeoJSON for the map. Uses the GiST index
-- via ST_Contains. `_points` is a JSON array of { "lat": number, "lng": number }.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.dominant_neighborhood(
  _city_normalized text,
  _points jsonb
)
returns table (
  id uuid,
  name_english text,
  name_hebrew text,
  matched integer,
  total integer,
  centroid_lat double precision,
  centroid_lng double precision,
  boundary_geojson text
)
language sql
stable
as $$
  with pts as (
    select st_setsrid(st_makepoint((p->>'lng')::float8, (p->>'lat')::float8), 4326)::geography as g
    from jsonb_array_elements(_points) as p
    where (p ? 'lat') and (p ? 'lng')
      and (p->>'lat') ~ '^-?[0-9.]+$' and (p->>'lng') ~ '^-?[0-9.]+$'
  ),
  total_pts as (select count(*)::int as n from pts)
  select
    n.id,
    n.name_english,
    n.name_hebrew,
    count(pts.g)::int as matched,
    (select n from total_pts) as total,
    st_y(st_centroid(n.boundary::geometry)) as centroid_lat,
    st_x(st_centroid(n.boundary::geometry)) as centroid_lng,
    st_asgeojson(n.boundary::geometry) as boundary_geojson
  from public.city_neighborhoods n
  join pts on st_contains(n.boundary::geometry, pts.g::geometry)
  where n.city_normalized = _city_normalized
  group by n.id, n.name_english, n.name_hebrew, n.boundary
  order by matched desc
  limit 1;
$$;

grant execute on function public.dominant_neighborhood(text, jsonb) to anon, authenticated, service_role;
