import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { LEGAL_CONSENT_VERSION } from '@/lib/legalConsent';

type ConsentBody = {
  version?: string;
  acceptedTerms?: boolean;
  acceptedPrivacy?: boolean;
  essentialCookies?: boolean;
  preferencesCookies?: boolean;
  analyticsCookies?: boolean;
};

function getIp(req: NextRequest) {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  );
}

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Server missing Supabase service configuration.' },
      { status: 503 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as ConsentBody;
  const version = body.version || LEGAL_CONSENT_VERSION;

  if (
    version !== LEGAL_CONSENT_VERSION ||
    body.acceptedTerms !== true ||
    body.acceptedPrivacy !== true ||
    body.essentialCookies !== true
  ) {
    return NextResponse.json({ error: 'Required legal consent is incomplete.' }, { status: 400 });
  }

  const sb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  const rawAuth = req.headers.get('authorization');
  const token = rawAuth?.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const { data } = await sb.auth.getUser(token);
    userId = data.user?.id ?? null;
  }

  const { error } = await sb.from('legal_consents').insert({
    user_id: userId,
    consent_version: version,
    accepted_terms: true,
    accepted_privacy: true,
    essential_cookies: true,
    preferences_cookies: body.preferencesCookies ?? true,
    analytics_cookies: body.analyticsCookies ?? false,
    user_agent: req.headers.get('user-agent'),
    ip_address: getIp(req),
  });

  if (error) {
    const e = error as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN LEGAL_CONSENTS:');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
    return NextResponse.json({ error: e.message, hint: e.hint, code: e.code }, { status: 500 });
  }
  console.log('✅ legal_consents row saved — userId:', userId);

  return NextResponse.json({ ok: true });
}
