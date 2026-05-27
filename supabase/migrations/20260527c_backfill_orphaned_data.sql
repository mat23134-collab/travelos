-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-05-27 (c) — Retroactive backfill of orphaned relational data.
--
-- Context: between 2026-05-14 and 2026-05-27, schema mismatches (city_norm
-- missing, hotel_anchors.session_key NOT NULL, trips dates NOT NULL) silently
-- killed the secondary writes in /api/generate. The itinerary_json blob was
-- saved but no rows landed in itinerary_items, user_trip_choices, trips,
-- hotel_anchors, or user_place_events for ~60 itineraries.
--
-- This migration rehydrates those tables FROM the itinerary_json blob so all
-- past trips are queryable like new ones.
--
-- Applied directly via Supabase MCP on 2026-05-27 ~08:15 UTC.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) itinerary_items ───────────────────────────────────────────────────────
WITH days AS (
  SELECT i.id AS itinerary_id, (d.idx) + 1 AS day_number, d.value AS day_json
  FROM itineraries i,
       LATERAL jsonb_array_elements(COALESCE(i.itinerary_json->'days','[]'::jsonb))
         WITH ORDINALITY d(value, idx)
  WHERE i.itinerary_json IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM itinerary_items ii WHERE ii.itinerary_id = i.id)
),
slots AS (
  SELECT d.itinerary_id, d.day_number, s.slot, s.ord,
         d.day_json -> s.slot AS item,
         s.slot IN ('morning','afternoon','evening') AS is_activity
  FROM days d
  CROSS JOIN (VALUES ('breakfast',0),('morning',1),('lunch',2),
                     ('afternoon',3),('dinner',4),('evening',5)) AS s(slot, ord)
  WHERE d.day_json ? s.slot
    AND d.day_json -> s.slot IS NOT NULL
    AND d.day_json -> s.slot ->> 'name' IS NOT NULL
)
INSERT INTO itinerary_items (
  itinerary_id, day_number, item_order, name, category, description, lat, lng,
  google_place_id, photo_url, website_url, item_tags
)
SELECT
  itinerary_id, day_number, ord,
  item->>'name', slot,
  CASE WHEN is_activity THEN item->>'description'
       WHEN item ? 'mustTry' AND length(item->>'mustTry')>0 THEN 'Must try: ' || (item->>'mustTry')
       ELSE item->>'cuisine' END,
  CASE WHEN item->>'latitude'  ~ '^-?[0-9.]+$' THEN (item->>'latitude')::float8 END,
  CASE WHEN item->>'longitude' ~ '^-?[0-9.]+$' THEN (item->>'longitude')::float8 END,
  NULL, NULL, item->>'website_url',
  CASE
    WHEN is_activity AND jsonb_typeof(item->'tags')='array' AND jsonb_array_length(item->'tags')>0
      THEN ARRAY(SELECT jsonb_array_elements_text(item->'tags'))
    WHEN NOT is_activity AND item->>'cuisine' IS NOT NULL THEN ARRAY[item->>'cuisine']
    ELSE '{}'::text[]
  END
FROM slots
ORDER BY itinerary_id, day_number, ord;

-- ── 2) user_trip_choices ─────────────────────────────────────────────────────
INSERT INTO user_trip_choices (
  user_id, itinerary_id, destination, start_date, end_date,
  trip_times, hotel_anchor,
  group_type, group_size, budget, pace,
  interests, accommodation,
  hotel_nightly_budget, hotel_location_pref, hotel_amenities,
  dietary_restrictions, must_have
)
SELECT
  i.user_id, i.id,
  COALESCE(i.profile_json->>'destination', i.destination),
  NULLIF(LEFT(i.profile_json->>'startDate',10),'')::date,
  NULLIF(LEFT(i.profile_json->>'endDate',10),'')::date,
  jsonb_build_object(
    'dailyStartTime', i.profile_json->>'dailyStartTime',
    'arrivalTime',    i.profile_json->>'arrivalTime',
    'departureTime', i.profile_json->>'departureTime',
    'skipDay1', COALESCE((i.profile_json->>'skipDay1')::bool, false)),
  jsonb_build_object(
    'hotelBooked',  i.profile_json->>'hotelBooked',
    'hotelAddress', i.profile_json->>'hotelAddress',
    'hotelLat',     i.profile_json->'hotelLat',
    'hotelLng',     i.profile_json->'hotelLng'),
  i.profile_json->>'groupType',
  CASE WHEN (i.profile_json->>'groupSize') ~ '^[0-9]+$' THEN (i.profile_json->>'groupSize')::int END,
  i.profile_json->>'budget',
  i.profile_json->>'pace',
  CASE WHEN jsonb_typeof(i.profile_json->'interests')='array' THEN i.profile_json->'interests' ELSE '[]'::jsonb END,
  i.profile_json->>'accommodation',
  CASE WHEN i.profile_json->>'hotelNightlyBudget' IN ('budget','mid','comfort','luxury')
       THEN i.profile_json->>'hotelNightlyBudget' END,
  CASE WHEN jsonb_typeof(i.profile_json->'hotelLocationPref')='array'
       THEN i.profile_json->'hotelLocationPref' ELSE '[]'::jsonb END,
  CASE WHEN jsonb_typeof(i.profile_json->'hotelAmenities')='array'
       THEN i.profile_json->'hotelAmenities' ELSE '[]'::jsonb END,
  COALESCE(i.profile_json->>'dietaryRestrictions',''),
  COALESCE(i.profile_json->>'mustHave','')
