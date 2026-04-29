import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const destination = body?.destination ?? '';

    if (!destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('itineraries')
      .insert([{ destination, status: 'generating', profile_json: body }])
      .select('id')
      .single();

    if (error) {
      console.error('[generate] insert error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data?.id) {
      return NextResponse.json({ error: 'Insert returned no ID' }, { status: 500 });
    }

    console.log('[generate] created row id:', data.id);
    return NextResponse.json({ id: data.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] unhandled error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
