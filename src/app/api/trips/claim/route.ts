import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabase } from '@/lib/supabase-user';
import { createServiceRoleClient } from '@/lib/supabaseService';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/trips/claim — lets a newly-signed-in user take ownership of a trip
 * they generated as a guest (guest mode: onboarding + generation need no
 * account; the itinerary page gates the full view behind sign-up for any
 * trip with no owner yet).
 *
 * First claim wins: only succeeds while itineraries.user_id IS NULL, via a
 * single atomic conditional UPDATE (not a read-then-write), so two people
 * racing to claim the same link can't both "win." Uses the service-role
 * client because the existing UPDATE RLS policy is `auth.uid() = user_id`,
 * which can never match a NULL user_id — an authenticated user's own client
 * literally cannot claim an unowned row.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: { itineraryId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const itineraryId = body.itineraryId?.trim() ?? '';
  if (!UUID_RE.test(itineraryId)) {
    return NextResponse.json({ error: 'Invalid itinerary id.' }, { status: 400 });
  }

  const userClient = createUserSupabase(token);
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }
  const me = userData.user.id;

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role).' }, { status: 503 });
  }

  // Already-owned check first so an owner re-hitting this endpoint (e.g. a
  // stale pending-intent replay) gets a clean "already yours" instead of a
  // silent no-op.
  const { data: existing, error: readErr } = await db
    .from('itineraries')
    .select('id, user_id')
    .eq('id', itineraryId)
    .maybeSingle();
  if (readErr || !existing) {
    return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  }
  if (existing.user_id === me) {
    return NextResponse.json({ ok: true, claimed: true, alreadyOwner: true });
  }
  if (existing.user_id) {
    // Someone else already claimed it — not an error, just not for this user.
    return NextResponse.json({ ok: true, claimed: false, reason: 'already-claimed' });
  }

  const { data: updated, error: updateErr } = await db
    .from('itineraries')
    .update({ user_id: me })
    .eq('id', itineraryId)
    .is('user_id', null) // atomic guard — loses the race gracefully instead of overwriting a concurrent claim
    .select('id');

  if (updateErr) {
    console.error('[trips/claim]', updateErr.message);
    return NextResponse.json({ error: 'Could not claim this trip. Try again.' }, { status: 500 });
  }

  const claimed = (updated?.length ?? 0) > 0;
  return NextResponse.json({ ok: true, claimed, reason: claimed ? undefined : 'already-claimed' });
}
