/**
 * Trip session row + per-city transportation cache (Supabase `trips`, `transportation`).
 * Writes use the service-role client from API routes; reads may use anon + RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CityTransportGuide } from '@/lib/types';
import { parseTransportGuideJson, hasTransportContent } from '@/lib/transportGuideParse';
import { runTransportScoutAgent } from '@/lib/transportScoutAgent';

export { parseTransportGuideJson, hasTransportContent } from '@/lib/transportGuideParse';

export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

export async function fetchTransportGuideForCity(
  db: SupabaseClient,
  city: string,
): Promise<CityTransportGuide | null> {
  const key = normalizeCityKey(city);
  if (!key) return null;
  const { data, error } = await db.from('transportation').select('guide').eq('city_norm', key).maybeSingle();
  if (error) {
    console.warn('[tripTransport] transportation select:', error.message);
    return null;
  }
  return parseTransportGuideJson(data?.guide);
}

export async function upsertTransportationGuide(
  db: SupabaseClient,
  cityDisplay: string,
  guide: CityTransportGuide,
): Promise<void> {
  const city_name = cityDisplay.trim();
  if (!city_name) return;
  const row = {
    city_name,
    guide,
    updated_at: new Date().toISOString(),
  };
  const { error } = await db.from('transportation').upsert(row, { onConflict: 'city_norm' });
  if (error) {
    console.warn('[tripTransport] transportation upsert failed:', error.message);
  }
}

/**
 * When a trip is created: if no `transportation` row for this city, run the transport scout
 * (Gemini + optional web snippets) and upsert the guide.
 */
export async function ensureTransportationForCity(
  db: SupabaseClient,
  cityRaw: string,
  tripDays?: number,
): Promise<void> {
  const city = cityRaw.trim();
  if (!city) return;

  const key = normalizeCityKey(city);
  const { data: existing, error: selErr } = await db.from('transportation').select('id').eq('city_norm', key).maybeSingle();
  if (selErr) {
    console.warn('[tripTransport] ensureTransportation select:', selErr.message);
    return;
  }
  if (existing) return;

  try {
    const guide = await runTransportScoutAgent(city, { tripDays });
    if (!guide || !hasTransportContent(guide)) {
      console.warn('[tripTransport] scout returned empty guide for', city);
      return;
    }
    await upsertTransportationGuide(db, city, guide);
    console.log('[tripTransport] transportation populated for', city);
  } catch (e) {
    console.warn('[tripTransport] scout failed (non-critical):', e instanceof Error ? e.message : e);
  }
}

/** Best-effort session row — mirrors itinerary creation for analytics / city_name / welcome copy. */
export async function persistTripSessionRow(
  db: SupabaseClient,
  args: {
    itineraryId: string;
    userId: string | null;
    cityName: string;
    username?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  },
): Promise<void> {
  const city_name = args.cityName.trim();
  if (!city_name || !args.itineraryId) return;
  const row: Record<string, unknown> = {
    itinerary_id: args.itineraryId,
    user_id: args.userId,
    city_name,
    username: args.username?.trim() || null,
    start_date: args.startDate?.trim().slice(0, 10) || null,
    end_date: args.endDate?.trim().slice(0, 10) || null,
    updated_at: new Date().toISOString(),
  };

  // Strategy: try upsert first; on unique violation fall back to UPDATE;
  // on missing-column errors strip the column and retry.
  for (let i = 0; i < 8; i++) {
    const hasItinId = 'itinerary_id' in row;

    const { error } = hasItinId
      ? await db.from('trips').upsert(row, { onConflict: 'itinerary_id' })
      : await db.from('trips').insert(row);

    if (!error) {
      console.log('[tripTransport] trips row saved for itinerary:', args.itineraryId);
      return;
    }

    const msg = error.message ?? '';
    console.warn('[tripTransport] trips upsert attempt', i + 1, 'error:', msg);

    // Unique violation (23505) — row already exists, update it instead
    if (error.code === '23505' || msg.includes('duplicate key') || msg.includes('unique')) {
      const { id: _id, itinerary_id: _iid, ...updateFields } = row as Record<string, unknown>;
      const { error: updErr } = await db
        .from('trips')
        .update(updateFields)
        .eq('itinerary_id', args.itineraryId);
      if (updErr) {
        console.warn('[tripTransport] trips update fallback failed:', updErr.message);
      } else {
        console.log('[tripTransport] trips row updated (fallback) for itinerary:', args.itineraryId);
      }
      return;
    }

    // Missing column — strip and retry
    const missing = msg.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missing || !(missing in row)) {
      console.warn('[tripTransport] trips upsert skipped (unrecoverable):', msg);
      return;
    }
    delete row[missing];
    console.warn('[tripTransport] trips upsert retry without column:', missing);
  }
}
