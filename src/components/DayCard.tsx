'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPlan, Activity, DiningSpot, VibeLabel, WebInsight } from '@/lib/types';
import { DayPhoto } from './DayPhoto';
import { VideoPreview } from './VideoPreview';
import { WebInsightBadge } from './WebInsightBadge';

// ─── Vibe helpers ─────────────────────────────────────────────────────────────

const VIBE_CONFIG: Record<VibeLabel, { label: string; icon: string; cls: string }> = {
  'hidden-gem':    { label: 'Hidden Gem',  icon: '💎', cls: 'bg-purple-100 text-purple-700' },
  'local-favorite':{ label: 'Local Fave',  icon: '🏘', cls: 'bg-emerald-100 text-emerald-700' },
  'viral-trend':   { label: 'Trending',    icon: '🔥', cls: 'bg-orange-100 text-orange-700' },
  'classic':       { label: 'Classic',     icon: '🏛', cls: 'bg-blue-100 text-blue-700' },
  'luxury-pick':   { label: 'Luxury Pick', icon: '✨', cls: 'bg-yellow-100 text-yellow-700' },
  'budget-pick':   { label: 'Budget Pick', icon: '💰', cls: 'bg-green-100 text-green-700' },
};

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

// ─── Particle confetti ────────────────────────────────────────────────────────

const BURST_COLORS = ['#ff5a5f', '#00d4ff', '#8b5cf6', '#f59e0b', '#10b981', '#ff8c5a'];

