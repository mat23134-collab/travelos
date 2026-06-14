'use client';

import { summarizeDay } from '@/lib/tripStory';
import type { DayPlan } from '@/lib/types';
import type { ItineraryUiStrings, TripUiLang } from '@/lib/tripUiCopy';

interface DaySummaryCardProps {
  day: DayPlan;
  dayIndex: number;
  ui: ItineraryUiStrings;
}

/**
 * Returns the sentences to show in the "Today's Plan" card: the AI-written
 * `day.daySummary` narrative when present and non-empty, otherwise the
 * deterministic `summarizeDay()` output (used by itineraries generated
 * before this field existed).
 */
export function getDaySummarySentences(day: DayPlan, dayIndex: number, lang: TripUiLang): string[] {
  const aiSummary = day.daySummary?.trim();
  if (aiSummary) return [aiSummary];
  return summarizeDay(day, dayIndex + 1, lang);
}

export function DaySummaryCard({ day, dayIndex, ui }: DaySummaryCardProps) {
  const sentences = getDaySummarySentences(day, dayIndex, ui.lang);
  if (sentences.length === 0) return null;

  return (
    <div className="px-4 py-3 rounded-2xl bg-white" style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
      <div className="text-[12px] font-bold text-[#222] mb-1">{ui.daySummaryTitle}</div>
      <p className="text-[12.5px] text-[#555] leading-relaxed">{sentences.join(' ')}</p>
    </div>
  );
}
