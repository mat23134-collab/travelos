/**
 * POST /api/admin/restaurant-reverify-trigger
 *
 * Shielded endpoint that re-verifies the stalest restaurant rows against Google
 * Place Details (§10) — refreshing rating / reviews / website / composite score
 * and pruning permanently-closed places. Requires an x-admin-secret header
 * matching ADMIN_SECRET. Intended to be called from a nightly cron.
 *
 * Usage:
 *   curl -X POST https://yourdomain.com/api/admin/restaurant-reverify-trigger \
 *     -H "x-admin-secret: $ADMIN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{ "city": "Tokyo", "limit": 20, "dryRun": false }'
 *
 * Unlike scout-trigger (which spawns a script), this runs inline: re-verify is
 * bounded (a handful of cheap Place Details lookups) so it fits a request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminApiRequest } from '@/lib/admin';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { reverifyCity, citiesNeedingReverify } from '@/lib/restaurantReverify';

/** Only allow clean city name strings — letters, numbers, spaces, hyphens, etc. */
const SAFE_CITY_RE = /^[\p{L}\p{N}\s\-'.]{1,80}$/u;
/** Cap cities per run so one cron tick can't exhaust the Places quota. */
const MAX_CITIES_PER_RUN = 5;

export async function POST(req: NextRequest) {
  if (!isAdminApiRequest(req)) {
    return NextResponse.json({ error: 'Forbidden — x-admin-secret header required.' }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { city?: string; limit?: number; dryRun?: boolean };
  const { city, dryRun = false } = body;
  const limit = Math.min(40, Math.max(1, Number(body.limit) || 20));

  if (city !== undefined && (typeof city !== 'string' || !SAFE_CITY_RE.test(city))) {
    return NextResponse.json({ error: 'Invalid city name.' }, { status: 400 });
  }

  const db = createServiceRoleClient();
  if (!db) {
    return NextResponse.json({ error: 'Server misconfigured (no service role).' }, { status: 503 });
  }

  const cities = city ? [city] : (await citiesNeedingReverify(db)).slice(0, MAX_CITIES_PER_RUN);
  const results = [];
  for (const c of cities) {
    results.push(await reverifyCity(db, c, { limit, dryRun }));
  }

  return NextResponse.json({ ok: true, dryRun, results });
}
