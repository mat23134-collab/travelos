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

export async function POST(req: NextRequest) {
  if (!isAdminApiRequest(req)) {
    return NextResponse.json(
      { error: 'Forbidden — x-admin-secret header required.' },
      { status: 403 },
    );
  }

  const { city, dryRun = true } = await req.json().catch(() => ({}));

  // city is optional for janitor (runs on all stale places when omitted)

  // ── Wire your janitor execution here ────────────────────────────────────────
  // Example (Node runtime required, not Edge):
  //   const { execSync } = await import('child_process');
  //   const cityFlag = city ? ` --city "${city}"` : '';
  //   execSync(`npx tsx scripts/scout-agent.ts --janitor${cityFlag}${dryRun ? ' --dry-run' : ''}`);
  // ────────────────────────────────────────────────────────────────────────────

  return NextResponse.json({
    ok: true,
    message: `Janitor trigger received${city ? ` for "${city}"` : ' (all cities)'}${dryRun ? ' (dry-run)' : ''}.`,
    note: 'Execution hook not yet wired — add your spawn/execSync call above.',
  });
}
