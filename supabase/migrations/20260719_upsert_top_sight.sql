-- ─────────────────────────────────────────────────────────────────────────────
-- upsert_top_sight — per-row upsert for the "Our Picks" onboarding bank
-- (places.top_pick_category / popularity_rank).
--
-- The existing bulk_upsert_places() RPC (used by the everyday-places scanner)
-- does NOT touch top_pick_category/popularity_rank at all, so it can't be
-- reused for curating the Step 7 onboarding card. This is a separate,
-- purpose-built upsert used by topSightsScoutAgent.ts (scripts/scout-topsights.ts):
--   • top_pick_category / popularity_rank are ALWAYS set — this agent IS the
--     authority for that curation.
--   • Everything else (lat/lng/photo/website/place_id/rating/description) is
--     COALESCEd — enrich existing `places` rows (e.g. one already scanned by
--     the general places pipeline) without blanking out data another
--     pipeline already filled in.
-- Same (lower(name), lower(city)) conflict target as places_name_city_norm_key.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.upsert_top_sight(
  _name               text,
  _city               text,
  _category           text,
  _top_pick_category  text,
  _popularity_rank    int,
  _description        text,
  _description_he     text,
  _category_emoji     text,
  _vibe_label         text,
  _lat                float8,
  _lng                float8,
  _photo_url          text,
  _website_url        text,
  _google_place_id    text,
  _google_rating      float8
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _id uuid;
begin
  insert into public.places (
    name, city, category, description, description_he,
    category_emoji, vibe_label, lat, lng, photo_url, website_url,
    google_place_id, google_rating, top_pick_category, popularity_rank,
    last_verified_at
  )
  values (
    _name, _city, _category, _description, _description_he,
    _category_emoji, _vibe_label, _lat, _lng, _photo_url, _website_url,
    _google_place_id, _google_rating, _top_pick_category, _popularity_rank,
    now()
  )
  on conflict (lower(name), lower(city)) do update set
    top_pick_category = excluded.top_pick_category,
    popularity_rank    = excluded.popularity_rank,
    description        = coalesce(nullif(excluded.description, ''), places.description),
    description_he     = coalesce(nullif(excluded.description_he, ''), places.description_he),
    category_emoji      = coalesce(excluded.category_emoji, places.category_emoji),
    vibe_label          = coalesce(excluded.vibe_label, places.vibe_label),
    lat                 = coalesce(excluded.lat, places.lat),
    lng                 = coalesce(excluded.lng, places.lng),
    photo_url           = coalesce(excluded.photo_url, places.photo_url),
    website_url         = coalesce(excluded.website_url, places.website_url),
    google_place_id     = coalesce(excluded.google_place_id, places.google_place_id),
    google_rating       = coalesce(excluded.google_rating, places.google_rating),
    last_verified_at    = now()
  returning id into _id;

  return _id;
end;
$$;

grant execute on function public.upsert_top_sight(
  text, text, text, text, int, text, text, text, text, float8, float8, text, text, text, float8
) to service_role;
