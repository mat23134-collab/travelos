'use client';

import { useState } from 'react';
import { Itinerary, Activity, DayPlan } from '@/lib/types';
import type { SwapResult } from '@/app/api/swap/route';

const SLOT_CONFIG = {
  morning:   { icon: '🌅', label: 'Morning',   timeHint: '~09:00' },
  afternoon: { icon: '☀️',  label: 'Afternoon', timeHint: '~14:00' },
  evening:   { icon: '🌙', label: 'Evening',   timeHint: '~20:00' },
} as const;

type Slot = keyof typeof SLOT_CONFIG;

// ─── Single slot row ──────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: Slot;
  activity: Activity;
  onRefresh: (prompt?: string) => void;
  swapping: boolean;
  justSwapped: boolean;
}

function SlotRow({ slot, activity, onRefresh, swapping, justSwapped }: SlotRowProps) {
  const { icon, label } = SLOT_CONFIG[slot];
  const [promptOpen, setPromptOpen] = useState(false);
  const [promptText, setPromptText] = useState('');

  const handleQuickSwap = () => {
    setPromptOpen(false);
    onRefresh(promptText.trim() || undefined);
    setPromptText('');
  };

  return (
    <div className={`group relative rounded-xl border transition-all duration-200 ${
      justSwapped
        ? 'border-emerald-300 bg-emerald-50'
        : 'border-[#e5e7eb] bg-white hover:border-[#ff5a5f]/30 hover:shadow-sm'
    }`}>
      <div className="flex items-start gap-3 p-3.5">
        <span className="text-base flex-shrink-0 mt-0.5">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">{label}</span>
            {activity.startTime && (
              <span className="text-[10px] font-mono text-[#ff5a5f] bg-[#fff0f0] px-1.5 py-0.5 rounded">
                {activity.startTime}
              </span>
            )}
            {justSwapped && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                ✓ Swapped
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-[#111827] leading-tight">{activity.name}</p>
          <p className="text-xs text-[#9ca3af] mt-0.5">📍 {activity.neighborhood}</p>
        </div>

        {/* Swap controls */}
        <div className="flex-shrink-0 flex flex-col items-end gap-1">
          <button
            onClick={() => setPromptOpen((o) => !o)}
            disabled={swapping}
            title="Swap this activity"
            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:border-[#ff5a5f] hover:text-[#ff5a5f] hover:bg-[#fff0f0] transition-all disabled:opacity-40"
          >
            {swapping
              ? <span className="w-3 h-3 rounded-full border border-[#ff5a5f]/30 border-t-[#ff5a5f] animate-spin" />
              : '↻'
            }
            {swapping ? 'Swapping…' : 'Swap'}
          </button>
        </div>
      </div>

      {/* Inline prompt input */}
      {promptOpen && !swapping && (
        <div className="border-t border-[#f3f4f6] px-3.5 pb-3 pt-2.5 flex gap-2">
          <input
            type="text"
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleQuickSwap()}
            placeholder={`e.g. "something outdoors" or just leave blank`}
            autoFocus
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-[#e5e7eb] focus:border-[#ff5a5f] focus:outline-none text-[#111827] placeholder:text-[#9ca3af] bg-white"
          />
          <button
            onClick={handleQuickSwap}
            className="text-xs px-3 py-2 rounded-lg bg-[#ff5a5f] text-white font-semibold hover:bg-[#e04a4f] transition-colors"
          >
            Go
          </button>
          <button
            onClick={() => setPromptOpen(false)}
            className="text-xs px-2 py-2 rounded-lg border border-[#e5e7eb] text-[#9ca3af] hover:text-[#6b7280] transition-colors"
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
}

function DayColumn({ day, dayIndex, swappingKey, swappedKeys, onSwap }: DayColumnProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-full bg-[#ff5a5f] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
          {dayIndex + 1}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-bold text-[#111827] truncate">{day.theme}</div>
          <div className="text-[10px] text-[#9ca3af]">{day.date}</div>
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
}

export function DraftOverview({ itinerary, onUpdate, onFinalize }: Props) {
  const [swappingKey, setSwappingKey] = useState<string | null>(null);
  const [swappedKeys, setSwappedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen bg-[#f8f7f2]">
      {/* Draft header */}
      <div className="bg-white border-b border-[#e5e7eb] sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm font-bold text-[#111827]">Review Draft</span>
              <span className="text-xs text-[#9ca3af]">— {itinerary.destination}, {itinerary.totalDays} days</span>
            </div>
            <p className="text-xs text-[#9ca3af] mt-0.5">
              Tap ↻ Swap on any activity you don't like, then finalize when ready.
              {totalSwaps > 0 && ` · ${totalSwaps} swap${totalSwaps > 1 ? 's' : ''} made`}
            </p>
          </div>
          <button
            onClick={onFinalize}
            disabled={!!swappingKey}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] disabled:opacity-40 text-white font-semibold text-sm transition-all duration-150 shadow-sm shadow-[#ff5a5f]/20 hover:-translate-y-0.5 whitespace-nowrap"
          >
            Looks Good ✓
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Strategic overview */}
        <div className="bg-[#0f1117] rounded-2xl px-5 py-4 mb-6 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest text-[#ff5a5f] mb-1.5">AI Strategy</div>
          <p className="text-sm text-white/70 leading-relaxed">{itinerary.strategicOverview}</p>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Day grid — horizontal scroll on mobile, grid on desktop */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {itinerary.days.map((day, i) => (
            <DayColumn
              key={day.day}
              day={day}
              dayIndex={i}
              swappingKey={swappingKey}
              swappedKeys={swappedKeys}
              onSwap={handleSwap}
            />
          ))}
        </div>

        <div className="mt-8 text-center">
          <button
            onClick={onFinalize}
            disabled={!!swappingKey}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] disabled:opacity-40 text-white font-semibold transition-all duration-150 hover:-translate-y-0.5 shadow-md shadow-[#ff5a5f]/20"
          >
            Finalize Itinerary →
          </button>
          <p className="text-xs text-[#9ca3af] mt-3">
            You can still edit activities after finalizing using Quick Edit
          </p>
        </div>
      </div>
    </div>
  );
}
