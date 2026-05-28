import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /api/feedback — stores the results-page micro-survey.
 *
 * POST body (all fields optional except at least one answer):
 *   {
 *     itineraryId?: string,
 *     destination?: string,
 *     searchAccuracy?: 1..5,
 *     readability?: 1..5,
 *     recommendationsHelpful?: 'yes' | 'partial' | 'no',
 *     waitTime?: 'fast' | 'fair' | 'slow',
 *     missingFeedback?: string,
 *   }
 */

type Body = {
  itineraryId?: string | null;
  destination?: string | null;
  searchAccuracy?: number | null;
  readability?: number | null;
  recommendationsHelpful?: 'yes' | 'partial' | 'no' | null;
  waitTime?: 'fast' | 'fair' | 'slow' | null;
  missingFeedback?: string | null;
};

function clampStar(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 1 && r <= 5 ? r : null;
}

function isUuid(v: unknown): v is string {
  return typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'Server missing Supabase configuration.' }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;

  const recHelpful = ['yes', 'partial', 'no'].includes(String(body.recommendationsHelpful))
    ? body.recommendationsHelpful
    : null;
  const waitTime = ['fast', 'fair', 'slow'].includes(String(body.waitTime))
    ? body.waitTime
    : null;
  const searchAccuracy = clampStar(body.searchAccuracy);
  const readability = clampStar(body.readability);
  const missing = typeof body.missingFeedback === 'string'
    ? body.missingFeedback.trim().slice(0, 1000) || null
    : null;

  // Require at least one substantive answer.
  if (searchAccuracy == null && readability == null && !recHelpful && !waitTime && !missing) {
    return NextResponse.json({ error: 'Empty feedback — nothing to store.' }, { status: 400 });
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve user id from bearer token when present (optional).
  let userId: string | null = null;
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const { data } = await sb.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const { error } = await sb.from('itinerary_feedback').insert({
    itinerary_id: isUuid(body.itineraryId) ? body.itineraryId : null,
    user_id: userId,
    search_accuracy: searchAccuracy,
    readability,
    recommendations_helpful: recHelpful,
    wait_time: waitTime,
    missing_feedback: missing,
    destination: typeof body.destination === 'string' ? body.destination.trim().slice(0, 120) || null : null,
    user_agent: req.headers.get('user-agent'),
  });

  if (error) {
    console.warn('[api/feedback] insert failed:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
