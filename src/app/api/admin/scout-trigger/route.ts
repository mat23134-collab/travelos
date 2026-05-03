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
 * Hook up your CLI execution logic (e.g. child_process.spawn) here when ready.
 */

import { NextRequest, NextResponse } from 'next/server';
import { isAdminApiRequest } from '@/lib/admin';

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

  // ── Wire your scout execution here ──────────────────────────────────────────
  // Example (Node runtime required, not Edge):
  //   const { execSync } = await import('child_process');
  //   execSync(`npx tsx scripts/scout-agent.ts --city "${city}"${dryRun ? ' --dry-run' : ''}`);
  // ────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    ok: true,
    message: `Scout trigger received for "${city}"${dryRun ? ' (dry-run)' : ''}.`,
    note: 'Execution hook not yet wired — add your spawn/execSync call above.',
  });
}
