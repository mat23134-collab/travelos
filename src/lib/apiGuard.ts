/**
 * apiGuard.ts — Shared security helpers for API routes
 *
 * - checkRateLimit:    in-memory sliding-window rate limiter (single-instance).
 *                      For multi-instance deploys swap the Map for Upstash Redis.
 * - verifySession:     validates a Supabase bearer token and returns the user id.
 * - getClientIp:       extracts the real client IP from forwarded headers.
 * - rateLimitedResponse / unauthorizedResponse: standard error helpers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ── In-memory rate limiter ────────────────────────────────────────────────────

const ipWindows = new Map<string, number[]>();

/** Runs every 5 min to evict stale entries and prevent unbounded memory growth. */
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000; // 1 hour
  for (const [ip, hits] of ipWindows) {
    const fresh = hits.filter((t) => t > cutoff);
    if (fresh.length === 0) ipWindows.delete(ip);
    else ipWindows.set(ip, fresh);
  }
}, 5 * 60 * 1000);

/**
 * Returns true when the request is allowed, false when the rate limit is exceeded.
 *
 * @param ip       - client IP string
 * @param limit    - max requests permitted inside the window
 * @param windowMs - rolling window size in milliseconds
 */
export function checkRateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (ipWindows.get(ip) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) return false;
  hits.push(now);
  ipWindows.set(ip, hits);
  return true;
}

// ── Session verification ──────────────────────────────────────────────────────

/**
 * Verifies the `Authorization: Bearer <token>` header against Supabase.
 * Returns the authenticated user's UUID on success, or null on failure.
 */
export async function verifySession(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !anon) return null;

  try {
    const client = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error,
    } = await client.auth.getUser(token);
    if (error || !user?.id) return null;
    return user.id;
  } catch {
    return null;
  }
}

// ── IP extraction ─────────────────────────────────────────────────────────────

/** Returns the best-guess client IP from forwarded headers. */
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ── Standard error responses ──────────────────────────────────────────────────

export function unauthorizedResponse(message = 'Authentication required.'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function rateLimitedResponse(): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests — please wait a moment and try again.' },
    { status: 429 },
  );
}
