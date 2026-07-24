import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runRestaurantScoutAgent } from '@/lib/restaurantScoutAgent';
import { upsertRestaurants, fetchRestaurantsForCity, cityLastUpdated, MAX_PRICE_LEVEL_BY_BUDGET } from '@/lib/restaurantBank';
import { verifySessionUser, unauthorizedResponse, isAdminEmail, forbiddenResponse } from '@/lib/apiGuard';
import { BudgetLevel, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/** Per-city cooldown to limit abuse of Gemini + Exa + Places (in-memory). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;

const BUDGET_LEVELS: readonly BudgetLevel[] = ['budget', 'mid-range', 'luxury'];

/**
 * POST /api/restaurants/scout — ADMIN ONLY.
 * Body: { city: string, lang?: string, budget?: BudgetLevel }
 *
 * Runs the restaurant scout (Exa → Gemini → Google Places → scoring) and
 * upserts `public.restaurant_recommendations` via the service-role client.
 * Returns the freshly-scored bank so the client can render immediately.
 *
 * This is a curated, read-only database from the traveler's point of view —
 * no signed-in user (or bug/abuse pattern) can trigger a live scout from the
 * app itself; populating a new city is an explicit admin action (§ cost
 * control). The client (`RestaurantsPanel`) never calls this route anymore.
 *
 * `budget` drives two different behaviors depending on whether the city has
 * been scouted before:
 *   - Brand-new city (no rows yet): the general full-spread scout runs
 *     alongside a dedicated affordable/mid-range pass IN PARALLEL, so the
 *     bank isn't luxury-skewed from the very first save (that skew is exactly
 *     what happened to Tokyo's original 8-row bank — 7 of them price_level 3–4).
 *   - Existing city (called because the GET route flagged `needsTopUp`):
 *     ONLY the budget-scoped pass runs, upserted in 'additive' mode so
 *     existing rows (including any splurge picks) are never touched.
 */
export async function POST(req: NextRequest) {
  const sessionUser = await verifySessionUser(req);
  if (!sessionUser) return unauthorizedResponse();
  if (!isAdminEmail(sessionUser.email)) return forbiddenResponse('Restaurant scouting is an admin-only operation.');

  const body = (await req.json().catch(() => null)) as
    | { city?: string; lang?: string; budget?: string }
    | null;
  const city = body?.city?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(body?.lang ?? '')
    ? (body!.lang as SiteLanguage)
    : 'en';
  const budget: BudgetLevel | null = BUDGET_LEVELS.includes(body?.budget as BudgetLevel)
    ? (body!.budget as BudgetLevel)
    : null;
  const maxPriceLevel = budget ? MAX_PRICE_LEVEL_BY_BUDGET[budget] : undefined;

  const key = city.toLowerCase();
  const now = Date.now();
  const prev = lastScoutAt.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    // Someone already kicked a scout recently — return whatever is cached.
    const db = createServiceRoleClient();
    const cached = db ? await fetchRestaurantsForCity(db, city, { lang, maxPriceLevel }) : [];
    return NextResponse.json({ ok: true, throttled: true, restaurants: cached });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    const hasExisting = (await cityLastUpdated(db, city)) != null;

    if (!hasExisting) {
      const [primary, topUp] = await Promise.all([
        runRestaurantScoutAgent(city),
        maxPriceLevel != null ? runRestaurantScoutAgent(city, { maxPriceLevel }) : Promise.resolve([]),
      ]);
      const recs = [...primary, ...topUp];
      if (recs.length === 0) {
        return NextResponse.json(
          { ok: false, restaurants: [], message: 'Scout returned no restaurants' },
          { status: 422 },
        );
      }
      await upsertRestaurants(db, recs);
    } else if (maxPriceLevel != null) {
      const recs = await runRestaurantScoutAgent(city, { maxPriceLevel });
      if (recs.length > 0) await upsertRestaurants(db, recs, { mode: 'additive' });
    }

    // Read back from the DB, budget-filtered, so ids/ordering match GET.
    const restaurants = await fetchRestaurantsForCity(db, city, { lang, maxPriceLevel });
    return NextResponse.json({ ok: true, restaurants });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Scout failed';
    console.warn('[restaurants/scout]', msg);
    return NextResponse.json({ error: 'Restaurant scout failed. Please try again.' }, { status: 502 });
  }
}
