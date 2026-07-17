-- Private Storage bucket for per-trip documents (passports, booking PDFs,
-- tickets). No new table: files live under the folder convention
-- {itineraryId}/{uuid}-{name}. All access is server-side via /api/trip-documents
-- (service role + ownership check against itineraries.user_id), so the bucket
-- stays private and is never read directly from the browser — the API hands out
-- short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-documents', 'trip-documents', false,
  15728640,  -- 15 MB per file
  array['application/pdf','image/png','image/jpeg','image/webp','image/heic']
)
on conflict (id) do nothing;
