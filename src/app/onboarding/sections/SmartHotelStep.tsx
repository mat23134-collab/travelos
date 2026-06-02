'use client';

/**
 * SmartHotelStep — Step 4 of the onboarding wizard.
 *
 * Two paths:
 *   A) "I have a hotel" — geocode search → confirm (unchanged)
 *   B) "Help me choose" — 4 progressive blocks driven by traveler context:
 *        Block 1: Accommodation type (ordered + dimmed by persona)
 *        Block 2: Nightly budget (filtered by type — existing logic)
 *        Block 3: Where in the city? (hotelLocationPref — single select)
 *        Block 4: Must-haves? (hotelAmenities — multi select)
 *
 * Context (groupType, groupDynamics, budget) is read from onboardingStore
 * and passed to getHotelPersonalization() which returns the display config.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { getHotelPersonalization } from '@/lib/hotelPersonalization';
import type { AccommodationType, HotelAmenity, HotelLocationPref } from '@/lib/types';

const GOLD  = '#c5912a';
const MUTED = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ── Static lookup tables ───────────────────────────────────────────────────────

const ACCOM_BASE: Record<AccommodationType, { label: string; icon: string; defaultDesc: string }> = {
  'hostel':         { label: 'Hostel / Guesthouse', icon: '🛏️', defaultDesc: 'Social, affordable, central' },
  'boutique-hotel': { label: 'Boutique Hotel',      icon: '🏨', defaultDesc: 'Character-driven, local feel' },
  'luxury-hotel':   { label: 'Luxury Hotel',        icon: '⭐', defaultDesc: '5-star service & amenities' },
  'airbnb':         { label: 'Apartment / Airbnb',  icon: '🏠', defaultDesc: 'Live like a local, full kitchen' },
  'resort':         { label: 'Resort',              icon: '🌴', defaultDesc: 'Self-contained, pool, curated' },
};

// ── Nightly budget (exported — used by test) ──────────────────────────────────

export const NIGHTLY_OPTIONS = [
  { value: 'budget'  as const, label: 'Up to $80',   icon: '🪙' },
  { value: 'mid'     as const, label: '$80 - $150',  icon: '💵' },
  { value: 'comfort' as const, label: '$150 - $300', icon: '💳' },
  { value: 'luxury'  as const, label: '$300+',       icon: '💎' },
] as const;

type NightlyOption = (typeof NIGHTLY_OPTIONS)[number];

export function getNightlyOptionsForAccommodation(
  accommodation: AccommodationType | '',
): readonly NightlyOption[] {
  switch (accommodation) {
    case 'hostel':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'budget' || o.value === 'mid');
    case 'luxury-hotel':
    case 'resort':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'comfort' || o.value === 'luxury');
    case 'boutique-hotel':
    case 'airbnb':
      return NIGHTLY_OPTIONS.filter((o) => o.value !== 'budget');
    default:
      return NIGHTLY_OPTIONS;
  }
}

// ── Location options ──────────────────────────────────────────────────────────

const LOCATION_OPTIONS: Record<
  HotelLocationPref,
  { label: string; icon: string; subLabel: (groupType: string) => string }
> = {
  center:  {
    label: 'City center',
    icon:  '🏙️',
    subLabel: (gt) => gt === 'family' ? 'Walk to attractions' : 'Walk to everything',
  },
  quiet:   {
    label: 'Quiet area',
    icon:  '🌿',
    subLabel: (gt) => gt === 'family' ? 'Safe, residential' : gt === 'couple' ? 'Intimate neighbourhood' : 'Residential, calm',
  },
  transit: {
    label: 'Near transit',
    icon:  '🚇',
    subLabel: (gt) => gt === 'family' ? 'Easy to get around' : 'Metro at your door',
  },
  nature:  {
    label: 'Nature / parks',
    icon:  '🌊',
    subLabel: (gt) => gt === 'family' ? 'Kids love the outdoors' : gt === 'couple' ? 'Scenic surroundings' : 'Green surroundings',
  },
};

// ── Amenity options ───────────────────────────────────────────────────────────

const AMENITY_OPTIONS: Record<HotelAmenity, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast',          icon: '☕' },
  pool:      { label: 'Pool',               icon: '🏊' },
  workspace: { label: 'Workspace',          icon: '💻' },
  gym:       { label: 'Gym',                icon: '🏋️' },
  parking:   { label: 'Parking',            icon: '🅿️' },
  spa:       { label: 'Spa',                icon: '🛁' },
  suite:     { label: 'Suite / extra space', icon: '🛏️' },
  rooftop:   { label: 'Rooftop',            icon: '🌅' },
  pets:      { label: 'Pet-friendly',       icon: '🐾' },
};
const ALL_AMENITIES = Object.keys(AMENITY_OPTIONS) as HotelAmenity[];

// ── Component ─────────────────────────────────────────────────────────────────

type Path = 'booked' | 'choose' | null;
type SearchStatus = 'idle' | 'loading' | 'found' | 'error';

interface Props {
  onComplete?: () => void;  // reserved for future use — parent currently drives continuation
  onSkip:      () => void;
}

export function SmartHotelStep({ onComplete, onSkip }: Props) {
  const {
    hotelAddress, hotelLat, hotelLng,
    setHotelLocation, clearHotelLocation,
    accommodation, hotelNightlyBudget,
    hotelLocationPref, hotelAmenities,
    setAccommodation, setHotelNightlyBudget,
    setHotelLocationPref, toggleHotelAmenity,
    destination, groupType, groupDynamics, budget,
  } = useOnboardingStore();

  // Personalization config derived from traveler context
  const config = useMemo(
    () => getHotelPersonalization(groupType, groupDynamics, budget),
    [groupType, groupDynamics, budget],
  );

  const [path, setPath]           = useState<Path>(hotelAddress ? 'booked' : null);
  const [query, setQuery]         = useState(hotelAddress || '');
  const [searchStatus, setStatus] = useState<SearchStatus>(hotelAddress ? 'found' : 'idle');
  const [errMsg, setErrMsg]       = useState('');

  const visibleNightlyOptions = useMemo(
    () => getNightlyOptionsForAccommodation(accommodation),
    [accommodation],
  );

  // Reset budget when accommodation changes and new type doesn't include current budget
  useEffect(() => {
    if (
      accommodation &&
      hotelNightlyBudget &&
      !visibleNightlyOptions.some((o) => o.value === hotelNightlyBudget)
    ) {
      setHotelNightlyBudget('');
    }
  }, [accommodation, hotelNightlyBudget, setHotelNightlyBudget, visibleNightlyOptions]);

  // Amenity display order: preset first, then the rest
  const orderedAmenities = useMemo(() => {
    const preset = config.amenityPreset.filter((a) => ALL_AMENITIES.includes(a));
    const rest   = ALL_AMENITIES.filter((a) => !preset.includes(a));
    return [...preset, ...rest];
  }, [config.amenityPreset]);

  // ── Path A helpers ────────────────────────────────────────────────────────

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus('loading');
    setErrMsg('');
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
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

  function handleAccommodationSelect(type: AccommodationType) {
    setAccommodation(type);
    const next = getNightlyOptionsForAccommodation(type);
    if (hotelNightlyBudget && !next.some((o) => o.value === hotelNightlyBudget)) {
      setHotelNightlyBudget('');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        {config.contextBadge && (
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
            style={{ background: 'rgba(197,145,42,0.12)', color: GOLD, border: '1px solid rgba(197,145,42,0.25)' }}
          >
            {config.contextBadge}
          </div>
        )}
        <h2 className="text-2xl font-black text-white tracking-tight">{config.headline}</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>{config.subline}</p>
      </div>

      {/* Path selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { p: 'booked' as Path, icon: '🏨', label: 'I already have a hotel', sub: 'Let me enter it' },
          { p: 'choose' as Path, icon: '🔍', label: 'Help me choose',          sub: 'Set my preferences' },
        ] as const).map(({ p, icon, label, sub }) => {
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

      <AnimatePresence mode="wait">

        {/* ── PATH A: Hotel search (unchanged) ──────────────────────── */}
        {path === 'booked' && (
          <motion.div key="booked-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {searchStatus !== 'found' ? (
                <motion.div key="search-input"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
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
                    disabled={query.trim().length < 3 || searchStatus === 'loading'}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: searchStatus === 'loading' ? 'rgba(197,145,42,0.30)' : GOLD }}
                  >
                    {searchStatus === 'loading' ? '…' : 'Find'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="hotel-found"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
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
              {searchStatus === 'error' && (
                <motion.p variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="text-sm px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(158,54,58,0.12)', color: '#f87171', border: '1px solid rgba(158,54,58,0.25)' }}>
                  ⚠️ {errMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── PATH B: Preferences (4 progressive blocks) ──────────── */}
        {path === 'choose' && (
          <motion.div key="choose-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-5">

            {/* Block 1: Accommodation type */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                What kind of place?
              </p>
              <div className="flex flex-col gap-2">
                {config.accomOrder.map((type, i) => {
                  const base        = ACCOM_BASE[type];
                  const desc        = config.accomDescriptions[type] ?? base.defaultDesc;
                  const sel         = accommodation === type;
                  const dimmed      = !sel && config.accomDimmed.includes(type);
                  const highlighted = !dimmed && i < 2;
                  return (
                    <motion.button
                      key={type}
                      onClick={() => handleAccommodationSelect(type)}
                      whileHover={dimmed ? {} : { scale: 1.01, x: 2 }}
                      whileTap={dimmed ? {} : { scale: 0.98 }}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left transition-all"
                      style={{
                        opacity: dimmed ? 0.4 : 1,
                        borderColor: sel
                          ? GOLD
                          : highlighted ? 'rgba(197,145,42,0.30)'
                          : 'rgba(255,255,255,0.07)',
                        background: sel
                          ? 'rgba(197,145,42,0.10)'
                          : highlighted ? 'rgba(197,145,42,0.04)'
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span className="text-xl shrink-0 leading-none">{base.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight"
                          style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>{base.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{desc}</p>
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

            {/* Block 2: Nightly budget — reveals after accommodation type chosen */}
            <AnimatePresence>
              {accommodation && (
                <motion.div key="nightly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Nightly budget per room
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {visibleNightlyOptions.map((opt) => {
                      const sel = hotelNightlyBudget === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => setHotelNightlyBudget(opt.value)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          animate={sel ? { boxShadow: `0 0 0 2px ${GOLD}` } : { boxShadow: 'none' }}
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

            {/* Block 3: Location preference — reveals after budget chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && (
                <motion.div key="location"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Where in the city?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {config.locationOrder.map((loc) => {
                      const opt = LOCATION_OPTIONS[loc];
                      const sel = hotelLocationPref.includes(loc);
                      return (
                        <motion.button
                          key={loc}
                          onClick={() => setHotelLocationPref([loc])}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                            : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                          }
                        >
                          <span className="text-base shrink-0">{opt.icon}</span>
                          <div>
                            <p className="text-xs font-semibold leading-tight"
                              style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.85)' }}>{opt.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                              {opt.subLabel(groupType)}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block 4: Amenities — reveals after location chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && hotelLocationPref.length > 0 && (
                <motion.div key="amenities"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Must-haves?{' '}
                    <span className="normal-case font-normal">pick any</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orderedAmenities.map((amenity) => {
                      const opt = AMENITY_OPTIONS[amenity];
                      const sel = hotelAmenities.includes(amenity);
                      return (
                        <motion.button
                          key={amenity}
                          onClick={() => toggleHotelAmenity(amenity)}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.12)', color: '#d4a235' }
                            : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.75)' }
                          }
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
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

      {/* Skip */}
      <button
        onClick={onSkip}
        className="text-xs text-center transition-colors"
        style={{ color: 'rgba(79,95,118,0.7)' }}
      >
        Skip — I&apos;ll add my hotel later
      </button>

    </div>
  );
}
