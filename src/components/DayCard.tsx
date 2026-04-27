'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPlan, Activity, DiningSpot, VibeLabel } from '@/lib/types';
import { WebInsightBadge } from './WebInsightBadge';
import { DayPhoto } from './DayPhoto';

// ─── Source citation parser ───────────────────────────────────────────────────

function parseCitation(text: string): { body: string; citation: string | null } {
  const match = text?.match(/\(Source:\s*([^)]+)\)\s*$/i);
  if (!match) return { body: text ?? '', citation: null };
  return { body: text.slice(0, match.index).trim(), citation: match[1].trim() };
}

function SourceBadge({ citation }: { citation: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ff5a5f] bg-[#fff0f0] border border-[#ff5a5f]/20 px-2 py-0.5 rounded-full mt-1.5 shrink-0">
      <span className="opacity-60">📖</span>
      {citation}
    </span>
  );
}

// ─── Vibe label chip ──────────────────────────────────────────────────────────

const VIBE_CONFIG: Record<VibeLabel, { label: string; icon: string; cls: string }> = {
  'hidden-gem':    { label: 'Hidden Gem',  icon: '💎', cls: 'bg-purple-100 text-purple-700' },
  'local-favorite':{ label: 'Local Fave',  icon: '🏘', cls: 'bg-emerald-100 text-emerald-700' },
  'viral-trend':   { label: 'Trending',    icon: '🔥', cls: 'bg-orange-100 text-orange-700' },
  'classic':       { label: 'Classic',     icon: '🏛', cls: 'bg-blue-100 text-blue-700' },
  'luxury-pick':   { label: 'Luxury Pick', icon: '✨', cls: 'bg-yellow-100 text-yellow-700' },
  'budget-pick':   { label: 'Budget Pick', icon: '💰', cls: 'bg-green-100 text-green-700' },
};

