import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runRestaurantScoutAgent } from '@/lib/restaurantScoutAgent';
import { upsertRestaurants, fetchRestaurantsForCity } from '@/lib/restaurantBank';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/** Per-city cooldown to limit abuse of Gemini + Exa + Places (in-memory). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;

/**
 * POST /api/restaurants/scout
 * Body: { city: string }
 *
 * Runs the restaurant scout (Exa → Gemini → Google Places → scoring) and
 * upserts `public.restaurant_recommendations` via the service-role client.
 * Returns the freshly-scored bank so the client can render immediately.
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as { city?: string; lang?: string } | null;
  const city = body?.city?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(body?.lang ?? '')
    ? (body!.lang as SiteLanguage)
    : 'en';

  const key = city.toLowerCase();
  const now = Date.now();
  const prev = lastScoutAt.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    // Someone already kicked a scout recently — return whatever is cached.
    const db = createServiceRoleClient();
    const cached = db ? await fetchRestaurantsForCity(db, city, { lang }) : [];
    return NextResponse.json({ ok: true, throttled: true, restaurants: cached });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    const recs = await runRestaurantScoutAgent(city);
    if (recs.length === 0) {
      return NextResponse.json(
        { ok: false, restaurants: [], message: 'Scout returned no restaurants' },
        { status: 422 },
      );
    }
    await upsertRestaurants(db, recs);
    // Read back from the DB so ids/ordering match what GET would return.
    const restaurants = await fetchRestaurantsForCity(db, city, { lang });
    return NextResponse.json({ ok: true, restaurants });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Scout failed';
    console.warn('[restaurants/scout]', msg);
    return NextResponse.json({ error: 'Restaurant scout failed. Please try again.' }, { status: 502 });
  }
}
