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
import { getStepBackground } from '@/lib/stepBackgrounds';
import { readTripLanguagePref, persistTripLanguagePref } from '@/lib/tripLanguagePref';
import { TripLanguageGateModal } from '@/components/TripLanguageGateModal';
import { BrandWordmark } from '@/components/BrandWordmark';
import { GENERATE_WALL_CLOCK_MS } from '@/lib/generateBudget';
type FormData = Record<string, unknown>;

// ── SSE streaming types ───────────────────────────────────────────────────────
type PlaceEvent = {
  name: string; emoji: string; description: string;
  slot: string; day: number; vibeLabel: string;
};
type StatusEvent = { message: string; icon: string };

const STORAGE_KEY = 'travelos_plan_draft';
const PRE_ONBOARDING_KEYS = new Set(['destination', 'dates', 'tripTimes']);
/** tripLanguage is chosen on the home gate or /plan gate, not in this wizard */
const PLAN_QUESTIONS = questions.filter((q) => !PRE_ONBOARDING_KEYS.has(q.key));

// ─── Animation variants ───────────────────────────────────────────────────────

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

// ─── Destination grid (Step 1 — ONLY valid UI for destination) ────────────────

const FEATURED_DESTINATIONS = [
  { name: 'Rome',       country: 'Italy',       flag: '🇮🇹', tagline: 'La Dolce Vita',           accent: '#f97316' },
  { name: 'Paris',      country: 'France',      flag: '🇫🇷', tagline: 'City of Light',            accent: '#a855f7' },
  { name: 'London',     country: 'UK',          flag: '🇬🇧', tagline: 'Iconic & Eclectic',       accent: '#3b82f6' },
  { name: 'Athens',     country: 'Greece',      flag: '🇬🇷', tagline: 'Cradle of Civilization', accent: '#10b981' },
  { name: 'Budapest',   country: 'Hungary',     flag: '🇭🇺', tagline: 'Paris of the East',       accent: '#ec4899' },
  { name: 'Vienna',     country: 'Austria',     flag: '🇦🇹', tagline: 'Imperial & Café Culture',   accent: '#eab308' },
  { name: 'Amsterdam',  country: 'Netherlands', flag: '🇳🇱', tagline: 'Canals & Contrasts',      accent: '#06b6d4' },
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
            whileHover={{ scale: 1.06, y: -6 }}
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
                <span className="text-white text-xs font-bold leading-none">✓</span>
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

// ─── Loading screen ───────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { icon: '📱', label: 'Scanning 2026 travel trends…' },
  { icon: '🍜', label: 'Cross-referencing local food blogs…' },
  { icon: '🗺', label: 'Optimizing neighborhood clusters…' },
  { icon: '✨', label: 'Vibe-checking the itinerary…' },
  { icon: '💎', label: 'Filtering tourist traps. You deserve better.' },
];

/** Soft target length for UX pacing (steps + progress bar — aligned with server budget). */
const GENERATION_SOFT_TARGET_SEC = 90;
/** Never show 100% in the UI while waiting on the server (avoids “stuck at 100%”). */
const GENERATION_UI_MAX_PCT = 97;

const GENERATION_TIMER_COPY = {
  en: {
    phase: (n: number, total: number) => `Step ${n} of ${total}`,
    progressLabel: 'Trip build',
    footer: 'Typical build: 30s–2 min · AI-powered',
    building: (dest: string) =>
      `Building your ${dest.trim() || 'trip'} itinerary`,
    almostDone: 'Finalizing details on our servers…',
  },
  he: {
    phase: (n: number, total: number) => `שלב ${n} מתוך ${total}`,
    progressLabel: 'התקדמות בניית הטיול',
    footer: 'זמן טיפוסי: 30 שנ׳ עד 2 דק׳ · בינה מלאכותית',
    building: (dest: string) =>
      dest.trim()
        ? `בונים את המסלול ל${dest}`
        : 'בונים את המסלול שלך',
    almostDone: 'מסיימים פרטים בשרת…',
  },
} as const;

// ─── Step 3 — Time-Aware inputs ───────────────────────────────────────────────

