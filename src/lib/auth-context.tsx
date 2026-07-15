'use client';

/**
 * AuthContext — wraps Supabase auth for the entire app.
 *
 * CRITICAL RULES (enforced here):
 *   1. Only `supabaseAuth` is imported — the data client (`supabase`) is
 *      NEVER touched in this file.  A failing DB query must NEVER affect
 *      the auth state.
 *   2. No .from() calls here — profiles bootstrap via POST /api/auth/ensure-profile.
 *   3. Loading state is driven by `getSession()` only — `onAuthStateChange`
 *      does NOT toggle loading to prevent flicker on token refresh.
 *
 * Usage:
 *   const { user, signIn, signUp, signOut, loading } = useAuth();
 */

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabaseAuth } from './supabase';

function pingEnsureProfile(accessToken: string | null | undefined) {
  if (!accessToken) return;
  fetch('/api/auth/ensure-profile', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {});
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthContextValue {
  user:    User    | null;
  session: Session | null;
  loading: boolean;
  signUp:  (
    email: string,
    password: string,
    profile?: {
      phone?: string;
      gender?: 'male' | 'female';
      age?: number;
      username: string;
      marketingOptIn?: boolean;
    },
  ) => Promise<{ error: string | null }>;
  signIn:  (email: string, password: string) => Promise<{ error: string | null }>;
  /** `next` — path to land on after the OAuth round-trip (default: /dashboard,
   *  set on /auth/callback). Used to route straight back to e.g. an itinerary
   *  page being claimed, since Google's redirect never passes back through
   *  /auth itself (unlike the email/password flow's pendingIntent restore). */
  signInWithGoogle: (next?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,    setUser]    = useState<User    | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // ── Step 1: restore session on mount ─────────────────────────────────────
    // getSession() reads from localStorage — pure client-side, no network call,
    // no DB query.  This is the ONLY place loading flips to false.
    supabaseAuth.auth.getSession().then(({ data: { session: s }, error }) => {
      if (error) {
        console.warn('[auth] getSession error (non-critical):', error.message);
      }
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
      pingEnsureProfile(s?.access_token);
    });

    // ── Step 2: keep state in sync with auth events ───────────────────────────
    // onAuthStateChange handles SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, etc.
    // We deliberately do NOT toggle `loading` here — that would cause flicker
    // on every token refresh.
    const { data: { subscription } } = supabaseAuth.auth.onAuthStateChange(
      (event, s) => {
        console.log('[auth] event:', event);
        setSession(s);
        setUser(s?.user ?? null);
        if (event === 'SIGNED_IN' && s?.access_token) {
          pingEnsureProfile(s.access_token);
        }
        // If a token refresh fails, Supabase emits SIGNED_OUT with null session
        // which correctly clears the user state above.
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions (pure auth — zero DB queries) ────────────────────────────

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabaseAuth.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in failed';
      console.error('[auth] signIn exception:', msg);
      return { error: msg };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    profile?: {
      phone?: string;
      gender?: 'male' | 'female';
      age?: number;
      username: string;
      /** Opt-in to marketing emails (Israeli anti-spam law requires explicit
       *  opt-in). Stored in Supabase Auth user metadata — no table schema
       *  needed, same as phone/gender/age above. */
      marketingOptIn?: boolean;
    },
  ) => {
    try {
      const { error } = await supabaseAuth.auth.signUp({
        email,
        password,
        options: profile ? { data: profile } : undefined,
      });
      return { error: error?.message ?? null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-up failed';
      console.error('[auth] signUp exception:', msg);
      return { error: msg };
    }
  };

  const signInWithGoogle = async (next?: string) => {
    try {
      const base =
        typeof window !== 'undefined'
          ? window.location.origin
          : (process.env.NEXT_PUBLIC_SITE_URL ?? '');
      const redirectTo = next
        ? `${base}/auth/callback?next=${encodeURIComponent(next)}`
        : `${base}/auth/callback`;
      const { error } = await supabaseAuth.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      return { error: error?.message ?? null };
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Google sign-in failed' };
    }
  };

  const signOut = async () => {
    try {
      await supabaseAuth.auth.signOut();
    } catch (err) {
      console.warn('[auth] signOut error (non-critical):', err instanceof Error ? err.message : err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
