import { NextRequest, NextResponse } from 'next/server';
import { authorizeTripOwnership, isUuid } from '@/lib/tripOwnership';

/**
 * /api/trip-budget — budget line items for the Trip Binder (Stage 3).
 *
 * A collection of editable money lines per trip (planned vs. actual), backed by
 * `trip_budget_items`. Same ownership gate as /api/trip-documents and
 * /api/trip-notes (authorizeTripOwnership) — the table has RLS on with no
 * policies, so it's only ever reachable through this service-role route.
 *
 * Unlike notes (one row per stop), a trip has MANY budget lines, so this route
 * is row-addressed by id: PUT creates (no id) or updates (id present), DELETE
 * removes a single line.
 */

const CATEGORIES = new Set(['flights', 'accommodation', 'food', 'transport', 'activities', 'shopping', 'other']);
const STATUSES = new Set(['planned', 'booked', 'paid']);
const MAX_LABEL = 200;
const MAX_PAID_BY = 120;
const MAX_AMOUNT = 100_000_000; // ₪100M — a sane ceiling that still fits numeric(12,2)

type Row = {
  id: string;
  item_id: string | null;
  label: string;
  category: string;
  planned_cost: string | number | null;
  actual_cost: string | number | null;
  currency: string;
  paid_by: string | null;
  status: string;
  updated_at: string;
};

function toItem(r: Row) {
  const num = (v: string | number | null) => (v === null ? null : typeof v === 'number' ? v : Number(v));
  return {
    id: r.id,
    itemId: r.item_id,
    label: r.label,
    category: r.category,
    plannedCost: num(r.planned_cost),
    actualCost: num(r.actual_cost),
    currency: r.currency,
    paidBy: r.paid_by,
    status: r.status,
    updatedAt: r.updated_at,
  };
}

/** Clamp/validate a money amount. Returns undefined for "not provided",
 *  null for an explicit clear, or a rounded number. Throws a message string on
 *  an invalid value so the caller can 400. */
function parseAmount(v: unknown, field: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > MAX_AMOUNT) throw `Invalid ${field}.`;
  return Math.round(n * 100) / 100;
}

/** GET ?itineraryId=… → { items: [...] } (oldest first for stable ordering). */
export async function GET(req: NextRequest) {
  const itineraryId = req.nextUrl.searchParams.get('itineraryId')?.trim() ?? '';
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const { data, error: selErr } = await db
    .from('trip_budget_items')
    .select('id, item_id, label, category, planned_cost, actual_cost, currency, paid_by, status, updated_at')
    .eq('itinerary_id', itineraryId)
    .order('created_at', { ascending: true });
  if (selErr) return NextResponse.json({ items: [] });

  return NextResponse.json({ items: (data ?? []).map((r) => toItem(r as Row)) });
}

/**
 * PUT body { itineraryId, id?, label, category?, plannedCost?, actualCost?,
 * currency?, paidBy?, status?, itemId? }
 *   • no id  → insert a new line (label required)
 *   • id set → update that line (only provided fields change; must belong to trip)
 */
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const itineraryId = (typeof body?.itineraryId === 'string' ? body.itineraryId.trim() : '') || '';
  const { db, userId, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;

  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const isUpdate = !!id;
  if (isUpdate && !isUuid(id)) {
    return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  }

  // Validate the fields that were provided.
  let planned: number | null | undefined;
  let actual: number | null | undefined;
  try {
    planned = parseAmount(body?.plannedCost, 'plannedCost');
    actual = parseAmount(body?.actualCost, 'actualCost');
  } catch (msg) {
    return NextResponse.json({ error: String(msg) }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body?.label === 'string') {
    const label = body.label.trim().slice(0, MAX_LABEL);
    if (!label) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });
    patch.label = label;
  }
  if (typeof body?.category === 'string') {
    if (!CATEGORIES.has(body.category)) return NextResponse.json({ error: 'Invalid category.' }, { status: 400 });
    patch.category = body.category;
  }
  if (typeof body?.status === 'string') {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
    patch.status = body.status;
  }
  if (typeof body?.currency === 'string' && body.currency.trim()) {
    patch.currency = body.currency.trim().slice(0, 8).toUpperCase();
  }
  if ('paidBy' in (body ?? {})) {
    patch.paid_by = typeof body?.paidBy === 'string' && body.paidBy.trim() ? body.paidBy.trim().slice(0, MAX_PAID_BY) : null;
  }
  if ('itemId' in (body ?? {})) {
    const it = typeof body?.itemId === 'string' ? body.itemId.trim() : '';
    if (it && !isUuid(it)) return NextResponse.json({ error: 'Invalid itemId.' }, { status: 400 });
    patch.item_id = it || null;
  }
  if (planned !== undefined) patch.planned_cost = planned;
  if (actual !== undefined) patch.actual_cost = actual;

  if (isUpdate) {
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    patch.updated_at = new Date().toISOString();
    // Scope by itinerary_id too, so a valid id from another trip can't be touched.
    const { data, error: upErr } = await db
      .from('trip_budget_items')
      .update(patch)
      .eq('id', id)
      .eq('itinerary_id', itineraryId)
      .select('id, item_id, label, category, planned_cost, actual_cost, currency, paid_by, status, updated_at')
      .maybeSingle();
    if (upErr) return NextResponse.json({ error: 'Update failed.' }, { status: 500 });
    if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    return NextResponse.json({ item: toItem(data as Row) });
  }

  // Insert — label is mandatory for a new line.
  if (!patch.label) return NextResponse.json({ error: 'A label is required.' }, { status: 400 });
  const { data, error: insErr } = await db
    .from('trip_budget_items')
    .insert({
      itinerary_id: itineraryId,
      user_id: userId,
      item_id: patch.item_id ?? null,
      label: patch.label,
      category: patch.category ?? 'other',
      planned_cost: patch.planned_cost ?? null,
      actual_cost: patch.actual_cost ?? null,
      currency: patch.currency ?? 'ILS',
      paid_by: patch.paid_by ?? null,
      status: patch.status ?? 'planned',
    })
    .select('id, item_id, label, category, planned_cost, actual_cost, currency, paid_by, status, updated_at')
    .maybeSingle();
  if (insErr || !data) return NextResponse.json({ error: 'Save failed.' }, { status: 500 });
  return NextResponse.json({ item: toItem(data as Row) });
}

/** DELETE body { itineraryId, id } → remove one budget line (scoped to trip). */
export async function DELETE(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { itineraryId?: string; id?: string } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  const { db, error } = await authorizeTripOwnership(req, itineraryId);
  if (error) return error;
  const id = body?.id?.trim() ?? '';
  if (!id || !isUuid(id)) return NextResponse.json({ error: 'A valid id is required.' }, { status: 400 });
  await db.from('trip_budget_items').delete().eq('id', id).eq('itinerary_id', itineraryId);
  return NextResponse.json({ ok: true });
}
