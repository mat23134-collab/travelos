import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantsForCity, cityLastUpdated, cityBudgetStats, MAX_PRICE_LEVEL_BY_BUDGET } from '@/lib/restaurantBank';
import { isStale, REC_TTL_DAYS } from '@/lib/recStaleness';
import { BudgetLevel, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

const BUDGET_LEVELS: readonly BudgetLevel[] = ['budget', 'mid-range', 'luxury'];

/**
 * GET /api/restaurants?city=Rome&lang=he&budget=mid-range&splurge=1
 *
 * Returns the cached, best-scored reservable restaurants for a city from
 * `public.restaurant_recommendations` (anon + RLS public read), with text
 * resolved to the requested site language. The client polls this while the
 * scout populates the bank in the background.
 *
 * `budget` scopes results to the trip's chosen tier (in-budget rows first,
 * pricier ones only as a backfill so the panel is never sparse). Pass
 * `splurge=1` alongside it to lift the cap — the traveler explicitly asking to
 * see the full (often pricier) list regardless of their trip budget.
 *
 * `limit` lets the panel pull a wider pool (rows carry the book-ahead engine
 * fields) that the client-side ranker then re-orders by per-trip fit and trims.
 * `splurgeAvailable` tells the panel whether pricier picks exist above the
 * budget ceiling, so it can offer the "show splurge picks too" toggle.
 */
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city')?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city query parameter is required' }, { status: 400 });
  }

  const langParam = req.nextUrl.searchParams.get('lang') ?? 'en';
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(langParam)
    ? (langParam as SiteLanguage)
    : 'en';

  const budgetParam = req.nextUrl.searchParams.get('budget') ?? '';
  const showSplurge = req.nextUrl.searchParams.get('splurge') === '1';
  const budget: BudgetLevel | null = BUDGET_LEVELS.includes(budgetParam as BudgetLevel)
    ? (budgetParam as BudgetLevel)
    : null;
  const maxPriceLevel = budget && !showSplurge ? MAX_PRICE_LEVEL_BY_BUDGET[budget] : undefined;

  // Wider pool (capped) so the client-side ranker has candidates to diversify
  // and fit-rank over; it trims back to the 4–8 shown.
  const limitParam = Number(req.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) ? Math.min(40, Math.max(4, limitParam)) : 12;

  const [restaurants, lastUpdated, budgetStats] = await Promise.all([
    fetchRestaurantsForCity(supabase, city, { lang, maxPriceLevel, limit }),
    cityLastUpdated(supabase, city),
    maxPriceLevel != null ? cityBudgetStats(supabase, city, maxPriceLevel) : Promise.resolve(null),
  ]);

  // A bank can be non-empty yet still fail budget travelers — e.g. a city
  // whose first scout skewed luxury. `needsTopUp` tells the client to trigger
  // a background additive scout for real affordable/mid-range picks, the same
  // stale-while-revalidate pattern as `stale` below, so the CURRENT visitor
  // keeps seeing today's (imperfect) list while the NEXT one gets a properly
  // budget-stocked bank.
  const MIN_IN_BUDGET = 4;
  const needsTopUp =
    budgetStats != null && budgetStats.total > 0 && budgetStats.inBudget < MIN_IN_BUDGET;

  // Are there pricier picks above the budget ceiling? (Only meaningful when we
  // actually applied a ceiling.) Drives the panel's splurge opt-in toggle.
  const splurgeAvailable =
    budgetStats != null && budgetStats.total > budgetStats.inBudget;

  // `stale` tells the client to render this cached data now but trigger a
  // background re-scout so the next visitor gets fresh data.
  return NextResponse.json({
    restaurants,
    stale: isStale(lastUpdated, REC_TTL_DAYS),
    needsTopUp,
    splurgeAvailable,
  });
}
