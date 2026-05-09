import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { normalizeUsername, validateUsernameShape } from '@/lib/username';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('u') ?? '';
  const shapeErr = validateUsernameShape(raw);
  if (shapeErr) {
    return NextResponse.json({ available: false, error: shapeErr }, { status: 400 });
  }
  const u = normalizeUsername(raw);

  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', u)
    .maybeSingle();

  if (error) {
    console.error('[username-available]', error.message);
    return NextResponse.json({ available: false, error: 'Could not check username.' }, { status: 500 });
  }

  return NextResponse.json({ available: !data });
}
