import { NextRequest, NextResponse } from 'next/server';
import { authorizeTripOwnership } from '@/lib/tripOwnership';

/**
 * /api/trip-documents — per-trip document bank (passports, booking PDFs,
 * tickets), now Binder-aware: a file can be anchored to a specific stop
 * (item_id) and carry a doc_type.
 *
 * The FILE still lives in the private `trip-documents` storage bucket under
 * `{itineraryId}/{uuid}-{name}` exactly as before — nothing about storage
 * changed. Stage 1 adds a sidecar `trip_document_meta` row per upload holding
 * the item_id + doc_type + label that storage listing can't carry, so results
 * can be grouped by stop. GET LEFT-JOINs meta onto the storage listing, so
 * files uploaded BEFORE this table still list fine (with null itemId/docType).
 *
 * All access is server-side via the service role and gated on ownership
 * (authorizeTripOwnership); the bucket is never touched from the browser.
 */

const BUCKET = 'trip-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']);
const DOC_TYPES = new Set(['flight', 'hotel', 'ticket', 'passport', 'insurance', 'reservation', 'other']);

const isUuidV = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/**
 * GET /api/trip-documents?itineraryId=…[&itemId=…]
 * → { files: [{ name, label, url, size, itemId, docType }] }
 * Optional itemId filters to a single stop's attachments.
 */
export async function GET(req: NextRequest) {
  const itineraryId = req.nextUrl.searchParams.get('itineraryId')?.trim() ?? '';
  const itemFilter = req.nextUrl.searchParams.get('itemId')?.trim() || null;
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const { data: objects, error: listErr } = await db.storage
    .from(BUCKET)
    .list(itineraryId, { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 });
  if (listErr) return NextResponse.json({ files: [] });

  // Sidecar metadata (item_id / doc_type / label), keyed by storage_path.
  const { data: metaRows } = await db
    .from('trip_document_meta')
    .select('storage_path, item_id, doc_type, label')
    .eq('itinerary_id', itineraryId);
  const metaByPath = new Map(
    (metaRows ?? []).map((m) => [m.storage_path as string, m]),
  );

  const files = (
    await Promise.all(
      (objects ?? [])
        .filter((o) => o.name && o.id) // skip folder placeholders
        .map(async (o) => {
          const path = `${itineraryId}/${o.name}`;
          const meta = metaByPath.get(path);
          const itemId = (meta?.item_id as string | null) ?? null;
          if (itemFilter && itemId !== itemFilter) return null;
          const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 300);
          return {
            name: o.name,
            label: (meta?.label as string | null) ?? o.name.replace(/^[0-9a-f-]{36}-/i, ''),
            url: signed?.signedUrl ?? null,
            size: (o.metadata as { size?: number } | null)?.size ?? null,
            itemId,
            docType: (meta?.doc_type as string | null) ?? null,
          };
        }),
    )
  ).filter((f): f is NonNullable<typeof f> => f !== null);

  return NextResponse.json({ files });
}

/**
 * POST multipart: `itineraryId` + one or more `file`, plus optional `itemId`
 * (anchor to a stop) and `docType`. Uploads each file, then records a meta row.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }
  const itineraryId = String(form.get('itineraryId') ?? '').trim();
  const { db, userId, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const itemIdRaw = String(form.get('itemId') ?? '').trim();
  const itemId = itemIdRaw && isUuidV(itemIdRaw) ? itemIdRaw : null;
  const docTypeRaw = String(form.get('docType') ?? '').trim().toLowerCase();
  const docType = DOC_TYPES.has(docTypeRaw) ? docTypeRaw : 'other';

  const files = form.getAll('file').filter((f): f is File => f instanceof File);
  if (files.length === 0) return NextResponse.json({ error: 'No files.' }, { status: 400 });

  const results: { name: string; ok: boolean }[] = [];
  for (const file of files) {
    if (file.size > MAX_BYTES) { results.push({ name: file.name, ok: false }); continue; }
    if (!ALLOWED.has(file.type)) { results.push({ name: file.name, ok: false }); continue; }

    const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `${itineraryId}/${crypto.randomUUID()}-${safe}`;
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) { results.push({ name: file.name, ok: false }); continue; }

    // Record the sidecar meta row. Best-effort: if this fails the file is still
    // uploaded and will list via the LEFT-JOIN fallback (just without item/type).
    const { error: metaErr } = await db.from('trip_document_meta').insert({
      itinerary_id: itineraryId,
      item_id: itemId,
      user_id: userId,
      storage_path: path,
      label: safe.replace(/^[0-9a-f-]{36}-/i, ''),
      doc_type: docType,
    });
    if (metaErr) console.warn('[trip-documents] meta insert failed (non-critical):', metaErr.message);
    results.push({ name: file.name, ok: true });
  }

  const uploaded = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: uploaded > 0, uploaded, results });
}

/** DELETE body: { itineraryId, name } → removes one file + its meta row. */
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { itineraryId?: string; name?: string } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  const name = body?.name?.trim() ?? '';
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;
  if (!name || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'Invalid file name.' }, { status: 400 });
  }

  const path = `${itineraryId}/${name}`;
  const { error: rmErr } = await db.storage.from(BUCKET).remove([path]);
  if (rmErr) return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  // Clean up the sidecar row (scoped to this trip so a forged path can't wipe others).
  await db.from('trip_document_meta').delete().eq('itinerary_id', itineraryId).eq('storage_path', path);
  return NextResponse.json({ ok: true });
}
