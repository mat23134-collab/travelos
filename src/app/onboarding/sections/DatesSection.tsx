'use client';

/**
 * DatesSection — Section 2 of the progressive onboarding flow.
 *
 * Combines:
 *   - Calendar range-picker (start / end dates)
 *   - Optional "Travel details" accordion (arrival + departure time chips)
 *
 * Everything on one surface — no separate pages.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const BLUE  = '#4a7bde';
const RED   = '#9e363a';
const RED2  = '#b5404a';
const MUTED = 'rgba(255,255,255,0.38)';

// ── Calendar helpers ──────────────────────────────────────────────────────────
function todayString() { return new Date().toISOString().slice(0, 10); }

function tripDuration(start: string, end: string) {
  if (!start || !end) return null;
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return days > 0 ? days : null;
}

function toDateObj(str: string) {
  if (!str) return null;
  const d = new Date(str + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}
function dateStr(d: Date) { return d.toISOString().slice(0, 10); }
function addDays(str: string, n: number) {
  const d = new Date(str + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return dateStr(d);
}
function fmt(str: string) {
  const d = toDateObj(str);
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—';
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
const PRESETS = [
  { label: '3 days', days: 3 },
  { label: '5 days', days: 5 },
  { label: '1 week', days: 7 },
  { label: '10 days', days: 10 },
  { label: '2 weeks', days: 14 },
];

// ── Arrival / Departure time chips ────────────────────────────────────────────
const ARRIVAL_OPTS = [
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '13:00', emoji: '☀️' },
  { label: 'Afternoon', value: '16:00', emoji: '🌤️' },
  { label: 'Evening',   value: '19:00', emoji: '🌆' },
  { label: 'Late',      value: '21:00', emoji: '🌙' },
  { label: 'Night',     value: '23:30', emoji: '🌃' },
];
const DEPARTURE_OPTS = [
  { label: 'Dawn',      value: '06:00', emoji: '🌄' },
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '12:00', emoji: '☀️' },
  { label: 'Afternoon', value: '15:00', emoji: '🌤️' },
  { label: 'Evening',   value: '18:00', emoji: '🌆' },
  { label: 'Night',     value: '22:00', emoji: '🌙' },
];

// ── Time chip ─────────────────────────────────────────────────────────────────
function TimeChip({ opt, selected, accent, onSelect }: {
  opt: { label: string; value: string; emoji: string };
  selected: boolean;
  accent: string;
  onSelect: () => void;
}) {
  const rgb = accent === BLUE ? '74,123,222' : '249,115,22';
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -2, scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      animate={selected
        ? { boxShadow: `0 0 0 1.5px rgba(${rgb},0.70)` }
        : { boxShadow: '0 2px 6px rgba(0,0,0,0.18)' }}
      className="flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-semibold"
      style={{
        background: selected ? `rgba(${rgb},0.22)` : 'rgba(15,40,98,0.18)',
        border: selected ? `1.5px solid rgba(${rgb},0.55)` : '1.5px solid rgba(255,255,255,0.06)',
        color: selected ? '#fff' : 'rgba(255,255,255,0.55)',
        minWidth: 52,
      }}
    >
      <span className="text-base mb-0.5">{opt.emoji}</span>
      {opt.label}
    </motion.button>
  );
}

// ── Calendar range picker ─────────────────────────────────────────────────────
function CalendarRangePicker({ startDate, endDate, onChange }: {
  startDate: string; endDate: string;
  onChange: (start: string, end: string) => void;
}) {
  const today = todayString();
  const initial = toDateObj(startDate) ?? new Date();
  const [viewYear, setViewYear]   = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());
  const [picking, setPicking]     = useState<'end' | null>(startDate ? 'end' : null);
  const [hoverDay, setHoverDay]   = useState<string | null>(null);

  const prevMonth = () => { if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); } else setViewMonth(m => m + 1); };

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dateStr(new Date(viewYear, viewMonth, i + 1))),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const handleDayClick = (day: string) => {
    if (day < today) return;
    if (!startDate || picking === null) { onChange(day, ''); setPicking('end'); }
    else if (picking === 'end') {
      if (day < startDate) { onChange(day, ''); setPicking('end'); }
      else if (day === startDate) { onChange('', ''); setPicking(null); }
      else { onChange(startDate, day); setPicking(null); }
    }
  };

  const rangeEnd = (picking === 'end' && hoverDay && startDate && hoverDay > startDate) ? hoverDay : (endDate || null);
  const isStart   = (d: string) => d === startDate;
  const isEnd     = (d: string) => d === rangeEnd && rangeEnd !== startDate;
  const isInRange = (d: string) => !!(startDate && rangeEnd && d > startDate && d < rangeEnd);
  const isPast    = (d: string) => d < today;
  const isToday   = (d: string) => d === today;

  return (
    <div className="rounded-2xl overflow-hidden select-none"
      style={{ background: 'rgba(15,40,98,0.30)', border: '1.5px solid rgba(74,123,222,0.20)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <button onClick={prevMonth} aria-label="Previous month"
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover-bg-subtle"
          style={{ color: 'rgba(255,255,255,0.50)' }}>‹</button>
        <span className="text-sm font-bold text-white">{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} aria-label="Next month"
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover-bg-subtle"
          style={{ color: 'rgba(255,255,255,0.50)' }}>›</button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest py-1"
            style={{ color: 'rgba(255,255,255,0.28)' }}>{d}</div>
        ))}
      </div>
      {/* Day cells */}
      <div className="grid grid-cols-7 px-2 pb-3">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />;
          const start = isStart(day), end = isEnd(day), inRange = isInRange(day);
          const past = isPast(day), tod = isToday(day);
          const col = idx % 7, isFirstCol = col === 0, isLastCol = col === 6;
          return (
            <div key={day} className="relative flex items-center justify-center" style={{ height: 38 }}
              onMouseEnter={() => picking === 'end' && setHoverDay(day)}
              onMouseLeave={() => setHoverDay(null)}>
              {inRange && (
                <div className="absolute inset-y-0" style={{ left: isFirstCol ? '50%' : 0, right: isLastCol ? '50%' : 0, background: 'rgba(74,123,222,0.15)' }} />
              )}
              {start && rangeEnd && rangeEnd !== startDate && (
                <div className="absolute inset-y-0" style={{ left: '50%', right: isLastCol ? '50%' : 0, background: 'rgba(74,123,222,0.15)' }} />
              )}
              {end && (
                <div className="absolute inset-y-0" style={{ right: '50%', left: isFirstCol ? '50%' : 0, background: 'rgba(74,123,222,0.15)' }} />
              )}
              <button
                onClick={() => handleDayClick(day)}
                disabled={past}
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all disabled:cursor-not-allowed"
                style={{
                  background: (start || end) ? BLUE : 'transparent',
                  color: (start || end) ? '#fff' : past ? 'rgba(255,255,255,0.18)' : tod ? BLUE : 'rgba(255,255,255,0.82)',
                  fontWeight: tod && !(start || end) ? 800 : 600,
                  boxShadow: (start || end) ? `0 0 14px rgba(74,123,222,0.55)` : 'none',
                }}
                onMouseEnter={e => { if (!past && !(start || end)) (e.currentTarget as HTMLElement).style.background = 'rgba(74,123,222,0.25)'; }}
                onMouseLeave={e => { if (!(start || end)) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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

// ── Reveal animation ─────────────────────────────────────────────────────────
const reveal = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  isCompleted: boolean;
  onComplete:  () => void;
  onEdit:      () => void;
}

// ── Section ───────────────────────────────────────────────────────────────────
export function DatesSection({ isCompleted, onComplete, onEdit }: Props) {
  const {
    startDate, endDate, setDateRange,
    arrivalTime, setArrivalTime,
    departureTime, setDepartureTime,
  } = useOnboardingStore();

  const [showDetails, setShowDetails] = useState(false);
  const duration = tripDuration(startDate, endDate);
  const canConfirm = !!(startDate && endDate);

  // ── Completed summary bar ────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(74,123,222,0.22)' }}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: BLUE }}>✓</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              {fmt(startDate)} → {fmt(endDate)}
            </span>
            {duration && (
              <>
                <span style={{ color: MUTED }} className="text-xs">·</span>
                <span className="text-xs font-medium" style={{ color: MUTED }}>{duration} nights</span>
              </>
            )}
            {arrivalTime && (
              <>
                <span style={{ color: MUTED }} className="text-xs">·</span>
                <span className="text-xs" style={{ color: MUTED }}>Arrives {arrivalTime}</span>
              </>
            )}
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
          style={{ background: BLUE }}>2</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">When?</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>Pick your travel dates</p>
        </div>
      </div>

      {/* Duration presets */}
      <div className="flex items-center gap-2 flex-wrap">
        {PRESETS.map(({ label, days }) => (
          <button
            key={label}
            onClick={() => {
              const base = startDate || todayString();
              setDateRange(base, addDays(base, days));
            }}
            className="text-xs px-3.5 py-1.5 rounded-full font-semibold transition-colors"
            style={{
              background: duration === days ? `rgba(74,123,222,0.22)` : 'rgba(255,255,255,0.06)',
              border: duration === days ? `1.5px solid rgba(74,123,222,0.50)` : '1.5px solid rgba(255,255,255,0.10)',
              color: duration === days ? '#a8c4f8' : 'rgba(255,255,255,0.60)',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Calendar */}
      <CalendarRangePicker
        startDate={startDate}
        endDate={endDate}
        onChange={setDateRange}
      />

      {/* Duration badge */}
      <AnimatePresence>
        {duration && (
          <motion.div key="dur" variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
            style={{ background: 'rgba(74,123,222,0.10)', border: '1px solid rgba(74,123,222,0.22)' }}>
            <span className="text-base">📅</span>
            <span className="text-sm font-semibold text-white">{duration} nights</span>
            <span className="text-xs ml-1" style={{ color: MUTED }}>
              {fmt(startDate)} — {fmt(endDate)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Travel details accordion */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <button
          onClick={() => setShowDetails(d => !d)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-left"
          style={{ color: showDetails ? '#fff' : 'rgba(255,255,255,0.55)' }}
        >
          <span className="flex items-center gap-2">
            <span>✈️</span>
            Travel details
            <span className="text-[10px] ml-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: MUTED }}>Optional</span>
          </span>
          <span
            className="transition-transform duration-200"
            style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)', color: MUTED }}
          >▾</span>
        </button>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              key="details"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ height: 0, opacity: 0, transition: { duration: 0.22 } }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                {/* Arrival */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                    Arrival time (first day)
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ARRIVAL_OPTS.map(opt => (
                      <TimeChip key={opt.value} opt={opt} selected={arrivalTime === opt.value}
                        accent={BLUE} onSelect={() => setArrivalTime(opt.value)} />
                    ))}
                  </div>
                </div>
                {/* Departure */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                    Departure time (last day)
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DEPARTURE_OPTS.map(opt => (
                      <TimeChip key={opt.value} opt={opt} selected={departureTime === opt.value}
                        accent="#f97316" onSelect={() => setDepartureTime(opt.value)} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA */}
      <AnimatePresence>
        {canConfirm && (
          <motion.div key="cta" variants={reveal} initial="hidden" animate="visible" exit="exit">
            <motion.button
              onClick={onComplete}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-full text-sm font-black text-white tracking-wide"
              style={{
                background: `linear-gradient(135deg, ${RED}, ${RED2})`,
                boxShadow: `0 0 40px rgba(158,54,58,0.42), 0 8px 24px -4px rgba(158,54,58,0.28)`,
              }}
            >
              {duration ? `Confirm ${duration}-night trip →` : 'Confirm dates →'}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
