'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
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
  const photoQuery = [row.name, neighborhood, destination].filter(Boolean).join(' ');

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
          <DayPhoto query={photoQuery} alt={row.name} height={164} dark />
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

        {/* Bottom: name + neighborhood over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
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
        ? { background: '#5aada5', color: '#fff', border: '1px solid #5aada5' }
        : { background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }}
    >
      {children}
    </motion.button>
  );
}
