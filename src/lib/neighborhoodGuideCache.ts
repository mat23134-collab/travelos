/**
 * neighborhoodGuideCache.ts — persistent cache for synthesized neighborhood
 * guides, so we don't re-run Tavily + Exa + Gemini on every render.
 *
 * A guide is fully determined by (city, the day's POI geometry, trip context),
 * so we hash those into a stable key and store the finished NeighborhoodProfile
 * in `public.neighborhood_guide_cache`. Cache hit = 0 external API calls.
 *
 * Service-role only (bypasses RLS); fully null-safe — if the env/table isn't
 * there, reads return null (miss) and writes no-op, so the profiler falls back
 * to live synthesis exactly as before.
 */

import { createHash } from 'crypto';
import { createServiceRoleClient } from '@/lib/supabaseService';
import type { NeighborhoodProfile, ProfilerPoi, ProfilerTripContext } from '@/services/neighborhood/types';

const TABLE = 'neighborhood_guide_cache';
const DEFAULT_TTL_DAYS = 30;
// Bump when the guide's shape or prompt changes, to invalidate old entries.
const CACHE_VERSION = 'v1';

/**
 * Deterministic cache key from everything that changes the guide's output:
 * city, the day's POIs (rounded so tiny coordinate jitter still hits), and the
 * personalization context. Two identical days for the same vibe share a key.
 */
export function buildGuideCacheKey(
  city: string,
  pois: ProfilerPoi[],
  trip: ProfilerTripContext,
  scope: 'nb' | 'city' = 'nb',
): string {
  const poiSig = pois
    .map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
    .sort()
    .join('|');
  const tripSig = [
    (trip.interests ?? []).map((s) => s.toLowerCase().trim()).sort().join(','),
    trip.groupType ?? '',
    trip.budget ?? '',
    trip.pace ?? '',
    trip.dayNumber ?? '',
  ].join('~');
  const raw = `${CACHE_VERSION}::${scope}::${city.toLowerCase().trim()}::${poiSig}::${tripSig}`;
  return createHash('sha1').update(raw).digest('hex');
}

/** Fresh cached profile for this key, or null on miss / expiry / any error. */
export async function getCachedGuide(cacheKey: string): Promise<NeighborhoodProfile | null> {
  const db = createServiceRoleClient();
  if (!db) return null;
  try {
    const { data, error } = await db
      .from(TABLE)
      .select('profile, expires_at')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (error || !data?.profile) return null;
    return data.profile as NeighborhoodProfile;
  } catch {
    return null;
  }
}

/** Persist a freshly-built profile. Fire-and-forget; never throws. */
export async function putCachedGuide(
  cacheKey: string,
  city: string,
  profile: NeighborhoodProfile,
  ttlDays: number = DEFAULT_TTL_DAYS,
): Promise<void> {
  const db = createServiceRoleClient();
  if (!db) return;
  const expiresAt = new Date(Date.now() + ttlDays * 86_400_000).toISOString();
  try {
    const { error } = await db.from(TABLE).upsert(
      {
        cache_key: cacheKey,
        city,
        neighborhood_name: profile.neighborhood?.nameEnglish ?? null,
        profile,
        created_at: new Date().toISOString(),
        expires_at: expiresAt,
      },
      { onConflict: 'cache_key' },
    );
    if (error) console.warn('[neighborhoodGuideCache] write failed:', error.message);
  } catch (e) {
    console.warn('[neighborhoodGuideCache] write error:', e instanceof Error ? e.message : e);
  }
}
