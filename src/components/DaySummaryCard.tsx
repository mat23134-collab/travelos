'use client';

import { summarizeDay } from '@/lib/tripStory';
import type { DayPlan } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

interface DaySummaryCardProps {
  day: DayPlan;
  dayIndex: number;
  ui: ItineraryUiStrings;
}

export function DaySummaryCard({ day, dayIndex, ui }: DaySummaryCardProps) {
  const sentences = summarizeDay(day, dayIndex + 1, ui.lang);
  if (sentences.length === 0) return null;

  return (
    <div className="px-4 py-3 rounded-2xl bg-white" style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
      <div className="text-[12px] font-bold text-[#222] mb-1">{ui.daySummaryTitle}</div>
      <p className="text-[12.5px] text-[#555] leading-relaxed">{sentences.join(' ')}</p>
    </div>
  );
}
