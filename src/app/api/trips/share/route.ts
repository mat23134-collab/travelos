import { NextRequest, NextResponse } from 'next/server';
import { createUserSupabase } from '@/lib/supabase-user';
import { normalizeUsername, validateUsernameShape } from '@/lib/username';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: { itineraryId?: string; username?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const itineraryId = body.itineraryId?.trim() ?? '';
  const recipientRaw = body.username?.trim() ?? '';

  if (!UUID_RE.test(itineraryId)) {
    return NextResponse.json({ error: 'Invalid itinerary id.' }, { status: 400 });
  }

  const shapeErr = validateUsernameShape(recipientRaw);
  if (shapeErr) {
    return NextResponse.json({ error: shapeErr }, { status: 400 });
  }
  const recipientUsername = normalizeUsername(recipientRaw);

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
    return NextResponse.json({ error: 'Trip not found or access denied.' }, { status: 404 });
  }
  if (trip.user_id !== me) {
    return NextResponse.json({ error: 'Only the trip owner can share it.' }, { status: 403 });
  }

  const { data: profile, error: profErr } = await sb
    .from('profiles')
    .select('id')
    .eq('username', recipientUsername)
    .maybeSingle();

  if (profErr || !profile) {
    return NextResponse.json({ error: 'No user found with that username.' }, { status: 404 });
  }

  if (profile.id === me) {
    return NextResponse.json({ error: 'You cannot share a trip with yourself.' }, { status: 400 });
  }

  const { error: insErr } = await sb.from('itinerary_shares').insert({
    itinerary_id: itineraryId,
    shared_with_user_id: profile.id,
  });

  if (insErr) {
    if (insErr.code === '23505') {
      return NextResponse.json({ ok: true, alreadyShared: true, message: 'Already shared with this user.' });
    }
    console.error('[trips/share]', insErr.message);
    return NextResponse.json({ error: 'Could not save share. Try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sharedWith: recipientUsername });
}
