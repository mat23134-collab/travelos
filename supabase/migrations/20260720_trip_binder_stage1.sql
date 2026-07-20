-- ─────────────────────────────────────────────────────────────────────────────
-- Trip Binder — Stage 1: per-stop attachments metadata + notes/status.
--
-- Two tables that turn a generated itinerary into an organizer (replacing the
-- Excel/Word a traveler would otherwise keep):
--
--   • trip_document_meta — one row per uploaded file in the existing private
--     `trip-documents` storage bucket, associating it with the trip and
--     (optionally) a specific stop. The FILE still lives in storage exactly as
--     today; this table only adds the item_id + doc_type + label metadata that
--     storage listing can't carry, so /api/trip-documents can group by stop.
--     Pre-existing files (uploaded before this table) simply have no meta row
--     and still list fine — the route LEFT-JOINs on storage_path.
--
--   • trip_item_notes — one editable note + status per stop (or trip-level when
--     item_id is null). status is a text+CHECK (not a pg enum) to match the
--     codebase style (places.top_pick_category) and stay cheaply extensible.
--
-- item_id is a plain uuid (the value embedded in the itinerary JSON blob), NOT
-- a FK to itinerary_items: those rows are replaced on swap/regeneration and we
-- must NOT cascade-delete a traveler's own docs/notes when a stop changes. Only
-- itinerary_id is FK'd (ON DELETE CASCADE) so deleting a trip cleans up.
--
-- Access is server-side only via the service-role client, gated on ownership in
-- the API route (authorizeTripOwnership). RLS is therefore ENABLED with NO
-- policies — the browser can never touch these directly; the service role
-- bypasses RLS. Same lockdown as neighborhood_guide_cache.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.trip_document_meta (
  id            uuid primary key default gen_random_uuid(),
  itinerary_id  uuid not null references public.itineraries(id) on delete cascade,
  item_id       uuid,                       -- null = trip-level (not tied to a stop)
  user_id       uuid not null,              -- owner (= itineraries.user_id at insert)
  storage_path  text not null unique,       -- full path in the trip-documents bucket
  label         text,                       -- clean display name
  doc_type      text not null default 'other'
                check (doc_type in ('flight','hotel','ticket','passport','insurance','reservation','other')),
  created_at    timestamptz not null default now()
);

create index if not exists trip_document_meta_itinerary_idx
  on public.trip_document_meta (itinerary_id);
create index if not exists trip_document_meta_item_idx
  on public.trip_document_meta (itinerary_id, item_id);

alter table public.trip_document_meta enable row level security;

create table if not exists public.trip_item_notes (
  id            uuid primary key default gen_random_uuid(),
  itinerary_id  uuid not null references public.itineraries(id) on delete cascade,
  item_id       uuid,                       -- null = trip-level note
  user_id       uuid not null,
  note_text     text,
  status        text check (status in ('planned','booked','paid','confirmed')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One note/status row per stop. Partial unique so multiple trip-level (null
-- item_id) rows aren't blocked, but a given stop upserts a single row.
create unique index if not exists trip_item_notes_stop_uidx
  on public.trip_item_notes (itinerary_id, item_id)
  where item_id is not null;
create index if not exists trip_item_notes_itinerary_idx
  on public.trip_item_notes (itinerary_id);

alter table public.trip_item_notes enable row level security;
