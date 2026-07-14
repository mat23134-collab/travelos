import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantsForCity, cityLastUpdated, MAX_PRICE_LEVEL_BY_BUDGET } from '@/lib/restaurantBank';
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

  const [restaurants, lastUpdated] = await Promise.all([
    fetchRestaurantsForCity(supabase, city, { lang, maxPriceLevel }),
    cityLastUpdated(supabase, city),
  ]);
  // `stale` tells the client to render this cached data now but trigger a
  // background re-scout so the next visitor gets fresh data.
  return NextResponse.json({ restaurants, stale: isStale(lastUpdated, REC_TTL_DAYS) });
}
