-- ─────────────────────────────────────────────────────────────────────────────
-- Demo neighborhood polygons + the ingestion RPC.
--
-- These are COARSE central-district envelopes (ST_MakeEnvelope) so the Dynamic
-- Neighborhood Profiler is visible immediately for the main cities. Replace /
-- extend them with real OSM boundaries via `scripts/seed-neighborhoods.ts`
-- (which calls upsert_city_neighborhood). Idempotent: only seeds when empty.
-- ─────────────────────────────────────────────────────────────────────────────

-- Ingestion RPC used by scripts/seed-neighborhoods.ts. Accepts a GeoJSON
-- Polygon/MultiPolygon, stores the largest polygon, upserts by (city, name).
create or replace function public.upsert_city_neighborhood(
  _city text,
  _name_english text,
  _name_hebrew text,
  _geojson text
)
returns uuid
language plpgsql
as $$
declare
  _id uuid;
  _geom geometry;
  _poly geometry;
begin
  _geom := st_setsrid(st_geomfromgeojson(_geojson), 4326);
  if geometrytype(_geom) = 'MULTIPOLYGON' then
    select geom into _poly from st_dump(_geom) order by st_area(geom) desc limit 1;
  else
    _poly := _geom;
  end if;

  update public.city_neighborhoods
    set boundary = _poly::geography, name_hebrew = coalesce(_name_hebrew, name_hebrew)
  where city_normalized = lower(trim(_city)) and lower(name_english) = lower(_name_english)
  returning id into _id;

  if _id is null then
    insert into public.city_neighborhoods (city, city_normalized, name_english, name_hebrew, boundary)
    values (_city, lower(trim(_city)), _name_english, _name_hebrew, _poly::geography)
    returning id into _id;
  end if;
  return _id;
end;
$$;

grant execute on function public.upsert_city_neighborhood(text, text, text, text) to service_role;

-- Coarse demo district polygons — only when the table is empty.
insert into public.city_neighborhoods (city, city_normalized, name_english, name_hebrew, boundary)
select * from (values
  ('Florence','florence','Centro Storico','המרכז ההיסטורי', ST_MakeEnvelope(11.246,43.764,11.268,43.780,4326)::geography),
  ('Florence','florence','Oltrarno','אולטרארנו',           ST_MakeEnvelope(11.238,43.758,11.258,43.768,4326)::geography),
  ('Rome','rome','Centro Storico','המרכז ההיסטורי',        ST_MakeEnvelope(12.462,41.892,12.484,41.906,4326)::geography),
  ('Rome','rome','Trastevere','טרסטוורה',                  ST_MakeEnvelope(12.460,41.882,12.476,41.892,4326)::geography),
  ('Rome','rome','Monti & Colosseo','מונטי וקולוסיאום',    ST_MakeEnvelope(12.484,41.885,12.502,41.899,4326)::geography),
  ('Tokyo','tokyo','Shibuya','שיבויה',                     ST_MakeEnvelope(139.690,35.652,139.710,35.666,4326)::geography),
  ('Tokyo','tokyo','Shinjuku','שינג׳וקו',                  ST_MakeEnvelope(139.692,35.684,139.714,35.698,4326)::geography),
  ('Tokyo','tokyo','Asakusa','אסקוסה',                     ST_MakeEnvelope(139.790,35.706,139.804,35.718,4326)::geography),
  ('Paris','paris','Le Marais','לה מארה',                  ST_MakeEnvelope(2.354,48.854,2.368,48.864,4326)::geography),
  ('Paris','paris','Saint-Germain','סן ז׳רמן',             ST_MakeEnvelope(2.328,48.850,2.342,48.858,4326)::geography)
) as v(city, city_normalized, name_english, name_hebrew, boundary)
where not exists (select 1 from public.city_neighborhoods);
