import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchAttractionsForCity, cityLastUpdated } from '@/lib/attractionBank';
import { isStale, REC_TTL_DAYS } from '@/lib/recStaleness';
import { AttractionEngine, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

const ENGINES = new Set<AttractionEngine>(['book_ahead', 'walk_in', 'only_here']);

/**
 * GET /api/attractions?city=Rome&lang=he&engine=walk_in
 * Cached attractions for a city from one engine (default book_ahead — the
 * must-book-ahead list), text resolved to the requested site language.
 * Mirrors /api/restaurants.
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

  const engineParam = req.nextUrl.searchParams.get('engine') ?? 'book_ahead';
  const engine: AttractionEngine = ENGINES.has(engineParam as AttractionEngine)
    ? (engineParam as AttractionEngine)
    : 'book_ahead';

  const [attractions, lastUpdated] = await Promise.all([
    fetchAttractionsForCity(supabase, city, { lang, engine }),
    cityLastUpdated(supabase, city, engine),
  ]);
  return NextResponse.json({ attractions, stale: isStale(lastUpdated, REC_TTL_DAYS) });
}