function VibeBadge({ vibe }: { vibe: VibeLabel }) {
  const cfg = VIBE_CONFIG[vibe];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ─── Squad-mode badge ─────────────────────────────────────────────────────────

const SQUAD_KEYWORDS = ['group', 'social', 'crowd', 'communal', 'friends', 'shared', 'party', 'together', 'lively', 'co-ed'];

function isSquadFriendly(tags: string[]): boolean {
  return tags?.some((t) => SQUAD_KEYWORDS.some((k) => t.toLowerCase().includes(k)));
}

function SquadBadge({ variant = 'goal' }: { variant?: 'goal' | 'approved' }) {
  return (
    <span className="squad-pulse inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-0.5 rounded-full border"
      style={{
        background: 'rgba(0,220,110,0.08)',
        borderColor: 'rgba(0,200,100,0.35)',
        color: '#00b86a',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[#00cc6a] animate-pulse flex-shrink-0" />
      {variant === 'approved' ? 'Group Approved' : 'Squad Goal'}
    </span>
  );
}

// ─── Time slot header ─────────────────────────────────────────────────────────

function TimeSlot({ start, end }: { start?: string; end?: string }) {
  if (!start && !end) return null;
  return (
    <span className="text-[10px] font-mono font-semibold text-[#ff5a5f] bg-[#fff0f0] px-2 py-0.5 rounded-md">
      {start ?? '?'} – {end ?? '?'}
    </span>
  );
}

// ─── Tactile swap button ──────────────────────────────────────────────────────

function SwapButton({ onClick, disabled, loading }: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      title="Swap this activity"
      whileHover={{ scale: disabled ? 1 : 1.08 }}
      whileTap={{ scale: disabled ? 1 : 0.86, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
      transition={{ type: 'spring', stiffness: 500, damping: 26 }}
      className="ml-auto flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-[#e5e7eb] text-[#9ca3af] hover:border-[#ff5a5f] hover:text-[#ff5a5f] hover:bg-[#fff0f0] transition-colors disabled:opacity-40"
    >
      {loading
        ? <span className="w-3 h-3 rounded-full border border-[#ff5a5f]/30 border-t-[#ff5a5f] animate-spin" />
        : '↻'
      }
      {loading ? 'Swapping…' : 'Swap'}
    </motion.button>
  );
}

// ─── Activity block ───────────────────────────────────────────────────────────

interface ActivityBlockProps {
  time: string;
  activity: Activity;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function ActivityBlock({ time, activity, onRefresh, refreshing }: ActivityBlockProps) {
  const { body, citation } = parseCitation(activity.whyThis);
  const showSquad = isSquadFriendly(activity.tags ?? []);

  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-[#fff0f0] border-2 border-[#ff5a5f]/30 flex items-center justify-center text-xs font-bold text-[#ff5a5f]">
          {time[0]}
        </div>
        <div className="w-px flex-1 bg-[#e5e7eb] mt-2" />
      </div>

      <div className="pb-6 min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">{time}</span>
          <TimeSlot start={activity.startTime} end={activity.endTime} />
          {activity.isHiddenGem && !activity.vibeLabel && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
              💎 Hidden Gem
            </span>
          )}
          {activity.vibeLabel && <VibeBadge vibe={activity.vibeLabel} />}
          {showSquad && <SquadBadge />}
          {onRefresh && (
            <SwapButton onClick={onRefresh} disabled={refreshing} loading={refreshing} />
          )}
        </div>

        <h4 className="font-semibold text-[#111827] text-sm mb-1 tracking-tight">{activity.name}</h4>
        <p className="text-[#6b7280] text-sm leading-relaxed mb-2">{activity.description}</p>

        <div className="flex flex-wrap gap-2 mb-2">
          <span className="text-xs text-[#9ca3af]">📍 {activity.neighborhood}</span>
          <span className="text-xs text-[#9ca3af]">⏱ {activity.duration}</span>
          <span className="text-xs text-[#9ca3af]">💳 {activity.estimatedCost}</span>
          {activity.transitFromPrevious && activity.transitFromPrevious !== 'null' && (
            <span className="text-xs text-blue-400">🚶 {activity.transitFromPrevious}</span>
          )}
        </div>

        {activity.bestTimeToVisit && (
          <div className="flex items-start gap-1.5 mb-2 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
            <span className="text-xs flex-shrink-0">⏰</span>
            <p className="text-xs text-amber-700 leading-relaxed">{activity.bestTimeToVisit}</p>
          </div>
        )}

        {activity.tags && activity.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {activity.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">{tag}</span>
            ))}
          </div>
        )}

        <div className="bg-[#f8f7f2] rounded-lg px-3 py-2.5 border-l-2 border-[#ff5a5f]/40">
          <span className="text-[10px] font-semibold text-[#ff5a5f] uppercase tracking-wide block mb-0.5">Why this?</span>
          <p className="text-xs text-[#6b7280] leading-relaxed">{body}</p>
          {citation && <SourceBadge citation={citation} />}
        </div>
      </div>
    </div>
  );
}

// ─── Dining block ─────────────────────────────────────────────────────────────

function DiningBlock({ meal, spot }: { meal: string; spot: DiningSpot }) {
  return (
    <div className="flex gap-3 items-start p-3 rounded-xl bg-[#f8f7f2] border border-[#e5e7eb]">
      <span className="text-lg flex-shrink-0">{meal === 'Lunch' ? '🍽️' : '🌙'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">{meal}</span>
          <span className="text-xs text-[#9ca3af]">{spot.priceRange}</span>
        </div>
        <div className="font-semibold text-sm text-[#111827] tracking-tight">{spot.name}</div>
        <div className="text-xs text-[#9ca3af] mt-0.5">{spot.cuisine} · {spot.neighborhood}</div>
        {spot.mustTry && <div className="text-xs text-[#ff5a5f] mt-1">✦ Must try: {spot.mustTry}</div>}
      </div>
    </div>
  );
}

// ─── Insider Reveal panel ─────────────────────────────────────────────────────

const insightStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const insightItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

function InsiderReveal({ insights }: { insights: DayPlan['webInsights'] }) {
  const [open, setOpen] = useState(false);
  const tipInsights = insights?.filter((i) => i.type !== 'warning') ?? [];
  if (tipInsights.length === 0) return null;

  return (
    <div>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.91, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors ${
          open
            ? 'border-violet-300 bg-violet-50 text-violet-700'
            : 'border-[#e5e7eb] bg-[#f8f7f2] text-[#6b7280] hover:border-violet-200 hover:text-violet-600'
        }`}
      >
        <span>🤫</span>
        {open ? 'Hide insider tips' : `Pro Move · ${tipInsights.length} local secret${tipInsights.length > 1 ? 's' : ''}`}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="ml-auto"
        >
          ▾
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="insider-panel"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <motion.div
              variants={insightStagger}
              initial="hidden"
              animate="show"
              className="pt-3 flex flex-col gap-2"
            >
              {tipInsights.map((insight, i) => (
                <motion.div key={i} variants={insightItem}>
                  <WebInsightBadge insight={insight} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

interface DayCardProps {
  day: DayPlan;
  index: number;
  destination?: string;
  onSwapSlot?: (slot: 'morning' | 'afternoon' | 'evening') => Promise<void>;
  onNeighborhoodClick?: (neighborhood: string) => void;
}

export function DayCard({ day, index, destination, onSwapSlot, onNeighborhoodClick: _onNeighborhoodClick }: DayCardProps) {
  const [swapping, setSwapping] = useState<'morning' | 'afternoon' | 'evening' | null>(null);

  const warnings = day.webInsights?.filter((i) => i.type === 'warning') ?? [];

  const photoQuery = destination
    ? `${day.morning?.neighborhood ?? day.theme} ${destination}`
    : day.theme;

  const handleSwap = async (slot: 'morning' | 'afternoon' | 'evening') => {
    if (!onSwapSlot || swapping) return;
    setSwapping(slot);
    try {
      await onSwapSlot(slot);
    } finally {
      setSwapping(null);
    }
  };

  return (
    <motion.div
      className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden shadow-sm inner-glow-hover transition-shadow duration-300"
      whileHover={{
        y: -4,
        boxShadow: '0 8px 32px -4px rgba(255,90,95,0.12), 0 20px 48px -8px rgba(0,0,0,0.10), inset 0 0 24px -6px rgba(255,90,95,0.10)',
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {/* Hero photo */}
      <div className="relative">
        <DayPhoto query={photoQuery} alt={day.theme} height={200} />
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1">
          <div className="w-5 h-5 rounded-full bg-[#ff5a5f] flex items-center justify-center text-white text-[10px] font-bold">
            {index + 1}
          </div>
          <span className="text-white text-xs font-semibold tracking-tight">{day.theme}</span>
        </div>
        {warnings.length > 0 && (
          <div className="absolute bottom-0 inset-x-0 z-10 px-4 pb-3 flex flex-col gap-1.5">
            {warnings.map((w, i) => <WebInsightBadge key={i} insight={w} />)}
          </div>
        )}
      </div>

      {/* Day header */}
      <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-xs text-[#9ca3af] font-medium tracking-wide">{day.date}</div>
          <h3 className="font-bold text-[#111827] tracking-tight">{day.theme}</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#9ca3af]">Est. daily spend</div>
          <div className="text-sm font-semibold text-[#111827] tracking-tight">{day.estimatedDailyCost}</div>
        </div>
      </div>

      <div className="p-6">
        {/* Activity timeline */}
        <div className="mb-6">
          {(['morning', 'afternoon', 'evening'] as const).map((slot) => (
            <ActivityBlock
              key={slot}
              time={slot.charAt(0).toUpperCase() + slot.slice(1)}
              activity={day[slot]}
              onRefresh={onSwapSlot ? () => handleSwap(slot) : undefined}
              refreshing={swapping === slot}
            />
          ))}
        </div>

        {/* Insider Reveal */}
        <div className="mb-6">
          <InsiderReveal insights={day.webInsights} />
        </div>

        {/* Dining */}
        <div className="mb-6">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-[#9ca3af] mb-3">Curated Dining</h4>
          <div className="grid sm:grid-cols-2 gap-2">
            <DiningBlock meal="Lunch" spot={day.lunch} />
            <DiningBlock meal="Dinner" spot={day.dinner} />
          </div>
        </div>

        {/* Transport */}
        {day.transportTip && (
          <div className="mb-4 p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mb-1">🚌 Getting Around</div>
            <p className="text-xs text-blue-700 leading-relaxed">{day.transportTip}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
