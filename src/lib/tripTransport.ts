/**
 * Trip session row + per-city transportation cache (Supabase `trips`, `transportation`).
 * Writes use the service-role client from API routes; reads may use anon + RLS.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CityTransportGuide } from '@/lib/types';
import { parseTransportGuideJson } from '@/lib/transportGuideParse';
import { runTransportScoutAgent } from '@/lib/transportScoutAgent';

export { parseTransportGuideJson } from '@/lib/transportGuideParse';

export function normalizeCityKey(city: string): string {
  return city.trim().toLowerCase();
}

function isNonEmptyGuide(g: CityTransportGuide | null | undefined): boolean {
  if (!g) return false;
  if (g.intro?.trim()) return true;
  if ((g.options?.length ?? 0) > 0) return true;
  if ((g.links?.length ?? 0) > 0) return true;
  return false;
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
export async function ensureTransportationForCity(db: SupabaseClient, cityRaw: string): Promise<void> {
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
    const guide = await runTransportScoutAgent(city);
    if (!guide || !isNonEmptyGuide(guide)) {
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
  for (let i = 0; i < 6; i++) {
    const { error } = await db.from('trips').upsert(row, { onConflict: 'itinerary_id' });
    if (!error) return;
    const missing = error.message?.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missing || !(missing in row)) {
      console.warn('[tripTransport] trips upsert skipped:', error.message);
      return;
    }
    delete row[missing];
    console.warn('[tripTransport] trips upsert retry without column:', missing);
  }
}
