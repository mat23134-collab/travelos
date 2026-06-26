'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { DayPlan } from '@/lib/types';

// ── Pure helper (exported for tests) ──────────────────────────────────────────

export function deriveDayBullets(day: DayPlan): string[] {
  // Chronological mix of activities AND dining so meals are visible in the
  // day summary too (dining marked with an emoji to distinguish it).
  const ordered: string[] = [];
  if (day.breakfast?.name) ordered.push(`☕ ${day.breakfast.name}`);
  if (day.morning?.name) ordered.push(day.morning.name);
  if (day.lunch?.name) ordered.push(`🍽️ ${day.lunch.name}`);
  if (day.afternoon?.name) ordered.push(day.afternoon.name);
  if (day.dinner?.name) ordered.push(`🍷 ${day.dinner.name}`);
  if (day.evening?.name) ordered.push(day.evening.name);
  return ordered.slice(0, 4);
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
  // Base the photo on a real landmark from THIS day (an English place name) so
  // every day gets a distinct, relevant image — and so it works for Hebrew
  // trips, where day.theme is Hebrew and Pexels can't match it (which made
  // every day fall back to the same generic photo). Vary the no-landmark
  // fallback by day so cards never look duplicated.
  const heroLandmark =
    day.morning?.name || day.afternoon?.name || day.evening?.name || '';
  const FALLBACK_SCENES = ['skyline', 'old town', 'street life', 'architecture', 'cityscape', 'historic center', 'rooftops'];
  const photoQuery = heroLandmark
    ? `${heroLandmark} ${destination}`
    : `${destination} ${FALLBACK_SCENES[(dayNumber - 1) % FALLBACK_SCENES.length]}`;
  const neighborhood =
    day.morning?.neighborhood ??
    day.afternoon?.neighborhood ??
    day.evening?.neighborhood;
  const title = day.theme ?? `Day ${dayNumber} of ${totalDays}`;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex-shrink-0 w-full cursor-pointer overflow-hidden rounded-[24px]"
      style={{
        scrollSnapAlign: 'start',
        background: 'var(--color-paper)',
        boxShadow: isActive
          ? '0 18px 44px rgba(184,119,46,0.30), 0 4px 14px rgba(0,0,0,0.12)'
          : 'var(--shadow-card)',
        outline: isActive
          ? '2.5px solid var(--color-sunrise-deep)'
          : '1px solid rgba(0,0,0,0.05)',
        outlineOffset: isActive ? '-2.5px' : '-1px',
      }}
    >
      {/* Full-bleed editorial photo */}
      <div className="relative h-[300px] overflow-hidden rounded-[24px]">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
          <DayPhoto
            query={photoQuery}
            alt={day.theme ?? destination}
            height={300}
            dark
          />
        </div>

        {/* Top row: Day N glass pill (start) + step counter (end) */}
        <div className="absolute top-3.5 inset-x-3.5 flex items-start justify-between">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white"
            style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}
          >
            Day {dayNumber}
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold text-white/90"
            style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(6px)' }}
          >
            {dayNumber} / {totalDays}
          </span>
        </div>

        {/* Bottom: serif title + neighborhood/theme over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="font-display text-white text-[22px] leading-tight drop-shadow">
            {title}
          </h3>
          {neighborhood && (
            <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-white/85 drop-shadow">
              📍 {neighborhood}
            </p>
          )}

          {/* Activity bullets over a soft tint */}
          {bullets.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-[12.5px] text-white/85 drop-shadow"
                >
                  <span
                    className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: 'var(--color-sunrise-deep)' }}
                  />
                  <span className="truncate">{b}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Footer: progress dots */}
          <div className="mt-3.5 flex items-center justify-between">
            <DotIndicator current={dayNumber - 1} total={totalDays} />
            <span className="text-[15px] text-white/80 transition-transform duration-300 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5">
              →
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DotIndicator({ current, total }: { current: number; total: number }) {
  const MAX_DOTS = 7;
  const count = Math.min(total, MAX_DOTS);
  return (
    <div className="flex items-center gap-[5px]">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === current % count ? 10 : 6,
            height: i === current % count ? 10 : 6,
            background:
              i === current % count
                ? 'var(--color-sunrise-deep)'
                : 'rgba(255,255,255,0.4)',
          }}
        />
      ))}
    </div>
  );
}
