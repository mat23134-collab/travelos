import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runEventScoutAgent } from '@/lib/eventScoutAgent';
import { upsertEvents, fetchEventsForCity } from '@/lib/eventBank';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';

/** Cooldown per city+window (events are window-scoped, unlike restaurants). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 60_000;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/events/scout — body: { city, from, to, lang? }
 * Runs the grounded event scout for the trip window and replaces the city's
 * event rows (service role).
 */
export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as
    | { city?: string; from?: string; to?: string; lang?: string }
    | null;
  const city = body?.city?.trim() ?? '';
  const from = body?.from?.trim() ?? '';
  const to = body?.to?.trim() ?? '';

  if (!city) return NextResponse.json({ error: 'city is required' }, { status: 400 });
  if (!ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) {
    return NextResponse.json({ error: 'from/to must be ISO dates (YYYY-MM-DD)' }, { status: 400 });
  }
  const lang: SiteLanguage = (SITE_LANGUAGES as readonly string[]).includes(body?.lang ?? '')
    ? (body!.lang as SiteLanguage)
    : 'en';

  const key = `${city.toLowerCase()}|${from}|${to}`;
  const now = Date.now();
  if (now - (lastScoutAt.get(key) ?? 0) < COOLDOWN_MS) {
    const db = createServiceRoleClient();
    const cached = db ? await fetchEventsForCity(db, city, from, to, { lang }) : [];
    return NextResponse.json({ ok: true, throttled: true, events: cached });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    const recs = await runEventScoutAgent(city, from, to);
    // An empty result here is a legitimate outcome (no grounded events in the
    // window) — return ok so the client shows "nothing on your dates" instead
    // of an error.
    await upsertEvents(db, recs);
    const events = await fetchEventsForCity(db, city, from, to, { lang });
    return NextResponse.json({ ok: true, events });
  } catch (e) {
    console.warn('[events/scout]', e instanceof Error ? e.message : e);
    return NextResponse.json({ error: 'Event scout failed. Please try again.' }, { status: 502 });
  }
}
