import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { fetchEventsForCity, windowLastUpdated } from '@/lib/eventBank';
import { isStale, EVENT_TTL_DAYS } from '@/lib/recStaleness';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/events?city=Rome&from=2026-08-19&to=2026-08-22&lang=he
 * Cached festivals/events overlapping the trip window, text resolved to the
 * requested site language.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const city = p.get('city')?.trim() ?? '';
  const from = p.get('from')?.trim() ?? '';
  const to = p.get('to')?.trim() ?? '';

  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from/to must be ISO dates (YYYY-MM-DD)' }, { status: 400 });
  }

  const langParam = p.get('lang') ?? 'en';
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(langParam)
    ? (langParam as SiteLanguage)
    : 'en';

  const [events, lastUpdated] = await Promise.all([
    fetchEventsForCity(supabase, city, from, to, { lang }),
    windowLastUpdated(supabase, city, from, to),
  ]);
  return NextResponse.json({ events, stale: isStale(lastUpdated, EVENT_TTL_DAYS) });
}
