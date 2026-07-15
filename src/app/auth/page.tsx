'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';
import { supabaseAuth } from '@/lib/supabase';
import { normalizeUsername, validateUsernameShape } from '@/lib/username';
import { loadAndClearPendingIntent, peekPendingIntent } from '@/lib/pendingIntent';
import {
  buildLegalConsentRecord,
  hasRequiredLegalConsent,
  storeLegalConsent,
} from '@/lib/legalConsent';

type Mode = 'login' | 'signup';
type Gender = 'male' | 'female';

// ── Grain texture ─────────────────────────────────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function AuthPage() {
  const router                          = useRouter();
  const { user, loading, signIn, signUp, signInWithGoogle } = useAuth();

  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [phone,    setPhone]    = useState('');
  const [gender,   setGender]   = useState<Gender>('male');
  const [age,      setAge]      = useState('');
  const [username, setUsername] = useState('');
  const [usernameHint, setUsernameHint] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [success,  setSuccess]  = useState('');
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);

  const syncProfileFromSession = useCallback(async () => {
    const { data: { session } } = await supabaseAuth.auth.getSession();
    if (!session?.access_token) return;
    const res = await fetch('/api/auth/ensure-profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      console.warn('[auth] ensure-profile:', j.error ?? res.status);
    }
  }, []);

  const resetAuthForm = () => {
    setMode('login');
    setEmail('');
    setPassword('');
    setPhone('');
    setGender('male');
    setAge('');
    setUsername('');
    setUsernameHint('');
    setError('');
    setSuccess('');
    setBusy(false);
    setLegalAccepted(hasRequiredLegalConsent());
  };

  // Show error injected from OAuth callback (?error=...)
  const errorReadRef = useRef(false);
  useEffect(() => {
    if (errorReadRef.current) return;
    errorReadRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const e = params.get('error');
    if (e) setError(decodeURIComponent(e));
  }, []);

  // Already logged in → restore pending intent or go to dashboard
  useEffect(() => {
    if (!loading && user) {
      const intent = loadAndClearPendingIntent();
      if (intent?.claimItineraryId) {
        // The itinerary page itself performs the claim (POST /api/trips/claim)
        // once it sees an authenticated session on an unclaimed trip — just
        // send them back to it.
        router.replace(`/itinerary/${intent.claimItineraryId}`);
      } else if (intent?.destination) {
        router.replace(`/onboarding?destination=${encodeURIComponent(intent.destination)}`);
      } else {
        router.replace('/dashboard');
      }
    }
  }, [user, loading, router]);

  // Always enter this page in a clean state.
  useEffect(() => {
    resetAuthForm();
  }, []);

  useEffect(() => {
    if (mode !== 'signup') {
      setUsernameHint('');
      return;
    }
    const n = normalizeUsername(username);
    if (n.length < 3) {
      setUsernameHint('');
      return;
    }
    const shapeErr = validateUsernameShape(username);
    if (shapeErr) {
      setUsernameHint(shapeErr);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/username-available?u=${encodeURIComponent(n)}`);
        const j = (await r.json()) as { available?: boolean; error?: string };
        if (cancelled) return;
        if (!r.ok) {
          setUsernameHint(j.error ?? 'Could not verify.');
          return;
        }
        setUsernameHint(j.available ? '✓ Available' : '✗ Already taken');
      } catch {
        if (!cancelled) setUsernameHint('');
      }
    }, 450);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    if (mode === 'signup') {
      if (!legalAccepted && !hasRequiredLegalConsent()) {
        setError('Please accept the Terms, Privacy Policy, and required cookies to create an account.');
        return;
      }
      const uErr = validateUsernameShape(username);
      if (uErr) {
        setError(uErr);
        return;
      }
      const un = normalizeUsername(username);
      try {
        const r = await fetch(`/api/username-available?u=${encodeURIComponent(un)}`);
        const j = (await r.json()) as { available?: boolean; error?: string };
        if (!r.ok || !j.available) {
          setError(j.error ?? 'Username is not available.');
          return;
        }
      } catch {
        setError('Could not verify username. Try again.');
        return;
      }
      const onlyDigitsPhone = phone.replace(/\D/g, '');
      if (onlyDigitsPhone && onlyDigitsPhone.length < 8) {
        setError('Please enter a valid phone number (or leave it blank).');
        return;
      }
      if (age.trim()) {
        const ageNum = Number(age);
        if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
          setError('Please enter a valid age between 13 and 120 (or leave it blank).');
          return;
        }
      }
    }
    setBusy(true);
    setError('');
    setSuccess('');
    if (mode === 'signup' && !hasRequiredLegalConsent()) {
      const consent = buildLegalConsentRecord({ preferencesCookies: true, analyticsCookies: false });
      storeLegalConsent(consent);
      fetch('/api/legal-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(consent),
      }).catch(() => {});
    }
    let authError: string | null = null;
    if (mode === 'login') {
      const result = await signIn(email.trim(), password);
      authError = result.error;
    } else {
      const result = await signUp(email.trim(), password, {
        phone: phone.trim() || undefined,
        gender: gender || undefined,
        age: age.trim() ? Number(age) : undefined,
        username: normalizeUsername(username),
        marketingOptIn,
      });
      authError = result.error;
    }

    if (authError) {
      setError(authError);
      setBusy(false);
    } else if (mode === 'signup') {
      await syncProfileFromSession();
      // Supabase sends a confirmation email by default;
      // show a friendly message instead of auto-redirect.
      setSuccess('Account created! Check your email to confirm, then log in.');
      setBusy(false);
      setMode('login');
      setEmail('');
      setPassword('');
      setPhone('');
      setGender('male');
      setAge('');
      setUsername('');
      setUsernameHint('');
    } else {
      await syncProfileFromSession();
      setBusy(false);
      // Restore pending trip intent (destination chosen, or a guest trip
      // waiting to be claimed, before this auth round-trip)
      const intent = loadAndClearPendingIntent();
      if (intent?.claimItineraryId) {
        router.push(`/itinerary/${intent.claimItineraryId}`);
      } else if (intent?.destination) {
        router.push(`/onboarding?destination=${encodeURIComponent(intent.destination)}`);
      } else {
        router.push('/dashboard');
      }
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
    setUsernameHint('');
  };

  if (loading) return null; // wait for auth check before rendering

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
    >
      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm transition-colors flex items-center gap-1.5 z-10"
        style={{ color: 'rgba(143,66,32,0.70)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'rgba(143,66,32,1)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(143,66,32,0.70)')}
      >
        ← <BrandWordmark accent="#b8552e" tone="light" className="text-sm" />
      </Link>

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        className="relative z-10 w-full max-w-md"
      >
        <div
          className="rounded-3xl p-8"
          style={{
            // Dark navy surface so the existing white form text stays readable
            // on top of the light teal/photo background. Teal border accent
            // preserves the new global theme.
            background: 'rgba(38,30,24,0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(184,85,46,0.35)',
            boxShadow: '0 32px 80px -16px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Brand mark */}
          <div className="text-center mb-8">
            <BrandWordmark accent="#D4784A" className="text-xl" variant="full" />
          </div>

          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ background: 'rgba(184,85,46,0.14)', border: '1px solid rgba(184,85,46,0.28)' }}
          >
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative"
                style={{
                  color: mode === m ? '#fff' : 'rgba(255,255,255,0.65)',
                }}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-tab-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'rgba(184,85,46,0.22)', border: '1px solid rgba(184,85,46,0.35)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Log In' : 'Sign Up'}</span>
              </button>
            ))}
          </div>

          {/* Google OAuth */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.015 }}
            whileTap={{ scale: 0.97 }}
            onClick={async () => {
              setBusy(true);
              setError('');
              const claimId = peekPendingIntent()?.claimItineraryId;
              const { error: gErr } = await signInWithGoogle(claimId ? `/itinerary/${claimId}` : undefined);
              if (gErr) { setError(gErr); setBusy(false); }
              // on success the page redirects — busy stays true intentionally
            }}
            disabled={busy}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff',
            }}
            onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; }}
          >
            {/* Google logo */}
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.9 3 4 11.9 4 23s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.2-3z" fill="#FFC107"/>
              <path d="M6.3 14.7l7 5.1C15.1 16.2 19.2 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3c-7.5 0-14 4.3-17.7 10.7z" fill="#FF3D00"/>
              <path d="M24 43c5.9 0 10.9-2 14.5-5.3l-6.7-5.5C29.9 34 27.1 35 24 35c-6.1 0-11.3-4.1-13.1-9.7l-7 5.4C7.7 39.5 15.3 43 24 43z" fill="#4CAF50"/>
              <path d="M44.5 20H24v8.5h11.8c-.9 2.6-2.6 4.8-4.9 6.2l6.7 5.5C41.3 36.5 44.5 30.2 44.5 23c0-1.3-.1-2-.2-3z" fill="#1976D2"/>
            </svg>
            {busy ? 'Redirecting…' : `${mode === 'login' ? 'Continue' : 'Sign up'} with Google`}
          </motion.button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.22)' }}>or continue with email</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Form */}
          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleSubmit}
              className="flex flex-col gap-4"
              autoComplete="off"
            >
              {/* Email */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                  Email <span className="text-[10px] font-normal normal-case tracking-normal text-red-400">required</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    color: '#222',
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(184,85,46,0.3)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                  Password <span className="text-[10px] font-normal normal-case tracking-normal text-red-400">required</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  autoComplete="off"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{
                    color: '#222',
                    background: 'rgba(255,255,255,0.6)',
                    border: '1px solid rgba(184,85,46,0.3)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.85)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.3)'; e.currentTarget.style.background = 'rgba(255,255,255,0.6)'; }}
                />
              </div>

              {mode === 'signup' && (
                <>
                  {/* Username */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                      Username <span className="text-[10px] font-normal normal-case tracking-normal text-red-400">required</span>
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. maya_travels"
                      autoComplete="username"
                      required={mode === 'signup'}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.55)'; e.currentTarget.style.background = 'rgba(184,85,46,0.07)'; }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    />
                    {usernameHint && (
                      <p
                        className="text-[11px] mt-1.5"
                        style={{
                          color: usernameHint.startsWith('✓')
                            ? 'rgba(52,211,153,0.9)'
                            : usernameHint.startsWith('✗') || usernameHint.includes('must')
                              ? 'rgba(255,140,143,0.95)'
                              : 'rgba(255,255,255,0.35)',
                        }}
                      >
                        {usernameHint}
                      </p>
                    )}
                    <p className="text-[10px] text-white/25 mt-1">3–24 chars · letters, numbers, underscore · lowercased when saved</p>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                      Phone Number <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.28)' }}>optional</span>
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+972 50 123 4567"
                      autoComplete="off"
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.55)'; e.currentTarget.style.background = 'rgba(184,85,46,0.07)'; }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    />
                  </div>

                  {/* Gender + Age */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                        Gender <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.28)' }}>optional</span>
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.55)'; e.currentTarget.style.background = 'rgba(184,85,46,0.07)'; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      >
                        <option value="male"   style={{ background: '#091f36', color: '#fff' }}>Male</option>
                        <option value="female" style={{ background: '#091f36', color: '#fff' }}>Female</option>
                        <option value="other"  style={{ background: '#091f36', color: '#fff' }}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: '#555' }}>
                        Age <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: 'rgba(255,255,255,0.28)' }}>optional</span>
                      </label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        min={13}
                        max={120}
                        placeholder="25"
                        autoComplete="off"
                        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(184,85,46,0.55)'; e.currentTarget.style.background = 'rgba(184,85,46,0.07)'; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-[#f0c98a] px-3 py-2 rounded-xl overflow-hidden"
                    style={{ background: 'rgba(255,90,95,0.10)', border: '1px solid rgba(255,90,95,0.22)' }}
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* Success */}
              <AnimatePresence>
                {success && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-emerald-300 px-3 py-2 rounded-xl overflow-hidden"
                    style={{ background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)' }}
                  >
                    ✓ {success}
                  </motion.p>
                )}
              </AnimatePresence>

              {mode === 'signup' && (
                <label
                  className="flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed"
                  style={{
                    borderColor: legalAccepted ? 'rgba(184,85,46,0.35)' : 'rgba(255,255,255,0.10)',
                    background: legalAccepted ? 'rgba(184,85,46,0.08)' : 'rgba(255,255,255,0.035)',
                    color: 'rgba(255,255,255,0.58)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={legalAccepted}
                    onChange={(e) => setLegalAccepted(e.target.checked)}
                    className="mt-0.5"
                    required={mode === 'signup'}
                  />
                  <span>
                    I agree to the{' '}
                    <Link href="/terms" className="underline underline-offset-2 text-white/80">
                      Terms of Service
                    </Link>
                    , the{' '}
                    <Link href="/privacy" className="underline underline-offset-2 text-white/80">
                      Privacy Policy
                    </Link>
                    , the{' '}
                    <Link href="/cookies" className="underline underline-offset-2 text-white/80">
                      Cookie Policy
                    </Link>
                    , and required cookies/local storage.
                  </span>
                </label>
              )}

              {mode === 'signup' && (
                <label
                  className="flex items-start gap-3 rounded-2xl border px-3.5 py-3 text-xs leading-relaxed"
                  style={{
                    borderColor: marketingOptIn ? 'rgba(184,85,46,0.35)' : 'rgba(255,255,255,0.10)',
                    background: marketingOptIn ? 'rgba(184,85,46,0.08)' : 'rgba(255,255,255,0.035)',
                    color: 'rgba(255,255,255,0.58)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={marketingOptIn}
                    onChange={(e) => setMarketingOptIn(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Send me trip ideas, tips, and offers by email. Optional — you can unsubscribe anytime.
                  </span>
                </label>
              )}

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white relative overflow-hidden transition-opacity disabled:opacity-60 mt-1"
                style={{
                  background: 'linear-gradient(135deg, #b8552e 0%, #cf6a3f 100%)',
                  boxShadow: '0 8px 32px -4px rgba(184,85,46,0.40)',
                }}
              >
                {/* Shimmer sweep */}
                <span
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                    backgroundSize: '200% 100%',
                    animation: busy ? 'none' : 'shimmer 2s infinite',
                  }}
                />
                <span className="relative">
                  {busy
                    ? (mode === 'login' ? 'Signing in…' : 'Creating account…')
                    : (mode === 'login' ? 'Log In →' : 'Create Account →')
                  }
                </span>
              </motion.button>
            </motion.form>
          </AnimatePresence>

          {/* Switch mode link */}
          <p className="text-center text-xs text-white/30">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold transition-colors hover-text-brand" style={{ color: '#cf6a3f' }}
            >
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-white/25 mt-5">
          By continuing you agree to our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-white/60 transition-colors">
            Terms of Service
          </a>
          {' '}and{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-white/60 transition-colors">
            Privacy Policy
          </a>
          {' '}and{' '}
          <a href="/cookies" className="underline underline-offset-2 hover:text-white/60 transition-colors">
            Cookie Policy
          </a>.
        </p>
      </motion.div>
    </main>
  );
}
