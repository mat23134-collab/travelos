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

/** Ordered timeline rows: morning → lunch → afternoon → dinner → evening */
export function buildTimelineRows(day: DayPlan): TimelineRow[] {
  const rows: TimelineRow[] = [];

  if (day.morning) {
    rows.push({
      type: 'activity', slot: 'morning',
      name: day.morning.name ?? 'Morning activity',
      time: day.morning.startTime ?? day.morning.time_slot?.split('–')[0]?.trim() ?? 'Morning',
      emoji: day.morning.category_emoji ?? (isHotelCheckIn(day.morning) ? '🏨' : '☀️'),
      activity: day.morning,
    });
  }
  if (day.lunch) {
    rows.push({
      type: 'dining', slot: 'lunch',
      name: day.lunch.name ?? 'Lunch',
      time: 'Lunch',
      emoji: '🍽️',
      dining: day.lunch,
    });
  }
  if (day.afternoon) {
    rows.push({
      type: 'activity', slot: 'afternoon',
      name: day.afternoon.name ?? 'Afternoon activity',
      time: day.afternoon.startTime ?? day.afternoon.time_slot?.split('–')[0]?.trim() ?? 'Afternoon',
      emoji: day.afternoon.category_emoji ?? '🌤',
      activity: day.afternoon,
    });
  }
  if (day.dinner) {
    rows.push({
      type: 'dining', slot: 'dinner',
      name: day.dinner.name ?? 'Dinner',
      time: 'Dinner',
      emoji: '🍷',
      dining: day.dinner,
    });
  }
  if (day.evening) {
    rows.push({
      type: 'activity', slot: 'evening',
      name: day.evening.name ?? 'Evening activity',
      time: day.evening.startTime ?? day.evening.time_slot?.split('–')[0]?.trim() ?? 'Evening',
      emoji: day.evening.category_emoji ?? '🌙',
      activity: day.evening,
    });
  }

  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  ui: ItineraryUiStrings;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
}

export function DayTimeline({
  day, onSwapSlot, onNeighborhoodClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  dayIndex: _dayIndex, destination: _destination, ui: _ui,
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
      {rows.map((row, i) => (
        <TimelineItem
          key={`${row.slot}-${i}`}
          row={row}
          isLast={i === rows.length - 1}
          onSwap={() => {
            if (row.type === 'activity' &&
                (row.slot === 'morning' || row.slot === 'afternoon' || row.slot === 'evening')) {
              onSwapSlot(row.slot as 'morning' | 'afternoon' | 'evening');
            }
          }}
          onNeighborhoodClick={onNeighborhoodClick}
        />
      ))}
    </div>
  );
}

function TimelineItem({
  row, isLast, onSwap, onNeighborhoodClick,
}: {
  row: TimelineRow;
  isLast: boolean;
  onSwap: () => void;
  onNeighborhoodClick: (n: string) => void;
}) {
  const isCheckIn = row.type === 'activity' && row.activity && isHotelCheckIn(row.activity);
  const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Time */}
      <span
        className="text-[13px] font-bold flex-shrink-0 w-[52px] pt-0.5"
        style={{ color: '#5aada5' }}
      >
        {row.time}
      </span>

      {/* Icon */}
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5"
        style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}
      >
        {row.emoji}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className="text-[13px] font-bold text-[#222]">{row.name}</span>
          {row.activity?.isHiddenGem && (
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}
            >
              💎 Hidden Gem
            </span>
          )}
        </div>

        {neighborhood && (
          <button
            type="button"
            onClick={() => onNeighborhoodClick(neighborhood)}
            className="text-[11px] text-[#5aada5] hover:underline mb-2 block text-left"
          >
            📍 {neighborhood}
          </button>
        )}

        <div className="flex flex-wrap gap-1.5">
          {isCheckIn ? (
            <>
              <TlBtn onClick={() => {}}>Hotel Details</TlBtn>
              <TlBtn onClick={onSwap} primary>Change Hotel</TlBtn>
            </>
          ) : row.type === 'dining' ? (
            <>
              <TlBtn onClick={() => {}}>View Menu</TlBtn>
              <TlBtn onClick={() => {}}>Reservation</TlBtn>
              <TlBtn onClick={onSwap} primary>Find Alternative</TlBtn>
            </>
          ) : (
            <>
              <TlBtn onClick={() => {}}>Explore Details</TlBtn>
              <TlBtn onClick={onSwap} primary>Modify</TlBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TlBtn({
  children, onClick, primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
      style={
        primary
          ? { background: '#5aada5', color: '#fff', border: '1px solid #5aada5' }
          : { background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }
      }
    >
      {children}
    </motion.button>
  );
}
