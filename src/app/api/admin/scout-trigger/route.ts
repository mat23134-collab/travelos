/**
 * POST /api/admin/scout-trigger
 *
 * Shielded endpoint that can trigger a remote Scout Agent run.
 * Requires x-admin-secret header matching ADMIN_SECRET env var.
 *
 * Usage:
 *   curl -X POST https://yourdomain.com/api/admin/scout-trigger \
 *     -H "x-admin-secret: $ADMIN_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{ "city": "Tokyo", "dryRun": false }'
 *
 * The actual scout logic lives in scripts/scout-agent.ts (CLI).
 * This route exists so you can trigger it from CI/cron without SSH access.
 *
 * SECURITY: When wiring up execution, always use spawn() with an args array —
 * never interpolate `city` into a shell template string. The validation below
 * enforces a strict allowlist, but spawn-with-array is a defence-in-depth
 * safeguard against shell injection regardless of input sanitisation.
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

  if (!city || typeof city !== 'string') {
    return NextResponse.json({ error: '{ city: string } required in request body.' }, { status: 400 });
  }

  if (!SAFE_CITY_RE.test(city)) {
    return NextResponse.json({ error: 'Invalid city name.' }, { status: 400 });
  }

  // ── Wire your scout execution here ──────────────────────────────────────────
  // IMPORTANT: use spawn() with an args ARRAY, never a template string.
  // Template strings risk shell injection even with the regex above.
  //
  //   const { spawn } = await import('child_process');
  //   const args = ['tsx', 'scripts/scout-agent.ts', '--city', city];
  //   if (dryRun) args.push('--dry-run');
  //   spawn('npx', args, { stdio: 'inherit' });
  // ────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    ok: true,
    message: `Scout trigger received for "${city}"${dryRun ? ' (dry-run)' : ''}.`,
    note: 'Execution hook not yet wired — add your spawn call above.',
  });
}
