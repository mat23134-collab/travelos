/**
 * Next.js Edge Middleware — TravelOS
 *
 * Admin login is handled by POST /api/admin/login (not a URL query param).
 * The ?key= URL approach has been removed — secrets must never appear in URLs
 * (browser history, server logs, proxy logs, Referer headers).
 *
 *   LOGOUT  — visit any URL with  ?logout=1
 *             Middleware clears both cookies and strips the param.
 *
 * Supabase SSR session refresh runs on every non-redirect request so that
 * server components and API routes always receive a fresh JWT in cookies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseMiddlewareClient } from '@/utils/supabase/middleware';

const COOKIE_SECURE = process.env.NODE_ENV === 'production';

export function middleware(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── Logout: ?logout=1 ───────────────────────────────────────────────────────
  if (searchParams.get('logout') === '1') {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete('logout');

    const res = NextResponse.redirect(clean);
    res.cookies.set('travelos_admin', '', { maxAge: 0, path: '/', secure: COOKIE_SECURE });
    res.cookies.set('travelos_admin_ui', '', { maxAge: 0, path: '/', secure: COOKIE_SECURE });
    return res;
  }

  // ── Supabase SSR session refresh ────────────────────────────────────────────
  // Keeps the user's JWT fresh by propagating updated session cookies.
  // Must run on every non-redirect response so server components always have
  // valid auth context.
  return createSupabaseMiddlewareClient(req);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
