/**
 * admin.ts — Server-side admin auth helpers
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

const ADMIN_SECRET = process.env.ADMIN_SECRET ?? '';

/**
 * Returns true when the current request has a valid admin session cookie.
 * Call from Server Components, Server Actions, and Route Handlers.
 */
export async function isAdminSession(): Promise<boolean> {
  if (!ADMIN_SECRET) return false;
  try {
    const store = await cookies();
    return store.get('travelos_admin')?.value === ADMIN_SECRET;
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
  return req.headers.get('x-admin-secret') === ADMIN_SECRET;
}
