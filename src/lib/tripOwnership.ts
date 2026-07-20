import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

/**
 * tripOwnership — the single ownership gate shared by every trip-scoped write
 * API (documents, notes/status, budget). Extracted verbatim from the original
 * inline `authorize()` in /api/trip-documents so the Binder routes don't each
 * re-implement (and risk diverging on) the "is this the caller's trip?" check.
 *
 * Confirms: valid session → valid itinerary UUID → the itinerary's user_id
 * matches the session user. Returns the service-role client (bypasses RLS; the
 * Binder tables have RLS on with no policies, so the browser can never reach
 * them) plus the resolved userId, or a ready-to-return error response.
 */

export const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export type TripAuthResult =
  | { error: NextResponse; db?: undefined; userId?: undefined }
  | { error?: undefined; db: SupabaseClient; userId: string };

export async function authorizeTripOwnership(
  req: NextRequest,
  itineraryId: string,
): Promise<TripAuthResult> {
  const userId = await verifySession(req);
  if (!userId) return { error: unauthorizedResponse() as NextResponse };
  if (!isUuid(itineraryId)) {
    return { error: NextResponse.json({ error: 'Invalid itineraryId.' }, { status: 400 }) };
  }
  const db = createServiceRoleClient();
  if (!db) return { error: NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 }) };

  const { data, error } = await db
    .from('itineraries')
    .select('user_id')
    .eq('id', itineraryId)
    .single();
  if (error || !data) return { error: NextResponse.json({ error: 'Trip not found.' }, { status: 404 }) };
  if (data.user_id !== userId) {
    return { error: NextResponse.json({ error: 'Not your trip.' }, { status: 403 }) };
  }
  return { db, userId };
}