const DAILY_START_OPTIONS = [
  { value: '07:00', label: 'Early Bird',    icon: '🌅', sub: 'Start at 7 am' },
  { value: '08:30', label: 'Morning',       icon: '☀️',  sub: 'Start at 8:30 am' },
  { value: '10:00', label: 'Mid-Morning',   icon: '🌤️', sub: 'Start at 10 am' },
  { value: '11:30', label: 'Late Starter',  icon: '🛌', sub: 'Start at 11:30 am' },
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
                    <span className="text-white text-[9px] font-bold">✓</span>
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
            🛬 Arrival time — Day 1
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
            🛫 Departure time — Last Day
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

// ─── Step 9 — Dietary options ─────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  { value: 'Vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { value: 'Vegan',       label: 'Vegan',        icon: '🌱' },
  { value: 'Kosher',      label: 'Kosher',        icon: '✡️' },
  { value: 'Halal',       label: 'Halal',         icon: '☪️' },
  { value: 'Gluten-Free', label: 'Gluten-Free',   icon: '🌾' },
  { value: 'Dairy-Free',  label: 'Dairy-Free',    icon: '🥛' },
];

// ─── Step 10 — City-specific must-haves ───────────────────────────────────────

type PickItem = { icon: string; label: string };
type PickCategory = {
  key: 'attractions' | 'restaurants' | 'historical' | 'popular';
  title: string;
  items: PickItem[];
};

const CITY_PICK_GROUPS: Record<string, PickCategory[]> = {
  Rome: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '⛲', label: 'Trevi Fountain' },
        { icon: '🗺️', label: 'Roman Forum' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🍝', label: 'Trastevere Pasta Spot' },
        { icon: '🍕', label: 'Traditional Roman Pizzeria' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '🏟️', label: 'Colosseum' },
        { icon: '🏛️', label: 'Pantheon' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '⛪', label: 'Vatican Museums' },
        { icon: '🛍️', label: "Campo de' Fiori Market" },
      ],
    },
  ],
  Paris: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🏘️', label: 'Montmartre Village' },
        { icon: '🚶', label: 'Le Marais Walk' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🥐', label: 'Classic Parisian Bistro' },
        { icon: '🧀', label: 'Cheese & Wine Dinner' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '🖼️', label: 'Louvre Museum' },
        { icon: '🎨', label: "Musée d'Orsay" },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🗼', label: 'Eiffel Tower' },
        { icon: '⛪', label: 'Notre-Dame Cathedral' },
      ],
    },
  ],
  London: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🌿', label: 'Hyde Park' },
        { icon: '🎡', label: 'London Eye' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🍞', label: 'Borough Market Tasting' },
        { icon: '🍽️', label: 'Modern British Gastropub' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '🏰', label: 'Tower of London' },
        { icon: '🕰️', label: 'Big Ben & Parliament' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🏺', label: 'British Museum' },
        { icon: '🚶', label: 'Covent Garden Walk' },
      ],
    },
  ],
  Athens: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🌄', label: 'Lycabettus Hill View' },
        { icon: '🌊', label: 'Cape Sounion Sunset' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🥙', label: 'Central Market Food Tour' },
        { icon: '🍢', label: 'Traditional Souvlaki Stop' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '🏛️', label: 'Acropolis' },
        { icon: '🏺', label: 'National Archaeology Museum' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🛍️', label: 'Monastiraki Flea Market' },
        { icon: '🚶', label: 'Plaka Old Town Walk' },
      ],
    },
  ],
  Budapest: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🌉', label: 'Chain Bridge Walk' },
        { icon: '🛁', label: 'Széchenyi Thermal Baths' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🍲', label: 'Goulash Restaurant' },
        { icon: '🥐', label: 'Great Market Hall' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '🏰', label: 'Buda Castle' },
        { icon: '🏛️', label: 'Hungarian Parliament' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🍺', label: 'Ruin Bar Night Out' },
        { icon: '🚋', label: 'Danube Promenade' },
      ],
    },
  ],
  Vienna: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🏰', label: 'Schönbrunn Palace' },
        { icon: '🎨', label: 'MuseumsQuartier' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '☕', label: 'Classic Viennese Café' },
        { icon: '🥨', label: 'Naschmarkt Food Walk' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '⛪', label: 'St. Stephen\'s Cathedral' },
        { icon: '🏛️', label: 'Hofburg Palace' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🎡', label: 'Prater Giant Ferris Wheel' },
        { icon: '🖼️', label: 'Belvedere Palace' },
      ],
    },
  ],
  Amsterdam: [
    {
      key: 'attractions',
      title: 'Attractions',
      items: [
        { icon: '🛶', label: 'Canal Ring Walk' },
        { icon: '🏘️', label: 'Jordaan Streets' },
      ],
    },
    {
      key: 'restaurants',
      title: 'Restaurants',
      items: [
        { icon: '🧇', label: 'Stroopwafel & Markets' },
        { icon: '🍛', label: 'Indonesian Rijsttafel Dinner' },
      ],
    },
    {
      key: 'historical',
      title: 'Historical',
      items: [
        { icon: '📔', label: 'Anne Frank House' },
        { icon: '🖼️', label: 'Rijksmuseum' },
      ],
    },
    {
      key: 'popular',
      title: 'Most Popular (Touristy Too)',
      items: [
        { icon: '🎨', label: 'Van Gogh Museum' },
        { icon: '📍', label: 'Dam Square & Royal Palace' },
      ],
    },
  ],
};

