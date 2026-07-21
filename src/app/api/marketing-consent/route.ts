import { NextRequest, NextResponse } from 'next/server';
import { verifySession, unauthorizedResponse, getClientIp, checkRateLimit, rateLimitedResponse } from '@/lib/apiGuard';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { MARKETING_CONSENT_VERSION, type MarketingConsentSource } from '@/lib/marketingConsent';

/**
 * /api/marketing-consent — the marketing (promotional-email) opt-in/opt-out,
 * kept separate from /api/legal-consent (Terms/Privacy/Cookies).
 *
 * Always tied to a real signed-in account (you need an email to market to —
 * no anonymous rows, unlike legal_consents). Every decision writes BOTH the
 * query-friendly current flag (profiles.marketing_opt_in, for a future send
 * pipeline to filter on) AND an append-only audit row (marketing_consents,
 * with IP/user-agent/version) that is the actual proof-of-consent record the
 * anti-spam law requires. Both tables have RLS on with no policies, so they're
 * only reachable through this service-role-backed route.
 */

const SOURCES = new Set<MarketingConsentSource>(['signup', 'dashboard_prompt', 'settings']);
const RATE_LIMIT = 20;
const RATE_WINDOW = 10 * 60 * 1000;

/** getClientIp falls back to the literal 'unknown', which isn't valid `inet` — null it out. */
function ipOrNull(req: NextRequest): string | null {
  const ip = getClientIp(req);
  return ip && ip !== 'unknown' ? ip : null;
}

/** GET → { optIn: boolean|null, updatedAt: string|null } for the caller's own account. */
export async function GET(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const db = createServiceRoleClient();
  if (!db) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 });

  const { data, error } = await db
    .from('profiles')
    .select('marketing_opt_in, marketing_opt_in_updated_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 });

  return NextResponse.json({
    optIn: data?.marketing_opt_in ?? null,
    updatedAt: data?.marketing_opt_in_updated_at ?? null,
  });
}

/** PUT body { optIn: boolean, source: 'signup'|'dashboard_prompt'|'settings' }
 *  → records the decision for the caller's own account. */
export async function PUT(req: NextRequest) {
  if (!checkRateLimit(getClientIp(req), RATE_LIMIT, RATE_WINDOW)) return rateLimitedResponse();

  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const body = (await req.json().catch(() => null)) as { optIn?: unknown; source?: unknown } | null;
  if (typeof body?.optIn !== 'boolean') {
    return NextResponse.json({ error: 'optIn must be a boolean.' }, { status: 400 });
  }
  const source = typeof body.source === 'string' && SOURCES.has(body.source as MarketingConsentSource)
    ? (body.source as MarketingConsentSource)
    : null;
  if (!source) return NextResponse.json({ error: 'Invalid source.' }, { status: 400 });

  const db = createServiceRoleClient();
  if (!db) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 });

  const now = new Date().toISOString();
  const { error: profErr } = await db
    .from('profiles')
    .update({ marketing_opt_in: body.optIn, marketing_opt_in_updated_at: now })
    .eq('id', userId);
  if (profErr) return NextResponse.json({ error: 'Save failed.' }, { status: 500 });

  // Audit row is best-effort: the current-state flag above is already saved,
  // so a logging hiccup shouldn't surface as a user-facing failure.
  const { error: auditErr } = await db.from('marketing_consents').insert({
    user_id: userId,
    opted_in: body.optIn,
    channels: ['email'],
    source,
    consent_version: MARKETING_CONSENT_VERSION,
    user_agent: req.headers.get('user-agent'),
    ip_address: ipOrNull(req),
  });
  if (auditErr) console.error('[marketing-consent] audit insert failed:', auditErr.message);

  return NextResponse.json({ ok: true });
}
