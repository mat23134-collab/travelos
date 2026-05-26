// UI Version: 2.1.0 - 2026-05-06T00:00:00Z (dark palette)
'use client';

import { useState, useCallback, useEffect, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { questions } from '@/lib/questionnaire';
import { TravelerProfile, type TripLanguage, type GroupType, type FamilyKidsByAge } from '@/lib/types';
import { sanitizeFamilyKids, totalFamilyKids } from '@/lib/familyKids';
import { FamilyKidsModal } from '@/components/FamilyKidsModal';
import { useAuth } from '@/lib/auth-context';
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';
import { readTripLanguagePref, persistTripLanguagePref } from '@/lib/tripLanguagePref';
import { TripLanguageGateModal } from '@/components/TripLanguageGateModal';
import { BrandWordmark } from '@/components/BrandWordmark';
import { FinishingTouchesForm } from '@/components/FinishingTouchesForm';
import { GENERATE_WALL_CLOCK_MS } from '@/lib/generateBudget';
type FormData = Record<string, unknown>;

// ג”€ג”€ SSE streaming types ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€
type PlaceEvent = {
  name: string; emoji: string; description: string;
  slot: string; day: number; vibeLabel: string;
};
type StatusEvent = { message: string; icon: string };

const STORAGE_KEY = 'travelos_plan_draft';
const PRE_ONBOARDING_KEYS = new Set(['destination', 'dates', 'tripTimes']);
const LEGACY_FINISHING_KEYS = new Set(['dietaryRestrictions', 'mustHave']);
/** tripLanguage is chosen on the home gate or /plan gate, not in this wizard */
const PLAN_QUESTIONS = questions.filter(
  (q) => !PRE_ONBOARDING_KEYS.has(q.key) && !LEGACY_FINISHING_KEYS.has(q.key),
);

// ג”€ג”€ג”€ Animation variants ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const slideVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? 48 : -48,
    scale: 0.97,
  }),
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 380, damping: 30 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? -32 : 32,
    scale: 0.97,
    transition: { duration: 0.18, ease: 'easeIn' as const },
  }),
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const optionVariant = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 28 },
  },
};

// ג”€ג”€ג”€ Destination grid (Step 1 ג€” ONLY valid UI for destination) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const FEATURED_DESTINATIONS = [
  { name: 'Rome',       country: 'Italy',       flag: 'נ‡®נ‡¹', tagline: 'La Dolce Vita',            accent: '#f97316' },
  { name: 'Paris',      country: 'France',      flag: 'נ‡«נ‡·', tagline: 'City of Light',             accent: '#a855f7' },
  { name: 'London',     country: 'UK',          flag: 'נ‡¬נ‡§', tagline: 'Iconic & Eclectic',        accent: '#3b82f6' },
  { name: 'Athens',     country: 'Greece',      flag: 'נ‡¬נ‡·', tagline: 'Cradle of Civilization',  accent: '#10b981' },
  { name: 'Budapest',   country: 'Hungary',     flag: 'נ‡­נ‡÷', tagline: 'Paris of the East',        accent: '#ec4899' },
  { name: 'Vienna',     country: 'Austria',     flag: 'נ‡¦נ‡¹', tagline: 'Imperial & Cafֳ© Culture',  accent: '#eab308' },
  { name: 'Amsterdam',  country: 'Netherlands', flag: 'נ‡³נ‡±', tagline: 'Canals & Contrasts',       accent: '#06b6d4' },
  { name: 'Sicily',     country: 'Italy',       flag: 'נ‡®נ‡¹', tagline: 'Sun, Sea & Ancient Ruins', accent: '#f59e0b' },
  { name: 'Lima',       country: 'Peru',        flag: 'נ‡µנ‡×', tagline: 'Gastronomic Capital',      accent: '#c084fc' },
];

function DestinationGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 gap-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {FEATURED_DESTINATIONS.map((dest, i) => {
        const selected = value === dest.name;
        return (
          <motion.button
            key={dest.name}
            variants={optionVariant}
            onClick={() => onChange(dest.name)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            animate={
              selected
                ? { boxShadow: `0 0 0 3px ${dest.accent}, 0 20px 48px -10px ${dest.accent}55` }
                : { boxShadow: '0 2px 14px rgba(0,0,0,0.30)' }
            }
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className={[
              'relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-colors',
              i === FEATURED_DESTINATIONS.length - 1 && FEATURED_DESTINATIONS.length % 2 === 1
                ? 'col-span-2 sm:col-span-1'
                : '',
              selected
                ? ''
                : 'border-white/10 hover:border-white/20',
            ].join(' ')}
            style={
              selected
                ? { borderColor: dest.accent, background: 'rgba(15,40,98,0.40)' }
                : { background: 'rgba(15,40,98,0.22)' }
            }
          >
            {selected && (
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow"
                style={{ backgroundColor: dest.accent }}
              >
                <span className="text-white text-xs font-bold leading-none">ג“</span>
              </motion.div>
            )}

            <div className="text-5xl mb-3 leading-none">{dest.flag}</div>
            <div
              className="font-extrabold text-lg leading-tight"
              style={{ color: selected ? dest.accent : 'rgba(255,255,255,0.92)' }}
            >
              {dest.name}
            </div>
            <div className="text-xs font-medium mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {dest.country}
            </div>
            <div className="text-xs italic mt-2 leading-snug" style={{ color: 'rgba(255,255,255,0.28)' }}>
              {dest.tagline}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ג”€ג”€ג”€ Loading screen ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const LOADING_STEPS = [
  { icon: '📡', label: 'Scanning fresh travel signals' },
  { icon: '🍜', label: 'Checking food blogs and local guides' },
  { icon: '🗺️', label: 'Clustering days by neighborhood' },
  { icon: '✨', label: 'Tuning the trip to your style' },
  { icon: '💎', label: 'Filtering tourist traps and weak picks' },
];

/** Soft target length for UX pacing (steps + progress bar ג€” aligned with server budget). */
const GENERATION_SOFT_TARGET_SEC = 90;
/** Never show 100% in the UI while waiting on the server (avoids ג€stuck at 100%ג€). */
const GENERATION_UI_MAX_PCT = 97;

const GENERATION_TIMER_COPY = {
  en: {
    phase: (n: number, total: number) => `Step ${n} of ${total}`,
    progressLabel: 'Trip build',
    elapsed: 'Elapsed',
    footer: 'Typical build: 30s-2 min · AI-powered',
    building: (dest: string) =>
      `Building your ${dest.trim() || 'trip'} itinerary`,
    almostDone: 'Finalizing details on our servers...',
  },
  he: {
    phase: (n: number, total: number) => `שלב ${n} מתוך ${total}`,
    progressLabel: 'התקדמות בניית הטיול',
    elapsed: 'זמן שעבר',
    footer: 'זמן טיפוסי: 30 שניות עד 2 דקות · AI',
    building: (dest: string) =>
      dest.trim()
        ? `בונים את המסלול ל${dest}`
        : 'בונים את המסלול שלך',
    almostDone: 'מסיימים פרטים בשרת...',
  },
} as const;

// ג”€ג”€ג”€ Step 3 ג€” Time-Aware inputs ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

const DAILY_START_OPTIONS = [
  { value: '07:00', label: 'Early Bird',    icon: 'נ…', sub: 'Start at 7 am' },
  { value: '08:30', label: 'Morning',       icon: 'ג˜€ן¸',  sub: 'Start at 8:30 am' },
  { value: '10:00', label: 'Mid-Morning',   icon: 'נ₪ן¸', sub: 'Start at 10 am' },
  { value: '11:30', label: 'Late Starter',  icon: 'נ›', sub: 'Start at 11:30 am' },
];

function TimeAwareStep({
  arrivalTime,
  departureTime,
  dailyStartTime,
  onArrival,
  onDeparture,
  onDailyStart,
}: {
  arrivalTime: string;
  departureTime: string;
  dailyStartTime: string;
  onArrival: (v: string) => void;
  onDeparture: (v: string) => void;
  onDailyStart: (v: string) => void;
}) {
  return (
    <motion.div
      className="flex flex-col gap-7"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Daily start time */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#9e363a' }}>
          When do you like to start exploring each day?
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DAILY_START_OPTIONS.map((opt) => {
            const sel = dailyStartTime === opt.value;
            return (
              <motion.button
                key={opt.value}
                variants={optionVariant}
                onClick={() => onDailyStart(opt.value)}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                animate={
                  sel
                    ? { boxShadow: '0 0 0 2px #9e363a, 0 8px 24px -4px rgba(158,54,58,0.22)' }
                    : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }
                }
                transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                className="relative p-4 rounded-2xl border text-center transition-colors"
                style={
                  sel
                    ? { borderColor: '#9e363a', background: 'rgba(158,54,58,0.14)' }
                    : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(15,40,98,0.22)' }
                }
              >
                {sel && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: '#9e363a' }}
                  >
                    <span className="text-white text-[9px] font-bold">ג“</span>
                  </motion.div>
                )}
                <div className="text-2xl mb-1.5 leading-none">{opt.icon}</div>
                <div className="text-xs font-semibold leading-tight" style={{ color: sel ? '#c05060' : 'rgba(255,255,255,0.85)' }}>
                  {opt.label}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>{opt.sub}</div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Arrival & Departure time */}
      <div className="grid sm:grid-cols-2 gap-5">
        <div
          className="rounded-2xl p-4 border"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(15,40,98,0.22)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.20)',
          }}
        >
          <label className="block text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9e363a' }}>
            נ›¬ Arrival time ג€” Day 1
          </label>
          <p className="text-[10px] mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            We won't schedule activities before you land. Leave blank if arriving the night before.
          </p>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => onArrival(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none text-sm transition-all"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          />
        </div>

        <div
          className="rounded-2xl p-4 border"
          style={{
            borderColor: 'rgba(255,255,255,0.08)',
            background: 'rgba(15,40,98,0.22)',
            boxShadow: '0 1px 6px rgba(0,0,0,0.20)',
          }}
        >
          <label className="block text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9e363a' }}>
            נ›« Departure time ג€” Last Day
          </label>
          <p className="text-[10px] mb-3 leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
            We'll only plan activities that end before you need to leave. Leave blank if departing at night.
          </p>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => onDeparture(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border focus:outline-none text-sm transition-all"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)',
              color: 'white',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          />
        </div>
      </div>
    </motion.div>
  );
}


// ג”€ג”€ג”€ Live discovery panel (SSE-fed sidebar) ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function DiscoveryPanel({
  places,
  tips,
  destination,
}: {
  places: PlaceEvent[];
  tips: string[];
  destination: string;
}) {
  const isEmpty = places.length === 0 && tips.length === 0;
  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <motion.div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: '#9e363a' }}
          animate={{ opacity: [1, 0.2, 1], scale: [1, 0.75, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.32)' }}>
          Discovering {destination || 'your destination'}
        </span>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
          className="py-8 text-center"
        >
          <div className="text-3xl mb-2 opacity-40">נ</div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Searching for hidden gemsג€¦
          </p>
        </motion.div>
      )}

      {/* Place cards ג€” slide in from the right */}
      <AnimatePresence initial={false}>
        {places.map((place, i) => (
          <motion.div
            key={`${place.name}|${place.day}|${place.slot}|${i}`}
            initial={{ opacity: 0, x: 36, height: 0 }}
            animate={{ opacity: 1, x: 0, height: 'auto' }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="overflow-hidden"
          >
            <div
              className="flex items-center gap-3 px-3 py-2.5 rounded-2xl"
              style={{ background: 'rgba(15,40,98,0.40)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <span className="text-xl leading-none flex-shrink-0">{place.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white leading-tight truncate">{place.name}</p>
                <p className="text-[10px] mt-0.5 capitalize" style={{ color: 'rgba(255,255,255,0.32)' }}>
                  Day {place.day} ֲ· {place.slot}
                </p>
              </div>
              {place.vibeLabel && place.vibeLabel !== 'dining' && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 font-semibold"
                  style={{ background: 'rgba(158,54,58,0.22)', color: '#ffb3b6', border: '1px solid rgba(158,54,58,0.30)' }}
                >
                  {place.vibeLabel}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tips ג€” fade up */}
      <AnimatePresence>
        {tips.map((tip, i) => (
          <motion.div
            key={`tip-${i}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
            className="px-3 py-2.5 rounded-2xl"
            style={{ background: 'rgba(158,54,58,0.10)', border: '1px solid rgba(158,54,58,0.22)' }}
          >
            <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>
              נ’¡ {tip}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ג”€ג”€ג”€ Loading screen ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

function LoadingScreen({
  destination,
  lang,
  streamedPlaces,
  streamedTips,
  streamStatus,
}: {
  destination: string;
  lang: TripLanguage;
  streamedPlaces: PlaceEvent[];
  streamedTips: string[];
  streamStatus: StatusEvent | null;
}) {
  const [tick, setTick] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const tc = GENERATION_TIMER_COPY[lang === 'he' ? 'he' : 'en'];

  useEffect(() => {
    startedAtRef.current = Date.now();
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec =
    startedAtRef.current != null
      ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
      : 0;

  void tick;

  /** Advance one loading phase every N seconds so the last phase is not reached in ~27s while the API still runs. */
  const phaseSec = Math.max(
    14,
    Math.floor(GENERATION_SOFT_TARGET_SEC / LOADING_STEPS.length),
  );
  const activeStep = Math.min(
    LOADING_STEPS.length - 1,
    Math.floor(elapsedSec / phaseSec),
  );

  /**
   * Progress %: mostly time-based (honest ג€how long youג€™ve been waitingג€), lightly boosted by phase
   * so the bar moves with phases but never hits 100% until navigation unmounts this screen.
   */
  const timeRatio = Math.min(1, elapsedSec / GENERATION_SOFT_TARGET_SEC);
  const phaseRatio = (activeStep + 1) / LOADING_STEPS.length;
  const blended = 0.62 * timeRatio + 0.38 * phaseRatio;
  const pct = Math.min(GENERATION_UI_MAX_PCT, Math.round(blended * 100));
  const showAlmostDone = activeStep >= LOADING_STEPS.length - 1;
  const bgUrl = resolveBackgroundImage(destination, activeStep);
  const elapsedLabel = `${Math.floor(elapsedSec / 60)}:${String(elapsedSec % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-16 px-6 lg:px-14 py-12 lg:py-0 relative overflow-hidden"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `linear-gradient(rgba(9,31,54,0.72), rgba(9,31,54,0.94)), url("${bgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
      {/* Ambient overlays */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 55% at 50% 10%, rgba(158,54,58,0.18), transparent 62%), linear-gradient(to top, rgba(9,31,54,0.98), transparent 45%)',
        }}
      />
      <div className="noise absolute w-[560px] h-[560px] rounded-full blur-[130px] top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: 'rgba(158,54,58,0.12)' }} />
      <div className="noise absolute w-[320px] h-[320px] rounded-full blur-[100px] bottom-1/4 right-1/4 pointer-events-none"
        style={{ background: 'rgba(15,40,98,0.40)' }} />

      {/* ג”€ג”€ Left panel: spinner + steps ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
      <div className="relative z-10 flex flex-col items-center text-center w-full max-w-xs shrink-0 lg:py-20">

      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="mb-6"
      >
        <motion.div
          className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center text-4xl shadow-xl relative overflow-hidden"
          style={{
            background: 'rgba(158,54,58,0.15)',
            border: '1px solid rgba(158,54,58,0.25)',
            boxShadow: '0 12px 40px -8px rgba(158,54,58,0.22)',
          }}
          animate={{ rotate: [0, -8, 8, -6, 6, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          ג³
          <motion.div
            className="absolute inset-x-2 bottom-2 h-1 rounded-full opacity-40"
            style={{ background: 'linear-gradient(90deg, transparent, #f5e6dc, transparent)' }}
            animate={{ x: ['-30%', '30%', '-30%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </motion.div>
      </motion.div>

      <div className="text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color: '#9e363a' }}>
        {tc.building(destination)}
      </div>

      <div
        className="mb-7 px-5 py-4 rounded-2xl w-full max-w-sm border text-center backdrop-blur-md"
        style={{
          background: 'rgba(9,31,54,0.58)',
          borderColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {tc.progressLabel}
        </div>
        <div className="font-extrabold text-white text-3xl sm:text-4xl tracking-tight tabular-nums">{pct}%</div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.32)' }}>
              {tc.elapsed}
            </div>
            <div className="text-sm font-black text-white tabular-nums">{elapsedLabel}</div>
          </div>
          <div className="rounded-xl py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="text-[9px] uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.32)' }}>
              Phase
            </div>
            <div className="text-sm font-black text-white">{activeStep + 1}/{LOADING_STEPS.length}</div>
          </div>
        </div>
        {showAlmostDone && (
          <p className="text-[11px] mt-3 leading-snug" style={{ color: 'rgba(251,191,36,0.88)' }}>
            {tc.almostDone}
          </p>
        )}
      </div>

      <div className="h-16 flex items-center justify-center mb-8 w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.p
            key={activeStep}
            initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="text-lg sm:text-xl font-bold text-white leading-snug"
          >
            {LOADING_STEPS[activeStep].icon}&nbsp;&nbsp;{LOADING_STEPS[activeStep].label}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs mb-8" aria-live="polite">
        {LOADING_STEPS.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.09, type: 'spring', stiffness: 380, damping: 28 }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left ${
                done ? 'bg-white/4 border border-white/8' :
                active ? '' :
                'opacity-25'
              }`}
              style={active ? {
                background: 'rgba(158,54,58,0.12)',
                border: '1px solid rgba(158,54,58,0.30)',
              } : {}}
            >
              <span className="text-base flex-shrink-0">{done ? 'ג“' : s.icon}</span>
              <span className={`text-xs flex-1 leading-snug ${
                done ? 'text-white/35 line-through' :
                active ? 'text-white font-medium' :
                'text-white/30'
              }`}>{s.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#9e363a' }} />}
            </motion.div>
          );
        })}
      </div>

      <div className="w-full max-w-xs h-1 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          style={{ background: 'linear-gradient(90deg, #9e363a, #4a7bde)' }}
        />
      </div>
      <p className="text-white/20 text-[10px] tabular-nums leading-relaxed">{tc.footer}</p>

      <div
        className="mt-5 w-full max-w-xs rounded-2xl px-4 py-3 text-left border"
        style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: '#9e363a' }}>
          Live build
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.52)' }}>
          We keep this screen honest: the timer is real, the bar slows before 100%, and the trip opens as soon as the itinerary is ready.
        </p>
      </div>

      {/* SSE live status pill */}
      <AnimatePresence mode="wait">
        {streamStatus && (
          <motion.p
            key={streamStatus.message}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
            className="mt-4 text-[11px] font-medium px-3 py-1.5 rounded-full"
            style={{ color: 'rgba(255,255,255,0.50)', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {streamStatus.icon} {streamStatus.message}
          </motion.p>
        )}
      </AnimatePresence>
    </div> {/* end left panel */}

    {/* ג”€ג”€ Right panel: live discovery ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ */}
    <motion.div
      className="relative z-10 w-full lg:w-72 xl:w-80 shrink-0 lg:py-20 max-h-[55vh] lg:max-h-[80vh] overflow-y-auto"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.35, type: 'spring', stiffness: 260, damping: 26 }}
    >
      <DiscoveryPanel
        places={streamedPlaces}
        tips={streamedTips}
        destination={destination}
      />
    </motion.div>
  </div>
  );
}

// ג”€ג”€ג”€ Main page ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€ג”€

export default function PlanPageWrapper() {
  return (
    <Suspense fallback={null}>
      <PlanPage />
    </Suspense>
  );
}

function PlanPage() {
  const router      = useRouter();
  const { user, session } = useAuth();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormData>({
    groupSize: 2,
    familyParents: 2 as 1 | 2,
    familyKidsByAge: {} as FamilyKidsByAge,
    tripLanguage: 'en',
    interests: [],
    dietaryRestrictions: [],
    mustHaveItems: [],
    mustHaveOther: '',
    arrivalTime: '',
    departureTime: '',
    dailyStartTime: '08:30',
    skipDay1: false,
  });
  const [error, setError] = useState('');           // validation error (inline)
  const [genError, setGenError] = useState('');     // generation/timeout error (banner)
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGeneratePending, setAutoGeneratePending] = useState(false);
  // SSE streaming state
  const [streamedPlaces, setStreamedPlaces] = useState<PlaceEvent[]>([]);
  const [streamedTips,   setStreamedTips]   = useState<string[]>([]);
  const [streamStatus,   setStreamStatus]   = useState<StatusEvent | null>(null);
  const [showTripLangGate, setShowTripLangGate] = useState(false);
  const [showFamilyKidsModal, setShowFamilyKidsModal] = useState(false);
  const groupTypeBeforeFamilyRef = useRef<GroupType>('couple');
  const autoSubmitStartedRef = useRef(false);

  const searchParams = useSearchParams();
  const planSearchKey = useMemo(() => searchParams.toString(), [searchParams]);

  /** Plan wizard expects onboarding-completed query params; otherwise send users to /onboarding first. */
  const [planGateReady, setPlanGateReady] = useState(false);

  useEffect(() => {
    setPlanGateReady(false);
    autoSubmitStartedRef.current = false;

    const preDestination = searchParams.get('destination')?.trim() ?? '';
    const preStartDate = searchParams.get('startDate')?.trim() ?? '';
    const preEndDate   = searchParams.get('endDate')?.trim() ?? '';
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    const hasTripBasics =
      preDestination.length >= 2 &&
      isoDate.test(preStartDate) &&
      isoDate.test(preEndDate);

    if (!hasTripBasics) {
      router.replace('/onboarding');
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    setStep(0);

    const preArrival    = searchParams.get('arrivalTime')    ?? '';
    const preDeparture  = searchParams.get('departureTime')  ?? '';
    const preDailyStart = searchParams.get('dailyStartTime') ?? '08:30';
    const preSkipDay1   = searchParams.get('skipDay1') === '1';
    const preHotelAddress = searchParams.get('hotelAddress') ?? '';
    const preHotelLatRaw = searchParams.get('hotelLat');
    const preHotelLngRaw = searchParams.get('hotelLng');
    const preHotelLat = preHotelLatRaw != null ? Number(preHotelLatRaw) : null;
    const preHotelLng = preHotelLngRaw != null ? Number(preHotelLngRaw) : null;

    // ג”€ג”€ Onboarding preference params (skip those questions if pre-filled) ג”€ג”€
    const preGroupType  = searchParams.get('groupType')  ?? '';
    const prePace       = searchParams.get('pace')       ?? '';
    const preBudget     = searchParams.get('budget')     ?? '';
    const preInterestsRaw = searchParams.get('interests') ?? '';
    const preInterests  = preInterestsRaw ? preInterestsRaw.split(',').filter(Boolean) : [];
    const preAccommodation      = searchParams.get('accommodation')      ?? '';
    const preHotelNightlyBudget = searchParams.get('hotelNightlyBudget') ?? '';
    const preDietaryRaw = searchParams.get('dietary') ?? '';
    const preDietary = preDietaryRaw ? preDietaryRaw.split(',').filter(Boolean) : [];
    const preMustHaveRaw = searchParams.get('mustHave') ?? '';
    const preMustHave = preMustHaveRaw ? preMustHaveRaw.split(',').filter(Boolean) : [];
    const preMustHaveOther = searchParams.get('mustHaveOther')?.trim() ?? '';
    const autoGenerateFlag = searchParams.get('autoGenerate') === '1';

    const tripLangParam = searchParams.get('tripLang');
    const prefLang = readTripLanguagePref();
    const initialTripLang: TravelerProfile['tripLanguage'] =
      tripLangParam === 'he' || tripLangParam === 'en'
        ? tripLangParam
        : prefLang === 'he' || prefLang === 'en'
          ? prefLang
          : 'en';

    const hasExplicitTripLang =
      tripLangParam === 'he' ||
      tripLangParam === 'en' ||
      prefLang === 'he' ||
      prefLang === 'en';
    setShowTripLangGate(!hasExplicitTripLang);

    const validGroupTypes       = ['solo', 'couple', 'family', 'group'];
    const validPaces            = ['relaxed', 'moderate', 'intense'];
    const validBudgets          = ['budget', 'mid-range', 'luxury'];
    const validAccommodations   = ['hostel', 'boutique-hotel', 'luxury-hotel', 'airbnb', 'resort'];
    const validNightlyBudgets   = ['budget', 'mid', 'comfort', 'luxury'];

    setForm({
      groupSize: 2,
      familyParents: 2 as 1 | 2,
      familyKidsByAge: {} as FamilyKidsByAge,
      tripLanguage: initialTripLang,
      interests:           preInterests.length ? preInterests : [],
      dietaryRestrictions: preDietary,
      mustHaveItems:       preMustHave,
      mustHaveOther:       preMustHaveOther,
      destination:    preDestination,
      startDate:      preStartDate,
      endDate:        preEndDate,
      arrivalTime:    preArrival,
      departureTime:  preDeparture,
      dailyStartTime: preDailyStart,
      skipDay1:       preSkipDay1,
      hotelBooked:    preHotelAddress,
      hotelAddress:   preHotelAddress,
      hotelLat:       Number.isFinite(preHotelLat) ? preHotelLat : null,
      hotelLng:       Number.isFinite(preHotelLng) ? preHotelLng : null,
      // Pre-fill from onboarding ג€” these skip their wizard steps below
      groupType:         validGroupTypes.includes(preGroupType)             ? preGroupType             : '',
      pace:              validPaces.includes(prePace)                       ? prePace                  : '',
      budget:            validBudgets.includes(preBudget)                   ? preBudget                : '',
      accommodation:     validAccommodations.includes(preAccommodation)     ? preAccommodation         : '',
      hotelNightlyBudget: validNightlyBudgets.includes(preHotelNightlyBudget) ? preHotelNightlyBudget : '',
    });
    setPlanGateReady(true);

    // When the full onboarding flow collected all data, auto-trigger generation
    // so the user lands directly on the loading screen ג€” no wizard at all.
    if (autoGenerateFlag) setAutoGeneratePending(true);
  }, [router, planSearchKey]);

  // Auto-generate: when the full onboarding collected all data, skip the wizard
  // and call handleSubmit() directly once the form state is settled.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (autoGeneratePending && planGateReady && !isSubmitting && !showTripLangGate) {
      if (autoSubmitStartedRef.current) return;
      autoSubmitStartedRef.current = true;
      setAutoGeneratePending(false);
      // Small delay so React finishes the render with the new form state
      const tid = setTimeout(() => handleSubmit(), 80);
      return () => clearTimeout(tid);
    }
  }, [autoGeneratePending, planGateReady, isSubmitting, showTripLangGate]); // handleSubmit excluded intentionally

  const hasHotelAnchor =
    !!(form.hotelBooked as string)?.trim() ||
    (typeof form.hotelLat === 'number' && typeof form.hotelLng === 'number');

  // Params pre-filled from the onboarding flow
  const hasPreGroupType        = !!(form.groupType as string);
  const hasPreBudget           = !!(form.budget as string);
  const hasPrePace             = !!(form.pace as string);
  const hasPreInterests        = ((form.interests as string[]) || []).length > 0;
  const hasPreAccommodation    = !!(form.accommodation as string);
  const hasPreNightlyBudget    = !!(form.hotelNightlyBudget as string);

  const autoGenerateFromOnboarding = searchParams.get('autoGenerate') === '1';

  const activeQuestions = PLAN_QUESTIONS.filter((q) => {
    if (autoGenerateFromOnboarding && q.key === 'finishingTouches') return false;
    // groupSize slider: only shown for 'group' ג€” solo/couple/family auto-derive it
    if (q.key === 'groupSize' && (form.groupType as string) !== 'group') return false;
    // Hotel-refinement steps: skip when hotel already booked via onboarding
    if (hasHotelAnchor && (
      q.key === 'accommodation' ||
      q.key === 'hotelNightlyBudget' ||
      q.key === 'hotelLocationPref' ||
      q.key === 'hotelAmenities'
    )) return false;
    // Onboarding pre-fills: skip questions already answered
    if (hasPreGroupType     && (q.key === 'groupType' || q.key === 'groupSize')) return false;
    if (hasPreBudget        &&  q.key === 'budget')           return false;
    if (hasPrePace          &&  q.key === 'pace')             return false;
    if (hasPreInterests     &&  q.key === 'interests')        return false;
    if (hasPreAccommodation &&  q.key === 'accommodation')    return false;
    if (hasPreNightlyBudget && (q.key === 'hotelNightlyBudget' || q.key === 'hotelLocationPref' || q.key === 'hotelAmenities')) return false;
    return true;
  });
  const question = activeQuestions[step];
  const planStepTotal = Math.max(1, activeQuestions.length);
  const planStepNumber = Math.min(step + 1, planStepTotal);
  const progress = (planStepNumber / planStepTotal) * 100;
  const destinationName = (form.destination as string) || '';
  const bgUrl = useMemo(
    () => resolveBackgroundImage(destinationName, planStepNumber),
    [destinationName, planStepNumber],
  );
  const photoOverlay = 'linear-gradient(rgba(9,31,54,0.76), rgba(9,31,54,0.91))';

  const destinationChosen = FEATURED_DESTINATIONS.some(
    (d) => d.name === (form.destination as string),
  );
  const continueDisabled =
    !!question && question.key === 'destination' && !destinationChosen;

  const setValue = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  const handleTripLangGateSelect = useCallback((lang: TripLanguage) => {
    persistTripLanguagePref(lang);
    setForm((prev) => ({ ...prev, tripLanguage: lang }));
    setShowTripLangGate(false);
  }, []);

  const handleFamilyKidsSave = useCallback((counts: FamilyKidsByAge, parents: 1 | 2) => {
    const cleaned = sanitizeFamilyKids(counts);
    const kids = totalFamilyKids(cleaned ?? {});
    setForm((prev) => ({
      ...prev,
      familyKidsByAge: cleaned ?? {},
      familyParents: parents,
      // groupSize auto-computed: parents + all kids
      groupSize: parents + kids,
    }));
    setShowFamilyKidsModal(false);
  }, []);

  const handleFamilyKidsCancel = useCallback(() => {
    setForm((prev) => ({
      ...prev,
      groupType: groupTypeBeforeFamilyRef.current,
      familyKidsByAge: {} as FamilyKidsByAge,
    }));
    setShowFamilyKidsModal(false);
  }, []);

  /**
   * Generic multi-select toggle. Writes to the form key matching the current
   * question (interests / hotelLocationPref / hotelAmenities). Optional `cap`
   * enforces a max selection count by evicting the oldest entry (FIFO).
   */
  const toggleMulti = useCallback((key: string, val: string, cap?: number) => {
    setForm((prev) => {
      const current = (prev[key] as string[]) || [];
      const next = current.includes(val)
        ? current.filter((i) => i !== val)
        : [...current, val];
      if (cap && next.length > cap) next.shift();
      return { ...prev, [key]: next };
    });
    setError('');
  }, []);

  // Back-compat alias ג€” interests is the original multi-select; keep the name
  // so existing tests/utilities that referenced `toggleInterest` still resolve.
  const toggleInterest = useCallback((val: string) => {
    toggleMulti('interests', val);
  }, [toggleMulti]);

  const toggleDietary = useCallback((val: string) => {
    setForm((prev) => {
      const current = (prev.dietaryRestrictions as string[]) || [];
      return {
        ...prev,
        dietaryRestrictions: current.includes(val)
          ? current.filter((i) => i !== val)
          : [...current, val],
      };
    });
  }, []);

  const toggleMustHave = useCallback((label: string) => {
    setForm((prev) => {
      const current = (prev.mustHaveItems as string[]) || [];
      return {
        ...prev,
        mustHaveItems: current.includes(label)
          ? current.filter((i) => i !== label)
          : [...current, label],
      };
    });
  }, []);

  const validate = () => {
    if (!question) return false;
    const val = form[question.key];
    if (!question.required) return true;
    if (question.key === 'destination') return destinationChosen;
    if (question.type === 'multi-select') return (val as string[])?.length > 0;
    if (question.type === 'date-range') {
      return !!(form['startDate'] as string) && !!(form['endDate'] as string);
    }
    if (question.key === 'groupType' && form.groupType === 'family') {
      return totalFamilyKids(form.familyKidsByAge as FamilyKidsByAge) >= 1;
    }
    return !!val;
  };

  const handleNext = () => {
    if (!question) return;
    if (!validate()) {
      if (question.key === 'groupType' && form.groupType === 'family') {
        setShowFamilyKidsModal(true);
      }
      setError(
        question.key === 'destination'
          ? 'Please select a destination to continue.'
          : question.key === 'groupType' && form.groupType === 'family'
            ? 'Tell us how many children are in each age band (tap Family again to edit), or choose another group type.'
            : 'Please complete this field before continuing.',
      );
      return;
    }
    if (step < activeQuestions.length - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setError('');
    setGenError('');
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
      return;
    }
    router.push('/onboarding?resume=1');
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setStreamedPlaces([]);
    setStreamedTips([]);
    setStreamStatus(null);

    const start = form['startDate'] as string;
    const end = form['endDate'] as string;
    const duration =
      start && end
        ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
        : 5;

    const profile: TravelerProfile = {
      destination: (form.destination as string) || '',
      tripLanguage: (form.tripLanguage as TravelerProfile['tripLanguage']) || 'en',
      startDate: start || '',
      endDate: end || '',
      duration,
      groupType: (form.groupType as TravelerProfile['groupType']) || 'solo',
      familyKidsByAge:
        form.groupType === 'family'
          ? sanitizeFamilyKids(form.familyKidsByAge as FamilyKidsByAge) ?? undefined
          : undefined,
      // groupSize is auto-derived for solo / couple / family; only the slider
      // value is used for group trips (where the question is actually shown).
      groupSize: (() => {
        const gt = (form.groupType as string) || 'solo';
        if (gt === 'solo')   return 1;
        if (gt === 'couple') return 2;
        if (gt === 'family') return (form.groupSize as number) || 2; // set by handleFamilyKidsSave
        return (form.groupSize as number) || 3; // group ג€” from slider
      })(),
      budget: (form.budget as TravelerProfile['budget']) || 'mid-range',
      pace: (form.pace as TravelerProfile['pace']) || 'moderate',
      interests: (form.interests as string[]) || [],
      accommodation: (form.accommodation as TravelerProfile['accommodation']) || 'boutique-hotel',
      hotelNightlyBudget: (form.hotelNightlyBudget as TravelerProfile['hotelNightlyBudget']) ?? null,
      hotelLocationPref: ((form.hotelLocationPref as TravelerProfile['hotelLocationPref']) || []),
      hotelAmenities: ((form.hotelAmenities as TravelerProfile['hotelAmenities']) || []),
      dietaryRestrictions: ((form.dietaryRestrictions as string[]) || []).join(', '),
      mustHave: [
        ...((form.mustHaveItems as string[]) || []),
        ...((form.mustHaveOther as string)?.trim()
          ? [(form.mustHaveOther as string).trim()]
          : []),
      ].filter(Boolean).join(', '),
      hotelBooked: (form.hotelBooked as string) || '',
      hotelAddress: (form.hotelAddress as string) || '',
      hotelLat: (form.hotelLat as number | null) ?? undefined,
      hotelLng: (form.hotelLng as number | null) ?? undefined,
      dailyStartTime: (form.dailyStartTime as string) || '08:30',
      arrivalTime: (form.arrivalTime as string) || '',
      departureTime: (form.departureTime as string) || '',
      skipDay1: !!(form.skipDay1 as boolean),
    };

    try {
      sessionStorage.setItem('travelos_profile', JSON.stringify(profile));
      localStorage.removeItem(STORAGE_KEY);

      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const controller = new AbortController();
      const genTimeoutMs = GENERATE_WALL_CLOCK_MS;
      const timeoutId = setTimeout(() => controller.abort(), genTimeoutMs);
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers,
          body: JSON.stringify({ ...profile, userId: user?.id ?? null }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text();
          let parsed: { error?: string; details?: string } = {};
          try { parsed = JSON.parse(text); } catch { /* ignore */ }
          throw new Error(parsed.error ?? `Server error ${res.status}: ${text.slice(0, 200)}`);
        }

        const data = (await res.json()) as { id?: string; itinerary?: unknown; error?: string };
        if (data.error || !data.id) {
          throw new Error(data.error ?? 'Generation failed');
        }
        if (data.itinerary) {
          sessionStorage.setItem('travelos_itinerary', JSON.stringify(data.itinerary));
        }
        router.push('/itinerary/' + data.id);
        return;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      const isAbort =
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      const msg = isAbort
          ? ((form.tripLanguage as TripLanguage) === 'he'
            ? '׳”׳‘׳ ׳™׳™׳” ׳׳¨׳›׳” ׳™׳•׳×׳¨ ׳׳“׳™ ג€” ׳ ׳¡׳• ׳©׳•׳‘ ׳׳• ׳‘׳“׳§׳• ׳׳× ׳”׳—׳™׳‘׳•׳¨.'
            : 'This is taking too long ג€” please try again or check your connection.')
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      setGenError(msg);   // shown as a prominent banner, not inline validation
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!planGateReady || isSubmitting || genError || showTripLangGate) return;
    if (activeQuestions.length > 0 || autoSubmitStartedRef.current) return;

    autoSubmitStartedRef.current = true;
    const tid = setTimeout(() => handleSubmit(), 80);
    return () => clearTimeout(tid);
    // handleSubmit intentionally omitted: it is rebuilt from current form state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planGateReady, isSubmitting, genError, showTripLangGate, activeQuestions.length]);

  if (isSubmitting) {
    return (
      <LoadingScreen
        destination={(form.destination as string) || ''}
        lang={(form.tripLanguage as TripLanguage) || 'en'}
        streamedPlaces={streamedPlaces}
        streamedTips={streamedTips}
        streamStatus={streamStatus}
      />
    );
  }

  if (!planGateReady) {
    return (
      <div
        className="min-h-screen w-full"
        style={{ backgroundColor: '#091f36' }}
        aria-busy="true"
        aria-label="Loading trip planner"
      />
    );
  }

  if (!question) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ backgroundColor: '#091f36' }}
      >
        {genError ? (
          <div className="max-w-md w-full rounded-2xl p-5 text-center"
            style={{ background: 'rgba(158,54,58,0.14)', border: '1px solid rgba(158,54,58,0.40)' }}>
            <p className="text-sm text-white mb-4">{genError}</p>
            <button
              type="button"
              onClick={() => { setGenError(''); handleSubmit(); }}
              className="px-6 py-3 rounded-full text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #9e363a, #b5404a)' }}
            >
              Try again →
            </button>
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>Preparing your trip…</p>
        )}
      </div>
    );
  }

  const isFinishingStep = question.key === 'finishingTouches';
  const isLast = step === activeQuestions.length - 1;
  const finishingAccent = '#9e363a';

  // Finishing step — same shell as onboarding (photo bg + glow + sticky footer)
  if (isFinishingStep) {
    return (
      <main
        className="min-h-screen relative"
        style={{
          backgroundColor: '#091f36',
          backgroundImage: `${photoOverlay}, url("${bgUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundAttachment: 'fixed',
        }}
      >
        <TripLanguageGateModal
          open={showTripLangGate}
          onSelect={handleTripLangGateSelect}
          onCancel={() => router.push('/')}
        />

        <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
          <div
            className="absolute top-0 left-0 right-0 h-64 transition-all duration-700"
            style={{
              background: `radial-gradient(ellipse 80% 100% at 50% -10%, ${finishingAccent}30 0%, transparent 70%)`,
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-48 transition-all duration-700"
            style={{
              background: `linear-gradient(to top, ${finishingAccent}15 0%, transparent 100%)`,
            }}
          />
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-8 pt-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <motion.button
                onClick={handleBack}
                aria-label="Go back"
                className="w-8 h-8 rounded-full flex items-center justify-center hover-bg-subtle transition-colors"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.10)' }}
              >
                ‹
              </motion.button>
              <BrandWordmark accent={finishingAccent} className="text-sm" />
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: planStepTotal }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-500"
                  style={{
                    height: 5,
                    width: i === step ? 24 : i < step ? 8 : 6,
                    background: i === step
                      ? finishingAccent
                      : i < step
                        ? `${finishingAccent}70`
                        : 'rgba(255,255,255,0.10)',
                  }}
                />
              ))}
            </div>
          </div>
          <p
            className="text-[11px] font-bold uppercase tracking-widest mt-3 mb-8"
            style={{ color: finishingAccent }}
          >
            Step {planStepNumber} of {planStepTotal} · Final details
          </p>
        </div>

        <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-8 pb-40">
          {genError && (
            <div
              className="mb-6 rounded-2xl p-5"
              style={{
                background: 'rgba(158,54,58,0.14)',
                border: '1px solid rgba(158,54,58,0.40)',
              }}
            >
              <p className="text-sm text-white mb-3">{genError}</p>
              <button
                type="button"
                onClick={() => { setGenError(''); handleSubmit(); }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #9e363a, #b5404a)' }}
              >
                Try again →
              </button>
            </div>
          )}

          <FinishingTouchesForm
            destination={destinationName}
            dietary={(form.dietaryRestrictions as string[]) || []}
            mustHaveItems={(form.mustHaveItems as string[]) || []}
            mustHaveOther={(form.mustHaveOther as string) || ''}
            onToggleDietary={toggleDietary}
            onToggleMustHave={toggleMustHave}
            onMustHaveOtherChange={(text) => setValue('mustHaveOther', text)}
            stepBadge={6}
          />
        </div>

        <div
          className="fixed bottom-0 left-0 right-0 z-20"
          style={{
            background: 'linear-gradient(to top, rgba(9,31,54,0.98) 60%, transparent 100%)',
            paddingTop: 36,
          }}
        >
          <div className="max-w-xl mx-auto px-5 sm:px-8 pb-8 flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-bold shrink-0 transition-colors"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.75)',
              }}
            >
              ‹ Back
            </button>
            <motion.button
              type="button"
              onClick={handleNext}
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-3.5 rounded-full text-sm font-black tracking-wide text-white"
              style={{
                background: 'linear-gradient(135deg, #9e363a, #b5404a)',
                boxShadow: '0 0 40px rgba(158,54,58,0.42), 0 8px 24px -4px rgba(158,54,58,0.28)',
              }}
            >
              Generate My Itinerary ✨
            </motion.button>
          </div>
          <p className="text-center text-xs pb-4" style={{ color: 'rgba(255,255,255,0.28)' }}>
            All optional — skip with Generate if you&apos;re ready
          </p>
        </div>
      </main>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `${photoOverlay}, url("${bgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      <TripLanguageGateModal
        open={showTripLangGate}
        onSelect={handleTripLangGateSelect}
        onCancel={() => router.push('/')}
      />

      <FamilyKidsModal
        open={showFamilyKidsModal}
        initial={(form.familyKidsByAge as FamilyKidsByAge) || {}}
        initialParents={(form.familyParents as 1 | 2) ?? 2}
        onSave={handleFamilyKidsSave}
        onCancel={handleFamilyKidsCancel}
      />

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-orb-float absolute w-[700px] h-[700px] rounded-full blur-[160px] -top-40 -left-40"
          style={{ backgroundColor: 'rgba(158,54,58,0.10)' }} />
        <div className="animate-orb-float absolute w-[500px] h-[500px] rounded-full blur-[140px] bottom-0 right-0"
          style={{ backgroundColor: 'rgba(15,40,98,0.30)', animationDelay: '-4s' }} />
        <div className="animate-orb-float absolute w-[300px] h-[300px] rounded-full blur-[120px] top-1/2 left-1/2"
          style={{ backgroundColor: 'rgba(74,123,222,0.06)', animationDelay: '-8s' }} />
      </div>

      {/* Top bar */}
      <div
        className="relative z-10 flex items-center justify-between px-6 py-5 border-b backdrop-blur-sm"
        style={{ background: 'rgba(9,31,54,0.88)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <Link href="/" className="text-lg text-white tracking-tight">
          <BrandWordmark accent="#9e363a" className="text-lg" />
        </Link>
        <span className="text-sm font-mono tabular-nums" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {planStepNumber}<span style={{ color: 'rgba(255,255,255,0.18)' }}> / {planStepTotal}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 h-0.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, #9e363a, #b5404a, #9e363a)' }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Question area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">

          {/* Generation error banner */}
          <AnimatePresence>
            {genError && (
              <motion.div
                initial={{ opacity: 0, y: -12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="mb-6 rounded-2xl p-5"
                style={{
                  background: 'rgba(158,54,58,0.14)',
                  border: '1px solid rgba(158,54,58,0.40)',
                  boxShadow: '0 4px 24px -4px rgba(158,54,58,0.20)',
                }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0 mt-0.5">ג ן¸</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white mb-1">
                      Generation failed
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.60)' }}>
                      {genError}
                    </p>
                  </div>
                </div>
                <motion.button
                  type="button"
                  onClick={() => { setGenError(''); handleSubmit(); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 w-full py-2.5 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #9e363a 0%, #b5404a 100%)',
                    boxShadow: '0 4px 16px -4px rgba(158,54,58,0.50)',
                  }}
                >
                  Try again ג†’
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-8 justify-center">
            {activeQuestions.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? 20 : 6,
                  opacity: i <= step ? 1 : 0.4,
                  backgroundColor: i <= step ? '#9e363a' : 'rgba(255,255,255,0.15)',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* Question header — finishing step uses its own onboarding-style header */}
              {!isFinishingStep && (
                <div className="mb-7">
                  <motion.div
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="text-xs font-semibold uppercase tracking-widest mb-2"
                    style={{ color: '#9e363a' }}
                  >
                    Step {planStepNumber}
                  </motion.div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2">
                    {question.title}
                  </h2>
                  {question.subtitle && (
                    <p className="text-base" style={{ color: 'rgba(255,255,255,0.50)' }}>{question.subtitle}</p>
                  )}
                </div>
              )}

              {/* Input area */}
              <div className="mb-6">

                {/* ג”€ג”€ Step 1: destination cards ג”€ג”€ */}
                {question.key === 'destination' && (
                  <DestinationGrid
                    value={(form.destination as string) || ''}
                    onChange={(v) => setValue('destination', v)}
                  />
                )}

                {/* ג”€ג”€ Text (non-destination) ג”€ג”€ */}
                {question.type === 'text' && question.key !== 'destination' && (
                  <input
                    type="text"
                    placeholder={question.placeholder}
                    value={(form[question.key] as string) || ''}
                    onChange={(e) => setValue(question.key, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    autoFocus
                    className="w-full px-5 py-4 rounded-2xl border focus:outline-none text-base transition-all text-white"
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(15,40,98,0.30)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(158,54,58,0.12)'; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                )}

                {/* ג”€ג”€ Date range ג”€ג”€ */}
                {question.type === 'date-range' && (
                  <div className="grid grid-cols-2 gap-3">
                    {(['startDate', 'endDate'] as const).map((key, i) => (
                      <div key={key}>
                        <label className="block text-xs font-medium mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                          {i === 0 ? 'Departure' : 'Return'}
                        </label>
                        <input
                          type="date"
                          value={(form[key] as string) || ''}
                          onChange={(e) => setValue(key, e.target.value)}
                          className="w-full px-4 py-3.5 rounded-2xl border focus:outline-none text-white transition-all"
                          style={{
                            borderColor: 'rgba(255,255,255,0.10)',
                            background: 'rgba(15,40,98,0.30)',
                            colorScheme: 'dark',
                          }}
                          onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; }}
                          onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
                          min={
                            key === 'endDate'
                              ? (form['startDate'] as string) || new Date().toISOString().split('T')[0]
                              : new Date().toISOString().split('T')[0]
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ג”€ג”€ Time-Aware (Step 3) ג”€ג”€ */}
                {question.type === 'time-aware' && (
                  <TimeAwareStep
                    arrivalTime={(form.arrivalTime as string) || ''}
                    departureTime={(form.departureTime as string) || ''}
                    dailyStartTime={(form.dailyStartTime as string) || '08:30'}
                    onArrival={(v) => setValue('arrivalTime', v)}
                    onDeparture={(v) => setValue('departureTime', v)}
                    onDailyStart={(v) => setValue('dailyStartTime', v)}
                  />
                )}

                {/* ג”€ג”€ Single select ג”€ג”€ */}
                {question.type === 'select' && question.options && (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {question.options.map((opt) => {
                      const selected = form[question.key] === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          variants={optionVariant}
                          onClick={() => {
                            if (question.key !== 'groupType') {
                              setValue(question.key, opt.value);
                              return;
                            }
                            if (opt.value === 'family') {
                              if (form.groupType !== 'family') {
                                groupTypeBeforeFamilyRef.current =
                                  (form.groupType as GroupType) || 'couple';
                              }
                              setValue('groupType', 'family');
                              setShowFamilyKidsModal(true);
                              return;
                            }
                            setForm((prev) => ({
                              ...prev,
                              groupType: opt.value,
                              familyKidsByAge: {} as FamilyKidsByAge,
                            }));
                            setError('');
                          }}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          animate={
                            selected
                              ? { boxShadow: '0 0 0 2px #9e363a, 0 8px 24px -4px rgba(158,54,58,0.20)' }
                              : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }
                          }
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className="text-left p-4 rounded-2xl border transition-colors"
                          style={
                            selected
                              ? { borderColor: '#9e363a', background: 'rgba(158,54,58,0.14)' }
                              : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(15,40,98,0.22)' }
                          }
                        >
                          <div className="flex items-start gap-3">
                            {opt.icon && <span className="text-2xl mt-0.5 flex-shrink-0">{opt.icon}</span>}
                            <div>
                              <div className="font-semibold text-sm" style={{ color: selected ? '#c05060' : 'rgba(255,255,255,0.92)' }}>
                                {opt.label}
                              </div>
                              {opt.description && (
                                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.40)' }}>{opt.description}</div>
                              )}
                            </div>
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-auto w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: '#9e363a' }}
                              >
                                <span className="text-white text-[10px]">ג“</span>
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* ג”€ג”€ Multi-select ג”€ג”€ */}
                {question.type === 'multi-select' && question.options && (
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {question.options.map((opt) => {
                      const selected = ((form[question.key] as string[]) || []).includes(opt.value);
                      return (
                        <motion.button
                          key={opt.value}
                          variants={optionVariant}
                          onClick={() => toggleMulti(
                            question.key,
                            opt.value,
                            // City Center / Beach / Quiet / Transit ג€” cap at 2
                            question.key === 'hotelLocationPref' ? 2 : undefined,
                          )}
                          whileHover={{ scale: 1.06, y: -3 }}
                          whileTap={{ scale: 0.94 }}
                          animate={
                            selected
                              ? { boxShadow: '0 0 0 2px #9e363a, 0 6px 20px -4px rgba(158,54,58,0.22)' }
                              : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }
                          }
                          transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                          className="p-3 rounded-2xl border text-center transition-colors"
                          style={
                            selected
                              ? { borderColor: '#9e363a', background: 'rgba(158,54,58,0.14)' }
                              : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(15,40,98,0.22)' }
                          }
                        >
                          <div className="text-xl mb-1.5">{opt.icon}</div>
                          <div className="text-xs font-medium leading-tight" style={{ color: selected ? '#c05060' : 'rgba(255,255,255,0.70)' }}>
                            {opt.label}
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* ג”€ג”€ Slider ג”€ג”€ */}
                {question.type === 'slider' && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-6"
                    style={{
                      borderColor: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      background: 'rgba(15,40,98,0.28)',
                      boxShadow: '0 8px 32px -8px rgba(158,54,58,0.08)',
                    }}
                  >
                    <div className="text-center mb-8">
                      <motion.span
                        key={(form[question.key] as number) ?? question.min}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-6xl font-bold text-white tabular-nums"
                      >
                        {(form[question.key] as number) ?? question.min ?? 1}
                      </motion.span>
                      <span className="ml-2 text-xl" style={{ color: 'rgba(255,255,255,0.40)' }}>
                        {((form[question.key] as number) ?? 1) === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={question.min || 1}
                      max={question.max || 20}
                      value={(form[question.key] as number) ?? 2}
                      onChange={(e) => setValue(question.key, Number(e.target.value))}
                      className="w-full cursor-pointer"
                      style={{ accentColor: '#9e363a' }}
                    />
                    <div className="flex justify-between text-xs mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      <span>{question.min}</span>
                      <span>{question.max}+</span>
                    </div>
                  </motion.div>
                )}

                {question.key === 'finishingTouches' && (
                  <FinishingTouchesForm
                    destination={(form.destination as string) || ''}
                    dietary={(form.dietaryRestrictions as string[]) || []}
                    mustHaveItems={(form.mustHaveItems as string[]) || []}
                    mustHaveOther={(form.mustHaveOther as string) || ''}
                    onToggleDietary={toggleDietary}
                    onToggleMustHave={toggleMustHave}
                    onMustHaveOtherChange={(text) => setValue('mustHaveOther', text)}
                  />
                )}

                {/* Textarea (generic) */}
                {question.type === 'textarea' && question.key !== 'finishingTouches' && (
                  <textarea
                    placeholder={question.placeholder}
                    value={(form[question.key] as string) || ''}
                    onChange={(e) => setValue(question.key, e.target.value)}
                    rows={4}
                    className="w-full px-5 py-4 rounded-2xl border focus:outline-none text-base transition-all resize-none text-white"
                    style={{
                      borderColor: 'rgba(255,255,255,0.10)',
                      background: 'rgba(15,40,98,0.30)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; e.currentTarget.style.boxShadow = '0 0 0 2px rgba(158,54,58,0.12)'; }}
                    onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                )}
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 px-4 py-3 rounded-xl text-sm"
                    style={{
                      background: 'rgba(158,54,58,0.12)',
                      border: '1px solid rgba(158,54,58,0.30)',
                      color: '#ff8c8f',
                    }}
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <motion.button
                  onClick={handleBack}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3 rounded-full border font-medium text-sm transition-colors hover-outline-btn"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                >
                  {step === 0 ? '← Back to setup' : '← Back'}
                </motion.button>

                <motion.button
                  onClick={handleNext}
                  disabled={continueDisabled}
                  whileHover={{ scale: continueDisabled ? 1 : 1.04, y: continueDisabled ? 0 : -2 }}
                  whileTap={{ scale: continueDisabled ? 1 : 0.96 }}
                  className="relative px-8 py-3 rounded-full font-semibold text-sm text-white overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #9e363a 0%, #7a2a2d 100%)',
                    boxShadow: continueDisabled ? 'none' : '0 0 32px rgba(158,54,58,0.45), 0 8px 24px -4px rgba(158,54,58,0.35)',
                  }}
                >
                  <span className="relative z-10">
                    {isLast || isFinishingStep ? 'Generate Itinerary ✨' : 'Continue →'}
                  </span>
                  {!continueDisabled && (
                    <motion.div
                      className="absolute inset-0 bg-white/10"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </motion.button>
              </div>

              {!question.required && (
                <div className="text-center mt-4">
                  <button
                    onClick={handleNext}
                    className="text-sm transition-colors hover-text-visible"
                    style={{ color: 'rgba(255,255,255,0.30)' }}
                  >
                    Skip this question
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
