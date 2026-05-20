'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';
import { supabaseAuth } from '@/lib/supabase';
import { normalizeUsername, validateUsernameShape } from '@/lib/username';

type Mode = 'login' | 'signup';
type Gender = 'male' | 'female';

// ── Grain texture ─────────────────────────────────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function AuthPage() {
  const router                          = useRouter();
  const { user, loading, signIn, signUp } = useAuth();

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
  };

  // Already logged in → redirect to dashboard
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
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
      const ageNum = Number(age);
      const onlyDigitsPhone = phone.replace(/\D/g, '');
      if (!onlyDigitsPhone || onlyDigitsPhone.length < 8) {
        setError('Please enter a valid phone number.');
        return;
      }
      if (!Number.isFinite(ageNum) || ageNum < 13 || ageNum > 120) {
        setError('Please enter a valid age between 13 and 120.');
        return;
      }
    }
    setBusy(true);
    setError('');
    setSuccess('');
    let authError: string | null = null;
    if (mode === 'login') {
      const result = await signIn(email.trim(), password);
      authError = result.error;
    } else {
      const result = await signUp(email.trim(), password, {
        phone: phone.trim(),
        gender,
        age: Number(age),
        username: normalizeUsername(username),
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
      // Successful login → go to dashboard
      router.push('/dashboard');
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
      style={{ backgroundColor: '#091f36' }}
    >
      {/* Grain */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }}
      />

      {/* Ambient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'rgba(158,54,58,0.10)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[110px] pointer-events-none"
        style={{ background: 'rgba(15,40,98,0.35)' }} />

      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5 z-10"
      >
        ← <BrandWordmark accent="#9e363a" className="text-sm" />
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
            background: 'rgba(255,255,255,0.035)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 32px 80px -16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Brand mark */}
          <div className="text-center mb-8">
            <BrandWordmark accent="#9e363a" className="text-2xl" />
            <p className="text-white/35 text-sm mt-1">Your AI trip planner</p>
          </div>

          {/* Tab switcher */}
          <div
            className="flex rounded-xl p-1 mb-8"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            {(['login', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all relative"
                style={{
                  color: mode === m ? '#fff' : 'rgba(255,255,255,0.35)',
                }}
              >
                {mode === m && (
                  <motion.div
                    layoutId="auth-tab-pill"
                    className="absolute inset-0 rounded-lg"
                    style={{ background: 'rgba(158,54,58,0.22)', border: '1px solid rgba(158,54,58,0.35)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{m === 'login' ? 'Log In' : 'Sign Up'}</span>
              </button>
            ))}
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
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="off"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
                  autoComplete="off"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                />
              </div>

              {mode === 'signup' && (
                <>
                  {/* Username */}
                  <div>
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                      Username
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
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
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
                    <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+972 50 123 4567"
                      autoComplete="off"
                      required={mode === 'signup'}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
                      onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    />
                  </div>

                  {/* Gender + Age */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Gender
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value as Gender)}
                        required={mode === 'signup'}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                      >
                        <option value="male"   style={{ background: '#091f36', color: '#fff' }}>Male</option>
                        <option value="female" style={{ background: '#091f36', color: '#fff' }}>Female</option>
                        <option value="other"  style={{ background: '#091f36', color: '#fff' }}>Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-white/40 uppercase tracking-widest mb-2">
                        Age
                      </label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        min={13}
                        max={120}
                        placeholder="25"
                        autoComplete="off"
                        required={mode === 'signup'}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                        style={{
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.10)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.55)'; e.currentTarget.style.background = 'rgba(158,54,58,0.07)'; }}
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
                    className="text-xs text-[#ff8c8f] px-3 py-2 rounded-xl overflow-hidden"
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

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={busy}
                whileHover={{ scale: busy ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-xl text-sm font-bold text-white relative overflow-hidden transition-opacity disabled:opacity-60 mt-1"
                style={{
                  background: 'linear-gradient(135deg, #9e363a 0%, #b5404a 100%)',
                  boxShadow: '0 8px 32px -4px rgba(158,54,58,0.40)',
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

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs text-white/20">or</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          {/* Switch mode link */}
          <p className="text-center text-xs text-white/30">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
              className="font-semibold transition-colors" style={{ color: '#c05060' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#9e363a')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#c05060')}
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
          </a>.
        </p>
      </motion.div>
    </main>
  );
}
