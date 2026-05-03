'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPlan, Activity, DiningSpot, VibeLabel, WebInsight } from '@/lib/types';
import { DayPhoto } from './DayPhoto';
import { VideoPreview } from './VideoPreview';
import { WebInsightBadge } from './WebInsightBadge';
import { DayTimeline } from './DayTimeline';
import { GenreCube } from './GenreCube';
import type { PlaceCardData } from '@/components/PlaceCard';
import type { MapPlace } from '@/components/InteractiveMap';

// Dynamically import the map so mapbox-gl never runs during SSR
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap').then((m) => ({ default: m.InteractiveMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl animate-pulse"
        style={{ height: 280, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
      />
    ),
  },
);

// ─── Spring preset ────────────────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, stiffness: 100, damping: 20 };

// ─── Vibe config ──────────────────────────────────────────────────────────────

const VIBE_CONFIG: Record<VibeLabel, { label: string; icon: string; cls: string }> = {
  'hidden-gem':     { label: 'Hidden Gem',  icon: '💎', cls: 'bg-purple-500/20 text-purple-300 border border-purple-500/30' },
  'local-favorite': { label: 'Local Fave',  icon: '🏘', cls: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' },
  'viral-trend':    { label: 'Trending',    icon: '🔥', cls: 'bg-orange-500/20 text-orange-300 border border-orange-500/30' },
  'classic':        { label: 'Classic',     icon: '🏛', cls: 'bg-blue-500/20 text-blue-300 border border-blue-500/30' },
  'luxury-pick':    { label: 'Luxury Pick', icon: '✨', cls: 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30' },
  'budget-pick':    { label: 'Budget Pick', icon: '💰', cls: 'bg-green-500/20 text-green-300 border border-green-500/30' },
};

const SLOT_GRADIENT: Record<string, string> = {
  morning:   'linear-gradient(135deg, #ff8c5a 0%, #f59e0b 100%)',
  afternoon: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c8f 100%)',
  evening:   'linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%)',
};

const SLOT_META = {
  morning:   { icon: '🌅', label: 'Morning' },
  afternoon: { icon: '☀️',  label: 'Afternoon' },
  evening:   { icon: '🌙', label: 'Evening' },
} as const;

type Slot = keyof typeof SLOT_META;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getVibeIcon(tags: string[], name: string): string {
  const t = [...(tags ?? []), name].join(' ').toLowerCase();
  if (/ramen|sushi|food|curry|yakitori|restaurant|izakaya|dining/.test(t)) return '🍜';
  if (/bar|cocktail|beer|sake|yokocho|nightlife|alley|drink/.test(t)) return '🍻';
  if (/teamlab|digital|art|gallery|immersive|museum/.test(t)) return '🎨';
  if (/shrine|temple|spiritual|cultural|historic|meiji/.test(t)) return '⛩️';
  if (/record|vinyl|music|concert|live/.test(t)) return '🎵';
  if (/shop|vintage|market|fashion|style|shopping/.test(t)) return '🛍️';
  if (/park|garden|nature|forest|cemetery/.test(t)) return '🌿';
  if (/rooftop|sky|view|tower|observation/.test(t)) return '🌆';
  if (/canal|walk|street|ginza|crawl/.test(t)) return '🚶';
  return '✨';
}

function getVibeMatch(vibeLabel?: VibeLabel, isHiddenGem?: boolean): number {
  if (isHiddenGem) return 98;
  const map: Record<VibeLabel, number> = {
    'hidden-gem': 98, 'local-favorite': 95, 'luxury-pick': 94,
    'budget-pick': 90, 'viral-trend': 91, 'classic': 89,
  };
  return vibeLabel ? map[vibeLabel] : 87;
}

const SQUAD_KEYWORDS = ['group', 'social', 'crowd', 'communal', 'friends', 'shared', 'party', 'together'];
const isSquadFriendly = (tags: string[]) =>
  tags?.some((t) => SQUAD_KEYWORDS.some((k) => t.toLowerCase().includes(k)));

function hasLiveBuzz(tags: string[], name: string, description?: string): boolean {
  const text = [...(tags ?? []), name, description ?? ''].join(' ').toLowerCase();
  return /trending|viral|tiktok|2024|2025|2026|buzz|hype|hot|new open|just open|pop.?up|limited|sold.?out|queue|line.?up/.test(text);
}

function parseCitation(text: string): { body: string; citation: string | null } {
  const match = text?.match(/\(Source:\s*([^)]+)\)\s*$/i);
  if (!match) return { body: text ?? '', citation: null };
  return { body: text.slice(0, match.index).trim(), citation: match[1].trim() };
}

// ─── Genre classification ─────────────────────────────────────────────────────

type GenreKey = 'sightseeing' | 'food' | 'shopping' | 'nightlife';

