/**
 * Next.js Edge Middleware — TravelOS Admin Auth
 *
 * Two gestures, zero login page:
 *
 *   LOGIN   — visit any URL with  ?key=<ADMIN_SECRET>
 *             Middleware sets both cookies and strips the param.
 *
 *   LOGOUT  — visit any URL with  ?logout=1
 *             Middleware clears both cookies and strips the param.
 *
 * Cookies set:
 *   travelos_admin     (httpOnly)  — carries the raw secret for server-side checks
 *   travelos_admin_ui  (readable)  — carries "1" for client-side UI show/hide
 */

import { NextRequest, NextResponse } from 'next/server';

const ADMIN_SECRET  = process.env.ADMIN_SECRET ?? '';
const COOKIE_SECURE = process.env.NODE_ENV === 'production';
const MAX_AGE       = 60 * 60 * 24 * 30; // 30 days

export function middleware(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // ── Login: ?key=<secret> ────────────────────────────────────────────────────
  const key = searchParams.get('key');
  if (key && ADMIN_SECRET && key === ADMIN_SECRET) {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete('key');

    const res = NextResponse.redirect(clean);

    // Server-side verification cookie (httpOnly — unreadable by JS)
    res.cookies.set('travelos_admin', key, {
      httpOnly: true,
      secure:   COOKIE_SECURE,
      sameSite: 'lax',
      maxAge:   MAX_AGE,
      path:     '/',
    });

    // Client-side UI flag cookie (readable by JS for conditional rendering)
    res.cookies.set('travelos_admin_ui', '1', {
      httpOnly: false,
      secure:   COOKIE_SECURE,
      sameSite: 'lax',
      maxAge:   MAX_AGE,
      path:     '/',
    });

    return res;
  }

  // ── Logout: ?logout=1 ───────────────────────────────────────────────────────
  if (searchParams.get('logout') === '1') {
    const clean = req.nextUrl.clone();
    clean.searchParams.delete('logout');

    const res = NextResponse.redirect(clean);
    res.cookies.delete('travelos_admin');
    res.cookies.delete('travelos_admin_ui');
    return res;
  }

  return NextResponse.next();
}

// Run on all non-asset paths so ?key= works from any page
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