FROM itineraries i
WHERE i.profile_json IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_trip_choices utc WHERE utc.itinerary_id = i.id)
ON CONFLICT (itinerary_id) DO NOTHING;

-- ── 3) trips ─────────────────────────────────────────────────────────────────
INSERT INTO trips (
  itinerary_id, user_id, username, city_name, start_date, end_date,
  selected_hotels, selected_attractions, full_itinerary, trip_vibe,
  created_at, updated_at
)
SELECT
  i.id, i.user_id, p.username,
  COALESCE(i.destination_city, i.destination, i.profile_json->>'destination'),
  NULLIF(LEFT(i.profile_json->>'startDate',10),'')::date,
  NULLIF(LEFT(i.profile_json->>'endDate',10),'')::date,
  COALESCE(i.itinerary_json->'basecamp'->'recommendations','[]'::jsonb),
  '[]'::jsonb,
  COALESCE(i.itinerary_json,'{}'::jsonb),
  CASE WHEN length(COALESCE(i.squad_vibe,''))>0 THEN i.squad_vibe ELSE 'Cinematic' END,
  i.created_at, i.created_at
FROM itineraries i
LEFT JOIN profiles p ON p.id = i.user_id
WHERE COALESCE(i.destination_city, i.destination) IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM trips t WHERE t.itinerary_id = i.id)
ON CONFLICT (itinerary_id) DO NOTHING;

-- ── 4) hotel_anchors ─────────────────────────────────────────────────────────
-- 4a) user-entered hotel (source='selected')
INSERT INTO hotel_anchors (
  itinerary_id, user_id, session_key, address, hotel_name, source, is_selected, lat, lng, created_at
)
SELECT
  i.id, i.user_id, i.id::text,
  trim(i.profile_json->>'hotelAddress'),
  COALESCE(NULLIF(trim(i.profile_json->>'hotelBooked'),''), trim(i.profile_json->>'hotelAddress')),
  'selected', true,
  CASE WHEN i.profile_json->>'hotelLat' ~ '^-?[0-9.]+$' THEN (i.profile_json->>'hotelLat')::float8 END,
  CASE WHEN i.profile_json->>'hotelLng' ~ '^-?[0-9.]+$' THEN (i.profile_json->>'hotelLng')::float8 END,
  i.created_at
FROM itineraries i
WHERE COALESCE(trim(i.profile_json->>'hotelAddress'),'') <> ''
  AND NOT EXISTS (SELECT 1 FROM hotel_anchors ha WHERE ha.itinerary_id = i.id AND ha.source = 'selected');

-- 4b) AI recommendations (source='recommended')
INSERT INTO hotel_anchors (
  itinerary_id, user_id, session_key, address, hotel_name, source, is_selected, lat, lng, created_at
)
SELECT
  i.id, i.user_id, i.id::text,
  COALESCE(NULLIF(trim(rec->>'neighborhood'),''), trim(rec->>'name')),
  trim(rec->>'name'),
  'recommended', false, NULL, NULL, i.created_at
FROM itineraries i,
     LATERAL jsonb_array_elements(COALESCE(i.itinerary_json->'basecamp'->'recommendations','[]'::jsonb)) AS rec
WHERE length(trim(rec->>'name'))>0
  AND NOT EXISTS (
    SELECT 1 FROM hotel_anchors ha
    WHERE ha.itinerary_id = i.id AND ha.hotel_name = trim(rec->>'name') AND ha.source='recommended');

-- ── 5) user_place_events ─────────────────────────────────────────────────────
INSERT INTO user_place_events (
  user_id, itinerary_id, itinerary_item_id, event_type,
  place_name, place_category, lat, lng, metadata, created_at
)
SELECT
  i.user_id, ii.itinerary_id, ii.id, 'created',
  ii.name, ii.category, ii.lat, ii.lng,
  jsonb_build_object('source','backfill','day_number',ii.day_number,'item_order',ii.item_order),
  i.created_at
FROM itinerary_items ii
JOIN itineraries i ON i.id = ii.itinerary_id
WHERE i.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM user_place_events upe WHERE upe.itinerary_item_id = ii.id);
