'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { DayPlan } from '@/lib/types';

// ── Pure helper (exported for tests) ──────────────────────────────────────────

export function deriveDayBullets(day: DayPlan): string[] {
  const activityNames = [
    day.morning?.name,
    day.afternoon?.name,
    day.evening?.name,
  ].filter(Boolean) as string[];

  if (activityNames.length > 0) return activityNames.slice(0, 3);

  // Fallback: use dining spot names
  return [day.lunch?.name, day.dinner?.name].filter(Boolean) as string[];
}

// ── Component ──────────────────────────────────────────────────────────────────

interface ItineraryDayCardProps {
  day: DayPlan;
  dayNumber: number;   // 1-based display number
  isActive: boolean;
  totalDays: number;
  destination: string;
  onClick: () => void;
}

export function ItineraryDayCard({
  day,
  dayNumber,
  isActive,
  totalDays,
  destination,
  onClick,
}: ItineraryDayCardProps) {
  const bullets = deriveDayBullets(day);
  const photoQuery = `${destination} ${day.theme ?? 'travel'} landmark`;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.16)' }}
      whileTap={{ scale: 0.98 }}
      className="flex-shrink-0 cursor-pointer rounded-[20px] overflow-hidden bg-white"
      style={{
        minWidth: 'min(340px, calc(100vw - 80px))',
        maxWidth: 'min(360px, calc(100vw - 64px))',
        scrollSnapAlign: 'center',
        boxShadow: isActive
          ? '0 8px 32px rgba(90,173,165,0.35), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: isActive ? '2px solid rgba(90,173,165,0.4)' : '2px solid transparent',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <span className="text-[20px] font-black text-[#222] tracking-tight">
          DAY {dayNumber}
        </span>
        <span className="text-[15px] font-bold text-[#333] truncate ml-3 flex-1 text-right">
          {day.theme ?? `Day ${dayNumber} of ${totalDays}`}
        </span>
      </div>

      {/* Destination photo */}
      <div className="relative h-[190px] overflow-hidden">
        <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={190} />
      </div>

      {/* Activity bullets */}
      {bullets.length > 0 && (
        <ul
          className="px-4 py-3 border-b space-y-1.5"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          {bullets.map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-[#444]">
              <span className="text-[#5aada5] text-base leading-none flex-shrink-0">•</span>
              {b}
            </li>
          ))}
        </ul>
      )}

      {/* Footer: dot indicator + arrows */}
      <div className="flex items-center justify-between px-4 py-3">
        <DotIndicator current={dayNumber - 1} total={totalDays} />
        <div className="flex gap-2">
          <ArrowBtn disabled={dayNumber <= 1}>←</ArrowBtn>
          <ArrowBtn disabled={dayNumber >= totalDays}>→</ArrowBtn>
        </div>
      </div>
    </motion.div>
  );
}

function DotIndicator({ current, total }: { current: number; total: number }) {
  const MAX_DOTS = 7;
  const count = Math.min(total, MAX_DOTS);
  return (
    <div className="flex gap-[5px] items-center">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === current % count ? 10 : 7,
            height: i === current % count ? 10 : 7,
            background: i === current % count ? '#5aada5' : 'rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </div>
  );
}

function ArrowBtn({ children, disabled }: { children: string; disabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        border: '1px solid rgba(0,0,0,0.15)',
        color: disabled ? 'rgba(0,0,0,0.2)' : '#555',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </span>
  );
}
