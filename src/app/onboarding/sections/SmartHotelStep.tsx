'use client';

/**
 * SmartHotelStep — Step 3 of the onboarding wizard.
 *
 * Two paths:
 *   A) "I have a hotel" → geocode search → confirm
 *   B) "Help me choose" → accommodation type → nightly budget → continue
 *
 * Either path calls onComplete() to advance the wizard.
 * A skip link is available to move on without hotel info.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

const GOLD  = '#c5912a';
const MUTED = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ── Accommodation options ──────────────────────────────────────────────────────
const ACCOM_OPTIONS = [
  { value: 'hostel',        label: 'Hostel / Guesthouse', icon: '🛏️', sub: 'Social, affordable, central'    },
  { value: 'boutique-hotel', label: 'Boutique Hotel',      icon: '🏨', sub: 'Character-driven, local feel'   },
  { value: 'luxury-hotel',  label: 'Luxury Hotel',         icon: '⭐', sub: '5-star service & amenities'    },
  { value: 'airbnb',        label: 'Apartment / Airbnb',   icon: '🏠', sub: 'Live like a local, full kitchen'},
  { value: 'resort',        label: 'Resort',               icon: '🌴', sub: 'Self-contained, pool, curated' },
] as const;

// ── Nightly budget options ─────────────────────────────────────────────────────
const NIGHTLY_OPTIONS = [
  { value: 'budget',  label: 'Up to $80',   icon: '🪙' },
  { value: 'mid',     label: '$80 – $150',  icon: '💵' },
  { value: 'comfort', label: '$150 – $300', icon: '💳' },
  { value: 'luxury',  label: '$300+',       icon: '💎' },
] as const;

interface Props {
  onComplete: () => void;
  onSkip:     () => void;
}

type Path = 'booked' | 'choose' | null;
type SearchStatus = 'idle' | 'loading' | 'found' | 'error';

export function SmartHotelStep({ onComplete, onSkip }: Props) {
  const {
    hotelAddress, hotelLat, hotelLng,
    setHotelLocation, clearHotelLocation,
    accommodation, hotelNightlyBudget,
    setAccommodation, setHotelNightlyBudget,
    destination,
  } = useOnboardingStore();

  const [path, setPath]       = useState<Path>(hotelAddress ? 'booked' : null);
  const [query, setQuery]     = useState(hotelAddress || '');
  const [status, setStatus]   = useState<SearchStatus>(hotelAddress ? 'found' : 'idle');
  const [errMsg, setErrMsg]   = useState('');

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

  function handlePathSelect(p: Path) {
    if (p === 'choose') {
      clearHotelLocation();
      setQuery('');
      setStatus('idle');
    }
    setPath(p);
  }

  // Can continue when:
  // - booked path: hotel confirmed
  // - choose path: at minimum accommodation type selected
  const canContinue =
    (path === 'booked' && status === 'found' && !!hotelAddress) ||
    (path === 'choose' && !!accommodation);

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-white tracking-tight">Where will you sleep?</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>
          Your accommodation anchors routes, dining picks, and neighbourhood advice
        </p>
      </div>

      {/* Path selector */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { p: 'booked' as Path, icon: '🏨', label: 'I already have a hotel', sub: 'Let me enter it' },
          { p: 'choose' as Path, icon: '🔍', label: 'Help me choose',           sub: 'Set my preferences' },
        ].map(({ p, icon, label, sub }) => {
          const sel = path === p;
          return (
            <motion.button
              key={p!}
              onClick={() => handlePathSelect(p)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              animate={sel
                ? { boxShadow: `0 0 0 2px ${GOLD}, 0 10px 28px -6px rgba(197,145,42,0.28)` }
                : { boxShadow: 'none' }
              }
              className="relative flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-colors"
              style={sel
                ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }
              }
            >
              {sel && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: GOLD }}>
                  <span className="text-white text-[9px] font-bold">✓</span>
                </motion.div>
              )}
              <span className="text-2xl leading-none">{icon}</span>
              <div>
                <p className="text-sm font-bold leading-tight"
                  style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{sub}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* ── PATH A: Hotel search ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {path === 'booked' && (
          <motion.div key="booked-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-3">

            <AnimatePresence mode="wait">
              {status !== 'found' ? (
                <motion.div key="search-input" variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex gap-2">
                  <div
                    className="flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
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
                    className="px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: status === 'loading' ? 'rgba(197,145,42,0.30)' : GOLD }}
                  >
                    {status === 'loading' ? '…' : 'Find'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="hotel-found" variants={reveal} initial="hidden" animate="visible" exit="exit"
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
                  <button onClick={handleClear} aria-label="Clear hotel"
                    className="shrink-0 text-sm mt-0.5 transition-colors"
                    style={{ color: 'rgba(197,145,42,0.5)' }}>✕</button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {status === 'error' && (
                <motion.p variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="text-sm px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(158,54,58,0.12)', color: '#f87171', border: '1px solid rgba(158,54,58,0.25)' }}>
                  ⚠️ {errMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── PATH B: Accommodation preferences ─────────────────────────────── */}
        {path === 'choose' && (
          <motion.div key="choose-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-5">

            {/* Accommodation type */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                What kind of place?
              </p>
              <div className="flex flex-col gap-2">
                {ACCOM_OPTIONS.map((opt) => {
                  const sel = accommodation === opt.value;
                  return (
                    <motion.button
                      key={opt.value}
                      onClick={() => setAccommodation(opt.value)}
                      whileHover={{ scale: 1.01, x: 3 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left transition-colors"
                      style={sel
                        ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                        : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                      }
                    >
                      <span className="text-xl shrink-0 leading-none">{opt.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight"
                          style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>{opt.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{opt.sub}</p>
                      </div>
                      {sel && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-xs font-bold shrink-0" style={{ color: GOLD }}>✓</motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Nightly budget — reveals after accommodation type */}
            <AnimatePresence>
              {accommodation && (
                <motion.div key="nightly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Nightly budget per room
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {NIGHTLY_OPTIONS.map((opt) => {
                      const sel = hotelNightlyBudget === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => setHotelNightlyBudget(opt.value)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          animate={sel
                            ? { boxShadow: `0 0 0 2px ${GOLD}` }
                            : { boxShadow: 'none' }
                          }
                          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                            : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                          }
                        >
                          <span className="text-lg shrink-0">{opt.icon}</span>
                          <span className="text-xs font-semibold leading-tight"
                            style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.82)' }}>{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Continue button ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {path && (
          <motion.div key="cta"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.3 } }}
            exit={{ opacity: 0 }}>
            <motion.button
              onClick={canContinue ? onComplete : undefined}
              disabled={!canContinue}
              whileHover={canContinue ? { scale: 1.02, y: -1 } : {}}
              whileTap={canContinue ? { scale: 0.97 } : {}}
              className="w-full py-4 rounded-full text-sm font-black tracking-wide disabled:opacity-35 transition-all"
              style={{
                background: canContinue
                  ? 'linear-gradient(135deg, #9e363a, #b5404a)'
                  : 'rgba(255,255,255,0.08)',
                color: canContinue ? '#fff' : 'rgba(255,255,255,0.3)',
                boxShadow: canContinue ? '0 0 40px rgba(158,54,58,0.38), 0 8px 24px -4px rgba(158,54,58,0.28)' : 'none',
                cursor: canContinue ? 'pointer' : 'default',
              }}
            >
              {path === 'booked'
                ? status === 'found' ? 'Perfect — who\'s joining? →' : 'Find your hotel first'
                : accommodation ? 'Set travel style →' : 'Pick your accommodation type'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip link */}
      <button
        onClick={onSkip}
        className="text-xs text-center transition-colors hover-text-faint"
        style={{ color: 'rgba(79,95,118,0.65)' }}
      >
        Skip — decide on accommodation later
      </button>
    </div>
  );
}
