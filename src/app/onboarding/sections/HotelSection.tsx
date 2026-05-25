'use client';

/**
 * HotelSection — Section 3 of the progressive onboarding flow (optional).
 *
 * Hotel search via /api/geocode (Nominatim proxy). Geocoordinates are stored
 * in the onboarding store and passed as query params to /plan.
 * The user can skip this step with no penalty.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

const GOLD  = '#c5912a';
const RED   = '#9e363a';
const RED2  = '#b5404a';
const MUTED = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

interface Props {
  isCompleted: boolean;
  onComplete:  () => void;  // "Build My Trip"
  onSkip:      () => void;  // skip hotel, go straight to plan
  onEdit:      () => void;
}

type Status = 'idle' | 'loading' | 'found' | 'error';

export function HotelSection({ isCompleted, onComplete, onSkip, onEdit }: Props) {
  const {
    hotelAddress, hotelLat, hotelLng,
    setHotelLocation, clearHotelLocation,
    destination,
  } = useOnboardingStore();

  const [query, setQuery]   = useState(hotelAddress || '');
  const [status, setStatus] = useState<Status>(hotelAddress ? 'found' : 'idle');
  const [errMsg, setErrMsg] = useState('');

  const confirmed = status === 'found' && !!hotelAddress;

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus('loading');
    setErrMsg('');
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (!data?.length) throw new Error('Not found');
      const { lat, lon, display_name } = data[0];
      setHotelLocation(display_name ?? q, parseFloat(lat), parseFloat(lon));
      setStatus('found');
    } catch {
      setStatus('error');
      setErrMsg('Hotel not found — try a different name or address');
    }
  }

  function handleClear() {
    clearHotelLocation();
    setQuery('');
    setStatus('idle');
  }

  // ── Completed summary bar ─────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(15,40,98,0.28)', border: `1px solid rgba(197,145,42,0.22)` }}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: GOLD }}>✓</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">🏨 {hotelAddress.split(',')[0]}</span>
          </div>
        </div>
        <button onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle"
          style={{ color: MUTED, border: '1px solid rgba(255,255,255,0.10)' }}>
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: GOLD }}>3</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Where to stay?</h2>
          <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: MUTED }}>
            Your hotel becomes the anchor for the entire trip
            <span className="px-1.5 py-0.5 rounded-full text-[10px]"
              style={{ background: 'rgba(255,255,255,0.07)', color: MUTED }}>Optional</span>
          </p>
        </div>
      </div>

      {/* Search input */}
      <AnimatePresence mode="wait">
        {status !== 'found' ? (
          <motion.div key="search" variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex gap-2">
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(197,145,42,0.45)`)}
              onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
            >
              <span className="text-base shrink-0">🏨</span>
              <input
                type="text"
                placeholder={`Hotel name or address in ${destination || 'your destination'}…`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
              />
            </div>
            <motion.button
              onClick={handleSearch}
              disabled={query.trim().length < 3 || status === 'loading'}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40 transition-colors"
              style={{ background: status === 'loading' ? 'rgba(197,145,42,0.30)' : GOLD }}
            >
              {status === 'loading' ? '…' : 'Find'}
            </motion.button>
          </motion.div>
        ) : (
          /* Found state */
          <motion.div key="found" variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
            style={{ background: 'rgba(197,145,42,0.10)', border: '1.5px solid rgba(197,145,42,0.35)' }}>
            <span className="text-xl mt-0.5">📍</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{hotelAddress.split(',')[0]}</p>
              <p className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>{hotelAddress}</p>
              {hotelLat != null && (
                <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(79,95,118,0.7)' }}>
                  {hotelLat.toFixed(4)}, {hotelLng!.toFixed(4)}
                </p>
              )}
            </div>
            <button onClick={handleClear} aria-label="Clear hotel selection"
              className="shrink-0 text-sm hover-text-gold mt-0.5 transition-colors"
              style={{ color: 'rgba(197,145,42,0.5)' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.p key="err" variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="text-sm px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(158,54,58,0.12)', color: '#f87171', border: '1px solid rgba(158,54,58,0.25)' }}>
            ⚠️ {errMsg}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Info note */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl"
        style={{ background: 'rgba(15,40,98,0.22)', border: '1px solid rgba(74,123,222,0.12)' }}>
        <span className="text-base shrink-0">🧭</span>
        <p className="text-xs leading-relaxed" style={{ color: '#4f5f76' }}>
          The AI uses your hotel's location as the trip anchor — optimizing routes and neighbourhood recommendations around it.
        </p>
      </div>

      {/* Skip link — the floating CTA is the primary generate action */}
      <button
        onClick={onSkip}
        className="text-xs text-center transition-colors hover-text-faint"
        style={{ color: 'rgba(79,95,118,0.7)' }}
      >
        Skip — I'll add my hotel later
      </button>
    </div>
  );
}
