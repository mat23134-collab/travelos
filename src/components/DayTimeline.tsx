'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import { tiktokSearchUrl, instagramSearchUrl } from '@/lib/socialSearch';
import { budgetToUsd } from '@/lib/currency';
import type { DayPlan, Activity, DiningSpot } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function isHotelCheckIn(activity: Pick<Activity, 'name'>): boolean {
  return /(check[- ]?in|hotel|accommodation)/i.test(activity.name ?? '');
}

export type TimelineRowType = 'activity' | 'dining';

export interface TimelineRow {
  type: TimelineRowType;
  slot: string;
  name: string;
  time: string;
  emoji: string;
  activity?: Activity;
  dining?: DiningSpot;
}

export function buildTimelineRows(day: DayPlan): TimelineRow[] {
  const rows: TimelineRow[] = [];
  if (day.breakfast) {
    rows.push({ type: 'dining', slot: 'breakfast', name: day.breakfast.name ?? 'Breakfast', time: 'Breakfast', emoji: '☕', dining: day.breakfast });
  }
  if (day.morning) {
    rows.push({ type: 'activity', slot: 'morning', name: day.morning.name ?? 'Morning activity', time: day.morning.startTime ?? day.morning.time_slot?.split('–')[0]?.trim() ?? 'Morning', emoji: day.morning.category_emoji ?? (isHotelCheckIn(day.morning) ? '🏨' : '☀️'), activity: day.morning });
  }
  if (day.lunch) {
    rows.push({ type: 'dining', slot: 'lunch', name: day.lunch.name ?? 'Lunch', time: 'Lunch', emoji: '🍽️', dining: day.lunch });
  }
  if (day.afternoon) {
    rows.push({ type: 'activity', slot: 'afternoon', name: day.afternoon.name ?? 'Afternoon activity', time: day.afternoon.startTime ?? day.afternoon.time_slot?.split('–')[0]?.trim() ?? 'Afternoon', emoji: day.afternoon.category_emoji ?? '🌤', activity: day.afternoon });
  }
  if (day.dinner) {
    rows.push({ type: 'dining', slot: 'dinner', name: day.dinner.name ?? 'Dinner', time: 'Dinner', emoji: '🍷', dining: day.dinner });
  }
  if (day.evening) {
    rows.push({ type: 'activity', slot: 'evening', name: day.evening.name ?? 'Evening activity', time: day.evening.startTime ?? day.evening.time_slot?.split('–')[0]?.trim() ?? 'Evening', emoji: day.evening.category_emoji ?? '🌙', activity: day.evening });
  }
  return rows;
}

