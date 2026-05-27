'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import {
  buildLegalConsentRecord,
  getStoredLegalConsent,
  hasRequiredLegalConsent,
  storeLegalConsent,
  type LegalConsentRecord,
} from '@/lib/legalConsent';

async function persistConsent(record: LegalConsentRecord, accessToken?: string | null) {
  try {
    const res = await fetch('/api/legal-consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { error?: string };
      console.error('[legal-consent] server rejected consent:', res.status, body.error ?? '');
    }
  } catch (err) {
    // Network error — local consent still gates UX; retried on next page load / auth.
    console.warn('[legal-consent] network error persisting consent:', err instanceof Error ? err.message : err);
  }
}

export function LegalConsentBanner() {
  const { session } = useAuth();
  const [visible, setVisible] = useState(false);
  const [manage, setManage] = useState(false);
  const [preferencesCookies, setPreferencesCookies] = useState(true);
  const [analyticsCookies, setAnalyticsCookies] = useState(false);

  useEffect(() => {
    setVisible(!hasRequiredLegalConsent());

    const show = () => {
      setManage(true);
      setVisible(true);
    };
    const sync = () => setVisible(!hasRequiredLegalConsent());

    window.addEventListener('travelos:legal-consent-required', show);
    window.addEventListener('travelos:legal-consent-updated', sync);
    return () => {
      window.removeEventListener('travelos:legal-consent-required', show);
      window.removeEventListener('travelos:legal-consent-updated', sync);
    };
  }, []);

  useEffect(() => {
    const stored = getStoredLegalConsent();
    if (stored && session?.access_token) {
      persistConsent(stored, session.access_token);
    }
  }, [session?.access_token]);

  const accept = useCallback((all: boolean) => {
    const record = buildLegalConsentRecord({
      preferencesCookies: all ? true : preferencesCookies,
      analyticsCookies: all ? true : analyticsCookies,
    });
    storeLegalConsent(record);
    persistConsent(record, session?.access_token);
    setVisible(false);
    setManage(false);
  }, [analyticsCookies, preferencesCookies, session?.access_token]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          className="fixed inset-x-4 bottom-4 z-[80] mx-auto max-w-3xl rounded-3xl border p-4 sm:p-5"
          style={{
            background: 'rgba(9,31,54,0.94)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.55), 0 0 50px rgba(158,54,58,0.20)',
            backdropFilter: 'blur(18px)',
          }}
          role="dialog"
          aria-label="Legal consent"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-white">Before takeoff</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.58)' }}>
                We use essential cookies/local storage for login, onboarding progress, and trip generation.
                By continuing you agree to our{' '}
                <Link href="/terms" className="underline underline-offset-2 text-white/80">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="underline underline-offset-2 text-white/80">Privacy Policy</Link>.
                {' '}Cookie details are listed in our{' '}
                <Link href="/cookies" className="underline underline-offset-2 text-white/80">Cookie Policy</Link>.
              </p>

              {manage && (
                <div className="mt-4 grid gap-2 text-xs">
                  <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    style={{ borderColor: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.62)' }}>
                    <span>Essential cookies and local storage (required)</span>
                    <input type="checkbox" checked readOnly />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    style={{ borderColor: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.62)' }}>
                    <span>Preference storage (language, onboarding choices)</span>
                    <input
                      type="checkbox"
                      checked={preferencesCookies}
                      onChange={(e) => setPreferencesCookies(e.target.checked)}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2"
                    style={{ borderColor: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.62)' }}>
                    <span>Analytics cookies (currently off by default)</span>
                    <input
                      type="checkbox"
                      checked={analyticsCookies}
                      onChange={(e) => setAnalyticsCookies(e.target.checked)}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:min-w-36">
              <button
                type="button"
                onClick={() => accept(true)}
                className="rounded-full px-5 py-2.5 text-xs font-black text-white"
                style={{ background: 'linear-gradient(135deg, #9e363a, #b5404a)' }}
              >
                Accept all
              </button>
              <button
                type="button"
                onClick={() => manage ? accept(false) : setManage(true)}
                className="rounded-full border px-5 py-2.5 text-xs font-bold"
                style={{ borderColor: 'rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.70)' }}
              >
                {manage ? 'Save choices' : 'Manage'}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
