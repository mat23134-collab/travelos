'use client';

/**
 * LogisticsStep — Step 3 of 4 in the onboarding flow.
 *
 * Combined arrival + departure logistics on ONE screen.
 * Replaces the old ArrivalTimeStep + DepartureTimeStep (two separate steps).
 *
 * skipDay1 logic: if arrivalTime is after 18:00, skipDay1 = true in the store
 * (set automatically by setArrivalTime). This is the single source of truth.
 *
 * 3D: clock scene tracking the arrival time.
 * Palette: Redline (#9e363a) for arrival, warm orange (#f97316) for early-departure warning.
 */

import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const PRIMARY   = '#9e363a';
const PRIMARY_H = '#b5404a';

// ── Quick-select chip data ────────────────────────────────────────────────────

const ARRIVAL_TIMES = [
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '13:00', emoji: '☀️' },
  { label: 'Afternoon', value: '16:00', emoji: '🌤️' },
  { label: 'Evening',   value: '19:00', emoji: '🌆' },
  { label: 'Late',      value: '21:00', emoji: '🌙' },
  { label: 'Night',     value: '23:30', emoji: '🌃' },
];

const DEPARTURE_TIMES = [
  { label: 'Dawn',      value: '06:00', emoji: '🌄' },
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '12:00', emoji: '☀️' },
  { label: 'Afternoon', value: '15:00', emoji: '🌤️' },
  { label: 'Evening',   value: '18:00', emoji: '🌆' },
  { label: 'Night',     value: '22:00', emoji: '🌙' },
];

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

// ── Small time chip grid ──────────────────────────────────────────────────────
function TimeChips({
  times,
  selected,
  accentColor,
  onSelect,
}: {
  times: typeof ARRIVAL_TIMES;
  selected: string;
  accentColor: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {times.map(({ label, value, emoji }) => {
        const active = selected === value;
        const rgb = accentColor === PRIMARY ? '158,54,58' : '249,115,22';
        return (
          <motion.button
            key={value}
            onClick={() => onSelect(value)}
            whileHover={{ y: -3, scale: 1.05 }}
            whileTap={{ scale: 0.94 }}
            animate={active
              ? { boxShadow: `0 0 0 1.5px rgba(${rgb},0.65), 0 8px 20px -4px rgba(${rgb},0.28)` }
              : { boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-semibold"
            style={{
              background: active ? `rgba(${rgb},0.20)` : `rgba(15,40,98,0.18)`,
              border: active ? `1.5px solid rgba(${rgb},0.55)` : `1.5px solid rgba(255,255,255,0.06)`,
              color: active ? accentColor : '#4f5f76',
            }}
          >
            <span className="text-sm mb-0.5">{emoji}</span>
            <span>{label}</span>
            <span className="text-[8px] opacity-50 font-mono">{value}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function LogisticsStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    arrivalTime, departureTime, skipDay1,
    setArrivalTime, setDepartureTime,
  } = useOnboardingStore();

  // Early departure warning (< 10:00)
  const [depH = 12] = (departureTime ?? '').split(':').map(Number);
  const isEarlyDep = !!departureTime && depH < 10;

  // Both fields are optional — can always proceed
  const canContinue = true;

  return (
    <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex flex-col gap-5"
      >
        {/* Step badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: `rgba(158,54,58,0.15)`,
              color: PRIMARY,
              border: `1px solid rgba(158,54,58,0.30)`,
            }}
          >
            Step 3 of 4
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
            style={{ background: `rgba(15,40,98,0.22)`, color: '#4f5f76' }}
          >
            Logistics
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Time your trip<br />
            <span style={{ color: PRIMARY }}>perfectly.</span>
          </h2>
          <p className="mt-1.5 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            We&apos;ll schedule around your flights — no rushed check-ins or missed planes.
          </p>
        </div>

        {/* ── Arrival ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-4"
          style={{ background: `rgba(15,40,98,0.20)`, border: `1px solid rgba(158,54,58,0.15)`, boxShadow: '0 8px 32px -8px rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🛬</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PRIMARY }}>
              Day 1 — Arrival
            </span>
          </div>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white text-base font-mono font-bold outline-none mb-3 transition-all"
            style={{
              background: `rgba(9,31,54,0.50)`,
              border: `1.5px solid rgba(158,54,58,0.25)`,
              colorScheme: 'dark',
            }}
          />
          <TimeChips
            times={ARRIVAL_TIMES}
            selected={arrivalTime}
            accentColor={PRIMARY}
            onSelect={setArrivalTime}
          />

          {/* Late-arrival notice */}
          {skipDay1 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(158,54,58,0.12)`, border: `1px solid rgba(158,54,58,0.28)` }}
            >
              <span className="text-sm shrink-0">🌙</span>
              <div>
                <p className="text-xs font-bold" style={{ color: '#f87171' }}>Late arrival — Day 1 simplified</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4f5f76' }}>
                  Arriving after 18:00? Day 1 = hotel check-in + dinner only. Full schedule starts Day 2.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Departure ────────────────────────────────────────────────────── */}
        <div
          className="rounded-3xl p-4"
          style={{ background: `rgba(15,40,98,0.20)`, border: `1px solid rgba(74,123,222,0.15)`, boxShadow: '0 8px 32px -8px rgba(0,0,0,0.35)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🛫</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a7bde' }}>
              Last Day — Departure
            </span>
          </div>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white text-base font-mono font-bold outline-none mb-3 transition-all"
            style={{
              background: `rgba(9,31,54,0.50)`,
              border: `1.5px solid rgba(74,123,222,0.25)`,
              colorScheme: 'dark',
            }}
          />
          <TimeChips
            times={DEPARTURE_TIMES}
            selected={departureTime}
            accentColor="#f97316"
            onSelect={setDepartureTime}
          />

          {/* Early-departure notice */}
          {isEarlyDep && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(249,115,22,0.10)`, border: `1px solid rgba(249,115,22,0.28)` }}
            >
              <span className="text-sm shrink-0">⏰</span>
              <div>
                <p className="text-xs font-bold text-orange-400">Early flight</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4f5f76' }}>
                  Last day ends before {String(depH + 2).padStart(2, '0')}:00 — light morning itinerary only.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className="flex-1 py-4 rounded-full text-sm font-bold transition-colors hover-text-white"
            style={{ color: '#4f5f76', border: `1.5px solid rgba(255,255,255,0.07)`, background: 'transparent' }}
          >
            ← Back
          </motion.button>
          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="flex-[2] py-4 rounded-full text-sm font-black text-white tracking-wide"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_H})`,
              boxShadow: `0 0 40px rgba(158,54,58,0.45), 0 8px 24px -4px rgba(158,54,58,0.35)`,
            }}
          >
            Set Home Base →
          </motion.button>
        </div>

        {/* Skip hint */}
        <p className="text-center text-[10px]" style={{ color: 'rgba(79,95,118,0.6)' }}>
          Both fields are optional — you can skip and fill in later
        </p>
      </motion.div>
  );
}
