/**
 * admin.ts — Server-side admin auth helpers
 *
 * The admin cookie stores an HMAC-SHA256 token (not the raw secret) so a
 * stolen cookie cannot be used to reconstruct the original secret.
 *
 * Login is done via POST /api/admin/login — never via a URL query param.
 *
 * Usage in Server Components:
 *   const admin = await isAdminSession();
 *
 * Usage in API Route Handlers:
 *   if (!isAdminApiRequest(req)) {
 *     return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
 *   }
 *
 * Never import this file in Client Components — it uses next/headers which
 * is server-only. Use the travelos_admin_ui cookie client-side for UI flags.
 */

import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { constantTimeEqual } from '@/lib/constantTimeEqual';

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';
const PEPPER       = 'travelos-admin-v1'; // cheap domain separation

/**
 * Derives a stable HMAC-SHA256 token from the admin secret.
 * This is what gets stored in the httpOnly cookie — never the raw secret.
 */
export async function deriveAdminToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(PEPPER));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns true when the current request has a valid admin session cookie.
 * Call from Server Components, Server Actions, and Route Handlers.
 */
export async function isAdminSession(): Promise<boolean> {
  if (!ADMIN_SECRET) return false;
  try {
    const store = await cookies();
    const cookieVal = store.get('travelos_admin')?.value;
    if (!cookieVal) return false;
    const expected = await deriveAdminToken(ADMIN_SECRET);
    return constantTimeEqual(cookieVal, expected);
  } catch {
    // cookies() throws outside of a request context (e.g. during static generation)
    return false;
  }
}

/**
 * Returns true when the request carries the correct x-admin-secret header.
 * Use this in API Route Handlers to gate write / scout operations.
 *
 * Example:
 *   curl -H "x-admin-secret: $ADMIN_SECRET" https://yourdomain.com/api/admin/scout-trigger
 */
export function isAdminApiRequest(req: NextRequest | Request): boolean {
  if (!ADMIN_SECRET) return false;
  const provided = req.headers.get('x-admin-secret');
  if (!provided) return false;
  return constantTimeEqual(provided, ADMIN_SECRET);
}
