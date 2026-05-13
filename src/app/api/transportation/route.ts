import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchTransportGuideForCity } from '@/lib/tripTransport';

/**
 * GET /api/transportation?city=Paris
 * Returns cached city mobility guide from `public.transportation` (anon + RLS read).
 */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city')?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city query parameter is required' }, { status: 400 });
  }

  const guide = await fetchTransportGuideForCity(supabase, city);
  return NextResponse.json({ guide: guide ?? null });
}
