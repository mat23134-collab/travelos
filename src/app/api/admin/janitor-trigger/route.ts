/**
 * POST /api/admin/janitor-trigger
 *
 * Shielded endpoint for triggering a remote Janitor run.
 * Requires x-admin-secret header matching ADMIN_SECRET env var.
 *
 * Usage:
 *   curl -X POST https://yourdomain.com/api/admin/janitor-trigger \
 *     -H "x-admin-secret: $ADMIN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{ "city": "Tokyo", "dryRun": false }'
 *
 * The actual janitor logic lives in scripts/scout-agent.ts --janitor flag.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminApiRequest } from '@/lib/admin';

/** Only allow clean city name strings — letters, spaces, hyphens, apostrophes. */
const SAFE_CITY_RE = /^[\p{L}\p{N}\s\-'.]{1,80}$/u;

export async function POST(req: NextRequest) {
  if (!isAdminApiRequest(req)) {
    return NextResponse.json(
      { error: 'Forbidden — x-admin-secret header required.' },
      { status: 403 },
    );
  }

  const { city, dryRun = true } = await req.json().catch(() => ({}));

  // city is optional for janitor (runs on all stale places when omitted)
  if (city !== undefined && (typeof city !== 'string' || !SAFE_CITY_RE.test(city))) {
    return NextResponse.json({ error: 'Invalid city name.' }, { status: 400 });
  }

  // ── Wire your janitor execution here ────────────────────────────────────────
  // IMPORTANT: use spawn() with an args ARRAY, never a template string.
  //
  //   const { spawn } = await import('child_process');
  //   const args = ['tsx', 'scripts/scout-agent.ts', '--janitor'];
  //   if (city) args.push('--city', city);   // ← array push, not string concat
  //   if (dryRun) args.push('--dry-run');
  //   spawn('npx', args, { stdio: 'inherit' });
  // ────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    ok: true,
    message: `Janitor trigger received${city ? ` for "${city}"` : ' (all cities)'}${dryRun ? ' (dry-run)' : ''}.`,
    note: 'Execution hook not yet wired — add your spawn call above.',
  });
}
