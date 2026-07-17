import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantsForCity, cityLastUpdated } from '@/lib/restaurantBank';
import { isStale, REC_TTL_DAYS } from '@/lib/recStaleness';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/**
 * GET /api/restaurants?city=Rome&lang=he
 * Returns the cached, best-scored reservable restaurants for a city from
 * `public.restaurant_recommendations` (anon + RLS public read), with text
 * resolved to the requested site language. The client polls this while the
 * scout populates the bank in the background.
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

  const [restaurants, lastUpdated] = await Promise.all([
    fetchRestaurantsForCity(supabase, city, { lang }),
    cityLastUpdated(supabase, city),
  ]);
  // `stale` tells the client to render this cached data now but trigger a
  // background re-scout so the next visitor gets fresh data.
  return NextResponse.json({ restaurants, stale: isStale(lastUpdated, REC_TTL_DAYS) });
}
