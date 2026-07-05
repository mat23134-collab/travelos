import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchRestaurantsForCity } from '@/lib/restaurantBank';
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

  const restaurants = await fetchRestaurantsForCity(supabase, city, { lang });
  return NextResponse.json({ restaurants });
}
