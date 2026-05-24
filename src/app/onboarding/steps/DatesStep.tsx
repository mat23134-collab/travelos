'use client';

/**
 * DatesStep — Step 2 of 4 in the onboarding flow.
 *
 * Single inline calendar range-picker: click departure, click return.
 * Palette: Blue-steel (#4a7bde) accent on Purple Shadow bg.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT   = '#4a7bde';
const ACCENT_H = '#5a8bee';
const GOLD     = '#c5912a';

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function tripDuration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : null;
}

function toDateObj(str: string): Date | null {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(str: string, days: number): string {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

// ── Calendar Range Picker ─────────────────────────────────────────────────────
function CalendarRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = todayString();

  // Which month is shown
  const initialDate = toDateObj(startDate) ?? new Date();
  const [viewYear, setViewYear]   = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  // Picking state: null = pick start next, 'start' = start chosen, wait for end
  const [picking, setPicking] = useState<'end' | null>(startDate ? 'end' : null);
  const [hoverDay, setHoverDay] = useState<string | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // Build the day grid for this month
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(viewYear, viewMonth, i + 1);
      return dateStr(d);
    }),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (day: string) => {
    if (day < today) return; // past dates disabled
    if (!startDate || picking === null) {
      // Start fresh: set start, wait for end
      onChange(day, '');
      setPicking('end');
    } else if (picking === 'end') {
      if (day < startDate) {
        // Clicked before start → restart with new start
        onChange(day, '');
        setPicking('end');
      } else if (day === startDate) {
        // Same day — reset
        onChange('', '');
        setPicking(null);
      } else {
        onChange(startDate, day);
        setPicking(null);
      }
    }
  };

  // Visual range (preview with hover)
  const rangeStart = startDate || null;
  const rangeEnd   = (picking === 'end' && hoverDay && startDate && hoverDay > startDate)
    ? hoverDay
    : (endDate || null);

  const isStart   = (d: string) => d === rangeStart;
  const isEnd     = (d: string) => d === rangeEnd && rangeEnd !== rangeStart;
  const isInRange = (d: string) =>
    rangeStart && rangeEnd && d > rangeStart && d < rangeEnd;
  const isPast    = (d: string) => d < today;
  const isToday   = (d: string) => d === today;

  return (
    <div
      className="rounded-2xl overflow-hidden select-none"
      style={{
        background: 'rgba(15,40,98,0.30)',
        border: '1.5px solid rgba(74,123,222,0.20)',
      }}
    >
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button
          onClick={prevMonth}
          aria-label="Previous month"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm"
          style={{ color: 'rgba(255,255,255,0.50)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ‹
        </button>
        <span className="text-sm font-bold text-white tracking-wide">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          onClick={nextMonth}
          aria-label="Next month"
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors text-sm"
          style={{ color: 'rgba(255,255,255,0.50)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2 pb-0">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest py-1" style={{ color: 'rgba(255,255,255,0.28)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />;
          const start  = isStart(day);
          const end    = isEnd(day);
          const inRange = isInRange(day);
          const past   = isPast(day);
          const tod    = isToday(day);
          const col = idx % 7;
          const isFirstCol = col === 0;
          const isLastCol  = col === 6;

          return (
            <div
              key={day}
              className="relative flex items-center justify-center"
              style={{ height: 40 }}
              onMouseEnter={() => picking === 'end' && setHoverDay(day)}
              onMouseLeave={() => setHoverDay(null)}
            >
              {/* Range strip background */}
              {inRange && (
                <div
                  className="absolute inset-y-0"
                  style={{
                    left: isFirstCol ? '50%' : 0,
                    right: isLastCol  ? '50%' : 0,
                    background: 'rgba(74,123,222,0.15)',
                  }}
                />
              )}
              {/* Cap strips for start/end */}
              {start && rangeEnd && rangeEnd !== rangeStart && (
                <div
                  className="absolute inset-y-0"
                  style={{ left: '50%', right: isLastCol ? '50%' : 0, background: 'rgba(74,123,222,0.15)' }}
                />
              )}
              {end && (
                <div
                  className="absolute inset-y-0"
                  style={{ right: '50%', left: isFirstCol ? '50%' : 0, background: 'rgba(74,123,222,0.15)' }}
                />
              )}

              {/* Day circle */}
              <button
                onClick={() => handleDayClick(day)}
                disabled={past}
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all disabled:cursor-not-allowed"
                style={{
                  background: (start || end)
                    ? ACCENT
                    : 'transparent',
                  color: (start || end)
                    ? '#fff'
                    : past
                      ? 'rgba(255,255,255,0.18)'
                      : tod
                        ? ACCENT
                        : 'rgba(255,255,255,0.82)',
                  fontWeight: tod && !(start || end) ? 800 : 600,
                  boxShadow: (start || end) ? `0 0 14px rgba(74,123,222,0.55)` : 'none',
                }}
                onMouseEnter={e => {
                  if (!past && !(start || end)) {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(74,123,222,0.25)';
                  }
                }}
                onMouseLeave={e => {
                  if (!(start || end)) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {new Date(day + 'T00:00:00').getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

const PRESETS = [
  { label: '3 days',  days: 3 },
  { label: '5 days',  days: 5 },
  { label: '7 days',  days: 7 },
  { label: '10 days', days: 10 },
  { label: '2 weeks', days: 14 },
];

export function DatesStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { destination, startDate, endDate, setDateRange } = useOnboardingStore();
  const duration = tripDuration(startDate, endDate);
  const hasRange = duration !== null;
  const canContinue = hasRange;

  const applyPreset = (days: number) => {
    const start = startDate || todayString();
    setDateRange(start, addDays(start, days));
  };

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
            background: `rgba(74,123,222,0.15)`,
            color: ACCENT,
            border: `1px solid rgba(74,123,222,0.30)`,
          }}
        >
          Step 2 of 4
        </span>
      </div>

      {/* Heading */}
      <div>
        <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
          When are you<br />
          <span style={{ color: ACCENT }}>
            {destination ? `in ${destination}?` : 'traveling?'}
          </span>
        </h2>
        <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
          Tap your departure, then your return date.
        </p>
      </div>

      {/* Instruction / selection summary */}
      <div className="flex items-center gap-3">
        <div
          className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold"
          style={{
            background: startDate ? 'rgba(74,123,222,0.18)' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${startDate ? 'rgba(74,123,222,0.45)' : 'rgba(255,255,255,0.08)'}`,
            color: startDate ? '#fff' : 'rgba(255,255,255,0.30)',
          }}
        >
          {startDate
            ? new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : '— Departure'}
        </div>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 18 }}>→</span>
        <div
          className="flex-1 rounded-xl px-3 py-2 text-center text-sm font-semibold"
          style={{
            background: endDate ? `rgba(197,145,42,0.18)` : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${endDate ? 'rgba(197,145,42,0.45)' : 'rgba(255,255,255,0.08)'}`,
            color: endDate ? '#fff' : 'rgba(255,255,255,0.30)',
          }}
        >
          {endDate
            ? new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : '— Return'}
        </div>
      </div>

      {/* Single calendar */}
      <CalendarRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={(s, e) => setDateRange(s, e)}
      />

      {/* Duration badge */}
      <AnimatePresence>
        {hasRange && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-center py-1"
          >
            <span className="text-2xl font-black" style={{ color: ACCENT }}>{duration}</span>
            <span className="text-sm ml-1.5" style={{ color: '#4f5f76' }}>
              {duration === 1 ? 'day' : 'days'} · perfect for a deep dive
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-fill chips */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4f5f76' }}>
          Quick fill
        </p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ label, days }) => {
            const active = duration === days;
            return (
              <motion.button
                key={label}
                onClick={() => applyPreset(days)}
                whileTap={{ scale: 0.94 }}
                animate={active
                  ? { boxShadow: `0 0 0 1.5px rgba(74,123,222,0.70), 0 8px 24px -4px rgba(74,123,222,0.30)` }
                  : { boxShadow: '0 2px 8px rgba(0,0,0,0.20)' }}
                transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{
                  background: active ? `rgba(74,123,222,0.22)` : `rgba(15,40,98,0.20)`,
                  border: active ? `1.5px solid rgba(74,123,222,0.55)` : `1.5px solid rgba(255,255,255,0.07)`,
                  color: active ? ACCENT : '#4f5f76',
                }}
              >
                {label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <motion.button
          onClick={onBack}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 24 }}
          className="flex-1 py-4 rounded-full text-sm font-bold transition-colors"
          style={{ color: '#4f5f76', border: `1.5px solid rgba(255,255,255,0.07)`, background: 'transparent' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#4f5f76')}
        >
          ← Back
        </motion.button>
        <motion.button
          onClick={onNext}
          disabled={!canContinue}
          whileHover={canContinue ? { scale: 1.02, y: -2 } : {}}
          whileTap={canContinue ? { scale: 0.97 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="flex-[2] py-4 rounded-full text-sm font-black text-white tracking-wide disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            background: canContinue
              ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_H})`
              : `rgba(255,255,255,0.06)`,
            boxShadow: canContinue
              ? `0 0 40px rgba(74,123,222,0.45), 0 8px 24px -4px rgba(74,123,222,0.35)`
              : 'none',
          }}
        >
          {canContinue ? `${duration} days — Let's go →` : 'Pick your dates'}
        </motion.button>
      </div>
    </motion.div>
  );
}
