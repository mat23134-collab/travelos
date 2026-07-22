import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runAttractionScoutAgent } from '@/lib/attractionScoutAgent';
import { runWalkInScoutAgent } from '@/lib/walkInScoutAgent';
import { upsertAttractions, fetchAttractionsForCity, findEngineOverlap } from '@/lib/attractionBank';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { AttractionEngine, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/** Per-city-per-engine cooldown to limit abuse of Gemini + Exa + Places (in-memory). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;
const ENGINES = new Set<AttractionEngine>(['book_ahead', 'walk_in']);

/**
 * POST /api/attractions/scout — body: { city, lang?, engine? }
 * Runs the requested engine's scout and replaces that city+engine's bank
 * (service role). engine defaults to 'book_ahead' (existing callers unchanged).
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as { city?: string; lang?: string; engine?: string } | null;
  const city = body?.city?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(body?.lang ?? '')
    ? (body!.lang as SiteLanguage)
    : 'en';
  const engine: AttractionEngine = ENGINES.has((body?.engine ?? '') as AttractionEngine)
    ? (body!.engine as AttractionEngine)
    : 'book_ahead';

  const key = `${engine}:${city.toLowerCase()}`;
  const now = Date.now();
  if (now - (lastScoutAt.get(key) ?? 0) < COOLDOWN_MS) {
    const db = createServiceRoleClient();
    const cached = db ? await fetchAttractionsForCity(db, city, { lang, engine }) : [];
    return NextResponse.json({ ok: true, throttled: true, attractions: cached });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    let recs = engine === 'walk_in' ? await runWalkInScoutAgent(city) : await runAttractionScoutAgent(city);

    // Zero-overlap guarantee (Engine B only): drop any walk-in candidate that
    // matches something already in this city's book-ahead bank — a place that
    // needs booking has no business appearing in the "just show up" list.
    if (engine === 'walk_in' && recs.length > 0) {
      const bookAhead = await fetchAttractionsForCity(db, city, { engine: 'book_ahead', limit: 50 });
      if (bookAhead.length > 0) {
        const overlap = findEngineOverlap(bookAhead, recs);
        if (overlap.length > 0) {
          const overlapNames = new Set(overlap.map((r) => r.name));
          recs = recs.filter((r) => !overlapNames.has(r.name));
        }
      }
    }

    if (recs.length === 0) {
      return NextResponse.json(
        { ok: false, attractions: [], message: 'Scout returned no attractions' },
        { status: 422 },
      );
    }
    await upsertAttractions(db, recs);
    const attractions = await fetchAttractionsForCity(db, city, { lang, engine });
    return NextResponse.json({ ok: true, attractions });
  } catch (e) {
    console.warn('[attractions/scout]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Attraction scout failed. Please try again.' }, { status: 502 });
  }
}
