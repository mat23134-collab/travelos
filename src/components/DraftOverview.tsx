'use client';

import { useState, useMemo } from 'react';
import { Itinerary, Activity, DayPlan } from '@/lib/types';
import type { SwapResult } from '@/app/api/swap/route';
import { draftSlotUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { TripStoryCube } from '@/components/TripStoryCube';
import { ITIN_RESULTS_PAGE_BG, ITIN_RESULTS_NOISE_DATA_URL } from '@/lib/itineraryResultsPalette';

const SLOT_ICONS = {
  morning: '🌅',
  afternoon: '☀️',
  evening: '🌙',
} as const;

type Slot = keyof typeof SLOT_ICONS;

// ─── Single slot row ──────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: Slot;
  activity: Activity | null | undefined;
  onRefresh: (prompt?: string) => void;
  swapping: boolean;
  justSwapped: boolean;
  slotUi: ReturnType<typeof draftSlotUi>;
  ui: ItineraryUiStrings;
}

function SlotRow({ slot, activity, onRefresh, swapping, justSwapped, slotUi, ui }: SlotRowProps) {
  const icon = SLOT_ICONS[slot];
  const label = slotUi[slot].label;
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const handleQuickSwap = () => {
    setPromptOpen(false);
    onRefresh(promptText.trim() || undefined);
    setPromptText('');
  };

  // Activity missing entirely
  if (!activity) {
    return (
      <div
        className="rounded-xl border border-dashed px-3.5 py-3 flex items-center gap-2"
        style={{ borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)' }}
      >
        <span className="text-base flex-shrink-0 opacity-30">{icon}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{label} {slotUi[slot].notPlanned}</span>
      </div>
    );
  }

  return (
    <div
      className="group relative rounded-xl border transition-all duration-200"
      style={
        justSwapped
          ? { borderColor: 'rgba(16,185,129,0.40)', background: 'rgba(16,185,129,0.08)' }
          : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(45,84,94,0.28)' }
      }
    >
      <div className="flex items-start gap-3 p-3.5">
        <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {label}
            </span>
            {activity?.startTime && (
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ color: '#c05060', background: 'rgba(201,168,76,0.12)' }}
              >
                {activity.startTime}
              </span>
            )}
            {justSwapped && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                {slotUi[slot].swapped}
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-white leading-tight">{activity?.name ?? 'Activity TBD'}</p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>📍 {activity?.neighborhood ?? '—'}</p>
        </div>

        {/* Swap controls */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <button
            onClick={() => setPromptOpen((o) => !o)}
            disabled={swapping}
            title="Swap this activity"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = '#a89254';
              (e.currentTarget as HTMLElement).style.color = '#c05060';
              (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.10)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.10)';
              (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }}
          >
            {swapping
              ? <span className="w-3 h-3 rounded-full border border-t-[#a89254] border-[#a89254]/30 animate-spin" />
              : '↻'
            }
            {swapping ? ui.draftSwapping : ui.draftSwap}
          </button>
        </div>
      </div>

      {/* Inline prompt input */}
      {promptOpen && !swapping && (
        <div className="border-t px-3.5 pb-3 pt-2.5 flex gap-2"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickSwap()}
            placeholder={ui.draftSwapPlaceholder}
            autoFocus
            className="flex-1 text-xs px-3 py-2 rounded-lg border focus:outline-none text-white"
            style={{
              borderColor: 'rgba(255,255,255,0.10)',
              background: 'rgba(255,255,255,0.06)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#a89254'; }}
            onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; }}
          />
          <button
            onClick={handleQuickSwap}
            className="text-xs px-3 py-2 rounded-lg text-white font-semibold transition-colors"
            style={{ background: '#a89254' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#b8a066')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#a89254')}
          >
            {ui.draftGo}
          </button>
          <button
            onClick={() => setPromptOpen(false)}
            className="text-xs px-2 py-2 rounded-lg border transition-colors"
            style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.38)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.70)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.38)')}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Day column ───────────────────────────────────────────────────────────────

interface DayColumnProps {
  day: DayPlan;
  dayIndex: number;
  swappingKey: string | null;
  swappedKeys: Set<string>;
  onSwap: (dayIndex: number, slot: Slot, request?: string) => void;
  slotUi: ReturnType<typeof draftSlotUi>;
  ui: ItineraryUiStrings;
}

function DayColumn({ day, dayIndex, swappingKey, swappedKeys, onSwap, slotUi, ui }: DayColumnProps) {
  if (!day) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
          style={{ background: '#a89254' }}
        >
          {dayIndex + 1}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-white truncate">{day.theme ?? `Day ${dayIndex + 1}`}</div>
          <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.38)' }}>{day.date ?? ''}</div>
        </div>
      </div>

      {(['morning', 'afternoon', 'evening'] as Slot[]).map((slot) => {
        const key = `${dayIndex}-${slot}`;
        return (
          <SlotRow
            key={slot}
            slot={slot}
            activity={day[slot]}
            swapping={swappingKey === key}
            justSwapped={swappedKeys.has(key)}
            onRefresh={(request) => onSwap(dayIndex, slot, request)}
            slotUi={slotUi}
            ui={ui}
          />
        );
      })}
    </div>
  );
}

