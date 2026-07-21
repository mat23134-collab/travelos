import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeUsername } from '@/lib/username';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { MARKETING_CONSENT_VERSION } from '@/lib/marketingConsent';

/**
 * Idempotent: creates public.profiles for the JWT user if missing.
 * Uses anon key + caller's access token so RLS policy profiles_insert_own applies.
 *
 * This is also the first authenticated request after signup (email confirmation
 * sits between signUp() and the first real session, so there's no access token
 * to call /api/marketing-consent at signup time) — so a first-time profile
 * creation seeds marketing_opt_in from the signup checkbox's value, carried in
 * auth user_metadata, and logs the audit-trail row for it via the service role.
 */

function slugFromUserId(userId: string): string {
  return `u${userId.replace(/-/g, '').slice(0, 23)}`;
}

/** Best-effort audit row for the signup-time marketing checkbox — requires the
 *  service role since marketing_consents has RLS on with no policies. Never
 *  throws: the profile write already succeeded, so a logging hiccup here
 *  shouldn't surface as a signup failure. */
async function logSignupMarketingConsent(userId: string, optedIn: boolean, req: NextRequest) {
  const db = createServiceRoleClient();
  if (!db) return;
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
  const { error } = await db.from('marketing_consents').insert({
    user_id: userId,
    opted_in: optedIn,
    channels: ['email'],
    source: 'signup',
    consent_version: MARKETING_CONSENT_VERSION,
    user_agent: req.headers.get('user-agent'),
    ip_address: ip,
  });
  if (error) console.warn('[ensure-profile] marketing consent audit insert failed:', error.message);
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) {
    return NextResponse.json({ error: 'Server missing Supabase configuration.' }, { status: 503 });
  }

  const raw = req.headers.get('authorization');
  const token = raw?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token.' }, { status: 401 });
  }

  const sb = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser(token);

  if (userErr || !user) {
    return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
  }

  const { data: existing, error: selErr } = await sb
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (selErr) {
    console.warn('[ensure-profile] select:', selErr.message);
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ ok: true });
  }

  const meta = user.user_metadata as { username?: string; marketingOptIn?: boolean } | undefined;
  let username =
    meta?.username && typeof meta.username === 'string'
      ? normalizeUsername(meta.username)
      : '';
  if (username.length < 3) {
    username = slugFromUserId(user.id);
  }
  // undefined (e.g. Google OAuth, which never showed the checkbox) is left
  // unset so marketing_opt_in stays null — "not yet asked" — and the dashboard
  // prompt still asks explicitly, rather than assuming a default either way.
  const marketingOptIn = typeof meta?.marketingOptIn === 'boolean' ? meta.marketingOptIn : undefined;

  let { error: insErr } = await sb.from('profiles').insert({
    id: user.id,
    username,
    ...(marketingOptIn !== undefined ? { marketing_opt_in: marketingOptIn, marketing_opt_in_updated_at: new Date().toISOString() } : {}),
  });

  if (!insErr) {
    if (marketingOptIn !== undefined) await logSignupMarketingConsent(user.id, marketingOptIn, req);
    return NextResponse.json({ ok: true });
  }

  if (insErr.code === '23505') {
    const { data: raced } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (raced) {
      return NextResponse.json({ ok: true });
    }

    const slug = slugFromUserId(user.id);
    const secondary =
      slug !== username
        ? slug
        : `u${user.id.replace(/-/g, '').slice(-23)}`;

    const { error: e2 } = await sb.from('profiles').insert({
      id: user.id,
      username: secondary,
      ...(marketingOptIn !== undefined ? { marketing_opt_in: marketingOptIn, marketing_opt_in_updated_at: new Date().toISOString() } : {}),
    });

    if (!e2) {
      if (marketingOptIn !== undefined) await logSignupMarketingConsent(user.id, marketingOptIn, req);
      return NextResponse.json({ ok: true });
    }

    const { data: raced2 } = await sb.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (raced2) {
      return NextResponse.json({ ok: true });
    }

    console.warn('[ensure-profile] insert after conflict:', e2.message);
    return NextResponse.json({ error: e2.message }, { status: 500 });
  }

  console.warn('[ensure-profile] insert:', insErr.message);
  return NextResponse.json({ error: insErr.message }, { status: 500 });
}
