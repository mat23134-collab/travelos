import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { buildNeighborhoodProfile } from '@/services/neighborhood';
import type { ProfilerPoi, ProfilerTripContext } from '@/services/neighborhood';
import { buildGuideCacheKey, getCachedGuide, putCachedGuide } from '@/lib/neighborhoodGuideCache';

/** Per-key cooldown so a day's guide isn't re-synthesized on every render. */
const lastRunAt = new Map<string, number>();
const COOLDOWN_MS = 30_000;

/**
 * POST /api/neighborhood-profile
 * Body: {
 *   city: string,
 *   pois: { name, lat, lng, category? }[],   // the day's generated stops
 *   profile?: { interests?, groupType?, budget?, pace?, dayNumber? }
 * }
 *
 * Maps the day's POIs to their dominant neighborhood (PostGIS), grounds it with
 * Tavily + Exa, and synthesizes a personalized Hebrew guide with Gemini.
 * Auth-gated (the pipeline calls three paid APIs). Returns 204 when the city has
 * no neighborhood polygons loaded (the client hides the panel).
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as {
    city?: string;
    pois?: ProfilerPoi[];
    profile?: ProfilerTripContext;
  } | null;

  const city = body?.city?.trim() ?? '';
  const pois = Array.isArray(body?.pois) ? body!.pois! : [];
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });

  const validPois = pois
    .filter((p) => p && typeof p.name === 'string' && Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .slice(0, 30);
  if (validPois.length === 0) {
    return NextResponse.json({ error: 'at least one geo-located POI is required' }, { status: 400 });
  }

  const trip = body?.profile ?? {};

  // Persistent cache: a guide is fully determined by (city, POI geometry, trip
  // context), so a repeat view is a single DB read and ZERO paid API calls.
  const cacheKey = buildGuideCacheKey(city, validPois, trip);
  const cached = await getCachedGuide(cacheKey);
  if (cached) return NextResponse.json(cached);

  // Cache miss → cooldown keyed by the day's geometry guards against a burst of
  // concurrent cold builds hammering the paid APIs on a tight render loop.
  const key = `${city.toLowerCase()}:${validPois.map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`).sort().join('|')}`;
  const now = Date.now();
  if (now - (lastRunAt.get(key) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ throttled: true }, { status: 429 });
  }
  lastRunAt.set(key, now);

  try {
    const profile = await buildNeighborhoodProfile(supabase, city, validPois, trip);
    if (!profile) {
      // No neighborhood polygons for this city yet — feature simply hidden.
      return new NextResponse(null, { status: 204 });
    }
    await putCachedGuide(cacheKey, city, profile); // persist for next time
    return NextResponse.json(profile);
  } catch (e) {
    lastRunAt.delete(key); // let the client retry a genuine failure
    const msg = e instanceof Error ? e.message : 'profiler failed';
    console.warn('[neighborhood-profile]', msg);
    return NextResponse.json({ error: 'Neighborhood profiler failed. Please try again.' }, { status: 502 });
  }
}
