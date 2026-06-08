'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import type { Activity, Itinerary, TravelerProfile } from '@/lib/types';
import { dayCardUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { useAuth } from '@/lib/auth-context';

export type SwapSlot = 'morning' | 'afternoon' | 'evening';

type SwapProposalAlternative = { placeIntro: string; whyItFitsYou: string; activity: Activity };

const SPRING = { type: 'spring' as const, stiffness: 100, damping: 20 };

export function SmartSwapSheet({
  open,
  onClose,
  itinerary,
  dayIndex,
  slot,
  activity,
  profile,
  genreLabel,
  onCommit,
  ui,
  dc,
}: {
  open: boolean;
  onClose: () => void;
  itinerary: Itinerary;
  dayIndex: number;
  slot: SwapSlot;
  activity: Activity;
  profile: TravelerProfile | null;
  genreLabel: string;
  onCommit: (next: Activity, summary: string) => Promise<void>;
  ui: ItineraryUiStrings;
  dc: ReturnType<typeof dayCardUi>;
}) {
  const { session } = useAuth();
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [alts, setAlts] = useState<SwapProposalAlternative[]>([]);
  const [localErr, setLocalErr] = useState('');
  const [applying, setApplying] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customApplying, setCustomApplying] = useState(false);

  useEffect(() => {
    setPortalEl(document.body);
  }, []);

  useEffect(() => {
    if (!open) {
      setPhase('idle');
      setAlts([]);
      setLocalErr('');
      setApplying(null);
      setCustomName('');
      setCustomApplying(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setPhase('loading');
      setLocalErr('');
      try {
        const authHeaders: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) authHeaders.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/swap-proposals', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            itinerary,
            dayIndex,
            slot,
            profile,
          }),
        });
        const data = (await res.json()) as { alternatives?: SwapProposalAlternative[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'swap-proposals failed');
        const list = Array.isArray(data.alternatives) ? data.alternatives : [];
        if (cancelled) return;
        setAlts(list);
        setPhase('ready');
      } catch (e) {
        if (cancelled) return;
        setPhase('error');
        setLocalErr(e instanceof Error ? e.message : dc.smartSwapError);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, itinerary, dayIndex, slot, profile, dc.smartSwapError]);

  const retry = () => {
    if (!open) return;
    setPhase('loading');
    setLocalErr('');
    (async () => {
      try {
        const retryHeaders: HeadersInit = { 'Content-Type': 'application/json' };
        if (session?.access_token) retryHeaders.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/swap-proposals', {
          method: 'POST',
          headers: retryHeaders,
          body: JSON.stringify({ itinerary, dayIndex, slot, profile }),
        });
        const data = (await res.json()) as { alternatives?: SwapProposalAlternative[]; error?: string };
        if (!res.ok) throw new Error(data.error || 'swap-proposals failed');
        setAlts(Array.isArray(data.alternatives) ? data.alternatives : []);
        setPhase('ready');
      } catch (e) {
        setPhase('error');
        setLocalErr(e instanceof Error ? e.message : dc.smartSwapError);
      }
    })();
  };

  const pick = async (i: number) => {
    const row = alts[i];
    if (!row || applying !== null) return;
    setApplying(i);
    try {
      const summary = `${row.whyItFitsYou} — ${row.placeIntro}`.slice(0, 400);
      await onCommit(row.activity, summary);
      onClose();
    } catch {
      setLocalErr(dc.smartSwapError);
    } finally {
      setApplying(null);
    }
  };

  const pickCustom = async () => {
    const name = customName.trim();
    if (!name || customApplying) return;
    setCustomApplying(true);
    try {
      // Build a minimal Activity from the user's free-text input
      const syntheticActivity = {
        ...activity,
        name,
        description: '',
        neighborhood: activity.neighborhood,
      } as Activity;
      await onCommit(syntheticActivity, `Custom selection: ${name}`);
      onClose();
    } catch {
      setLocalErr(dc.smartSwapError);
    } finally {
      setCustomApplying(false);
    }
  };

  if (!portalEl || !open) return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain"
      style={{ direction: ui.dir }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      lang={ui.htmlLang}
    >
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full max-w-lg max-h-[min(92dvh,880px)] overflow-y-auto rounded-3xl border border-white/10 shadow-2xl my-auto"
        style={{ background: '#0f1117' }}
        initial={{ y: 28, opacity: 0.94, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={SPRING}
      >
        <div className="sticky top-0 z-20 flex items-start justify-between gap-3 px-5 py-4 border-b border-white/8 bg-[#0f1117]/95 backdrop-blur-md">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1">{dc.smartSwapTitle}</p>
            <p className="text-xs text-white/45">{dc.smartSwapSubtitle(genreLabel)}</p>
            <p className="text-sm font-semibold text-white mt-1 line-clamp-2">{activity.name}</p>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.88 }}
            aria-label="Close Smart Swap"
            className="w-8 h-8 rounded-full flex items-center justify-center text-white/45 hover:text-white border border-white/12 bg-white/5 text-xs shrink-0"
          >
            ✕
          </motion.button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/45 text-sm">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 0.85, repeat: Infinity, ease: 'linear' }}
                className="text-2xl inline-block"
              >
                ↻
              </motion.span>
              {dc.smartSwapLoading}
            </div>
          )}

          {phase === 'error' && (
            <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200/90">
              <p>{localErr || dc.smartSwapError}</p>
              <motion.button
                type="button"
                onClick={retry}
                whileTap={{ scale: 0.96 }}
                className="mt-3 text-xs font-bold uppercase tracking-wide text-white/80 underline underline-offset-2"
              >
                {dc.smartSwapRetry}
              </motion.button>
            </div>
          )}

          {phase === 'ready' && (
            <div className="space-y-4">
              {alts.slice(0, 2).map((row, idx) => (
                <div
                  key={`${row.activity.name}-${idx}`}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3"
                >
                  <div>
                    <p className="text-base font-bold text-white leading-tight">{row.activity.name}</p>
                    <p className="text-[11px] text-white/40 mt-1">📍 {row.activity.neighborhood ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/35 mb-1">{dc.smartSwapIntro}</p>
                    <p className="text-xs text-white/65 leading-relaxed">{row.placeIntro}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]/90 mb-1">{dc.smartSwapWhyYou}</p>
                    <p className="text-xs text-white/75 leading-relaxed">{row.whyItFitsYou}</p>
                  </div>
                  <motion.button
                    type="button"
                    disabled={applying !== null}
                    whileTap={{ scale: applying === null ? 0.97 : 1 }}
                    onClick={() => pick(idx)}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-45 transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg, #a89254 0%, #b8a066 100%)',
                      boxShadow: '0 4px 18px rgba(200,150,102,0.28)',
                    }}
                  >
                    {applying === idx ? dc.smartSwapApplying : dc.smartSwapReplace}
                  </motion.button>
                </div>
              ))}

              {/* ── Custom place entry ─────────────────────────────────────── */}
              <div className="relative flex items-center gap-3 my-2">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30 shrink-0">
                  or enter your own
                </span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                  Your Place
                </p>
                <input
                  type="text"
                  placeholder="Type a place name…"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') pickCustom();
                  }}
                  disabled={customApplying || applying !== null}
                  className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none disabled:opacity-40"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.55)'; }}
                  onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                />
                <motion.button
                  type="button"
                  disabled={!customName.trim() || customApplying || applying !== null}
                  whileTap={{ scale: customName.trim() && !customApplying ? 0.97 : 1 }}
                  onClick={pickCustom}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-opacity"
                  style={{
                    background: 'rgba(201,168,76,0.20)',
                    border: '1px solid rgba(201,168,76,0.35)',
                    color: '#d4c8a8',
                  }}
                >
                  {customApplying ? 'Applying…' : 'Use This Place ✓'}
                </motion.button>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 px-5 py-4 border-t border-white/8 bg-[#0f1117]">
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.98 }}
            className="w-full py-2.5 rounded-xl text-sm text-white/45 border border-white/10 hover:bg-white/5 transition-colors"
          >
            {dc.smartSwapClose}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    portalEl,
  );
}