// ─── Main DraftOverview ───────────────────────────────────────────────────────

interface Props {
  itinerary: Itinerary;
  onUpdate: (updated: Itinerary) => void;
  onFinalize: () => void;
  ui: ItineraryUiStrings;
}

export function DraftOverview({ itinerary, onUpdate, onFinalize, ui }: Props) {
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [swappedKeys, setSwappedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [tripStoryOpen, setTripStoryOpen] = useState(false);

  const handleSwap = async (dayIndex: number, slot: Slot, request?: string) => {
    const key = `${dayIndex}-${slot}`;
    setSwappingKey(key);
    setError('');

    try {
      const res = await fetch('/api/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary,
          dayIndex,
          slot,
          request: request ?? `Suggest a better ${slot} activity`,
        }),
      });

      const data: SwapResult & { error?: string } = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');

      const updatedDays = itinerary.days.map((day, i) => {
        if (i !== dayIndex) return day;
        return { ...day, [slot]: data.activity };
      });

      onUpdate({ ...itinerary, days: updatedDays });
      setSwappedKeys((prev) => new Set([...prev, key]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Swap failed — try again');
    } finally {
      setSwappingKey(null);
    }
  };

  const totalSwaps = swappedKeys.size;
  const slotUi = useMemo(() => draftSlotUi(ui.lang), [ui.lang]);

  return (
    <div className="min-h-screen relative" style={{ background: ITIN_RESULTS_PAGE_BG }} dir={ui.dir} lang={ui.htmlLang}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.02]"
        style={{
          backgroundImage: `url(${ITIN_RESULTS_NOISE_DATA_URL})`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'overlay',
        }}
      />
      <div className="relative z-[1]">
        {/* Draft header */}
      <div
        className="sticky top-0 z-40 border-b backdrop-blur-sm"
        style={{ background: 'rgba(18,52,59,0.92)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-bold text-white">{ui.draftReviewTitle}</span>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>
                — {itinerary.destination ?? '—'}, {itinerary.totalDays ?? '?'} days
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
              {ui.draftInstructions(totalSwaps)}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTripStoryOpen(true)}
              disabled={!!swappingKey}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl disabled:opacity-40 text-white font-semibold text-xs sm:text-sm transition-all border whitespace-nowrap"
              style={{
                borderColor: 'rgba(255,255,255,0.14)',
                background: 'rgba(255,255,255,0.06)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.10)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
              }}
            >
              {ui.tripStoryButton}
            </button>
            <button
              onClick={onFinalize}
              disabled={!!swappingKey}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl disabled:opacity-40 text-white font-semibold text-sm transition-all duration-150 hover:-translate-y-0.5 whitespace-nowrap"
              style={{
                background: '#a89254',
                boxShadow: '0 4px 16px -4px rgba(201,168,76,0.35)',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#b8a066')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#a89254')}
            >
              {ui.looksGood}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Strategic overview */}
        <div
          className="rounded-2xl px-5 py-4 mb-6"
          style={{ background: 'rgba(45,84,94,0.38)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <div className="text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: '#a89254' }}>
            {ui.aiStrategy}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.70)' }}>
            {itinerary.strategicOverview ?? 'Generating your plan…'}
          </p>
        </div>

        {error && (
          <div
            className="mb-4 px-4 py-3 rounded-xl text-sm"
            style={{
              background: 'rgba(201,168,76,0.12)',
              border: '1px solid rgba(201,168,76,0.28)',
              color: '#ff8c8f',
            }}
          >
            {error}
          </div>
        )}

        {/* Day grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itinerary.days.map((day, i) => (
            <DayColumn
              key={day.day}
              day={day}
              dayIndex={i}
              swappingKey={swappingKey}
              swappedKeys={swappedKeys}
              onSwap={handleSwap}
              slotUi={slotUi}
              ui={ui}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onFinalize}
            disabled={!!swappingKey}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl disabled:opacity-40 text-white font-semibold transition-all duration-150 hover:-translate-y-0.5"
            style={{
              background: '#a89254',
              boxShadow: '0 8px 28px -4px rgba(201,168,76,0.35)',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#b8a066')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#a89254')}
          >
            {ui.finalizeItinerary}
          </button>
          <p className="text-xs mt-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {ui.finalizeHint}
          </p>
        </div>
      </div>

      <TripStoryCube
        open={tripStoryOpen}
        onClose={() => setTripStoryOpen(false)}
        itinerary={itinerary}
        ui={ui}
      />
      </div>
    </div>
  );
}