function ParticleBurst({ active }: { active: boolean }) {
  const count = 12;
  return (
    <AnimatePresence>
      {active && Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        const dist = 32 + (i % 3) * 10;
        return (
          <motion.span
            key={i}
            className="pointer-events-none absolute rounded-full z-50"
            style={{
              width: i % 2 === 0 ? 7 : 5,
              height: i % 2 === 0 ? 7 : 5,
              background: BURST_COLORS[i % BURST_COLORS.length],
              top: '50%', left: '50%',
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
  { id: 'fire',  emoji: '🔥', label: 'On fire' },
  { id: 'pin',   emoji: '📍', label: 'Pinned'  },
  { id: 'love',  emoji: '💖', label: 'Love it' },
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
    <div className="flex gap-2 pt-3 mt-3 border-t border-[#f3f4f6]">
      {REACTIONS.map((r) => (
        <div key={r.id} className="relative overflow-visible">
          <motion.button
            onClick={() => handleReact(r.id)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.82, transition: { type: 'spring', stiffness: 700, damping: 16 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
              (counts[r.id] ?? 0) > 0
                ? 'border-[#ff5a5f]/40 bg-[#fff0f0] text-[#ff5a5f]'
                : 'border-[#e5e7eb] bg-[#f8f7f2] text-[#6b7280] hover:border-[#e5e7eb] hover:bg-white'
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

// ─── Reviews carousel (chat bubbles) ─────────────────────────────────────────

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
      <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af] mb-2">
        💬 What the Squad Says
      </div>

      {/* Chat bubble */}
      <div className="relative min-h-[56px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: 16, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -12, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="bg-[#f3f4f6] rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-[#374151] leading-relaxed"
            style={{ borderTopLeftRadius: 4 }}
          >
            {reviews[idx]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      {reviews.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {reviews.map((_, i) => (
            <motion.button
              key={i}
              onClick={() => setIdx(i)}
              animate={{ width: i === idx ? 16 : 6, backgroundColor: i === idx ? '#ff5a5f' : '#e5e7eb' }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="h-1.5 rounded-full"
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Source citation parser ───────────────────────────────────────────────────

function parseCitation(text: string): { body: string; citation: string | null } {
  const match = text?.match(/\(Source:\s*([^)]+)\)\s*$/i);
  if (!match) return { body: text ?? '', citation: null };
  return { body: text.slice(0, match.index).trim(), citation: match[1].trim() };
}

// ─── Slot colour palette ──────────────────────────────────────────────────────

const SLOT_GRADIENT: Record<string, string> = {
  morning:   'linear-gradient(135deg, #ff8c5a 0%, #f59e0b 100%)',
  afternoon: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c8f 100%)',
  evening:   'linear-gradient(135deg, #8b5cf6 0%, #4f46e5 100%)',
};

// ─── Expanded activity content ────────────────────────────────────────────────

function ExpandedContent({
  activity,
  destination,
  slot,
}: {
  activity: Activity;
  destination?: string;
  slot: string;
}) {
  const { body, citation } = parseCitation(activity.whyThis);
  const photoQuery = destination
    ? `${activity.neighborhood} ${destination}`
    : activity.neighborhood;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.08 }}
      className="border-t border-[#f3f4f6]"
    >
      {/* Full photo */}
      <div className="overflow-hidden">
        <DayPhoto query={photoQuery} alt={activity.name} height={180} />
      </div>

      <div className="px-4 pt-3 pb-1">
        {/* Description */}
        <p className="text-sm text-[#4b5563] leading-relaxed mb-3">{activity.description}</p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-2 mb-3">
          {activity.startTime && activity.endTime && (
            <span className="text-[10px] font-mono font-semibold text-[#ff5a5f] bg-[#fff0f0] px-2 py-0.5 rounded-md">
              {activity.startTime} – {activity.endTime}
            </span>
          )}
          <span className="text-xs text-[#9ca3af]">⏱ {activity.duration}</span>
          <span className="text-xs text-[#9ca3af]">💳 {activity.estimatedCost}</span>
        </div>

        {/* Best time callout */}
        {activity.bestTimeToVisit && (
          <div className="flex items-start gap-1.5 mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
            <span className="text-xs flex-shrink-0 mt-0.5">⏰</span>
            <p className="text-xs text-amber-700 leading-relaxed">{activity.bestTimeToVisit}</p>
          </div>
        )}

        {/* Tags */}
        {activity.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {activity.tags.map((tag) => (
              <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-[#f3f4f6] text-[#6b7280]">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Why this */}
        <div className="bg-[#f8f7f2] rounded-xl px-3 py-2.5 border-l-2 border-[#ff5a5f]/40 mb-3">
          <span className="text-[10px] font-semibold text-[#ff5a5f] uppercase tracking-wide block mb-0.5">Why this?</span>
          <p className="text-xs text-[#6b7280] leading-relaxed">{body}</p>
          {citation && (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ff5a5f] bg-[#fff0f0] border border-[#ff5a5f]/20 px-2 py-0.5 rounded-full mt-1.5">
              <span className="opacity-60">📖</span>{citation}
            </span>
          )}
        </div>

        {/* Video preview */}
        <VideoPreview videoUrl={activity.videoUrl} activityName={activity.name} />

        {/* Reviews carousel */}
        {activity.reviews && activity.reviews.length > 0 && (
          <ReviewsCarousel reviews={activity.reviews} />
        )}

        {/* Reactions */}
        <ReactionBar />
      </div>
    </motion.div>
  );
}

// ─── Compact activity card ────────────────────────────────────────────────────

interface ActivityCardProps {
  slot: string;
  activity: Activity;
  onRefresh?: () => void;
  refreshing?: boolean;
  destination?: string;
}

function ActivityCompactCard({ slot, activity, onRefresh, refreshing, destination }: ActivityCardProps) {
  const [expanded, setExpanded] = useState(false);

  const vibeIcon  = getVibeIcon(activity.tags ?? [], activity.name);
  const vibeMatch = getVibeMatch(activity.vibeLabel, activity.isHiddenGem);
  const squad     = isSquadFriendly(activity.tags ?? []);
  const vibeCfg   = activity.vibeLabel ? VIBE_CONFIG[activity.vibeLabel] : null;

  return (
    <motion.div
      layout
      className="rounded-3xl overflow-hidden border border-[#e5e7eb] bg-white shadow-sm relative"
      whileHover={expanded ? {} : { y: -3, boxShadow: '0 12px 32px -6px rgba(255,90,95,0.16)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
    >
      {/* Swap shimmer overlay — localised to this card only */}
      <AnimatePresence>
        {refreshing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 pointer-events-none rounded-3xl overflow-hidden"
          >
            <div
              className="w-full h-full animate-shimmer"
              style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,90,95,0.18) 50%, transparent 100%)',
                backgroundSize: '200% 100%',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Cover tap target ── */}
      <button className="w-full text-left" onClick={() => setExpanded((e) => !e)}>

        {/* Large cover image area */}
        <div
          className="relative overflow-hidden"
          style={{ height: 148, background: SLOT_GRADIENT[slot] ?? SLOT_GRADIENT.morning }}
        >
          {/* Big vibe emoji — scales down when expanded */}
          <motion.div
            animate={expanded ? { scale: 0.7, opacity: 0.5 } : { scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 340, damping: 26 }}
            className="absolute inset-0 flex items-center justify-center text-[80px] select-none"
            style={{ filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.28))' }}
          >
            {vibeIcon}
          </motion.div>

          {/* Noise grain */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.07] mix-blend-overlay"
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }}
          />

          {/* Bottom scrim for text readability */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/75 to-transparent" />

          {/* Match score — top right */}
          <div className="absolute top-2.5 right-2.5">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
            >
              {vibeMatch}% Match
            </span>
          </div>

          {/* Vibe + Squad badges — top left */}
          <div className="absolute top-2.5 left-2.5 flex gap-1 flex-wrap">
            {vibeCfg && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${vibeCfg.cls}`}>
                {vibeCfg.icon} {vibeCfg.label}
              </span>
            )}
            {squad && (
              <span
                className="squad-pulse text-[9px] font-bold px-1.5 py-0.5 rounded-full border"
                style={{ background: 'rgba(0,220,110,0.18)', borderColor: 'rgba(0,200,100,0.45)', color: '#00cc6a' }}
              >
                ⚡ Squad
              </span>
            )}
          </div>

          {/* Name + location overlay */}
          <div className="absolute bottom-0 inset-x-0 px-3 pb-3">
            <h4 className="font-bold text-white text-sm tracking-tight leading-tight line-clamp-1 drop-shadow">
              {activity.name}
            </h4>
            <p className="text-white/60 text-[11px] mt-0.5 leading-tight">
              📍 {activity.neighborhood}
              {activity.startTime && <span className="ml-2 font-mono text-[#ffb3b5]">{activity.startTime}</span>}
            </p>
          </div>
        </div>

        {/* Bottom strip */}
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex items-center gap-3 text-xs text-[#9ca3af]">
            <span>⏱ {activity.duration}</span>
            <span className="font-medium text-[#6b7280]">💳 {activity.estimatedCost}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <motion.button
                onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                disabled={refreshing}
                whileTap={{ scale: 0.82, transition: { type: 'spring', stiffness: 700, damping: 16 } }}
                animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                className="w-6 h-6 flex items-center justify-center rounded-lg border border-[#e5e7eb] text-[#9ca3af] hover:border-[#ff5a5f] hover:text-[#ff5a5f] transition-colors disabled:opacity-40 text-xs"
              >
                ↻
              </motion.button>
            )}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="text-[#9ca3af] text-xs"
            >
              ▾
            </motion.span>
          </div>
        </div>
      </button>

      {/* ── Spring-loaded expansion ── */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="overflow-hidden"
          >
            <ExpandedContent activity={activity} destination={destination} slot={slot} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Waze-style transit micro-badge ──────────────────────────────────────────

function TransitBadge({ text }: { text: string }) {
  if (!text || text === 'null') return null;
  const isWalk = /walk/i.test(text);
  const isMetro = /metro|train|subway|line/i.test(text);
  const icon = isWalk ? '🚶' : isMetro ? '🚇' : '🚕';

  return (
    <div className="flex items-center gap-2 my-2 ml-2">
      <div className="flex flex-col items-center gap-0.5 w-5 flex-shrink-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-1 h-1 rounded-full bg-[#d1d5db]" />
        ))}
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#e5e7eb] shadow-sm text-xs text-[#6b7280]">
        <span>{icon}</span>
        <span className="font-medium">{text}</span>
        {isWalk && <span className="text-[#ff5a5f] text-[10px] font-semibold">📸 photo op!</span>}
      </div>
    </div>
  );
}

// ─── Waze timeline — all 3 slots ─────────────────────────────────────────────

const SLOT_META = {
  morning:   { icon: '🌅', label: 'Morning',   nodeColor: '#ff8c5a', ringColor: 'rgba(255,140,90,0.2)' },
  afternoon: { icon: '☀️',  label: 'Afternoon', nodeColor: '#ff5a5f', ringColor: 'rgba(255,90,95,0.2)' },
  evening:   { icon: '🌙', label: 'Evening',   nodeColor: '#8b5cf6', ringColor: 'rgba(139,92,246,0.2)' },
} as const;

type Slot = keyof typeof SLOT_META;

interface TimelineProps {
  day: DayPlan;
  destination?: string;
  onSwapSlot?: (slot: Slot) => Promise<void>;
}

function WazeTimeline({ day, destination, onSwapSlot }: TimelineProps) {
  const [swapping, setSwapping] = useState<Slot | null>(null);
  const slots: Slot[] = ['morning', 'afternoon', 'evening'];

  const handleSwap = async (slot: Slot) => {
    if (!onSwapSlot || swapping) return;
    setSwapping(slot);
    try { await onSwapSlot(slot); } finally { setSwapping(null); }
  };

  // Approximate y-centres of the 3 nodes (collapsed card ~188px + transit ~44px per gap)
  const NODE_Y = [16, 264, 512] as const;

  return (
    <div className="px-4 pb-4 relative">
      {/* Animated walking emoji — patrols the full path */}
      <motion.div
        aria-hidden="true"
        className="absolute z-10 pointer-events-none select-none text-base"
        style={{ left: 20 }}
        animate={{ y: [NODE_Y[0], NODE_Y[1], NODE_Y[2], NODE_Y[1], NODE_Y[0]] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', times: [0, 0.3, 0.55, 0.78, 1] }}
      >
        🚶
      </motion.div>

      {slots.map((slot, i) => {
        const meta        = SLOT_META[slot];
        const activity    = day[slot];
        const nextSlot    = slots[i + 1];
        const nextActivity = nextSlot ? day[nextSlot] : null;

        return (
          <div key={slot}>
            <div className="flex gap-3 items-start">
              {/* Node column */}
              <div className="flex flex-col items-center flex-shrink-0 pt-2" style={{ width: 32 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 24, delay: i * 0.08 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 shadow-md"
                  style={{
                    background: meta.nodeColor,
                    boxShadow: `0 0 0 4px ${meta.ringColor}, 0 2px 8px ${meta.ringColor}`,
                  }}
                >
                  {meta.icon}
                </motion.div>

                {/* Vibrant coral→lime path connector */}
                {nextActivity && (
                  <div
                    className="w-1 flex-1 mt-1.5 rounded-full"
                    style={{
                      background: 'linear-gradient(to bottom, #ff5a5f, #84cc16)',
                      minHeight: 28,
                      opacity: 0.55,
                    }}
                  />
                )}
              </div>

              {/* Activity card */}
              <div className="flex-1 pb-2 min-w-0">
                <div
                  className="text-[9px] font-bold uppercase tracking-widest mb-1.5"
                  style={{ color: meta.nodeColor }}
                >
                  {meta.label}
                </div>
                <ActivityCompactCard
                  slot={slot}
                  activity={activity}
                  destination={destination}
                  onRefresh={onSwapSlot ? () => handleSwap(slot) : undefined}
                  refreshing={swapping === slot}
                />
              </div>
            </div>

            {/* Transit badge between slots */}
            {nextActivity && (
              <div className="ml-9">
                <TransitBadge text={nextActivity.transitFromPrevious ?? ''} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Dining section ───────────────────────────────────────────────────────────

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

// ─── Insider Reveal ───────────────────────────────────────────────────────────

const insightStagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const insightItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
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
            ? 'border-violet-300 bg-violet-50 text-violet-700'
            : 'border-[#e5e7eb] bg-[#f8f7f2] text-[#6b7280] hover:border-violet-200 hover:text-violet-600'
        }`}
      >
        <span className="flex items-center gap-2">
          <span>🤫</span>
          {open ? 'Hide intel' : `Pro Move · ${tipInsights.length} insider secret${tipInsights.length > 1 ? 's' : ''}`}
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
                <motion.div key={i} variants={insightItem}><WebInsightBadge insight={insight} /></motion.div>
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
  const warnings = day.webInsights?.filter((i) => i.type === 'warning') ?? [];

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden shadow-sm">
      {/* Day header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#f3f4f6] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {/* Day number bubble */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #ff5a5f, #8b5cf6)' }}
          >
            {index + 1}
          </div>
          <div>
            <div className="text-xs text-[#9ca3af] font-medium tracking-wide">{day.date}</div>
            <h3 className="font-bold text-[#111827] tracking-tight text-sm">{day.theme}</h3>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#9ca3af] uppercase tracking-wide">Est. spend</div>
          <div className="text-sm font-bold text-[#111827] tracking-tight">{day.estimatedDailyCost}</div>
        </div>
      </div>

      {/* Warnings pinned below header */}
      {warnings.length > 0 && (
        <div className="px-4 pt-3 flex flex-col gap-1.5">
          {warnings.map((w, i) => <WebInsightBadge key={i} insight={w} />)}
        </div>
      )}

      {/* Waze timeline */}
      <div className="pt-3">
        <WazeTimeline day={day} destination={destination} onSwapSlot={onSwapSlot} />
      </div>

      {/* Insider reveal */}
      <InsiderReveal insights={day.webInsights ?? []} />

      {/* Dining */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af] mb-2">Squad Eats</div>
        <div className="grid sm:grid-cols-2 gap-2">
          <DiningBlock meal="Lunch" spot={day.lunch} />
          <DiningBlock meal="Dinner" spot={day.dinner} />
        </div>
      </div>

      {/* Transport tip */}
      {day.transportTip && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-600 mb-1">🚌 Getting Around</div>
            <p className="text-xs text-blue-700 leading-relaxed">{day.transportTip}</p>
          </div>
        </div>
      )}
    </div>
  );
}
