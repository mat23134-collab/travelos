/**
 * POST /api/admin/login
 *
 * Accepts the admin secret in the request body (never in the URL).
 * On success sets an httpOnly cookie containing the HMAC-derived token
 * (not the raw secret) so a stolen cookie can't reveal the original value.
 *
 * Usage:
 *   fetch('/api/admin/login', {
 *     method: 'POST',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ secret: 'your_admin_secret' }),
 *   });
 */

import { NextRequest, NextResponse } from 'next/server';
import { deriveAdminToken } from '@/lib/admin';

const ADMIN_SECRET  = process.env.ADMIN_SECRET ?? '';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';
const MAX_AGE       = 60 * 60 * 8; // 8 hours — re-login daily

export async function POST(req: NextRequest) {
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: 'Admin access not configured.' }, { status: 503 });
  }

  let body: { secret?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (!body.secret || body.secret !== ADMIN_SECRET) {
    // Uniform response time to resist timing attacks
    await new Promise((r) => setTimeout(r, 200));
    return NextResponse.json({ error: 'Invalid secret.' }, { status: 401 });
  }

  const token = await deriveAdminToken(ADMIN_SECRET);

  const res = NextResponse.json({ ok: true });

  // httpOnly — unreadable by JS, contains HMAC token (not raw secret)
  res.cookies.set('travelos_admin', token, {
    httpOnly: true,
    secure:   COOKIE_SECURE,
    sameSite: 'lax',
    maxAge:   MAX_AGE,
    path:     '/',
  });

  // Non-httpOnly UI flag — lets client code show admin controls
  res.cookies.set('travelos_admin_ui', '1', {
    httpOnly: false,
    secure:   COOKIE_SECURE,
    sameSite: 'lax',
    maxAge:   MAX_AGE,
    path:     '/',
  });

  return res;
}
