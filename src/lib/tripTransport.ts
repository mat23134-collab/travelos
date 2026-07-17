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
  lang: string = 'en',
): Promise<CityTransportGuide | null> {
  const key = normalizeCityKey(city);
  if (!key) return null;
  const { data, error } = await db.from('transportation').select('guide, guide_he').eq('city_norm', key).maybeSingle();
  if (error) {
    console.warn('[tripTransport] transportation select:', error.message);
    return null;
  }
  // Hebrew guide when present; fall back to the English guide.
  const raw = lang === 'he' && data?.guide_he ? data.guide_he : data?.guide;
  return parseTransportGuideJson(raw);
}

export async function upsertTransportationGuide(
  db: SupabaseClient,
  cityDisplay: string,
  guide: CityTransportGuide,
  lang: string = 'en',
): Promise<void> {
  const city_name = cityDisplay.trim();
  if (!city_name) return;
  // Hebrew guides go in guide_he so the English `guide` is preserved (a user can
  // choose either language). Only the relevant column is written on upsert.
  const row: Record<string, unknown> = { city_name, updated_at: new Date().toISOString() };
  if (lang === 'he') row.guide_he = guide;
  else row.guide = guide;
  const { error } = await db.from('transportation').upsert(row, { onConflict: 'city_norm' });
  if (error) {
    const e = error as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN TRANSPORTATION:');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
  } else {
    console.log('✅ transportation upsert OK for city:', city_name);
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
  lang: string = 'en',
): Promise<void> {
  const city = cityRaw.trim();
  if (!city) return;

  const STALE_MS = 90 * 24 * 60 * 60 * 1000; // 3 months

  const key = normalizeCityKey(city);
  const { data: existing, error: selErr } = await db.from('transportation').select('id, updated_at, guide, guide_he').eq('city_norm', key).maybeSingle();
  if (selErr) {
    const e = selErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN TRANSPORTATION (select check):');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
    return;
  }
  // Per-language: the row may exist with an English guide but no Hebrew yet.
  const langGuide = lang === 'he' ? existing?.guide_he : existing?.guide;
  if (existing && langGuide) {
    const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
    const isStale = Date.now() - updatedAt > STALE_MS;
    if (!isStale) {
      console.log(`ℹ️  transportation (${lang}) already exists for city:`, city, '— skipping scout');
      return;
    }
    console.log('🔄 transportation data for city:', city, 'is older than 3 months — refreshing…');
  }

  console.log(`🔍 transportation (${lang}) missing for city:`, city, '— running scout agent…');
  try {
    const guide = await runTransportScoutAgent(city, { tripDays, lang });
    if (!guide || !hasTransportContent(guide)) {
      console.warn('⚠️  scout returned empty guide for', city);
      return;
    }
    await upsertTransportationGuide(db, city, guide, lang);
  } catch (e) {
    console.warn('⚠️  transportation scout failed (non-critical):', e instanceof Error ? e.message : e);
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

  console.log('⏳ persistTripSessionRow — attempting upsert for itinerary:', args.itineraryId, 'city:', city_name);

  // Strategy: try upsert first; on unique violation fall back to UPDATE;
  // on missing-column errors strip the column and retry.
  for (let i = 0; i < 8; i++) {
    const hasItinId = 'itinerary_id' in row;

    const { error } = hasItinId
      ? await db.from('trips').upsert(row, { onConflict: 'itinerary_id' })
      : await db.from('trips').insert(row);

    if (!error) {
      console.log('✅ TRIPS ROW SAVED — itinerary:', args.itineraryId);
      return;
    }

    const e = error as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log(`❌ SUPABASE ERROR DETECTED IN TRIPS (attempt ${i + 1}):`);
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
    console.log('  Row being inserted:', JSON.stringify(row, null, 2));

    const msg  = e.message ?? '';
    const code = e.code ?? '';

    // Unique violation (23505) — row already exists, update it instead
    if (code === '23505' || msg.includes('duplicate key') || msg.includes('unique')) {
      console.log('  → unique violation — falling back to UPDATE');
      const { id: _id, itinerary_id: _iid, ...updateFields } = row as Record<string, unknown>;
      const { error: updErr } = await db
        .from('trips')
        .update(updateFields)
        .eq('itinerary_id', args.itineraryId);
      if (updErr) {
        const ue = updErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
        console.log('❌ SUPABASE ERROR DETECTED IN TRIPS (update fallback):');
        console.log('  Message:', ue.message);
        console.log('  Details:', ue.details);
        console.log('  Hint:   ', ue.hint);
        console.log('  Code:   ', ue.code);
      } else {
        console.log('✅ TRIPS ROW UPDATED (fallback) — itinerary:', args.itineraryId);
      }
      return;
    }

    // Missing column — strip and retry
    const missing = msg.match(/Could not find the '([^']+)' column/)?.[1];
    if (!missing || !(missing in row)) {
      console.log('  → unrecoverable error — aborting trips write');
      return;
    }
    delete row[missing];
    console.log('  → retrying without missing column:', missing);
  }
}