/** Google Maps directions URL from current location to a named place. */
export function buildMapsDirectionsUrl(name: string, neighborhood: string | undefined, city: string): string {
  const dest = [name, neighborhood, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/** Map dining field to nearest activity slot for the swap API. */
export function slotForDining(field: 'breakfast' | 'lunch' | 'dinner'): 'morning' | 'evening' {
  if (field === 'breakfast') return 'morning';
  return field === 'lunch' ? 'morning' : 'evening';
}

// ── SwapTarget ────────────────────────────────────────────────────────────────

export interface SwapTarget {
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  diningField?: 'breakfast' | 'lunch' | 'dinner';
  currentName: string;
  neighborhood?: string;
}

/** Clear, human "what is this" label for a row: a meal name, Hotel, or Attraction. */
export function rowTypeLabel(row: TimelineRow): string {
  if (row.type === 'dining') return row.slot.charAt(0).toUpperCase() + row.slot.slice(1);
  if (row.activity && isHotelCheckIn(row.activity)) return 'Hotel';
  return 'Attraction';
}

/** Compact "day at a glance" text schedule — a scannable overview of the whole
 *  day (time · type · name) to complement the big image cards below. */
export function DayGlance({ day, title = 'Day at a glance' }: { day: DayPlan; title?: string }) {
  const rows = buildTimelineRows(day);
  if (rows.length === 0) return null;

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <h4 className="font-display text-[16px]" style={{ color: 'var(--color-ink-warm)' }}>{title}</h4>
        {day.estimatedDailyCost?.trim() && (
          <span
            className="text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap"
            style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-terracotta-deep)' }}
          >
            💰 {budgetToUsd(day.estimatedDailyCost)}
          </span>
        )}
      </div>
      <ol>
        {rows.map((row, i) => (
          <li
            key={`${row.slot}-${i}`}
            className="flex items-center gap-2.5 py-1.5"
            style={{ borderTop: i ? '1px solid rgba(43,38,34,0.07)' : 'none' }}
          >
            <span className="w-5 flex-shrink-0 text-center text-[14px]">{row.emoji}</span>
            <span className="w-[64px] flex-shrink-0 font-mono text-[11px]" style={{ color: 'var(--color-ink-warm-mut)' }}>{row.time}</span>
            <span className="flex-1 truncate text-[13px] font-medium" style={{ color: 'var(--color-ink-warm)' }}>{row.name}</span>
            <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--color-sunrise-deep)' }}>{rowTypeLabel(row)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  ui: ItineraryUiStrings;
  /** @deprecated — kept for backward compat while DayDetailPanel migrates to onFindAlternative */
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  onExplore?: (row: TimelineRow) => void;
  onFindAlternative?: (target: SwapTarget) => void;
}

export function DayTimeline({
  day, dayIndex, destination,
  onSwapSlot: _onSwapSlot,
  onNeighborhoodClick,
  onExplore = () => {},
  onFindAlternative = () => {},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ui: _ui,
}: DayTimelineProps) {
  const rows = buildTimelineRows(day);

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[#888] rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
        No activities planned for this day yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => {
        const slot = row.type === 'activity'
          ? (row.slot as 'morning' | 'afternoon' | 'evening')
          : slotForDining(row.slot as 'lunch' | 'dinner');
        const diningField = row.type === 'dining' ? (row.slot as 'breakfast' | 'lunch' | 'dinner') : undefined;
        const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;
        const swapTarget: SwapTarget = { dayIndex, slot, diningField, currentName: row.name, neighborhood };

        return (
          <TimelineItem
            key={`${row.slot}-${i}`}
            row={row}
            index={i}
            destination={destination}
            onExplore={() => onExplore(row)}
            onFindAlternative={() => onFindAlternative(swapTarget)}
            onNeighborhoodClick={onNeighborhoodClick}
          />
        );
      })}
    </div>
  );
}

function TimelineItem({
  row, index, destination, onExplore, onFindAlternative, onNeighborhoodClick,
}: {
  row: TimelineRow;
  index: number;
  destination: string;
  onExplore: () => void;
  onFindAlternative: () => void;
  onNeighborhoodClick: (n: string) => void;
}) {
  const isCheckIn = row.type === 'activity' && row.activity && isHotelCheckIn(row.activity);
  const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;
  const mapsUrl = buildMapsDirectionsUrl(row.name, neighborhood, destination);
  // Dining: a cinematic cuisine/atmosphere shot of the destination — NOT the specific
  // restaurant (those photos are generic/poor). Activities: the actual place photo.
  const photoQuery = row.type === 'dining'
    ? [destination, row.dining?.cuisine, 'cuisine food cinematic'].filter(Boolean).join(' ')
    : [row.name, neighborhood, destination].filter(Boolean).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: Math.min(index, 5) * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
      className="rounded-2xl overflow-hidden group"
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Photo header */}
      <div className="relative h-[164px] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
          <DayPhoto query={photoQuery} alt={row.name} ratio="3/2" dark />
        </div>

        {/* Top row: time + emoji (start), Hidden Gem (end) */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-start justify-between">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
            style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}
          >
            <span>{row.emoji}</span>{row.time}
          </span>
          {row.activity?.isHiddenGem && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black text-white" style={{ background: 'rgba(184,119,46,0.92)' }}>
              💎 Hidden Gem
            </span>
          )}
        </div>

        {/* Bottom: type tag + name + neighborhood over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          <span
            className="inline-block mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white"
            style={{ background: 'rgba(184,119,46,0.92)' }}
          >
            {rowTypeLabel(row)}
          </span>
          <h4 className="font-display text-white text-lg sm:text-xl leading-tight drop-shadow">{row.name}</h4>
          {neighborhood && (
            <button
              type="button"
              onClick={() => onNeighborhoodClick(neighborhood)}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-white/85 hover:text-white"
            >
              📍 {neighborhood}
            </button>
          )}
        </div>
      </div>

      {/* Actions on warm paper */}
      <div className="flex flex-wrap gap-1.5 items-center p-3">
        {isCheckIn ? (
          <>
            <TlBtn onClick={onExplore}>Hotel Details</TlBtn>
            <TlBtn onClick={onFindAlternative} primary>Change Hotel</TlBtn>
          </>
        ) : row.type === 'dining' ? (
          <>
            <TlBtn onClick={onFindAlternative} primary>Find Alternative</TlBtn>
            <TlBtn onClick={onExplore}>Explore Details</TlBtn>
          </>
        ) : (
          <>
            <TlBtn onClick={onFindAlternative} primary>Modify</TlBtn>
            <TlBtn onClick={onExplore}>Explore Details</TlBtn>
          </>
        )}
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors hover:bg-blue-50"
          style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
          </svg>
          Navigate
        </a>

        {/* See it on social — jump to short-form video/photos of this place */}
        <a
          href={tiktokSearchUrl(row.name, destination)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Watch ${row.name} on TikTok`}
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white transition-transform hover:-translate-y-0.5"
          style={{ background: '#000' }}
        >
          🎵 TikTok
        </a>
        <a
          href={instagramSearchUrl(row.name, destination)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`See ${row.name} on Instagram`}
          className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg text-white transition-transform hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg,#f9ce34 0%,#ee2a7b 50%,#6228d7 100%)' }}
        >
          📷 Instagram
        </a>
      </div>
    </motion.div>
  );
}

function TlBtn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
      style={primary
        ? { background: '#b8552e', color: '#fff', border: '1px solid #b8552e' }
        : { background: '#f6e7df', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)' }}
    >
      {children}
    </motion.button>
  );
}
