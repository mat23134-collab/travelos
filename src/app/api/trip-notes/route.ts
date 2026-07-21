import { NextRequest, NextResponse } from 'next/server';
import { authorizeTripOwnership, isUuid } from '@/lib/tripOwnership';

/**
 * /api/trip-notes — per-stop note + status for the Trip Binder.
 *
 * One editable note + booking status per stop (item_id), or trip-level when
 * item_id is null. Backed by `trip_item_notes`. Same ownership gate as
 * /api/trip-documents (authorizeTripOwnership) — the table has RLS on with no
 * policies, so it's only ever reachable through this service-role route.
 */

const STATUSES = new Set(['planned', 'booked', 'paid', 'confirmed', 'cancelled']);
const MAX_NOTE = 4000;
const MAX_AMOUNT = 100_000_000;

/** GET ?itineraryId=… → { notes: [{ itemId, noteText, status, paidAmount, paidCurrency, updatedAt }] } */
export async function GET(req: NextRequest) {
  const itineraryId = req.nextUrl.searchParams.get('itineraryId')?.trim() ?? '';
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const { data, error: selErr } = await db
    .from('trip_item_notes')
    .select('item_id, note_text, status, paid_amount, paid_currency, updated_at')
    .eq('itinerary_id', itineraryId);
  if (selErr) return NextResponse.json({ notes: [] });

  const notes = (data ?? []).map((r) => ({
    itemId: r.item_id as string | null,
    noteText: (r.note_text as string | null) ?? '',
    status: (r.status as string | null) ?? null,
    paidAmount: r.paid_amount === null || r.paid_amount === undefined ? null : Number(r.paid_amount),
    paidCurrency: (r.paid_currency as string | null) ?? 'ILS',
    updatedAt: r.updated_at as string,
  }));
  return NextResponse.json({ notes });
}

/**
 * PUT body { itineraryId, itemId, noteText?, status? } → upsert one stop's row.
 * Omitted fields are left unchanged on an existing row. Manual upsert (select →
 * update/insert) rather than PostgREST onConflict, since the uniqueness is a
 * PARTIAL index (item_id is not null) that ON CONFLICT can't reliably target.
 */
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    itineraryId?: string; itemId?: string; noteText?: string; status?: string | null;
    paidAmount?: number | string | null; paidCurrency?: string;
  } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  const { db, userId, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const itemId = body?.itemId?.trim() ?? '';
  if (!itemId || !isUuid(itemId)) {
    return NextResponse.json({ error: 'A valid itemId is required.' }, { status: 400 });
  }

  const hasNote = typeof body?.noteText === 'string';
  const hasStatus = body ? 'status' in body : false;
  const hasPaidAmount = body ? 'paidAmount' in body : false;
  const hasPaidCurrency = typeof body?.paidCurrency === 'string';
  if (!hasNote && !hasStatus && !hasPaidAmount && !hasPaidCurrency) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }
  const noteText = hasNote ? body!.noteText!.slice(0, MAX_NOTE) : undefined;
  let status: string | null | undefined;
  if (hasStatus) {
    const s = body!.status;
    if (s === null || s === '') status = null;
    else if (typeof s === 'string' && STATUSES.has(s)) status = s;
    else return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
  }
  let paidAmount: number | null | undefined;
  if (hasPaidAmount) {
    const v = body!.paidAmount;
    if (v === null || v === '') paidAmount = null;
    else {
      const n = typeof v === 'number' ? v : Number(v);
      if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) {
        return NextResponse.json({ error: 'Invalid paidAmount.' }, { status: 400 });
      }
      paidAmount = Math.round(n * 100) / 100;
    }
  }
  const paidCurrency = hasPaidCurrency ? body!.paidCurrency!.trim().slice(0, 8).toUpperCase() || 'ILS' : undefined;

  const { data: existing } = await db
    .from('trip_item_notes')
    .select('id')
    .eq('itinerary_id', itineraryId)
    .eq('item_id', itemId)
    .maybeSingle();

  if (existing?.id) {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (noteText !== undefined) patch.note_text = noteText;
    if (status !== undefined) patch.status = status;
    if (paidAmount !== undefined) patch.paid_amount = paidAmount;
    if (paidCurrency !== undefined) patch.paid_currency = paidCurrency;
    const { error: upErr } = await db.from('trip_item_notes').update(patch).eq('id', existing.id);
    if (upErr) return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
  } else {
    const { error: insErr } = await db.from('trip_item_notes').insert({
      itinerary_id: itineraryId,
      item_id: itemId,
      user_id: userId,
      note_text: noteText ?? null,
      status: status ?? null,
      paid_amount: paidAmount ?? null,
      paid_currency: paidCurrency ?? 'ILS',
    });
    if (insErr) return NextResponse.json({ error: 'Save failed.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE body { itineraryId, itemId } → clears a stop's note + status row. */
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { itineraryId?: string; itemId?: string } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;
  const itemId = body?.itemId?.trim() ?? '';
  if (!itemId || !isUuid(itemId)) {
    return NextResponse.json({ error: 'A valid itemId is required.' }, { status: 400 });
  }
  await db.from('trip_item_notes').delete().eq('itinerary_id', itineraryId).eq('item_id', itemId);
  return NextResponse.json({ ok: true });
}
