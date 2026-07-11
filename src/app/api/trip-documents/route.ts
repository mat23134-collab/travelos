import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

/**
 * /api/trip-documents — per-trip document bank (passports, booking PDFs, tickets).
 *
 * Storage-only, no DB table: files live under `{itineraryId}/{uuid}-{name}` in
 * the private `trip-documents` bucket. All access is server-side via the
 * service role and gated on ownership (itineraries.user_id === session user),
 * so the bucket is never touched directly from the browser. Reads are handed
 * out as short-lived signed URLs.
 */

const BUCKET = 'trip-documents';
const MAX_BYTES = 15 * 1024 * 1024;
const ALLOWED = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic']);

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Resolve the service client and confirm the itinerary belongs to the user. */
async function authorize(req: NextRequest, itineraryId: string) {
  const userId = await verifySession(req);
  if (!userId) return { error: unauthorizedResponse() as NextResponse };
  if (!isUuid(itineraryId)) {
    return { error: NextResponse.json({ error: 'Invalid itineraryId.' }, { status: 400 }) };
  }
  const db = createServiceRoleClient();
  if (!db) return { error: NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 }) };

  const { data, error } = await db
    .from('itineraries')
    .select('user_id')
    .eq('id', itineraryId)
    .single();
  if (error || !data) return { error: NextResponse.json({ error: 'Trip not found.' }, { status: 404 }) };
  if (data.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Not your trip.' }, { status: 403 }) };
  }
  return { db };
}

/** GET /api/trip-documents?itineraryId=… → { files: [{ name, label, url, size }] } */
export async function GET(req: NextRequest) {
  const itineraryId = req.nextUrl.searchParams.get('itineraryId')?.trim() ?? '';
  const { db, error } = await authorize(req, itineraryId);
  if (error) return error;

  const { data: objects, error: listErr } = await db.storage
    .from(BUCKET)
    .list(itineraryId, { sortBy: { column: 'created_at', order: 'desc' }, limit: 100 });
  if (listErr) return NextResponse.json({ files: [] });

  const files = await Promise.all(
    (objects ?? [])
      .filter((o) => o.name && o.id) // skip folder placeholders
      .map(async (o) => {
        const path = `${itineraryId}/${o.name}`;
        const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(path, 300);
        return {
          name: o.name,
          // Strip the "{uuid}-" prefix we add on upload for a clean display name.
          label: o.name.replace(/^[0-9a-f-]{36}-/i, ''),
          url: signed?.signedUrl ?? null,
          size: (o.metadata as { size?: number } | null)?.size ?? null,
        };
      }),
  );
  return NextResponse.json({ files });
}

/** POST multipart: fields `itineraryId` + one or more `file` → uploads them. */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data.' }, { status: 400 });
  }
  const itineraryId = String(form.get('itineraryId') ?? '').trim();
  const { db, error } = await authorize(req, itineraryId);
  if (error) return error;

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
    results.push({ name: file.name, ok: !upErr });
  }

  const uploaded = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: uploaded > 0, uploaded, results });
}

/** DELETE body: { itineraryId, name } → removes one file. */
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { itineraryId?: string; name?: string } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  const name = body?.name?.trim() ?? '';
  const { db, error } = await authorize(req, itineraryId);
  if (error) return error;
  if (!name || name.includes('/') || name.includes('..')) {
    return NextResponse.json({ error: 'Invalid file name.' }, { status: 400 });
  }

  const { error: rmErr } = await db.storage.from(BUCKET).remove([`${itineraryId}/${name}`]);
  if (rmErr) return NextResponse.json({ error: 'Delete failed.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
