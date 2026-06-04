'use client';

import { motion } from 'framer-motion';
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
export function slotForDining(field: 'lunch' | 'dinner'): 'morning' | 'evening' {
  return field === 'lunch' ? 'morning' : 'evening';
}

// ── SwapTarget ────────────────────────────────────────────────────────────────

export interface SwapTarget {
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  diningField?: 'lunch' | 'dinner';
  currentName: string;
  neighborhood?: string;
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
      <div className="p-6 text-center text-sm text-[#888] bg-white rounded-2xl" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        No activities planned for this day yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {rows.map((row, i) => {
        const slot = row.type === 'activity'
          ? (row.slot as 'morning' | 'afternoon' | 'evening')
          : slotForDining(row.slot as 'lunch' | 'dinner');
        const diningField = row.type === 'dining' ? (row.slot as 'lunch' | 'dinner') : undefined;
        const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;
        const swapTarget: SwapTarget = { dayIndex, slot, diningField, currentName: row.name, neighborhood };

        return (
          <TimelineItem
            key={`${row.slot}-${i}`}
            row={row}
            isLast={i === rows.length - 1}
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
  row, isLast, destination, onExplore, onFindAlternative, onNeighborhoodClick,
}: {
  row: TimelineRow;
  isLast: boolean;
  destination: string;
  onExplore: () => void;
  onFindAlternative: () => void;
  onNeighborhoodClick: (n: string) => void;
}) {
  const isCheckIn = row.type === 'activity' && row.activity && isHotelCheckIn(row.activity);
  const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;
  const mapsUrl = buildMapsDirectionsUrl(row.name, neighborhood, destination);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
    >
      <span className="text-[13px] font-bold flex-shrink-0 w-[52px] pt-0.5" style={{ color: '#5aada5' }}>
        {row.time}
      </span>
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5" style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}>
        {row.emoji}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className="text-[13px] font-bold text-[#222]">{row.name}</span>
          {row.activity?.isHiddenGem && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}>
              💎 Hidden Gem
            </span>
          )}
        </div>
        {neighborhood && (
          <button type="button" onClick={() => onNeighborhoodClick(neighborhood)} className="text-[11px] text-[#5aada5] hover:underline mb-2 block text-left">
            📍 {neighborhood}
          </button>
        )}
        <div className="flex flex-wrap gap-1.5 items-center">
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
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-blue-50"
            style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
            </svg>
            Navigate
          </a>
        </div>
      </div>
    </div>
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
        ? { background: '#5aada5', color: '#fff', border: '1px solid #5aada5' }
        : { background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }}
    >
      {children}
    </motion.button>
  );
}
