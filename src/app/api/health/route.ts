/**
 * GET /api/health
 *
 * Readiness probe for Railway, UptimeRobot, BetterUptime, or any monitor.
 * Returns 200 when the app and database are reachable, 503 otherwise.
 *
 * Response shape:
 *   { ok: true,  version: string, db: "ok" }
 *   { ok: false, version: string, db: "error", error: string }
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const version =
    process.env.NEXT_PUBLIC_BUILD_ID ||
    process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 7) ||
    'unknown';

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!url || !key) {
    return NextResponse.json(
      { ok: false, version, db: 'error', error: 'Supabase env vars not configured' },
      { status: 503 },
    );
  }

  try {
    const db = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Lightweight existence check — no full table scan
    const { error } = await db.from('itineraries').select('id').limit(1).maybeSingle();

    if (error) {
      return NextResponse.json(
        { ok: false, version, db: 'error', error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, version, db: 'ok' });
  } catch (err) {
    return NextResponse.json(
      { ok: false, version, db: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 503 },
    );
  }
}