const GENRE_CONFIG: Record<GenreKey, { icon: string; label: string; accent: string }> = {
  sightseeing: { icon: '🏛️', label: 'Sightseeing & Vibes',  accent: '#3b82f6' },
  food:        { icon: '🍽️', label: 'Food & Dining',         accent: '#f97316' },
  shopping:    { icon: '🛍️', label: 'Shopping & Style',      accent: '#ec4899' },
  nightlife:   { icon: '🎶', label: 'Nightlife & Culture',   accent: '#8b5cf6' },
};

function classifyActivity(activity: Activity): GenreKey {
  const t = [
    ...(activity.tags ?? []),
    activity.name ?? '',
    activity.description ?? '',
  ].join(' ').toLowerCase();
  if (/shop|vintage|market|fashion|style|boutique|mall|brand|cloth|accessor/.test(t))
    return 'shopping';
  if (/bar|cocktail|beer|sake|nightlife|club|disco|live\s*music|jazz|concert|karaoke|speakeasy|alley|yokocho/.test(t))
    return 'nightlife';
  if (/ramen|sushi|food|restaurant|cafe|coffee|bakery|izakaya|dining|eat/.test(t))
    return 'food';
  return 'sightseeing';
}

// Optional mealSlot lets callers attach a Breakfast / Lunch / Dinner label.
function activityToCard(
  activity: Activity,
  slot: Slot,
  dayIdx: number,
  mealSlot?: 'breakfast' | 'lunch' | 'dinner',
): PlaceCardData {
  return {
    id:          `day${dayIdx}-${slot}-${(activity.name ?? 'act').replace(/\s+/g, '-').toLowerCase()}`,
    name:        activity.name ?? 'Activity',
    emoji:       getVibeIcon(activity.tags ?? [], activity.name ?? ''),
    vibeLabel:   activity.vibeLabel ?? 'classic',
    description: activity.description ?? '',
    highlights:  (activity.tags ?? []).slice(0, 4),
    neighborhood: activity.neighborhood,
    category:    slot,
    estimatedCost: activity.estimatedCost,
    // Map lat/lng from Activity's coordinate fields so the day map can pin them
    lat:         activity.latitude,
    lng:         activity.longitude,
    mealSlot,
    verificationStatus: activity.verificationStatus,
    verifiedAt:  activity.verifiedAt,
  };
}

function diningToCard(
  spot: DiningSpot,
  meal: 'breakfast' | 'lunch' | 'dinner',
  dayIdx: number,
): PlaceCardData {
  const MEAL_EMOJI: Record<'breakfast' | 'lunch' | 'dinner', string> = {
    breakfast: '☕', lunch: '🍽️', dinner: '🌙',
  };
  return {
    id:          `day${dayIdx}-${meal}-${(spot.name ?? 'dining').replace(/\s+/g, '-').toLowerCase()}`,
    name:        spot.name ?? (meal === 'breakfast' ? 'Breakfast Spot' : meal === 'lunch' ? 'Lunch Spot' : 'Dinner Spot'),
    emoji:       MEAL_EMOJI[meal],
    vibeLabel:   'local-favorite',
    description: [
      spot.mustTry ? `Must try: ${spot.mustTry}` : '',
      spot.cuisine ?? '',
    ].filter(Boolean).join(' · ') || 'Local dining recommendation',
    neighborhood: spot.neighborhood,
    category:    spot.cuisine,
    estimatedCost: spot.priceRange,
    mealSlot:    meal,
  };
}

// Soft placeholder shown when a meal slot has no data — tells the traveller
// to ask locally rather than leaving a blank gap in the Food cube.
function makeMealPlaceholder(meal: 'breakfast' | 'lunch' | 'dinner', dayIdx: number): PlaceCardData {
  const CFG = {
    breakfast: {
      emoji: '☕', vibeLabel: 'budget-pick' as const,
      name: 'Breakfast — Ask Locally',
      description: 'Head to a nearby café or convenience store. Your hotel concierge can point you to the best local morning spot.',
    },
    lunch: {
      emoji: '🍱', vibeLabel: 'local-favorite' as const,
      name: 'Lunch — Scout the Block',
      description: 'No fixed plan — wander the neighbourhood and follow the lunch crowds. The best finds are unscripted.',
    },
    dinner: {
      emoji: '🌃', vibeLabel: 'classic' as const,
      name: 'Dinner — Your Choice',
      description: 'Open evening. Use Google Maps or ask a local guide for a reservation that fits the mood.',
    },
  } as const;
  const c = CFG[meal];
  return {
    id:          `day${dayIdx}-${meal}-placeholder`,
    name:        c.name,
    emoji:       c.emoji,
    vibeLabel:   c.vibeLabel,
    description: c.description,
    mealSlot:    meal,
  };
}

// ─── Particle burst ───────────────────────────────────────────────────────────

const BURST_COLORS = ['#ff5a5f', '#00d4ff', '#8b5cf6', '#f59e0b', '#10b981', '#ff8c5a'];

