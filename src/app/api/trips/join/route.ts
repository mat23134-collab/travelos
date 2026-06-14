import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabase } from '@/lib/supabase-user';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Lets a signed-in user join a trip via its share link — adds them as a
 * collaborator (a row in `itinerary_shares`). Once joined, the trip shows
 * up in their dashboard as "Shared with you" and they get edit access via
 * the `itinerary_collaborator_update` RLS policy.
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

  const sb = createUserSupabase(token);

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }
  const me = userData.user.id;

  const { data: trip, error: tripErr } = await sb
    .from('itineraries')
    .select('id, user_id')
    .eq('id', itineraryId)
    .maybeSingle();

  if (tripErr || !trip) {
    return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  }

  if (trip.user_id === me) {
    return NextResponse.json({ ok: true, alreadyOwner: true });
  }

  const { error: insErr } = await sb.from('itinerary_shares').insert({
    itinerary_id: itineraryId,
    shared_with_user_id: me,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ ok: true, alreadyJoined: true });
    }
    console.error('[trips/join]', insErr.message);
    return NextResponse.json({ error: 'Could not join this trip. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, joined: true });
}
