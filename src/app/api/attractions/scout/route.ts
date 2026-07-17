import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runAttractionScoutAgent } from '@/lib/attractionScoutAgent';
import { upsertAttractions, fetchAttractionsForCity } from '@/lib/attractionBank';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/** Per-city cooldown to limit abuse of Gemini + Exa + Places (in-memory). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;

/**
 * POST /api/attractions/scout — body: { city, lang? }
 * Runs the attraction scout and replaces the city's bank (service role).
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
  if (now - (lastScoutAt.get(key) ?? 0) < COOLDOWN_MS) {
    const db = createServiceRoleClient();
    const cached = db ? await fetchAttractionsForCity(db, city, { lang }) : [];
    return NextResponse.json({ ok: true, throttled: true, attractions: cached });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    const recs = await runAttractionScoutAgent(city);
    if (recs.length === 0) {
      return NextResponse.json(
        { ok: false, attractions: [], message: 'Scout returned no attractions' },
        { status: 422 },
      );
    }
    await upsertAttractions(db, recs);
    const attractions = await fetchAttractionsForCity(db, city, { lang });
    return NextResponse.json({ ok: true, attractions });
  } catch (e) {
    console.warn('[attractions/scout]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Attraction scout failed. Please try again.' }, { status: 502 });
  }
}
