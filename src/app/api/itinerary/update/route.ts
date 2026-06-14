import { NextRequest, NextResponse } from 'next/server';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { createUserSupabase } from '@/lib/supabase-user';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Persists client-side itinerary edits (quick edits, swaps, drafts) back to
 * `itineraries.itinerary_json`. Relies on RLS: the owner-only `Owner-only
 * update/delete` policy and the `itinerary_collaborator_update` policy
 * (rows in `itinerary_shares`) together decide who may write. If neither
 * applies, the update affects 0 rows and we return 403.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: { itineraryId?: string; itinerary?: Itinerary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const itineraryId = body.itineraryId?.trim() ?? '';
  const itinerary = body.itinerary;
  if (!UUID_RE.test(itineraryId) || !itinerary) {
    return NextResponse.json({ error: 'itineraryId and itinerary are required.' }, { status: 400 });
  }

  const sb = createUserSupabase(token);

  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData.user) {
    return NextResponse.json({ error: 'Invalid session.' }, { status: 401 });
  }

  // Preserve the stored `_profile` blob — the client only edits the
  // itinerary body, never the traveler profile.
  const { data: existing } = await sb
    .from('itineraries')
    .select('itinerary_json')
    .eq('id', itineraryId)
    .maybeSingle();

  const existingProfile = (existing?.itinerary_json as (Itinerary & { _profile?: TravelerProfile }) | null)
    ?._profile;

  const mergedBlob: Itinerary & { _profile?: TravelerProfile } = {
    ...itinerary,
    _profile: existingProfile,
  };

  const { error: updErr, data: updatedRows } = await sb
    .from('itineraries')
    .update({ itinerary_json: mergedBlob })
    .eq('id', itineraryId)
    .select('id');

  if (updErr) {
    console.error('[itinerary/update]', updErr.message);
    return NextResponse.json({ error: 'Could not save changes.' }, { status: 500 });
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Not authorized to edit this trip.' }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
