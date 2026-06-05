import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { runTransportScoutAgent } from '@/lib/transportScoutAgent';
import { upsertTransportationGuide } from '@/lib/tripTransport';
import { hasTransportContent } from '@/lib/transportGuideParse';
import { MOCK_ITINERARY } from '@/lib/mockData';

/** Per-city cooldown to limit abuse of Gemini + Exa (in-memory; resets on cold start). */
const lastScoutAt = new Map<string, number>();
const COOLDOWN_MS = 45_000;

/**
 * POST /api/transportation/scout
 * Body: { city: string, tripDays?: number }
 * Runs transport scout (Exa + Gemini) and upserts `public.transportation` (service role).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { city?: string; tripDays?: number } | null;
  const city = body?.city?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  // ── Mock mode ────────────────────────────────────────────────────────────────
  if (process.env.MOCK_AI === 'true') {
    return NextResponse.json({ ok: true, guide: MOCK_ITINERARY.cityTransport });
  }

  const key = city.toLowerCase();
  const now = Date.now();
  const prev = lastScoutAt.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) {
    return NextResponse.json({ ok: true, throttled: true, retryAfterMs: COOLDOWN_MS - (now - prev) });
  }
  lastScoutAt.set(key, now);

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role)' }, { status: 503 });
  }

  try {
    const tripDays =
      typeof body?.tripDays === 'number' && Number.isFinite(body.tripDays) && body.tripDays > 0
        ? Math.min(30, Math.round(body.tripDays))
        : undefined;
    const guide = await runTransportScoutAgent(city, { tripDays });
    if (!guide || !hasTransportContent(guide)) {
      return NextResponse.json({ ok: false, guide: null, message: 'Scout returned no usable guide' }, { status: 422 });
    }
    await upsertTransportationGuide(db, city, guide);
    return NextResponse.json({ ok: true, guide });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Scout failed';
    console.warn('[transportation/scout]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