function ParticleBurst({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active &&
        Array.from({ length: 12 }, (_, i) => {
          const angle = (360 / 12) * i;
          const dist = 32 + (i % 3) * 10;
          return (
            <motion.span
              key={i}
              className="pointer-events-none absolute rounded-full z-50"
              style={{
                width: i % 2 === 0 ? 7 : 5,
                height: i % 2 === 0 ? 7 : 5,
                background: BURST_COLORS[i % BURST_COLORS.length],
                top: '50%',
                left: '50%',
                marginLeft: i % 2 === 0 ? -3.5 : -2.5,
                marginTop: i % 2 === 0 ? -3.5 : -2.5,
              }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
              animate={{
                x: Math.cos((angle * Math.PI) / 180) * dist,
                y: Math.sin((angle * Math.PI) / 180) * dist,
                scale: [0, 1.5, 0],
                opacity: [1, 1, 0],
              }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
            />
          );
        })}
    </AnimatePresence>
  );
}

// ─── Reaction bar ─────────────────────────────────────────────────────────────

const REACTIONS = [
  { id: 'fire', emoji: '🔥', label: 'On fire' },
  { id: 'pin',  emoji: '📍', label: 'Pinned'  },
  { id: 'love', emoji: '💖', label: 'Love it' },
];

function ReactionBar() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [burst, setBurst] = useState<string | null>(null);

  const handleReact = (id: string) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setBurst(id);
    setTimeout(() => setBurst(null), 750);
  };

  return (
    <div className="flex gap-2 pt-3 mt-3 border-t border-white/10">
      {REACTIONS.map((r) => (
        <div key={r.id} className="relative overflow-visible">
          <motion.button
            onClick={() => handleReact(r.id)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.82, transition: { type: 'spring', stiffness: 700, damping: 16 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
              (counts[r.id] ?? 0) > 0
                ? 'border-[#ff5a5f]/40 bg-[#ff5a5f]/15 text-[#ff8c8f]'
                : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20 hover:bg-white/10'
            }`}
          >
            <span>{r.emoji}</span>
            {(counts[r.id] ?? 0) > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-xs font-semibold tabular-nums"
              >
                {counts[r.id]}
              </motion.span>
            )}
          </motion.button>
          <ParticleBurst active={burst === r.id} />
        </div>
      ))}
    </div>
  );
}

// ─── Reviews carousel ─────────────────────────────────────────────────────────

function ReviewsCarousel({ reviews }: { reviews: string[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reviews.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % reviews.length), 3200);
    return () => clearInterval(t);
  }, [reviews.length]);

  if (!reviews.length) return null;

  return (
    <div className="my-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 mb-2">
        💬 What the Squad Says
      </div>
      <div className="relative min-h-[56px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="rounded-2xl px-4 py-3 text-sm text-white/65 leading-relaxed border border-white/8"
            style={{ background: 'rgba(255,255,255,0.05)', borderTopLeftRadius: 4 }}
          >
            {reviews[idx]}
          </motion.div>
        </AnimatePresence>
      </div>
      {reviews.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {reviews.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => setIdx(i)}
              animate={{
                width: i === idx ? 16 : 6,
                backgroundColor: i === idx ? '#ff5a5f' : 'rgba(255,255,255,0.15)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Activity Modal (box-in-box expansion) ────────────────────────────────────

interface ModalProps {
  activity: Activity;
  slot: string;
  destination?: string;
  onClose: () => void;
  onSwap?: () => void;
  swapping?: boolean;
}

function ActivityModal({ activity, slot, destination, onClose, onSwap, swapping }: ModalProps) {
  const { body, citation } = parseCitation(activity?.whyThis ?? '');
  const photoQuery = destination
    ? `${activity?.neighborhood ?? ''} ${destination}`.trim()
    : (activity?.neighborhood ?? 'travel');
  const vibeIcon   = getVibeIcon(activity?.tags ?? [], activity?.name ?? '');
  const vibeCfg    = activity?.vibeLabel ? VIBE_CONFIG[activity.vibeLabel] : null;
  const liveBuzz   = hasLiveBuzz(activity?.tags ?? [], activity?.name ?? '', activity?.description);
  const slotMeta   = SLOT_META[slot as Slot];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col"
        style={{
          background: '#0f1117',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.85)',
          maxHeight: '92dvh',
        }}
        initial={{ y: '100%', scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: '60%', opacity: 0, scale: 0.94 }}
        transition={SPRING}
      >
        {/* Ambient orb */}
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: SLOT_GRADIENT[slot] ?? SLOT_GRADIENT.morning, opacity: 0.06, filter: 'blur(60px)' }}
        />

        {/* Hero photo — fixed height, not scrollable */}
        <div className="relative flex-shrink-0">
          <DayPhoto query={photoQuery} alt={activity.name} height={260} />

          {/* Close */}
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.85 }}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
            style={{ background: 'rgba(15,17,23,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            ✕
          </motion.button>

          {/* Slot label */}
          {slotMeta && (
            <div
              className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wide z-10"
              style={{ background: 'rgba(15,17,23,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
            >
              {slotMeta.icon} {slotMeta.label}
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 relative z-10">
          <div className="px-5 pt-5 pb-8">
            {/* Title row */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight leading-tight">{activity?.name ?? 'Activity'}</h3>
                <p className="text-white/45 text-sm mt-1">📍 {activity?.neighborhood ?? '—'}</p>
              </div>
              <span className="text-4xl flex-shrink-0 mt-0.5 select-none">{vibeIcon}</span>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {vibeCfg && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${vibeCfg.cls}`}>
                  {vibeCfg.icon} {vibeCfg.label}
                </span>
              )}
              {isSquadFriendly(activity.tags ?? []) && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#00cc6a]/15 text-[#4ade80] border border-[#00cc6a]/25">
                  ⚡ Squad Pick
                </span>
              )}
              {liveBuzz && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ff5a5f]/15 text-[#ff8c8f] border border-[#ff5a5f]/25 inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse inline-block" />
                  Live Buzz
                </span>
              )}
            </div>

            {/* Meta pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {activity?.startTime && activity?.endTime && (
                <span className="text-[10px] font-mono font-semibold text-[#ff8c8f] bg-[#ff5a5f]/10 px-2.5 py-1 rounded-lg border border-[#ff5a5f]/15">
                  {activity.startTime} – {activity.endTime}
                </span>
              )}
              {activity?.duration && (
                <span className="text-xs text-white/40 bg-white/5 px-2.5 py-1 rounded-lg">⏱ {activity.duration}</span>
              )}
              {activity?.estimatedCost && (
                <span className="text-xs text-white/40 bg-white/5 px-2.5 py-1 rounded-lg">💳 {activity.estimatedCost}</span>
              )}
            </div>

            {/* Description */}
            {activity?.description && (
              <p className="text-white/65 text-sm leading-relaxed mb-4">{activity.description}</p>
            )}

            {/* Best time */}
            {activity.bestTimeToVisit && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-2xl border border-amber-500/15"
                style={{ background: 'rgba(245,158,11,0.07)' }}>
                <span className="text-xs flex-shrink-0 mt-0.5">⏰</span>
                <p className="text-xs text-amber-300/75 leading-relaxed">{activity.bestTimeToVisit}</p>
              </div>
            )}

            {/* Tags */}
            {(activity?.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(activity?.tags ?? []).map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/35 border border-white/8">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Why this */}
            {body && (
              <div className="rounded-2xl px-4 py-3 border-l-2 border-[#ff5a5f]/40 mb-4"
                style={{ background: 'rgba(255,255,255,0.04)' }}>
                <span className="text-[10px] font-semibold text-[#ff5a5f] uppercase tracking-wide block mb-1">Why this?</span>
                <p className="text-xs text-white/55 leading-relaxed">{body}</p>
                {citation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ff8c8f] bg-[#ff5a5f]/10 border border-[#ff5a5f]/15 px-2 py-0.5 rounded-full mt-1.5">
                    <span className="opacity-60">📖</span>{citation}
                  </span>
                )}
              </div>
            )}

            {/* Video */}
            <VideoPreview videoUrl={activity?.videoUrl} activityName={activity?.name ?? ''} />

            {/* Reviews */}
            {(activity?.reviews?.length ?? 0) > 0 && <ReviewsCarousel reviews={activity!.reviews!} />}

            {/* Reactions */}
            <ReactionBar />

            {/* Swap CTA */}
            {onSwap && (
              <motion.button
                onClick={onSwap}
                disabled={swapping}
                whileTap={{ scale: 0.95 }}
                className="w-full mt-5 py-3 rounded-2xl text-sm font-semibold border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/75 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <motion.span
                  animate={swapping ? { rotate: 360 } : { rotate: 0 }}
                  transition={swapping ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                >
                  ↻
                </motion.span>
                {swapping ? 'Finding something better…' : 'Swap this activity'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bento Tile ───────────────────────────────────────────────────────────────

interface BentoTileProps {
  slot: Slot;
  activity: Activity;
  height: number;
  destination?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}

function BentoTile({ slot, activity, height, destination, onRefresh, refreshing }: BentoTileProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const photoQuery = destination
    ? `${activity?.neighborhood ?? ''} ${destination}`.trim()
    : (activity?.neighborhood ?? destination ?? 'travel');
  const vibeIcon   = getVibeIcon(activity?.tags ?? [], activity?.name ?? '');
  const vibeMatch  = getVibeMatch(activity?.vibeLabel, activity?.isHiddenGem);
  const squad      = isSquadFriendly(activity?.tags ?? []);
  const vibeCfg    = activity?.vibeLabel ? VIBE_CONFIG[activity.vibeLabel] : null;
  const liveBuzz   = hasLiveBuzz(activity?.tags ?? [], activity?.name ?? '', activity?.description);
  const meta       = SLOT_META[slot];

  return (
    <>
      <motion.button
        className="relative overflow-hidden rounded-3xl text-left w-full group"
        style={{ height }}
        whileHover={{ scale: 1.015, zIndex: 2 }}
        whileTap={{ scale: 0.985 }}
        transition={SPRING}
        onClick={() => setModalOpen(true)}
      >
        {/* Swap shimmer overlay */}
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 pointer-events-none"
            >
              <div
                className="w-full h-full animate-shimmer"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,90,95,0.22) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Photo background */}
        <div className="absolute inset-0 pointer-events-none">
          <DayPhoto query={photoQuery} alt={activity?.name ?? 'Activity'} height={height} />
        </div>

        {/* Slot-colour wash — subtle tint so photo colours stay vivid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: SLOT_GRADIENT[slot], opacity: 0.28, mixBlendMode: 'multiply' }}
        />

        {/* Grain texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />

        {/* Dark bottom scrim — stronger for photo legibility */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/92 via-black/40 to-transparent pointer-events-none" />

        {/* Top-right: match score */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            {vibeMatch}% Match
          </span>
        </div>

        {/* Top-left: badges */}
        <div className="absolute top-2.5 left-2.5 z-10 flex gap-1 flex-wrap">
          <span
            className="text-[9px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            {meta.icon} {meta.label}
          </span>
          {vibeCfg && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${vibeCfg.cls}`}>
              {vibeCfg.icon} {vibeCfg.label}
            </span>
          )}
          {squad && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#00cc6a]/18 text-[#4ade80] border border-[#00cc6a]/30">
              ⚡ Squad
            </span>
          )}
          {liveBuzz && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#ff5a5f]/20 text-[#ff8c8f] border border-[#ff5a5f]/30 inline-flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-[#ff5a5f] animate-pulse inline-block" />
              Live
            </span>
          )}
        </div>

        {/* Centre: pulsing vibe emoji */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.span
            className="text-5xl select-none"
            style={{ filter: 'drop-shadow(0 6px 22px rgba(0,0,0,0.45))' }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {vibeIcon}
          </motion.span>
        </div>

        {/* Bottom: name + location + tap hint */}
        <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 z-10">
          <h4 className="font-bold text-white text-sm tracking-tight leading-tight line-clamp-1 drop-shadow">
            {activity?.name ?? 'Activity'}
          </h4>
          <div className="flex items-center justify-between mt-0.5">
            <p className="text-white/55 text-[11px] leading-tight">📍 {activity?.neighborhood ?? '—'}</p>
            <span className="text-white/25 text-[10px] group-hover:text-white/55 transition-colors">
              tap →
            </span>
          </div>
        </div>

        {/* Swap button — hover-reveal bottom-right */}
        {onRefresh && (
          <div className="absolute bottom-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={refreshing}
              whileTap={{ scale: 0.82 }}
              animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
              transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
              className="w-7 h-7 flex items-center justify-center rounded-xl text-xs text-white disabled:opacity-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
            >
              ↻
            </motion.button>
          </div>
        )}
      </motion.button>

      {/* Box-in-box modal */}
      <AnimatePresence>
        {modalOpen && (
          <ActivityModal
            activity={activity}
            slot={slot}
            destination={destination}
            onClose={() => setModalOpen(false)}
            onSwap={
              onRefresh
                ? () => {
                    onRefresh();
                    setModalOpen(false);
                  }
                : undefined
            }
            swapping={refreshing}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Bento Grid ───────────────────────────────────────────────────────────────

interface BentoGridProps {
  day: DayPlan;
  destination?: string;
  onSwapSlot?: (slot: Slot) => Promise<void>;
}

function BentoGrid({ day, destination, onSwapSlot }: BentoGridProps) {
  const [swapping, setSwapping] = useState<Slot | null>(null);

  const handleSwap = async (slot: Slot) => {
    if (!onSwapSlot || swapping) return;
    setSwapping(slot);
    try {
      await onSwapSlot(slot);
    } finally {
      setSwapping(null);
    }
  };

  return (
    <div className="px-4 pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Morning — wide (2/3) */}
        {day.morning && (
          <div className="sm:col-span-2">
            <BentoTile
              slot="morning"
              activity={day.morning}
              height={240}
              destination={destination}
              onRefresh={onSwapSlot ? () => handleSwap('morning') : undefined}
              refreshing={swapping === 'morning'}
            />
          </div>
        )}

        {/* Afternoon — square (1/3) */}
        {day.afternoon && (
          <div className="sm:col-span-1">
            <BentoTile
              slot="afternoon"
              activity={day.afternoon}
              height={240}
              destination={destination}
              onRefresh={onSwapSlot ? () => handleSwap('afternoon') : undefined}
              refreshing={swapping === 'afternoon'}
            />
          </div>
        )}

        {/* Evening — full width */}
        {day.evening && (
          <div className="sm:col-span-3">
            <BentoTile
              slot="evening"
              activity={day.evening}
              height={200}
              destination={destination}
              onRefresh={onSwapSlot ? () => handleSwap('evening') : undefined}
              refreshing={swapping === 'evening'}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dining section (dark) ────────────────────────────────────────────────────

function DiningBlock({ meal, spot }: { meal: string; spot?: DiningSpot }) {
  if (!spot) return (
    <div className="flex gap-3 items-start p-3 rounded-2xl border border-dashed border-white/10"
      style={{ background: 'rgba(255,255,255,0.02)' }}>
      <span className="text-lg flex-shrink-0 opacity-30">{meal === 'Lunch' ? '🍽️' : '🌙'}</span>
      <span className="text-xs text-white/25 mt-0.5">{meal} — not listed</span>
    </div>
  );

  return (
    <div className="flex gap-3 items-start p-3 rounded-2xl border border-white/8"
      style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="text-lg flex-shrink-0">{meal === 'Lunch' ? '🍽️' : '🌙'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{meal}</span>
          {spot.priceRange && <span className="text-xs text-white/25">{spot.priceRange}</span>}
        </div>
        <div className="font-semibold text-sm text-white/85 tracking-tight">{spot.name ?? '—'}</div>
        <div className="text-xs text-white/35 mt-0.5">
          {[spot.cuisine, spot.neighborhood].filter(Boolean).join(' · ') || '—'}
        </div>
        {spot.mustTry && <div className="text-xs text-[#ff8c8f] mt-1">✦ Must try: {spot.mustTry}</div>}
      </div>
    </div>
  );
}

// ─── Insider Reveal (dark) ────────────────────────────────────────────────────

const insightStagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const insightItem = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

function InsiderReveal({ insights }: { insights: WebInsight[] }) {
  const [open, setOpen] = useState(false);
  const tipInsights = insights?.filter((i) => i.type !== 'warning') ?? [];
  if (tipInsights.length === 0) return null;

  return (
    <div className="px-4 pb-4">
      <motion.button
        onClick={() => setOpen((o) => !o)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors w-full justify-between ${
          open
            ? 'border-violet-500/40 bg-violet-500/10 text-violet-300'
            : 'border-white/10 bg-white/5 text-white/40 hover:border-violet-500/30 hover:text-violet-400'
        }`}
      >
        <span className="flex items-center gap-2">
          <span>🤫</span>
          {open
            ? 'Hide intel'
            : `Pro Move · ${tipInsights.length} insider secret${tipInsights.length > 1 ? 's' : ''}`}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 28 }}>
          ▾
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <motion.div variants={insightStagger} initial="hidden" animate="show" className="pt-3 flex flex-col gap-2">
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

export function DayCard({ day, index, destination, onSwapSlot }: DayCardProps) {
  const [open, setOpen] = useState(false);
  const warnings    = day.webInsights?.filter((i) => i.type === 'warning') ?? [];
  const tipInsights = (day.webInsights ?? []).filter((i) => i.type !== 'warning');

  // ── Genre buckets (built once per render) ────────────────────────────────────
  const byGenre: Record<GenreKey, PlaceCardData[]> = {
    sightseeing: [], food: [], shopping: [], nightlife: [],
  };

  // Classify each time-slot activity; food items are handled below via the
  // 3-Meal Rule so we skip them here to avoid double-counting.
  const dayActivities: { activity: Activity; slot: Slot }[] = [
    day.morning   ? { activity: day.morning,   slot: 'morning'   as const } : null,
    day.afternoon ? { activity: day.afternoon, slot: 'afternoon' as const } : null,
    day.evening   ? { activity: day.evening,   slot: 'evening'   as const } : null,
  ].filter((e): e is { activity: Activity; slot: Slot } => e !== null);

  dayActivities.forEach(({ activity, slot }) => {
    const genre = classifyActivity(activity);
    if (genre !== 'food') byGenre[genre].push(activityToCard(activity, slot, index));
  });

  // ── 3-Meal Rule: always produce Breakfast → Lunch → Dinner in Food cube ─────
  //
  //  Priority order per slot:
  //    Breakfast : explicit day.breakfast DiningSpot → morning food Activity → placeholder
  //    Lunch     : explicit day.lunch DiningSpot → afternoon food Activity  → placeholder
  //    Dinner    : explicit day.dinner DiningSpot → evening food Activity   → placeholder
  //
  const morningIsFood   = day.morning   && classifyActivity(day.morning)   === 'food';
  const afternoonIsFood = day.afternoon && classifyActivity(day.afternoon) === 'food';
  const eveningIsFood   = day.evening   && classifyActivity(day.evening)   === 'food';

  const mealCards: Record<'breakfast' | 'lunch' | 'dinner', PlaceCardData> = {
    breakfast:
      day.breakfast
        ? diningToCard(day.breakfast, 'breakfast', index)
        : morningIsFood && day.morning
          ? activityToCard(day.morning,   'morning',   index, 'breakfast')
          : makeMealPlaceholder('breakfast', index),

    lunch:
      day.lunch
        ? diningToCard(day.lunch, 'lunch', index)
        : afternoonIsFood && day.afternoon
          ? activityToCard(day.afternoon, 'afternoon', index, 'lunch')
          : makeMealPlaceholder('lunch', index),

    dinner:
      day.dinner
        ? diningToCard(day.dinner, 'dinner', index)
        : eveningIsFood && day.evening
          ? activityToCard(day.evening,   'evening',   index, 'dinner')
          : makeMealPlaceholder('dinner', index),
  };

  byGenre.food = [mealCards.breakfast, mealCards.lunch, mealCards.dinner];

  // ── Map layer: places with GPS coords (stable across renders via useMemo) ───
  const mapPlaces = useMemo<MapPlace[]>(() => {
    const slotMap: [Slot, Activity | undefined][] = [
      ['morning',   day.morning],
      ['afternoon', day.afternoon],
      ['evening',   day.evening],
    ];
    return slotMap
      .filter((e): e is [Slot, Activity] =>
        !!e[1] && Number.isFinite(e[1].latitude) && Number.isFinite(e[1].longitude)
      )
      .map(([slot, act]) => ({
        id:        `day${index}-${slot}-${(act.name ?? 'act').replace(/\s+/g, '-').toLowerCase()}`,
        name:      act.name ?? slot,
        emoji:     getVibeIcon(act.tags ?? [], act.name ?? ''),
        lat:       act.latitude!,
        lng:       act.longitude!,
        vibeLabel: act.vibeLabel ?? 'classic',
      }));
  // day.morning/afternoon/evening are plain objects from props — safe deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.morning, day.afternoon, day.evening, index]);

  // ── Fly-to: updated when a GenreCube opens or a PlaceCard is selected ───────
  const [flyToId, setFlyToId] = useState<string | null>(null);

  const handleGenreOpen = useCallback((cubePlaces: PlaceCardData[]) => {
    const withCoords = cubePlaces.find(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    if (withCoords) setFlyToId(withCoords.id);
  }, []);

  const handlePlaceSelect = useCallback((placeId: string) => {
    // Only fly if that place actually has GPS coords in mapPlaces
    if (mapPlaces.some((mp) => mp.id === placeId)) {
      setFlyToId(placeId);
    }
  }, [mapPlaces]);

  // Ternary + typed predicate — avoids the `&&` → `undefined` narrowing
  // problem that breaks strict-mode builds with `.filter(Boolean) as T[]`.
  const slotPreviews: { icon: string; name: string }[] = [
    day.morning   ? { icon: '🌅', name: day.morning.name   } : null,
    day.afternoon ? { icon: '☀️',  name: day.afternoon.name } : null,
    day.evening   ? { icon: '🌙', name: day.evening.name   } : null,
  ].filter((e): e is { icon: string; name: string } => e !== null);

  return (
    <div
      className="rounded-3xl overflow-hidden relative"
      style={{
        background: 'rgba(13, 15, 20, 0.82)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 8px 48px -12px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Card-level noise grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Accordion Header (always visible, tap to expand) ─────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left focus:outline-none relative z-10"
      >
        <div className="relative overflow-hidden border-b border-white/6">
          {/* Themed photo background */}
          <div className="absolute inset-0 pointer-events-none">
            <DayPhoto
              query={destination ? `${destination} ${day.theme ?? ''}`.trim() : (day.theme ?? 'travel')}
              alt={day.theme ?? `Day ${index + 1}`}
              height={90}
              dark
            />
          </div>
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: 'rgba(10,12,18,0.78)', backdropFilter: 'blur(4px)' }}
          />

          {/* Header content */}
          <div className="relative z-10 px-4 pt-4 pb-3 flex items-center gap-3">
            {/* Day number badge */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #ff5a5f, #8b5cf6)',
                boxShadow: '0 0 20px rgba(255,90,95,0.35)',
              }}
            >
              {index + 1}
            </div>

            {/* Title + slot preview */}
            <div className="flex-1 min-w-0">
              {day.date && (
                <div className="text-[10px] text-white/35 font-medium tracking-wide leading-none mb-0.5">
                  {day.date}
                </div>
              )}
              <h3 className="font-bold text-white tracking-tight text-sm leading-snug truncate">
                {day.theme ?? `Day ${index + 1}`}
              </h3>
              {/* Slot emoji preview — fades out when open */}
              <AnimatePresence initial={false}>
                {!open && slotPreviews.length > 0 && (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-1.5 mt-1 overflow-hidden"
                  >
                    {slotPreviews.map((s, i) => (
                      <span key={i} className="text-[11px]">{s.icon}</span>
                    ))}
                    <span className="text-[10px] text-white/25 truncate">
                      {slotPreviews.map((s) => s.name).join(' · ')}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: cost pill + rotating chevron */}
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {day.estimatedDailyCost && (
                <div className="text-right hidden sm:block">
                  <div className="text-[10px] text-white/25 uppercase tracking-wide leading-none mb-0.5">
                    Est. spend
                  </div>
                  <div className="text-sm font-bold text-white/75 tracking-tight">
                    {day.estimatedDailyCost}
                  </div>
                </div>
              )}
              <motion.div
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: open ? 'rgba(255,90,95,0.15)' : 'rgba(255,255,255,0.08)',
                  border: open ? '1px solid rgba(255,90,95,0.3)' : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path
                    d="M1 1.5L6 6.5L11 1.5"
                    stroke={open ? 'rgba(255,140,143,0.9)' : 'rgba(255,255,255,0.5)'}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      {/* ── Accordion Body (collapses / expands) ─────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 30 }}
            className="overflow-hidden relative z-10"
          >
            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="px-4 pt-3 flex flex-col gap-1.5">
                {warnings.map((w, i) => (
                  <WebInsightBadge key={i} insight={w} />
                ))}
              </div>
            )}

            {/* ── 📋 Daily Brief Strip ─────────────────────────────── */}
            {(day.estimatedDailyCost || day.transportTip) && (
              <div className="px-4 pt-4">
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="text-sm leading-none">📋</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                      Day Brief
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.estimatedDailyCost && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{
                          background: 'rgba(255,90,95,0.10)',
                          border: '1px solid rgba(255,90,95,0.22)',
                          color: '#ff8c8f',
                        }}
                      >
                        💳 {day.estimatedDailyCost}
                      </span>
                    )}
                    {day.transportTip && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                        style={{
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.20)',
                          color: 'rgba(52,211,153,0.85)',
                        }}
                      >
                        🚌 {day.transportTip}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Genre Cubes ───────────────────────────────────────── */}
            {(Object.entries(byGenre) as [GenreKey, PlaceCardData[]][])
              .filter(([, places]) => places.length > 0)
              .map(([key, places]) => {
                const cfg = GENRE_CONFIG[key];
                // Food cube: always 3 cards (Breakfast → Lunch → Dinner), laid out
                // in a single-column stack so meal labels are clearly readable.
                const cols = key === 'food' ? (1 as const) : (2 as const);
                return (
                  <div key={key} className="px-4 pt-3">
                    <GenreCube
                      icon={cfg.icon}
                      label={cfg.label}
                      accent={cfg.accent}
                      places={places}
                      columns={cols}
                      onOpen={handleGenreOpen}
                      onSelect={handlePlaceSelect}
                    />
                  </div>
                );
              })}

            {/* ── 📅 Day Timeline Cube ─────────────────────────────── */}
            <div className="px-4 pt-3">
              <div
                className="rounded-2xl p-4"
                style={{
                  background: 'rgba(239,68,68,0.07)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  boxShadow: '0 2px 16px -4px rgba(239,68,68,0.10)',
                }}
              >
                <div className="flex items-center gap-1.5 mb-3">
                  <span className="text-sm leading-none">📅</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400/80">
                    Day Timeline
                  </span>
                </div>
                <DayTimeline day={day} />
              </div>
            </div>

            {/* ── 📍 Day Route / Interactive Map ───────────────────── */}
            <div className="px-4 pt-3">
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(99,102,241,0.07)',
                  border: '1px solid rgba(99,102,241,0.15)',
                  boxShadow: '0 2px 16px -4px rgba(99,102,241,0.10)',
                }}
              >
                <div className="px-4 pt-3 pb-2 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm leading-none">📍</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80">
                      Day Route
                    </span>
                  </div>
                  {mapPlaces.length > 0 && (
                    <span className="text-[9px] text-indigo-400/45 font-medium">
                      {mapPlaces.length} location{mapPlaces.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="px-4 pb-4">
                  <InteractiveMap
                    places={mapPlaces}
                    flyToId={flyToId}
                    height={280}
                  />
                </div>
              </div>
            </div>

            {/* ── 🤫 Insider Intel Cube ────────────────────────────── */}
            {tipInsights.length > 0 && (
              <div className="px-4 pt-3 pb-4">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: 'rgba(139,92,246,0.07)',
                    border: '1px solid rgba(139,92,246,0.16)',
                    boxShadow: '0 2px 16px -4px rgba(139,92,246,0.12)',
                  }}
                >
                  <div className="px-4 pt-3 pb-0 flex items-center gap-1.5">
                    <span className="text-sm leading-none">🤫</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/80">
                      Insider Intel
                    </span>
                  </div>
                  <InsiderReveal insights={day.webInsights ?? []} />
                </div>
              </div>
            )}
            {/* Bottom spacer when no Insider Intel */}
            {tipInsights.length === 0 && <div className="pb-4" />}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
