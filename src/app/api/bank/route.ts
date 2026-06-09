import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';

export interface BankItem {
  id: string;
  itinerary_id: string;
  name: string;
  description: string | null;
  category_emoji: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  website_url: string | null;
  source: 'ai' | 'manual';
  top_pick_category: 'sightseeing' | 'history' | 'food' | null;
  created_at: string;
}

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const itineraryId = (req.nextUrl.searchParams.get('itinerary_id') ?? '').trim();
  if (!itineraryId) {
    return NextResponse.json({ error: 'itinerary_id query param required' }, { status: 400 });
  }

  const db = dbClient();
  const { data, error } = await db
    .from('attraction_bank')
    .select('id, itinerary_id, name, description, category_emoji, lat, lng, photo_url, website_url, source, top_pick_category, created_at')
    .eq('itinerary_id', itineraryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[api/bank] select failed:', error.message);
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as BankItem[] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  let body: {
    itinerary_id?: string;
    name?: string;
    description?: string;
    category_emoji?: string;
    lat?: number;
    lng?: number;
    website_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const itineraryId = (body.itinerary_id ?? '').trim();
  const name = (body.name ?? '').trim();
  if (!itineraryId || !name) {
    return NextResponse.json({ error: 'itinerary_id and name are required' }, { status: 400 });
  }

  const db = dbClient();
  const { data, error } = await db
    .from('attraction_bank')
    .insert({
      itinerary_id: itineraryId,
      user_id: userId,
      name,
      description: body.description?.trim() || null,
      category_emoji: body.category_emoji?.trim() || '📍',
      lat: typeof body.lat === 'number' ? body.lat : null,
      lng: typeof body.lng === 'number' ? body.lng : null,
      website_url: body.website_url?.trim() || null,
      source: 'manual',
      top_pick_category: null,
    })
    .select('id, itinerary_id, name, description, category_emoji, lat, lng, photo_url, website_url, source, top_pick_category, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data as BankItem });
}
