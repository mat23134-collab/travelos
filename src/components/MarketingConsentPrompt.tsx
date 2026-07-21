'use client';

/**
 * MarketingConsentPrompt — a small, dismissible dashboard card that asks
 * existing accounts the marketing opt-in question they were never explicitly
 * asked (profiles.marketing_opt_in === null): pre-existing users, or anyone
 * who signed up via a path that skips the checkbox (e.g. Google OAuth).
 *
 * Deliberately NOT part of the required legal-consent banner — the anti-spam
 * law requires this to be a free, specific, unbundled choice with zero effect
 * on using the site. Closing the card without choosing just snoozes it
 * (re-appears next visit after the cooldown); only Yes/No records a decision.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MARKETING_CONSENT_COPY } from '@/lib/marketingConsent';

const SNOOZE_KEY = 'travelos_marketing_prompt_snoozed_until';
const SNOOZE_DAYS = 14;

function isSnoozed(): boolean {
  if (typeof window === 'undefined') return false;
  const until = Number(window.localStorage.getItem(SNOOZE_KEY) ?? 0);
  return Number.isFinite(until) && until > Date.now();
}

function snooze() {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
}

export function MarketingConsentPrompt({ accessToken }: { accessToken: string | null | undefined }) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [he, setHe] = useState(false);

  useEffect(() => {
    setHe(typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('he'));
  }, []);

  useEffect(() => {
    if (!accessToken || isSnoozed()) return;
    let cancelled = false;
    fetch('/api/marketing-consent', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { optIn?: boolean | null } | null) => {
        if (!cancelled && data && data.optIn === null) setVisible(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accessToken]);

  async function answer(optIn: boolean) {
    if (!accessToken || busy) return;
    setBusy(true);
    try {
      await fetch('/api/marketing-consent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ optIn, source: 'dashboard_prompt' }),
      });
    } catch { /* the prompt just won't re-show correctly until next successful check */ }
    setVisible(false);
    setBusy(false);
  }

  function dismiss() {
    snooze();
    setVisible(false);
  }

  const t = he ? MARKETING_CONSENT_COPY.he : MARKETING_CONSENT_COPY.en;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          dir={he ? 'rtl' : 'ltr'}
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="overflow-hidden"
        >
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 mb-4"
            style={{ background: '#fffdf7', border: '1px solid rgba(184,85,46,0.20)', boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
            role="region"
            aria-label="Marketing email preference"
          >
            <span className="text-xl shrink-0">💌</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13.5px] font-bold" style={{ color: '#2b2622' }}>{t.title}</p>
              <p className="text-[12px] mt-0.5 leading-relaxed" style={{ color: 'rgba(43,38,34,0.62)' }}>{t.body}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(true)}
                className="px-3.5 py-2 rounded-xl text-[12.5px] font-bold text-white disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #b8552e, #cf6a3f)' }}
              >
                {t.yes}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => answer(false)}
                className="px-3.5 py-2 rounded-xl text-[12.5px] font-semibold disabled:opacity-50"
                style={{ background: 'rgba(43,38,34,0.05)', color: 'rgba(43,38,34,0.65)' }}
              >
                {t.no}
              </button>
              <button
                type="button"
                onClick={dismiss}
                aria-label={he ? 'סגירה' : 'Dismiss'}
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] shrink-0"
                style={{ background: 'rgba(43,38,34,0.05)', color: 'rgba(43,38,34,0.5)' }}
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
