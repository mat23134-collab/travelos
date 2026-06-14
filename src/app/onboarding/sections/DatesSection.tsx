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
import { THEME, CARD } from '@/lib/onboardingTheme';
import { Sunrise, Sun, Sunset, Moon, MoonStar, Plane, CalendarDays } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ── Calendar helpers ──────────────────────────────────────────────────────────
// Format a Date as YYYY-MM-DD using its LOCAL calendar fields. Using
// toISOString() here would convert to UTC first, shifting the date back a
// day in any positive-offset timezone (e.g. Israel UTC+2/+3) — which made
// the calendar render every day one column too far right.
function dateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayString() { return dateStr(new Date()); }

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
const ARRIVAL_OPTS: { label: string; value: string; icon: LucideIcon }[] = [
  { label: 'Morning',   value: '09:00', icon: Sunrise },
  { label: 'Midday',    value: '13:00', icon: Sun },
  { label: 'Afternoon', value: '16:00', icon: Sunset },
  { label: 'Evening',   value: '19:00', icon: Moon },
  { label: 'Late',      value: '21:00', icon: Moon },
  { label: 'Night',     value: '23:30', icon: MoonStar },
];
const DEPARTURE_OPTS: { label: string; value: string; icon: LucideIcon }[] = [
  { label: 'Dawn',      value: '06:00', icon: Sunrise },
  { label: 'Morning',   value: '09:00', icon: Sunrise },
  { label: 'Midday',    value: '12:00', icon: Sun },
  { label: 'Afternoon', value: '15:00', icon: Sunset },
  { label: 'Evening',   value: '18:00', icon: Moon },
  { label: 'Night',     value: '22:00', icon: MoonStar },
];

// ── Time chip ─────────────────────────────────────────────────────────────────
function TimeChip({ opt, selected, onSelect }: {
  opt: { label: string; value: string; icon: LucideIcon };
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = opt.icon;
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -2, scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
      className="flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-semibold transition-colors"
      style={{
        ...(selected ? CARD.selected : CARD.base),
        color: selected ? THEME.deepGreen : THEME.textMuted,
        minWidth: 52,
      }}
    >
      <Icon size={18} strokeWidth={1.75} className="mb-0.5" style={{ color: selected ? THEME.gold : THEME.textMuted }} />
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
      style={{ background: THEME.surface, border: `1.5px solid ${THEME.border}` }}>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: THEME.border }}>
        <button onClick={prevMonth} aria-label="Previous month"
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover-bg-subtle"
          style={{ color: THEME.textMuted }}>‹</button>
        <span className="text-sm font-bold" style={{ color: THEME.deepGreen }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} aria-label="Next month"
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm hover-bg-subtle"
          style={{ color: THEME.textMuted }}>›</button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest py-1"
            style={{ color: THEME.textFaint }}>{d}</div>
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
                <div className="absolute inset-y-0" style={{ left: isFirstCol ? '50%' : 0, right: isLastCol ? '50%' : 0, background: THEME.surfaceSel }} />
              )}
              {start && rangeEnd && rangeEnd !== startDate && (
                <div className="absolute inset-y-0" style={{ left: '50%', right: isLastCol ? '50%' : 0, background: THEME.surfaceSel }} />
              )}
              {end && (
                <div className="absolute inset-y-0" style={{ right: '50%', left: isFirstCol ? '50%' : 0, background: THEME.surfaceSel }} />
              )}
              <button
                onClick={() => handleDayClick(day)}
                disabled={past}
                className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all disabled:cursor-not-allowed"
                style={{
                  background: (start || end) ? THEME.gold : 'transparent',
                  color: (start || end) ? '#fff' : past ? THEME.textFaint : tod ? THEME.gold : THEME.textBody,
                  fontWeight: tod && !(start || end) ? 800 : 600,
                }}
                onMouseEnter={e => { if (!past && !(start || end)) (e.currentTarget as HTMLElement).style.background = THEME.surfaceSel; }}
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
  // ── Completed summary bar ────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={CARD.base}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: THEME.textBody }}>
              {fmt(startDate)} → {fmt(endDate)}
            </span>
            {duration && (
              <>
                <span style={{ color: THEME.textMuted }} className="text-xs">·</span>
                <span className="text-xs font-medium" style={{ color: THEME.textMuted }}>{duration} nights</span>
              </>
            )}
            {arrivalTime && (
              <>
                <span style={{ color: THEME.textMuted }} className="text-xs">·</span>
                <span className="text-xs" style={{ color: THEME.textMuted }}>Arrives {arrivalTime}</span>
              </>
            )}
          </div>
        </div>
        <button onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle"
          style={{ color: THEME.textMuted, border: `1px solid ${THEME.border}` }}>
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ──────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-5">

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
              background: duration === days ? THEME.surfaceSel : THEME.surface,
              border: duration === days ? `1.5px solid ${THEME.borderSel}` : `1.5px solid ${THEME.border}`,
              color: duration === days ? THEME.gold : THEME.textMuted,
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
            style={CARD.base}>
            <CalendarDays size={16} strokeWidth={1.75} style={{ color: THEME.textMuted }} className="shrink-0" />
            <span className="text-sm font-semibold" style={{ color: THEME.textBody }}>{duration} nights</span>
            <span className="text-xs ml-1" style={{ color: THEME.textMuted }}>
              {fmt(startDate)} — {fmt(endDate)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Travel details accordion */}
      <div className="rounded-2xl overflow-hidden"
        style={CARD.base}>
        <button
          onClick={() => setShowDetails(d => !d)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-left"
          style={{ color: showDetails ? THEME.textBody : THEME.textMuted }}
        >
          <span className="flex items-center gap-2">
            <Plane size={16} strokeWidth={1.75} style={{ color: THEME.textMuted }} />
            Travel details
            <span className="text-[10px] ml-1 px-2 py-0.5 rounded-full" style={{ background: THEME.surfaceSel, color: THEME.textMuted }}>Optional</span>
          </span>
          <span
            className="transition-transform duration-200"
            style={{ transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)', color: THEME.textMuted }}
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
              <div className="px-4 pb-4 pt-1 flex flex-col gap-4 border-t" style={{ borderColor: THEME.border }}>
                {/* Arrival */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: THEME.textMuted }}>
                    Arrival time (first day)
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {ARRIVAL_OPTS.map(opt => (
                      <TimeChip key={opt.value} opt={opt} selected={arrivalTime === opt.value}
                        onSelect={() => setArrivalTime(opt.value)} />
                    ))}
                  </div>
                </div>
                {/* Departure */}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: THEME.textMuted }}>
                    Departure time (last day)
                  </p>
                  <div className="flex gap-1.5 flex-wrap">
                    {DEPARTURE_OPTS.map(opt => (
                      <TimeChip key={opt.value} opt={opt} selected={departureTime === opt.value}
                        onSelect={() => setDepartureTime(opt.value)} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
