import { NextRequest, NextResponse } from 'next/server';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { buildCityProfile } from '@/services/neighborhood';
import type { ProfilerPoi, ProfilerTripContext } from '@/services/neighborhood';
import { buildGuideCacheKey, getCachedGuide, putCachedGuide } from '@/lib/neighborhoodGuideCache';

/** Per-key cooldown so the city guide isn't re-synthesized on a tight render loop. */
const lastRunAt = new Map<string, number>();
const COOLDOWN_MS = 30_000;

/**
 * POST /api/city-profile
 * Body: {
 *   city: string,
 *   pois?: { name, lat, lng, category? }[],   // a sample of the trip's stops (optional)
 *   profile?: { interests?, groupType?, budget?, pace?, dayNumber? }  // dayNumber = trip length
 * }
 *
 * Whole-trip CITY guide for the results page — no PostGIS / polygon dependency,
 * so it works for every city. Grounds the city with Tavily + Exa and synthesizes
 * a personalized Hebrew guide with Gemini. Auth-gated (three paid APIs) and
 * cached persistently, so repeat views are a single DB read.
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
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });

  const pois = Array.isArray(body?.pois)
    ? body!.pois!.filter((p) => p && typeof p.name === 'string').slice(0, 30)
    : [];
  const trip = body?.profile ?? {};

  // Persistent cache — a city guide is determined by (city, trip context, the
  // sampled stops), so a repeat view is a DB read and ZERO paid API calls.
  const cacheKey = buildGuideCacheKey(city, pois, trip, 'city');
  const cached = await getCachedGuide(cacheKey);
  if (cached) return NextResponse.json(cached);

  const now = Date.now();
  if (now - (lastRunAt.get(cacheKey) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ throttled: true }, { status: 429 });
  }
  lastRunAt.set(cacheKey, now);

  try {
    const profile = await buildCityProfile(city, pois, trip);
    if (!profile) return new NextResponse(null, { status: 204 });
    await putCachedGuide(cacheKey, city, profile);
    return NextResponse.json(profile);
  } catch (e) {
    lastRunAt.delete(cacheKey);
    const msg = e instanceof Error ? e.message : 'city profiler failed';
    console.warn('[city-profile]', msg);
    return NextResponse.json({ error: 'City guide failed. Please try again.' }, { status: 502 });
  }
}
