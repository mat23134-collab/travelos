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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

// ── Durable rate limiter (Postgres, cross-instance) ───────────────────────────
//
// The in-memory Map above resets on every deploy/cold start and is per-instance,
// so it evaporates the moment Railway runs more than one replica. This variant
// calls the atomic `rate_limit_hit` Postgres function (service-role only) so the
// limit holds across all instances. Fails OPEN on any DB error — a transient DB
// hiccup must not lock every user out.

let _rlClient: SupabaseClient | null = null;
function rateLimitClient(): SupabaseClient | null {
  if (_rlClient) return _rlClient;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  _rlClient = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _rlClient;
}

/**
 * Cross-instance rate limit. Returns true when allowed, false when exceeded.
 * `key` should encode the identity + route, e.g. `gen:<userId|ip>`.
 * Falls back to the in-memory limiter when no service-role key is configured.
 */
export async function checkRateLimitDurable(key: string, limit: number, windowMs: number): Promise<boolean> {
  const db = rateLimitClient();
  if (!db) return checkRateLimit(key, limit, windowMs);
  try {
    const { data, error } = await db.rpc('rate_limit_hit', {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.max(1, Math.round(windowMs / 1000)),
    });
    if (error) {
      console.warn('[rate-limit] durable check failed, failing open:', error.message);
      return true;
    }
    return (data as { allowed?: boolean } | null)?.allowed !== false;
  } catch (e) {
    console.warn('[rate-limit] durable check threw, failing open:', e instanceof Error ? e.message : e);
    return true;
  }
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
