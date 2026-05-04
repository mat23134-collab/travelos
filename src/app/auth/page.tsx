'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';

type Mode = 'login' | 'signup';

// ── Grain texture ─────────────────────────────────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function AuthPage() {
  const router                          = useRouter();
  const { user, loading, signIn, signUp } = useAuth();

  const [mode,     setMode]     = useState<Mode>('login');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [success,  setSuccess]  = useState('');

  // Already logged in → redirect to dashboard
  useEffect(() => {
    if (!loading && user) router.replace('/dashboard');
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password.');
      return;
    }
    setBusy(true);
    setError('');
    setSuccess('');

    const fn = mode === 'login' ? signIn : signUp;
    const { error: authError } = await fn(email.trim(), password);

    if (authError) {
      setError(authError);
      setBusy(false);
    } else if (mode === 'signup') {
      // Supabase sends a confirmation email by default;
      // show a friendly message instead of auto-redirect.
      setSuccess('Account created! Check your email to confirm, then log in.');
      setBusy(false);
      setMode('login');
    } else {
      // Successful login → go to dashboard
      router.push('/dashboard');
    }
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setError('');
    setSuccess('');
  };

  if (loading) return null; // wait for auth check before rendering

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ backgroundColor: '#080b12' }}
    >
      {/* Grain */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.025] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }}
      />

      {/* Ambient orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[140px] pointer-events-none"
        style={{ background: 'rgba(255,90,95,0.10)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full blur-[110px] pointer-events-none"
        style={{ background: 'rgba(139,92,246,0.08)' }} />

      {/* Back link */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-white/35 hover:text-white/70 transition-colors flex items-center gap-1.5 z-10"
      >
        ← Travel<span className="text-[#ff5a5f]">OS</span>
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
            <span className="text-2xl font-bold text-white tracking-tight">
              Travel<span className="text-[#ff5a5f]">OS</span>
            </span>
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
                    style={{ background: 'rgba(255,90,95,0.22)', border: '1px solid rgba(255,90,95,0.35)' }}
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
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,90,95,0.45)'; e.currentTarget.style.background = 'rgba(255,90,95,0.06)'; }}
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
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-white/20 outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,90,95,0.45)'; e.currentTarget.style.background = 'rgba(255,90,95,0.06)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                />
              </div>

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
                  background: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c5a 100%)',
                  boxShadow: '0 8px 32px -4px rgba(255,90,95,0.40)',
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
              className="text-[#ff8c8f] hover:text-[#ff5a5f] font-semibold transition-colors"
            >
              {mode === 'login' ? 'Sign up free' : 'Log in'}
            </button>
          </p>
        </div>

        <p className="text-center text-[10px] text-white/15 mt-5">
          By continuing you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </main>
  );
}
