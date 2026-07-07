import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAttractionsForCity } from '@/lib/attractionBank';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/**
 * GET /api/attractions?city=Rome&lang=he
 * Cached must-book-ahead attractions for a city, text resolved to the
 * requested site language. Mirrors /api/restaurants.
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

  const attractions = await fetchAttractionsForCity(supabase, city, { lang });
  return NextResponse.json({ attractions });
}
