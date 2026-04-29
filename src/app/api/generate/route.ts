import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // Surface missing env vars as a JSON error instead of an HTML crash page
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('[generate] Supabase env vars missing');
    return NextResponse.json({ error: 'Supabase is not configured on this deployment.' }, { status: 500 });
  }

  let profile: TravelerProfile;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!profile.destination) {
    return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('itineraries')
      .insert([{
        destination: profile.destination,
        status: 'generating',
        profile_json: profile,
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[generate] Supabase insert error:', JSON.stringify(error));
      return NextResponse.json({ error: 'Failed to create itinerary: ' + error.message }, { status: 500 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: 'Insert returned no ID' }, { status: 500 });
    }

    console.log('[generate] Created row:', data.id, '| dest:', profile.destination);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Database error: ' + msg }, { status: 500 });
  }
}
