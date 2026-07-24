import { NextRequest, NextResponse } from 'next/server';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { buildCityProfile } from '@/services/neighborhood';
import { buildCityGuideCacheKey, getCachedGuide, putCachedGuide } from '@/lib/neighborhoodGuideCache';

/** Per-key cooldown so the city guide isn't re-synthesized on a tight render loop. */
const lastRunAt = new Map<string, number>();
const COOLDOWN_MS = 30_000;

/**
 * POST /api/city-profile
 * Body: { city: string, lang?: 'he' | 'en' }
 *
 * Whole-trip CITY guide for the results page — no PostGIS / polygon dependency,
 * so it works for every city. Grounds the city with Tavily + Exa and synthesizes
 * a guide with Gemini in the requested site language. The guide is CITY-GENERIC
 * (not per-traveler), so it's keyed and cached by CITY + LANGUAGE — built once
 * per city per language and reused for every trip and traveler. Auth-gated
 * (three paid APIs).
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as { city?: string; lang?: string } | null;

  const city = body?.city?.trim() ?? '';
  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });
  const lang: 'he' | 'en' = body?.lang === 'en' ? 'en' : 'he';

  // Persistent cache keyed by CITY + LANGUAGE — first traveler to a city+lang
  // builds it, everyone else gets a single DB read with ZERO paid API calls.
  const cacheKey = buildCityGuideCacheKey(city, lang);
  const cached = await getCachedGuide(cacheKey);
  if (cached) return NextResponse.json(cached);

  const now = Date.now();
  if (now - (lastRunAt.get(cacheKey) ?? 0) < COOLDOWN_MS) {
    return NextResponse.json({ throttled: true }, { status: 429 });
  }
  lastRunAt.set(cacheKey, now);

  try {
    const profile = await buildCityProfile(city, lang);
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