const GENERIC_PICK_GROUPS: PickCategory[] = [
  {
    key: 'attractions',
    title: 'Attractions',
    items: [
      { icon: '🌿', label: 'Parks & Nature' },
      { icon: '🛍️', label: 'Local Markets' },
    ],
  },
  {
    key: 'restaurants',
    title: 'Restaurants',
    items: [
      { icon: '🍽️', label: 'Food Tours' },
      { icon: '🥘', label: 'Local Signature Restaurant' },
    ],
  },
  {
    key: 'historical',
    title: 'Historical',
    items: [
      { icon: '🏛️', label: 'Museums' },
      { icon: '🏰', label: 'Historic Sites' },
    ],
  },
  {
    key: 'popular',
    title: 'Most Popular (Touristy Too)',
    items: [
      { icon: '📸', label: 'Most Photographed Spot' },
      { icon: '🌃', label: 'Popular Nightlife Area' },
    ],
  },
];

// ─── DietaryCubes — Step 9 ────────────────────────────────────────────────────

function DietaryCubes({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 gap-3"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {DIETARY_OPTIONS.map((opt) => {
        const sel = selected.includes(opt.value);
        return (
          <motion.button
            key={opt.value}
            variants={optionVariant}
            onClick={() => onToggle(opt.value)}
            whileHover={{ scale: 1.06, y: -3 }}
            whileTap={{ scale: 0.94 }}
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
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#9e363a' }}
              >
                <span className="text-white text-[9px] font-bold">✓</span>
              </motion.div>
            )}
            <div className="text-2xl mb-2 leading-none">{opt.icon}</div>
            <div className="text-xs font-semibold leading-tight" style={{ color: sel ? '#c05060' : 'rgba(255,255,255,0.75)' }}>
              {opt.label}
            </div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── MustHaveCubes — Step 10 ──────────────────────────────────────────────────

function MustHaveCubes({
  destination,
  selected,
  customText,
  onToggle,
  onCustomChange,
}: {
  destination: string;
  selected: string[];
  customText: string;
  onToggle: (label: string) => void;
  onCustomChange: (text: string) => void;
}) {
  const pickGroups = CITY_PICK_GROUPS[destination] ?? GENERIC_PICK_GROUPS;
  const otherSelected = selected.includes('Other');

  return (
    <div>
      {destination && CITY_PICK_GROUPS[destination] && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#9e363a' }}>
            Top picks for {destination}
          </span>
          <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
        </div>
      )}

      <motion.div className="grid grid-cols-1 sm:grid-cols-2 gap-3" variants={staggerContainer} initial="hidden" animate="show">
        {pickGroups.map((group) => (
          <motion.div
            key={group.key}
            variants={optionVariant}
            className="rounded-2xl border p-3"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(15,40,98,0.22)',
            }}
          >
            <div className="text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: '#9e363a' }}>
              {group.title}
            </div>
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((pick) => {
                const sel = selected.includes(pick.label);
                return (
                  <motion.button
                    key={pick.label}
                    onClick={() => onToggle(pick.label)}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    animate={
                      sel
                        ? { boxShadow: '0 0 0 2px #9e363a, 0 8px 24px -4px rgba(158,54,58,0.22)' }
                        : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }
                    }
                    transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                    className="relative p-3 rounded-xl border text-left transition-colors"
                    style={
                      sel
                        ? { borderColor: '#9e363a', background: 'rgba(158,54,58,0.14)' }
                        : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(15,40,98,0.28)' }
                    }
                  >
                    {sel && (
                      <motion.div
                        initial={{ scale: 0, rotate: -15 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                        className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: '#9e363a' }}
                      >
                        <span className="text-white text-[9px] font-bold">✓</span>
                      </motion.div>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="text-xl leading-none">{pick.icon}</div>
                      <div className="text-xs font-semibold leading-snug" style={{ color: sel ? '#c05060' : 'rgba(255,255,255,0.78)' }}>
                        {pick.label}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Other cube */}
      <motion.button
        variants={optionVariant}
        onClick={() => onToggle('Other')}
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.97 }}
        animate={
          otherSelected
            ? { boxShadow: '0 0 0 2px #9e363a, 0 8px 24px -4px rgba(158,54,58,0.22)' }
            : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }
        }
        transition={{ type: 'spring', stiffness: 450, damping: 22 }}
        className="relative p-4 rounded-2xl border text-center transition-colors mt-3 w-full"
        style={
          otherSelected
            ? { borderColor: '#9e363a', background: 'rgba(158,54,58,0.14)' }
            : { borderColor: 'rgba(255,255,255,0.15)', borderStyle: 'dashed', background: 'rgba(15,40,98,0.14)' }
        }
      >
        {otherSelected && (
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#9e363a' }}
          >
            <span className="text-white text-[9px] font-bold">✓</span>
          </motion.div>
        )}
        <div className="text-2xl mb-2 leading-none">✏️</div>
        <div className="text-xs font-semibold leading-tight" style={{ color: otherSelected ? '#c05060' : 'rgba(255,255,255,0.38)' }}>
          Other…
        </div>
      </motion.button>

      {/* Inline text input */}
      <AnimatePresence>
        {otherSelected && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="overflow-hidden"
          >
            <input
              type="text"
              autoFocus
              placeholder='e.g. "Sagrada Família", "Northern Lights", "Michelin star dinner"…'
              value={customText}
              onChange={(e) => onCustomChange(e.target.value)}
              className="w-full px-5 py-4 rounded-2xl border focus:outline-none text-sm transition-all"
              style={{
                borderColor: 'rgba(158,54,58,0.45)',
                background: 'rgba(158,54,58,0.10)',
                color: 'white',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = '#9e363a'; }}
              onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(158,54,58,0.45)'; }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Live discovery panel (SSE-fed sidebar) ───────────────────────────────────

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
          <div className="text-3xl mb-2 opacity-40">🌍</div>
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Searching for hidden gems…
          </p>
        </motion.div>
      )}

      {/* Place cards — slide in from the right */}
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
                  Day {place.day} · {place.slot}
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

      {/* Tips — fade up */}
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
              💡 {tip}
            </p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

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
   * Progress %: mostly time-based (honest “how long you’ve been waiting”), lightly boosted by phase
   * so the bar moves with phases but never hits 100% until navigation unmounts this screen.
   */
  const timeRatio = Math.min(1, elapsedSec / GENERATION_SOFT_TARGET_SEC);
  const phaseRatio = (activeStep + 1) / LOADING_STEPS.length;
  const blended = 0.62 * timeRatio + 0.38 * phaseRatio;
  const pct = Math.min(GENERATION_UI_MAX_PCT, Math.round(blended * 100));
  const showAlmostDone = activeStep >= LOADING_STEPS.length - 1;

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center lg:items-start justify-center gap-10 lg:gap-16 px-6 lg:px-14 py-12 lg:py-0 relative overflow-hidden"
      style={{ backgroundColor: '#091f36' }}>
      {/* Ambient orbs */}
      <div className="noise absolute w-[560px] h-[560px] rounded-full blur-[130px] top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ background: 'rgba(158,54,58,0.12)' }} />
      <div className="noise absolute w-[320px] h-[320px] rounded-full blur-[100px] bottom-1/4 right-1/4 pointer-events-none"
        style={{ background: 'rgba(15,40,98,0.40)' }} />

      {/* ── Left panel: spinner + steps ─────────────────────────────────── */}
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
          ⏳
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
        className="mb-7 px-5 py-4 rounded-2xl w-full max-w-sm border text-center"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'rgba(255,255,255,0.10)',
        }}
      >
        <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {tc.progressLabel}
        </div>
        <div className="font-extrabold text-white text-3xl sm:text-4xl tracking-tight tabular-nums">{pct}%</div>
        <div className="text-xs mt-2 font-medium" style={{ color: 'rgba(255,255,255,0.55)' }}>
          {tc.phase(activeStep + 1, LOADING_STEPS.length)}
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

      <div className="flex flex-col gap-2 w-full max-w-xs mb-8">
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
              <span className="text-base flex-shrink-0">{done ? '✓' : s.icon}</span>
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

    {/* ── Right panel: live discovery ───────────────────────────────────── */}
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

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // SSE streaming state
  const [streamedPlaces, setStreamedPlaces] = useState<PlaceEvent[]>([]);
  const [streamedTips,   setStreamedTips]   = useState<string[]>([]);
  const [streamStatus,   setStreamStatus]   = useState<StatusEvent | null>(null);
  const [showTripLangGate, setShowTripLangGate] = useState(false);
  const [showFamilyKidsModal, setShowFamilyKidsModal] = useState(false);
  const groupTypeBeforeFamilyRef = useRef<GroupType>('couple');

  const searchParams = useSearchParams();
  const planSearchKey = useMemo(() => searchParams.toString(), [searchParams]);

  /** Plan wizard expects onboarding-completed query params; otherwise send users to /onboarding first. */
  const [planGateReady, setPlanGateReady] = useState(false);

  useEffect(() => {
    setPlanGateReady(false);

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

    setForm({
      groupSize: 2,
      familyKidsByAge: {} as FamilyKidsByAge,
      tripLanguage: initialTripLang,
      interests: [],
      dietaryRestrictions: [],
      mustHaveItems: [],
      mustHaveOther: '',
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
    });
    setPlanGateReady(true);
  }, [router, planSearchKey]);

  const hasHotelAnchor =
    !!(form.hotelBooked as string)?.trim() ||
    (typeof form.hotelLat === 'number' && typeof form.hotelLng === 'number');
  const activeQuestions = PLAN_QUESTIONS.filter(
    (q) => !(hasHotelAnchor && q.key === 'accommodation'),
  );
  const question = activeQuestions[step];
  const planStepTotal = Math.max(1, activeQuestions.length);
  const planStepNumber = Math.min(step + 1, planStepTotal);
  const progress = (planStepNumber / planStepTotal) * 100;
  const bg = getStepBackground(planStepNumber, 5);

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

  const handleFamilyKidsSave = useCallback((counts: FamilyKidsByAge) => {
    const cleaned = sanitizeFamilyKids(counts);
    setForm((prev) => ({ ...prev, familyKidsByAge: cleaned ?? {} }));
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

  const toggleInterest = useCallback((val: string) => {
    setForm((prev) => {
      const current = (prev.interests as string[]) || [];
      return {
        ...prev,
        interests: current.includes(val)
          ? current.filter((i) => i !== val)
          : [...current, val],
      };
    });
    setError('');
  }, []);

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
      groupSize: (form.groupSize as number) || 1,
      budget: (form.budget as TravelerProfile['budget']) || 'mid-range',
      pace: (form.pace as TravelerProfile['pace']) || 'moderate',
      interests: (form.interests as string[]) || [],
      accommodation: (form.accommodation as TravelerProfile['accommodation']) || 'boutique-hotel',
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
            ? 'הבנייה ארכה יותר מדי — נסו שוב או בדקו את החיבור.'
            : 'This is taking too long — please try again or check your connection.')
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      setError(msg);
      setIsSubmitting(false);
    }
  };

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

  const isLast = step === activeQuestions.length - 1;

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `linear-gradient(rgba(9,31,54,0.82), rgba(9,31,54,0.90)), url("${bg.imageUrl}")`,
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
              {/* Question header */}
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

              {/* Input area */}
              <div className="mb-6">

                {/* ── Step 1: destination cards ── */}
                {question.key === 'destination' && (
                  <DestinationGrid
                    value={(form.destination as string) || ''}
                    onChange={(v) => setValue('destination', v)}
                  />
                )}

                {/* ── Text (non-destination) ── */}
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

                {/* ── Date range ── */}
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

                {/* ── Time-Aware (Step 3) ── */}
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

                {/* ── Single select ── */}
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
                                <span className="text-white text-[10px]">✓</span>
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── Multi-select ── */}
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
                          onClick={() => toggleInterest(opt.value)}
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

                {/* ── Slider ── */}
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

                {/* ── Step 9: Dietary Cubes ── */}
                {question.key === 'dietaryRestrictions' && (
                  <DietaryCubes
                    selected={(form.dietaryRestrictions as string[]) || []}
                    onToggle={toggleDietary}
                  />
                )}

                {/* ── Step 10: Must-Have City Picks ── */}
                {question.key === 'mustHave' && (
                  <MustHaveCubes
                    destination={(form.destination as string) || ''}
                    selected={(form.mustHaveItems as string[]) || []}
                    customText={(form.mustHaveOther as string) || ''}
                    onToggle={toggleMustHave}
                    onCustomChange={(text) => setValue('mustHaveOther', text)}
                  />
                )}

                {/* ── Textarea ── */}
                {question.type === 'textarea' &&
                  question.key !== 'dietaryRestrictions' &&
                  question.key !== 'mustHave' && (
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
                  className="px-6 py-3 rounded-full border font-medium text-sm transition-colors"
                  style={{
                    borderColor: 'rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.45)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.22)';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
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
                    {isLast ? 'Generate Itinerary ✨' : 'Continue →'}
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
                    className="text-sm transition-colors"
                    style={{ color: 'rgba(255,255,255,0.30)' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.30)')}
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
