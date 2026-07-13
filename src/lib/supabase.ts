/**
 * supabase.ts — Two dedicated Supabase clients
 *
 * WHY two clients?
 *   Supabase uses a shared PostgREST schema cache.  When any query hits a
 *   table/column that doesn't exist yet (e.g. itinerary_items during early
 *   rollout), PostgREST can mark its schema cache as dirty and return
 *   "Database error querying schema" for ALL subsequent requests — including
 *   GoTrue auth calls.
 *
 *   Separating auth from data queries means:
 *   1.  A failing DB query can NEVER infect the auth client's state.
 *   2.  The auth client has no db schema knowledge at all — it only speaks
 *       to the GoTrue /auth/v1/* endpoints.
 *   3.  The data client has auth disabled so it never tries to attach a JWT
 *       to schema-introspection calls on the server side.
 *
 * EXPORTS
 *   supabase      — data client  (use for all .from() queries)
 *   supabaseAuth  — auth client  (use ONLY for supabase.auth.* calls)
 */

import { createClient } from '@supabase/supabase-js';

const rawUrl         = process.env.NEXT_PUBLIC_SUPABASE_URL        ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  ?? '';

// Strip any accidental trailing slash — Supabase SDK appends /rest/v1/... itself
const supabaseUrl = rawUrl.replace(/\/+$/, '');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[supabase] ✗ MISSING env vars — NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY not set',
  );
} else {
  console.log(
    '[supabase] init — URL:', supabaseUrl.replace(/^(https:\/\/[^.]+).*/, '$1…supabase.co'),
    '| KEY: ✓', supabaseAnonKey.slice(0, 6) + '…',
  );
}

// createClient (supabase-js ≥2.x) THROWS "supabaseUrl is required" when handed
// an empty string. During `next build`, the "Collecting page data" pass imports
// every API-route module — and on hosts that don't expose NEXT_PUBLIC_* at build
// time this module loads with blank env, so the throw crashed the entire build
// (Failed to collect page data for /api/attractions).
//
// Fall back to a syntactically-valid placeholder so the module can always be
// imported. Real requests only execute at runtime, where the env IS set, so this
// never changes production behaviour — it only stops a missing build-time env
// from aborting the build. The console.error above still surfaces any real
// misconfiguration.
const effectiveUrl = supabaseUrl     || 'https://placeholder.supabase.co';
const effectiveKey = supabaseAnonKey || 'placeholder-anon-key';

// ── Data client ───────────────────────────────────────────────────────────────
// Used for ALL .from() queries (itineraries, itinerary_items, places…).
// Auth is disabled so this client NEVER touches the auth schema or stores
// tokens — safe to use in both server and client components.
export const supabase = createClient(effectiveUrl, effectiveKey, {
  auth: {
    // Disable the auth state machine on the data client entirely.
    // All auth operations must go through `supabaseAuth` below.
    persistSession:    false,
    autoRefreshToken:  false,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'x-client-info': 'travelos-data/1' },
  },
  db: {
    schema: 'public',
  },
});

// ── Auth client ───────────────────────────────────────────────────────────────
// Used ONLY for supabase.auth.* calls (signIn, signUp, signOut, getSession,
// onAuthStateChange).  Has full session persistence — NEVER used for .from()
// queries so a bad DB query can't contaminate auth state.
export const supabaseAuth = createClient(effectiveUrl, effectiveKey, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: true,
    storageKey:        'travelos_auth_v1',  // namespaced — avoids collisions
  },
  global: {
    headers: { 'x-client-info': 'travelos-auth/1' },
  },
});
