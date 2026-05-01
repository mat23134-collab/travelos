'use client';

import { motion } from 'framer-motion';
import { DayPlan, Activity } from '@/lib/types';

interface TimelineEntry {
  slot: 'morning' | 'afternoon' | 'evening';
  activity: Activity;
  slotIcon: string;
  slotColor: string;
}

const SLOT_META = {
  morning:   { icon: '🌅', color: '#f59e0b' },
  afternoon: { icon: '☀️',  color: '#ff5a5f' },
  evening:   { icon: '🌙', color: '#8b5cf6' },
} as const;

function formatTimeSlot(activity: Activity, slot: string): string {
  if (activity.time_slot) return activity.time_slot;
  if (activity.startTime && activity.endTime) return `${activity.startTime} – ${activity.endTime}`;
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

export function DayTimeline({ day }: { day: DayPlan }) {
  const entries: TimelineEntry[] = (
    [
      day.morning   && { slot: 'morning'   as const, activity: day.morning,   ...SLOT_META.morning   },
      day.afternoon && { slot: 'afternoon' as const, activity: day.afternoon, ...SLOT_META.afternoon },
      day.evening   && { slot: 'evening'   as const, activity: day.evening,   ...SLOT_META.evening   },
    ] as (TimelineEntry | false)[]
  ).filter((e): e is TimelineEntry => Boolean(e));

  if (entries.length === 0) return null;

  return (
    <div className="relative py-1">
      {/* Vertical connector line */}
      <div
        className="absolute left-[17px] top-6 bottom-6 w-px pointer-events-none"
        style={{
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 60%, transparent 100%)',
        }}
      />

      <div className="flex flex-col gap-5">
        {entries.map(({ slot, activity, slotIcon, slotColor }, i) => (
          <motion.div
            key={slot}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, type: 'spring', stiffness: 380, damping: 28 }}
            className="flex items-start gap-3"
          >
            {/* Dot / emoji bubble */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-base flex-shrink-0 z-10 relative"
              style={{
                background: `${slotColor}18`,
                border: `1px solid ${slotColor}35`,
                boxShadow: `0 0 10px ${slotColor}20`,
              }}
            >
              {activity.category_emoji ?? slotIcon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              {/* Time badge */}
              <span
                className="inline-block text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md mb-1"
                style={{
                  background: `${slotColor}12`,
                  border: `1px solid ${slotColor}28`,
                  color: slotColor,
                }}
              >
                {formatTimeSlot(activity, slot)}
              </span>

              {/* Activity name */}
              <div className="font-semibold text-white/90 text-sm tracking-tight leading-snug">
                {activity.name}
              </div>

              {/* Neighborhood */}
              {activity.neighborhood && (
                <div className="text-[11px] text-white/38 mt-0.5">
                  📍 {activity.neighborhood}
                </div>
              )}

              {/* Transit note */}
              {activity.transitFromPrevious && i > 0 && (
                <div className="text-[10px] text-white/22 mt-1 flex items-center gap-1">
                  <span>🚶</span>
                  <span>{activity.transitFromPrevious} from previous</span>
                </div>
              )}

              {/* Duration pill */}
              {activity.duration && (
                <span className="inline-block text-[10px] text-white/30 mt-1">
                  ⏱ {activity.duration}
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
