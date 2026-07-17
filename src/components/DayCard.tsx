'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Map, Link2, Check } from 'lucide-react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { DayPlan, Activity, DiningSpot, VibeLabel, WebInsight, Itinerary, TravelerProfile } from '@/lib/types';
import { classifyActivity, type ActivityGenre } from '@/lib/activityGenre';
import { DayPhoto } from './DayPhoto';
import { VideoPreview } from './VideoPreview';
import { WebInsightBadge } from './WebInsightBadge';
import { DayTimeline } from './DayTimeline';
import { GenreCube } from './GenreCube';
import { TripPill } from './TripPill';
import { SmartSwapSheet } from '@/components/SmartSwapSheet';
import type { PlaceCardData } from '@/components/PlaceCard';
import type { MapPlace } from '@/components/InteractiveMap';
import { dayCardUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';

// ── Interactive map — SSR disabled (mapbox-gl touches window) ─────────────────
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap').then((m) => ({ default: m.InteractiveMap })),
  {
    ssr: false,
    loading: () => (
      <div
        className="rounded-2xl animate-pulse"
        style={{
          height: 280,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      />
    ),
  },
);

// ─── Spring preset ────────────────────────────────────────────────────────────

const SPRING = { type: 'spring' as const, stiffness: 100, damping: 20 };

const SLOT_GRADIENT: Record<string, string> = {
  morning:   'linear-gradient(135deg, #C9A84C 0%, #a89254 100%)',
  afternoon: 'linear-gradient(135deg, #a89254 0%, #C9A84C 100%)',
  evening:   'linear-gradient(135deg, #2d545e 0%, #12343b 100%)',
};

const SLOT_META_EN = {
  morning:   { icon: '🌅', label: 'Morning' },
  afternoon: { icon: '☀️',  label: 'Afternoon' },
  evening:   { icon: '🌙', label: 'Evening' },
} as const;

type Slot = keyof typeof SLOT_META_EN;

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

const GENRE_CONFIG: Record<ActivityGenre, { icon: string; label: string; accent: string }> = {
  sightseeing: { icon: '🏛️', label: 'Sightseeing & Vibes',  accent: '#3b82f6' },
  food:        { icon: '🍽️', label: 'Food & Dining',         accent: '#f97316' },
  shopping:    { icon: '🛍️', label: 'Shopping & Style',      accent: '#ec4899' },
  nightlife:   { icon: '🎶', label: 'Nightlife & Culture',   accent: '#8b5cf6' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a Google Maps place-search URL to open the actual POI page. */
const COUNTRY_BY_CITY: Record<string, string> = {
  budapest: 'Hungary',
  athens: 'Greece',
  paris: 'France',
  london: 'United Kingdom',
  rome: 'Italy',
};

function inferCountry(city?: string | null): string | undefined {
  if (!city) return undefined;
  return COUNTRY_BY_CITY[city.trim().toLowerCase()];
}

function buildMapsUrl(
  name?: string | null,
  neighborhood?: string | null,
  city?: string | null,
  lat?: number | null,
  lng?: number | null,
): string | undefined {
  const country = inferCountry(city);
  const q = [name?.trim(), neighborhood?.trim(), city?.trim(), country].filter(Boolean).join(', ');
  if (q) {
    let url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    const la = Number(lat);
    const lo = Number(lng);
    if (Number.isFinite(la) && Number.isFinite(lo)) {
      url += `&center=${la},${lo}&zoom=17`;
    }
    return url;
  }
  const la = Number(lat);
  const lo = Number(lng);
  if (Number.isFinite(la) && Number.isFinite(lo)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${la},${lo}`)}`;
  }
  return undefined;
}

// ─── Multi-stop route builder ─────────────────────────────────────────────────

const ACTIVITY_CATEGORY_LABEL: Record<string, string> = {
  sightseeing: 'Attraction',
  food:        'Dining',
  shopping:    'Shopping',
  nightlife:   'Nightlife',
};

function generateFullDayRouteUrl(
  day: DayPlan,
  destination: string,
): { url: string; stopCount: number } | null {
  const city = destination || '';
  const labels: string[] = [];

  // Helper: validate GPS before including a stop in the route
  const hasGps = (lat?: number | null, lng?: number | null) => {
    if (lat == null || lng == null) return false;
    const la = Number(lat); const lo = Number(lng);
    return Number.isFinite(la) && Number.isFinite(lo) && !(la === 0 && lo === 0);
  };

  // Chronological order: breakfast → morning → lunch → afternoon → dinner → evening
  if (day.breakfast?.name && hasGps(day.breakfast.latitude, day.breakfast.longitude)) {
    labels.push(`${day.breakfast.name} (Breakfast) ${city}`);
  }
  if (day.morning?.name && hasGps(day.morning.latitude, day.morning.longitude)) {
    const cat = ACTIVITY_CATEGORY_LABEL[classifyActivity(day.morning)] ?? 'Attraction';
    labels.push(`${day.morning.name} (${cat}) ${city}`);
  }
  if (day.lunch?.name && hasGps(day.lunch.latitude, day.lunch.longitude)) {
    labels.push(`${day.lunch.name} (Lunch) ${city}`);
  }
  if (day.afternoon?.name && hasGps(day.afternoon.latitude, day.afternoon.longitude)) {
    const cat = ACTIVITY_CATEGORY_LABEL[classifyActivity(day.afternoon)] ?? 'Attraction';
    labels.push(`${day.afternoon.name} (${cat}) ${city}`);
  }
  if (day.dinner?.name && hasGps(day.dinner.latitude, day.dinner.longitude)) {
    labels.push(`${day.dinner.name} (Dinner) ${city}`);
  }
  if (day.evening?.name && hasGps(day.evening.latitude, day.evening.longitude)) {
    const cat = ACTIVITY_CATEGORY_LABEL[classifyActivity(day.evening)] ?? 'Nightlife';
    labels.push(`${day.evening.name} (${cat}) ${city}`);
  }

  // Safety cap: max 9 stops (Google Maps Directions limit)
  const limited = labels.slice(0, 9);
  if (limited.length === 0) return null;

  let url: string;
  if (limited.length === 1) {
    url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(limited[0])}`;
  } else {
    const origin    = encodeURIComponent(limited[0]);
    const dest      = encodeURIComponent(limited[limited.length - 1]);
    const waypoints = limited.slice(1, -1).map(encodeURIComponent).join('|');
    url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=walking`;
    if (waypoints) url += `&waypoints=${waypoints}`;
  }

  return { url, stopCount: limited.length };
}

// ─── Card builders ────────────────────────────────────────────────────────────

/** Convert an Activity slot into a PlaceCardData. */
function activityToCard(
  activity: Activity,
  slot: Slot,
  dayIdx: number,
  city?: string,
  mealSlot?: 'breakfast' | 'lunch' | 'dinner',
  swapEligible?: boolean,
): PlaceCardData {
  return {
    id:          `day${dayIdx}-${slot}-${(activity.name ?? 'act').replace(/\s+/g, '-').toLowerCase()}`,
    name:        activity.name ?? 'Activity',
    emoji:       getVibeIcon(activity.tags ?? [], activity.name ?? ''),
    vibeLabel:   activity.vibeLabel ?? 'classic',
    description: activity.description ?? '',
    highlights:  (activity.tags ?? []).slice(0, 4),
    neighborhood: activity.neighborhood,
    city,
    category:    slot,
    estimatedCost: activity.estimatedCost,
    lat:         activity.latitude,
    lng:         activity.longitude,
    mapsUrl:     buildMapsUrl(activity.name, activity.neighborhood, city, activity.latitude, activity.longitude),
    mealSlot,
    verificationStatus: activity.verificationStatus,
    verifiedAt:  activity.verifiedAt,
    cubePhotoGenre: classifyActivity(activity),
    smartSwap:
      swapEligible ? { slot, dayIndex: dayIdx, activity } : undefined,
  };
}

// Maps meal slots to the activity-slot enum used by smartSwap
const MEAL_TO_SLOT: Record<'breakfast' | 'lunch' | 'dinner', 'morning' | 'afternoon' | 'evening'> = {
  breakfast: 'morning',
  lunch:     'afternoon',
  dinner:    'evening',
};

/** Convert an explicit DiningSpot into a PlaceCardData with meal badge. */
function diningToCard(
  spot: DiningSpot,
  meal: 'breakfast' | 'lunch' | 'dinner',
  dayIdx: number,
  city?: string,
  swapEligible?: boolean,
): PlaceCardData {
  const MEAL_EMOJI: Record<'breakfast' | 'lunch' | 'dinner', string> = {
    breakfast: '☕', lunch: '🍽️', dinner: '🌙',
  };
  const spotName = spot.name ?? (meal === 'breakfast' ? 'Breakfast Spot' : meal === 'lunch' ? 'Lunch Spot' : 'Dinner Spot');
  const spotDesc = [
    spot.mustTry ? `Must try: ${spot.mustTry}` : '',
    spot.cuisine ?? '',
  ].filter(Boolean).join(' · ') || 'Local dining recommendation';

  // Build a minimal synthetic Activity so SmartSwap can fetch food alternatives
  const syntheticActivity: Activity = {
    name:          spotName,
    description:   spotDesc,
    neighborhood:  spot.neighborhood,
    latitude:      spot.latitude  != null ? Number(spot.latitude)  : undefined,
    longitude:     spot.longitude != null ? Number(spot.longitude) : undefined,
    estimatedCost: spot.priceRange,
    tags:          spot.cuisine ? [spot.cuisine] : [],
    vibeLabel:     'local-favorite',
  } as Activity;

  const slot = MEAL_TO_SLOT[meal];

  return {
    id:          `day${dayIdx}-${meal}-${(spot.name ?? 'dining').replace(/\s+/g, '-').toLowerCase()}`,
    name:        spotName,
    emoji:       MEAL_EMOJI[meal],
    vibeLabel:   'local-favorite',
    description: spotDesc,
    neighborhood: spot.neighborhood,
    city,
    category:    spot.cuisine,
    estimatedCost: spot.priceRange,
    mealSlot:    meal,
    // Pass GPS if the AI returned it — feeds into mapPlaces below
    lat:         spot.latitude  != null ? Number(spot.latitude)  : undefined,
    lng:         spot.longitude != null ? Number(spot.longitude) : undefined,
    mapsUrl:     buildMapsUrl(spot.name, spot.neighborhood, city, spot.latitude, spot.longitude),
    cubePhotoGenre: 'food',
    smartSwap:   swapEligible ? { slot, dayIndex: dayIdx, activity: syntheticActivity, diningField: meal } : undefined,
  };
}

// ─── Particle burst ───────────────────────────────────────────────────────────

const BURST_COLORS = ['#a89254', '#2d545e', '#C9A84C', '#f59e0b', '#10b981', '#8f7a42'];

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

function ReactionBar({ dc }: { dc: ReturnType<typeof dayCardUi> }) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [burst, setBurst] = useState<string | null>(null);

  const handleReact = (id: string) => {
    setCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
    setBurst(id);
    setTimeout(() => setBurst(null), 750);
  };

  return (
    <div className="flex gap-2 pt-3 mt-3 border-t border-white/10">
      {dc.reactions.map((r) => (
        <div key={r.id} className="relative overflow-visible">
          <motion.button
            onClick={() => handleReact(r.id)}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.82, transition: { type: 'spring', stiffness: 700, damping: 16 } }}
            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
              (counts[r.id] ?? 0) > 0
                ? 'border-[#a89254]/40 bg-[#a89254]/15 text-[#C9A84C]'
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

function ReviewsCarousel({
  reviews,
  groupType,
  ui,
  dc,
}: {
  reviews: string[];
  groupType?: DayCardProps['groupType'];
  ui: ItineraryUiStrings;
  dc: ReturnType<typeof dayCardUi>;
}) {
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
        {dc.reviewsHeading(ui.audienceTitle(groupType))}
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
                backgroundColor: i === idx ? '#a89254' : 'rgba(255,255,255,0.15)',
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


// ─── Activity Modal ───────────────────────────────────────────────────────────

interface ModalProps {
  activity: Activity;
  slot: string;
  destination?: string;
  groupType?: DayCardProps['groupType'];
  onClose: () => void;
  /** Called with the user's request text when they hit Scout It */
  onSwap?: (request: string) => void;
  swapping?: boolean;
  smartSwapEnabled?: boolean;
  onRequestSmartSwap?: () => void;
  ui: ItineraryUiStrings;
  dc: ReturnType<typeof dayCardUi>;
}

function ActivityModal({
  activity,
  slot,
  destination,
  groupType,
  onClose,
  onSwap,
  swapping,
  smartSwapEnabled,
  onRequestSmartSwap,
  ui,
  dc,
}: ModalProps) {
  const [swapExpanded, setSwapExpanded] = useState(false);
  const [swapText, setSwapText]         = useState('');
  const { body, citation } = parseCitation(activity?.whyThis ?? '');
  const photoQuery = destination
    ? `${activity?.neighborhood ?? ''} ${destination}`.trim()
    : (activity?.neighborhood ?? 'travel');
  const vibeIcon  = getVibeIcon(activity?.tags ?? [], activity?.name ?? '');
  const vibeKey   = activity?.vibeLabel ? String(activity.vibeLabel) : '';
  const vibeChipLabel = activity?.vibeLabel ? (dc.vibeLabel[activity.vibeLabel as VibeLabel] ?? '') : '';
  const liveBuzz  = hasLiveBuzz(activity?.tags ?? [], activity?.name ?? '', activity?.description);
  const slotMeta  = dc.slotMeta[slot as Slot];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

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
        <div
          className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
          style={{ background: SLOT_GRADIENT[slot] ?? SLOT_GRADIENT.morning, opacity: 0.06, filter: 'blur(60px)' }}
        />

        <div className="relative flex-shrink-0">
          <DayPhoto query={photoQuery} alt={activity.name} ratio="3/2" />

          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.85 }}
            aria-label="Close activity details"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
            style={{ background: 'rgba(15,17,23,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            ✕
          </motion.button>

          {slotMeta && (
            <div className="absolute top-3 left-3 z-10">
              <TripPill variant="slot" icon={slotMeta.icon} label={slotMeta.label} size="md" />
            </div>
          )}
        </div>

        <div className="overflow-y-auto flex-1 relative z-10">
          <div className="px-5 pt-5 pb-8">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-white font-bold text-xl tracking-tight leading-tight">{activity?.name ?? 'Activity'}</h3>
                <p className="text-white/45 text-sm mt-1">📍 {activity?.neighborhood ?? '—'}</p>
              </div>
              <span className="text-4xl flex-shrink-0 mt-0.5 select-none">{vibeIcon}</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              {vibeKey && vibeChipLabel && (
                <TripPill variant="vibe" vibeKey={vibeKey} label={vibeChipLabel} size="md" />
              )}
              {isSquadFriendly(activity.tags ?? []) && (
                <TripPill
                  variant="accent"
                  icon="⚡"
                  label={dc.squadPick(ui.audienceTitle(groupType))}
                  tint="emerald"
                  size="md"
                />
              )}
              {liveBuzz && (
                <TripPill variant="accent" icon="📡" label={dc.liveBuzz} tint="gold" pulse size="md" />
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {activity?.startTime && activity?.endTime && (
                <span className="text-[10px] font-mono font-semibold bg-[#a89254]/10 px-2.5 py-1 rounded-lg border border-[#a89254]/15" style={{ color: '#C9A84C' }}>
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

            {activity?.description && (
              <p className="text-white/65 text-sm leading-relaxed mb-4">{activity.description}</p>
            )}

            {activity.bestTimeToVisit && (
              <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-2xl border border-amber-500/15"
                style={{ background: 'rgba(245,158,11,0.07)' }}>
                <span className="text-xs flex-shrink-0 mt-0.5">⏰</span>
                <p className="text-xs text-amber-300/75 leading-relaxed">{activity.bestTimeToVisit}</p>
              </div>
            )}

            {(activity?.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {(activity?.tags ?? []).map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/35 border border-white/8">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {body && (
              <div className="rounded-2xl px-4 py-3 border-l-2 mb-4"
                style={{ background: 'rgba(255,255,255,0.04)', borderLeftColor: 'rgba(201,168,76,0.50)' }}>
                <span className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#a89254' }}>{dc.whyThis}</span>
                <p className="text-xs text-white/55 leading-relaxed">{body}</p>
                {citation && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-[#a89254]/10 border border-[#a89254]/15 px-2 py-0.5 rounded-full mt-1.5" style={{ color: '#C9A84C' }}>
                    <span className="opacity-60">📖</span>{citation}
                  </span>
                )}
              </div>
            )}

            <VideoPreview videoUrl={activity?.videoUrl} activityName={activity?.name ?? ''} />

            {(activity?.reviews?.length ?? 0) > 0 && (
              <ReviewsCarousel reviews={activity!.reviews!} groupType={groupType} ui={ui} dc={dc} />
            )}

            <ReactionBar dc={dc} />

            {smartSwapEnabled && onRequestSmartSwap && (
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={onRequestSmartSwap}
                disabled={swapping}
                whileTap={{ scale: 0.97 }}
                className="mt-5 w-full py-3 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #a89254 0%, #C9A84C 55%, #8f7a42 100%)',
                  boxShadow: '0 6px 22px rgba(201,168,76,0.35)',
                }}
              >
                ✨ {dc.smartSwapTitle}
              </motion.button>
            )}

            {onSwap && (
              <div className={smartSwapEnabled ? 'mt-3' : 'mt-5'}>
                <AnimatePresence mode="wait">
                  {!swapExpanded ? (
                    smartSwapEnabled ? (
                      <motion.button
                        key="swap-custom-trigger"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSwapExpanded(true)}
                        disabled={swapping}
                        whileTap={{ scale: 0.95 }}
                        className="w-full py-3 rounded-2xl text-sm font-semibold border border-white/10 bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                      >
                        {dc.smartSwapCustom}
                      </motion.button>
                    ) : (
                    <motion.button
                      key="swap-trigger"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setSwapExpanded(true)}
                      disabled={swapping}
                      whileTap={{ scale: 0.95 }}
                      className="w-full py-3 rounded-2xl text-sm font-semibold border border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/75 transition-all flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <motion.span
                        animate={swapping ? { rotate: 360 } : { rotate: 0 }}
                        transition={swapping ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                      >
                        ↻
                      </motion.span>
                      {swapping ? dc.swapFinding : dc.swapThis}
                    </motion.button>
                    )
                  ) : (
                    <motion.div
                      key="swap-form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className="flex flex-col gap-2"
                    >
                      <label className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                        {dc.swapWhatInstead}
                      </label>
                      <input
                        type="text"
                        autoFocus
                        placeholder={dc.swapPlaceholder}
                        value={swapText}
                        onChange={(e) => setSwapText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !swapping) {
                            onSwap(swapText.trim() || `Suggest a better ${slot} activity`);
                          }
                          if (e.key === 'Escape') setSwapExpanded(false);
                        }}
                        disabled={swapping}
                        className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/25 outline-none disabled:opacity-40"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.14)',
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(201,168,76,0.55)'; }}
                        onBlur={(e)  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }}
                      />
                      <div className="flex gap-2">
                        <motion.button
                          onClick={() => onSwap(swapText.trim() || `Suggest a better ${slot} activity`)}
                          disabled={swapping}
                          whileTap={{ scale: 0.95 }}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                          style={{
                            background: 'linear-gradient(135deg, #a89254 0%, #b8a066 100%)',
                            boxShadow: '0 4px 18px rgba(201,168,76,0.28)',
                          }}
                        >
                          <motion.span
                            animate={swapping ? { rotate: 360 } : { rotate: 0 }}
                            transition={swapping ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                          >
                            ↻
                          </motion.span>
                          {swapping ? dc.swapScouting : dc.scoutItButton}
                        </motion.button>
                        <motion.button
                          onClick={() => { setSwapExpanded(false); setSwapText(''); }}
                          disabled={swapping}
                          whileTap={{ scale: 0.95 }}
                          className="px-4 py-2.5 rounded-xl text-sm text-white/40 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white/60 transition-all disabled:opacity-40"
                        >
                          {dc.swapCancel}
                        </motion.button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Bento Tile ───────────────────────────────────────────────────────────────

interface SmartSwapContext {
  itinerary: Itinerary;
  dayIndex: number;
  profile: TravelerProfile | null;
  onCommitSlot: (slot: Slot, activity: Activity, summary: string) => Promise<void>;
}

interface BentoTileProps {
  slot: Slot;
  activity: Activity;
  height: number;
  destination?: string;
  groupType?: DayCardProps['groupType'];
  onRefresh?: (request?: string) => void;
  refreshing?: boolean;
  smartSwap?: SmartSwapContext;
  ui: ItineraryUiStrings;
  dc: ReturnType<typeof dayCardUi>;
}

function BentoTile({
  slot,
  activity,
  height,
  destination,
  groupType,
  onRefresh,
  refreshing,
  smartSwap,
  ui,
  dc,
}: BentoTileProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [smartOpen, setSmartOpen] = useState(false);

  const photoQuery  = destination
    ? `${activity?.neighborhood ?? ''} ${destination}`.trim()
    : (activity?.neighborhood ?? destination ?? 'travel');
  const vibeIcon    = getVibeIcon(activity?.tags ?? [], activity?.name ?? '');
  const vibeMatch   = getVibeMatch(activity?.vibeLabel, activity?.isHiddenGem);
  const squad       = isSquadFriendly(activity?.tags ?? []);
  const vibeKey       = activity?.vibeLabel ? String(activity.vibeLabel) : '';
  const vibeChipLabel = activity?.vibeLabel ? (dc.vibeLabel[activity.vibeLabel as VibeLabel] ?? '') : '';
  const liveBuzz    = hasLiveBuzz(activity?.tags ?? [], activity?.name ?? '', activity?.description);
  const meta        = dc.slotMeta[slot];

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
        <AnimatePresence>
          {refreshing && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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

        <div className="absolute inset-0 pointer-events-none">
          <DayPhoto query={photoQuery} alt={activity?.name ?? 'Activity'} height={height} />
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: SLOT_GRADIENT[slot], opacity: 0.28, mixBlendMode: 'multiply' }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.08] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/92 via-black/40 to-transparent pointer-events-none" />

        <div className="absolute top-2.5 right-2.5 z-10">
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            {dc.matchPercent(vibeMatch)}
          </span>
        </div>

        <div className="absolute top-2.5 left-2.5 z-10 flex gap-1 flex-wrap items-center">
          <TripPill variant="slot" icon={meta.icon} label={meta.label} size="sm" />
          {vibeKey && vibeChipLabel && (
            <TripPill variant="vibe" vibeKey={vibeKey} label={vibeChipLabel} size="sm" />
          )}
          {squad && (
            <TripPill
              variant="accent"
              icon="⚡"
              label={dc.squadPick(ui.audienceTitle(groupType))}
              tint="emerald"
              size="sm"
            />
          )}
          {liveBuzz && (
            <TripPill variant="accent" icon="📡" label={dc.live} tint="gold" pulse size="sm" />
          )}
        </div>

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

        <div className="absolute bottom-0 inset-x-0 px-3.5 pb-3.5 z-10">
          <h4 className="font-bold text-white text-sm tracking-tight leading-tight line-clamp-1 drop-shadow">
            {activity?.name ?? 'Activity'}
          </h4>
          <div className="flex items-center justify-between mt-1 gap-2">
            <p className="text-white/55 text-[11px] leading-tight truncate min-w-0">
              📍 {activity?.neighborhood ?? '—'}
            </p>
            <div className="flex items-center gap-1.5 shrink-0">
              {smartSwap && (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSmartOpen(true);
                  }}
                  whileTap={{ scale: 0.92 }}
                  className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg text-white border border-white/20"
                  style={{ background: 'rgba(201,168,76,0.55)', backdropFilter: 'blur(8px)' }}
                >
                  {dc.smartSwapButton}
                </motion.button>
              )}
              {!smartSwap && onRefresh && (
                <motion.button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefresh();
                  }}
                  disabled={refreshing}
                  aria-label="Refresh activity"
                  whileTap={{ scale: 0.82 }}
                  animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                  transition={refreshing ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                  className="w-7 h-7 flex items-center justify-center rounded-xl text-xs text-white disabled:opacity-40 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)' }}
                >
                  ↻
                </motion.button>
              )}
              <span className="text-white/25 text-[10px] hidden sm:inline group-hover:text-white/55 transition-colors">
                tap →
              </span>
            </div>
          </div>
        </div>
      </motion.button>

      <AnimatePresence>
        {modalOpen && (
          <ActivityModal
            activity={activity}
            slot={slot}
            destination={destination}
            groupType={groupType}
            onClose={() => setModalOpen(false)}
            onSwap={onRefresh ? (req) => { onRefresh(req); setModalOpen(false); } : undefined}
            swapping={refreshing}
            smartSwapEnabled={!!smartSwap}
            onRequestSmartSwap={
              smartSwap
                ? () => {
                    setModalOpen(false);
                    setSmartOpen(true);
                  }
                : undefined
            }
            ui={ui}
            dc={dc}
          />
        )}
      </AnimatePresence>

      {smartOpen && smartSwap && (() => {
        const g = classifyActivity(activity);
        return (
          <SmartSwapSheet
            open={smartOpen}
            onClose={() => setSmartOpen(false)}
            itinerary={smartSwap.itinerary}
            dayIndex={smartSwap.dayIndex}
            slot={slot}
            activity={activity}
            profile={smartSwap.profile}
            genreLabel={dc.genreLabel[g] ?? GENRE_CONFIG[g].label}
            onCommit={(next, summary) => smartSwap.onCommitSlot(slot, next, summary)}
            ui={ui}
            dc={dc}
          />
        );
      })()}
    </>
  );
}

// ─── Bento Grid ───────────────────────────────────────────────────────────────

interface BentoGridProps {
  day: DayPlan;
  destination?: string;
  groupType?: DayCardProps['groupType'];
  onSwapSlot?: (slot: Slot, request?: string) => Promise<void>;
  ui: ItineraryUiStrings;
  dc: ReturnType<typeof dayCardUi>;
}

function BentoGrid({ day, destination, groupType, onSwapSlot, ui, dc }: BentoGridProps) {
  const [swapping, setSwapping] = useState<Slot | null>(null);

  const handleSwap = async (slot: Slot, request?: string) => {
    if (!onSwapSlot || swapping) return;
    setSwapping(slot);
    try { await onSwapSlot(slot, request); }
    finally { setSwapping(null); }
  };

  return (
    <div className="px-4 pb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {day.morning && (
          <div className="sm:col-span-2">
            <BentoTile slot="morning" activity={day.morning} height={240} destination={destination}
              groupType={groupType}
              onRefresh={onSwapSlot ? (req) => handleSwap('morning', req) : undefined}
              refreshing={swapping === 'morning'}
              ui={ui}
              dc={dc} />
          </div>
        )}
        {day.afternoon && (
          <div className="sm:col-span-1">
            <BentoTile slot="afternoon" activity={day.afternoon} height={240} destination={destination}
              groupType={groupType}
              onRefresh={onSwapSlot ? (req) => handleSwap('afternoon', req) : undefined}
              refreshing={swapping === 'afternoon'}
              ui={ui}
              dc={dc} />
          </div>
        )}
        {day.evening && (
          <div className="sm:col-span-3">
            <BentoTile slot="evening" activity={day.evening} height={200} destination={destination}
              groupType={groupType}
              onRefresh={onSwapSlot ? (req) => handleSwap('evening', req) : undefined}
              refreshing={swapping === 'evening'}
              ui={ui}
              dc={dc} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Insider Reveal ───────────────────────────────────────────────────────────

const insightStagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const insightItem = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 380, damping: 28 } },
};

function InsiderReveal({ insights, dc }: { insights: WebInsight[]; dc: ReturnType<typeof dayCardUi> }) {
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
          {open ? dc.insiderOpen : dc.insiderClosed(tipInsights.length)}
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
  groupType?: 'solo' | 'couple' | 'family' | 'group';
  onSwapSlot?: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => Promise<void>;
  /** Final itinerary — enables smart swap (two proposals) on place cards when set with onCommitActivitySwap */
  itinerary?: Itinerary | null;
  profile?: TravelerProfile | null;
  onCommitActivitySwap?: (slot: Slot, activity: Activity, summary: string, diningField?: 'breakfast' | 'lunch' | 'dinner') => Promise<void>;
  onNeighborhoodClick?: (neighborhood: string) => void;
  ui: ItineraryUiStrings;
}

export function DayCard({
  day,
  index,
  destination,
  groupType,
  onSwapSlot,
  itinerary,
  profile,
  onCommitActivitySwap,
  ui,
}: DayCardProps) {
  const [open, setOpen]     = useState(false);
  const [copied, setCopied] = useState(false);
  const warnings    = day.webInsights?.filter((i) => i.type === 'warning') ?? [];
  const tipInsights = (day.webInsights ?? []).filter((i) => i.type !== 'warning');
  const dc = useMemo(() => dayCardUi(ui.lang), [ui.lang]);
  const swapEligible = !!(itinerary && onCommitActivitySwap);

  // ── Genre buckets ─────────────────────────────────────────────────────────
  const byGenre: Record<ActivityGenre, PlaceCardData[]> = {
    sightseeing: [], food: [], shopping: [], nightlife: [],
  };

  const dayActivities: { activity: Activity; slot: Slot }[] = [
    day.morning   ? { activity: day.morning,   slot: 'morning'   as const } : null,
    day.afternoon ? { activity: day.afternoon, slot: 'afternoon' as const } : null,
    day.evening   ? { activity: day.evening,   slot: 'evening'   as const } : null,
  ].filter((e): e is { activity: Activity; slot: Slot } => e !== null);

  // Non-food activities → their genre bucket (food handled separately below)
  dayActivities.forEach(({ activity, slot }) => {
    const genre = classifyActivity(activity);
    if (genre !== 'food')
      byGenre[genre].push(activityToCard(activity, slot, index, destination, undefined, swapEligible));
  });

  // ── Meal cards (real spots only — no placeholders) ───────────────────────
  //
  //  Priority per slot:
  //    1. Explicit DiningSpot (day.breakfast / day.lunch / day.dinner)
  //    2. Activity in that slot that classifies as food
  //    3. null — slot simply omitted from the Food cube
  //
  const morningIsFood   = day.morning   && classifyActivity(day.morning)   === 'food';
  const afternoonIsFood = day.afternoon && classifyActivity(day.afternoon) === 'food';
  const eveningIsFood   = day.evening   && classifyActivity(day.evening)   === 'food';

  const mealCards: Record<'breakfast' | 'lunch' | 'dinner', PlaceCardData | null> = {
    breakfast:
      day.breakfast
        ? diningToCard(day.breakfast, 'breakfast', index, destination, swapEligible)
        : morningIsFood && day.morning
          ? activityToCard(day.morning,   'morning',   index, destination, 'breakfast', swapEligible)
          : null,

    lunch:
      day.lunch
        ? diningToCard(day.lunch, 'lunch', index, destination, swapEligible)
        : afternoonIsFood && day.afternoon
          ? activityToCard(day.afternoon, 'afternoon', index, destination, 'lunch', swapEligible)
          : null,

    dinner:
      day.dinner
        ? diningToCard(day.dinner, 'dinner', index, destination, swapEligible)
        : eveningIsFood && day.evening
          ? activityToCard(day.evening,   'evening',   index, destination, 'dinner', swapEligible)
          : null,
  };

  // Only real cards — filter out null so no phantom slots appear
  byGenre.food = [mealCards.breakfast, mealCards.lunch, mealCards.dinner].filter(
    (c): c is PlaceCardData => c !== null,
  );

  // ── Map layer: ALL activities + dining spots with GPS ─────────────────────
  // Sources:
  //   1. morning / afternoon / evening Activity slots (sightseeing, shopping, etc.)
  //   2. lunch / dinner DiningSpot objects (when Claude returned GPS coords)
  // Each pin carries a `category` and `slotLabel` for colour + popup context.
  const mapPlaces = useMemo<MapPlace[]>(() => {
    const pins: MapPlace[] = [];

    // ── Activity slots ────────────────────────────────────────────────────
    const slotMap: [Slot, Activity | undefined][] = [
      ['morning',   day.morning],
      ['afternoon', day.afternoon],
      ['evening',   day.evening],
    ];
    for (const [slot, act] of slotMap) {
      if (!act) continue;
      // Guard: skip if coords are missing, non-finite, or zero (null-island)
      if (act.latitude == null || act.longitude == null) continue;
      const lat = Number(act.latitude);
      const lng = Number(act.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      const genre    = classifyActivity(act);
      const slotMeta = dc.slotMeta[slot];
      const catLabel = dc.genreLabel[genre] ?? GENRE_CONFIG[genre]?.label ?? genre;
      pins.push({
        id:        `day${index}-${slot}-${(act.name ?? 'act').replace(/\s+/g, '-').toLowerCase()}`,
        name:      act.name ?? slot,
        emoji:     act.category_emoji ?? getVibeIcon(act.tags ?? [], act.name ?? ''),
        lat,
        lng,
        vibeLabel: act.vibeLabel ?? 'classic',
        category:  genre,
        slotLabel: `${slotMeta.icon} ${slotMeta.label} · ${catLabel}`,
        city: destination,
        country: inferCountry(destination),
        neighborhood: act.neighborhood,
      });
    }

    // ── Dining spots (lunch / dinner) ─────────────────────────────────────
    const MEAL_META: { spot: DiningSpot | undefined; meal: 'breakfast' | 'lunch' | 'dinner'; icon: string; label: string }[] = [
      { spot: day.breakfast, meal: 'breakfast', icon: '☕', label: dc.mealBreakfast },
      { spot: day.lunch,     meal: 'lunch',     icon: '🍽️', label: dc.mealLunch },
      { spot: day.dinner,    meal: 'dinner',    icon: '🌙', label: dc.mealDinner },
    ];
    const MEAL_EMOJI: Record<'breakfast' | 'lunch' | 'dinner', string> = {
      breakfast: '☕', lunch: '🍽️', dinner: '🌙',
    };
    for (const { spot, meal, icon, label } of MEAL_META) {
      if (!spot) continue;
      // Guard: skip if coords are missing, non-finite, or zero (null-island)
      if (spot.latitude == null || spot.longitude == null) continue;
      const lat = Number(spot.latitude);
      const lng = Number(spot.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
      // ID matches diningToCard so flyToId wiring works
      const id = `day${index}-${meal}-${(spot.name ?? 'dining').replace(/\s+/g, '-').toLowerCase()}`;
      pins.push({
        id,
        name:      spot.name ?? `${label} Spot`,
        emoji:     MEAL_EMOJI[meal],
        lat,
        lng,
        vibeLabel: 'local-favorite',
        category:  'food',
        slotLabel: `${icon} ${label} · ${dc.genreLabel.food}`,
        city: destination,
        country: inferCountry(destination),
        neighborhood: spot.neighborhood,
      });
    }

    return pins;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.morning, day.afternoon, day.evening, day.lunch, day.dinner, day.breakfast, index, dc, destination]);

  // ── Multi-stop day route URL ───────────────────────────────────────────────
  const routeInfo = useMemo(
    () => generateFullDayRouteUrl(day, destination ?? ''),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [day.breakfast, day.morning, day.lunch, day.afternoon, day.dinner, day.evening, destination],
  );

  // ── Fly-to wiring ─────────────────────────────────────────────────────────
  //   GenreCube.onOpen  → first place in that cube with GPS → flyToId
  //   PlaceCard.onSelect → clicked place id → flyToId (if it has GPS)
  const [flyToId, setFlyToId] = useState<string | null>(null);

  const handleGenreOpen = useCallback(
    (cubePlaces: PlaceCardData[]) => {
      // Try to fly to the first map pin that matches one of the cube's place IDs
      const cubeIds = new Set(cubePlaces.map((p) => p.id));
      const match = mapPlaces.find((mp) => cubeIds.has(mp.id));
      // Fallback: first map pin with valid coords (covers dining placeholders that
      // have no GPS — we just keep the camera where it is in that case)
      const target = match ?? mapPlaces.find((mp) => Number.isFinite(mp.lat) && Number.isFinite(mp.lng));
      if (target) setFlyToId(target.id);
    },
    [mapPlaces],
  );

  const handlePlaceSelect = useCallback(
    (placeId: string) => {
      if (mapPlaces.some((mp) => mp.id === placeId)) setFlyToId(placeId);
    },
    [mapPlaces],
  );

  // Slot preview pills shown in the collapsed header
  const slotPreviews: { icon: string; name: string }[] = [
    day.morning   ? { icon: '🌅', name: day.morning.name   } : null,
    day.afternoon ? { icon: '☀️',  name: day.afternoon.name } : null,
    day.evening   ? { icon: '🌙', name: day.evening.name   } : null,
  ].filter((e): e is { icon: string; name: string } => e !== null);

  return (
    <div
      className="rounded-3xl overflow-hidden relative"
      style={{
        background: 'rgba(11, 14, 20, 0.86)',
        backdropFilter: 'blur(24px) saturate(170%)',
        WebkitBackdropFilter: 'blur(24px) saturate(170%)',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 12px 56px -12px rgba(0,0,0,0.80), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}
    >
      {/* Ambient teal glow — top-right */}
      <div
        className="absolute top-0 right-0 w-72 h-48 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 80% 10%, rgba(45,84,94,0.30) 0%, transparent 65%)',
          filter: 'blur(1px)',
        }}
      />
      {/* Ambient gold glow — bottom-left */}
      <div
        className="absolute bottom-0 left-0 w-56 h-40 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at 20% 90%, rgba(168,146,84,0.12) 0%, transparent 60%)',
          filter: 'blur(1px)',
        }}
      />

      {/* Card noise grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* ── Accordion Header ───────────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left focus:outline-none relative z-10"
      >
        <div className="relative overflow-hidden border-b border-white/6">
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

          <div className="relative z-10 px-4 pt-4 pb-3 flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #a89254, #2d545e)',
                boxShadow: '0 0 20px rgba(201,168,76,0.35)',
              }}
            >
              {index + 1}
            </div>

            <div className="flex-1 min-w-0">
              {day.date && (
                <div className="text-[10px] text-white/35 font-medium tracking-wide leading-none mb-0.5">
                  {day.date}
                </div>
              )}
              <h3 className="font-bold text-white tracking-tight text-sm leading-snug truncate">
                {day.theme ?? `Day ${index + 1}`}
              </h3>
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

            <div className="flex items-center gap-2.5 flex-shrink-0">
              {day.estimatedDailyCost && (
                <div className="text-right hidden sm:block max-w-[200px]">
                  <p className="text-[10px] text-white/45 leading-snug">{dc.estSpendLine(day.estimatedDailyCost)}</p>
                </div>
              )}
              <motion.div
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: open ? 'rgba(201,168,76,0.15)' : 'rgba(255,255,255,0.08)',
                  border: open ? '1px solid rgba(201,168,76,0.3)' : '1px solid rgba(255,255,255,0.12)',
                }}
              >
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path
                    d="M1 1.5L6 6.5L11 1.5"
                    stroke={open ? 'rgba(192,80,96,0.9)' : 'rgba(255,255,255,0.5)'}
                    strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  />
                </svg>
              </motion.div>
            </div>
          </div>
        </div>
      </button>

      {/* ── Route Action Buttons ────────────────────────────────────────── */}
      {routeInfo && (
        <div className="px-4 py-2.5 border-b border-white/6 flex gap-2">
          {/* Start Day Route — opens Google Maps */}
          <a
            href={routeInfo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center gap-1.5 flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all hover:brightness-115 hover:shadow-[0_0_32px_rgba(184,85,46,0.30)] active:scale-[0.98]"
            style={{
              background: 'linear-gradient(145deg, rgba(184,85,46,0.60) 0%, rgba(143,66,32,0.94) 42%, rgba(125,43,47,0.98) 100%)',
              border: '2px solid rgba(224,164,75,0.70)',
              boxShadow:
                '0 0 0 1px rgba(224,164,75,0.35), 0 6px 22px rgba(0,0,0,0.35), 0 0 28px rgba(184,85,46,0.24)',
              color: '#f8fafc',
            }}
          >
            <Map size={12} />
            <span>{dc.startDayRoute}</span>
            <span
              className="ml-0.5 tabular-nums rounded-full px-1.5 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(255,255,255,0.18)', color: '#fff' }}
            >
              {routeInfo.stopCount}
            </span>
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              className="ml-0.5 transition-transform duration-200 group-hover:translate-x-0.5"
            >
              <path d="M2 5h6M5.5 2.5L8 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>

          {/* Copy Route Link — clipboard + toast */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(routeInfo.url).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all hover:brightness-125 active:scale-95"
            style={{
              background: copied
                ? 'rgba(16,185,129,0.12)'
                : 'rgba(255,255,255,0.04)',
              border: copied
                ? '1px solid rgba(16,185,129,0.35)'
                : '1px solid rgba(255,255,255,0.12)',
              color: copied ? '#34d399' : 'rgba(255,255,255,0.38)',
              minWidth: 110,
            }}
          >
            {copied ? <Check size={12} /> : <Link2 size={12} />}
            <span>{copied ? dc.copied : dc.copyRouteLink}</span>
          </button>
        </div>
      )}

      {/* ── Accordion Body ─────────────────────────────────────────────── */}
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
                {warnings.map((w, i) => <WebInsightBadge key={i} insight={w} />)}
              </div>
            )}

            {/* ── 📋 Daily Brief Strip ──────────────────────────────── */}
            {(day.estimatedDailyCost || day.transportTip) && (
              <div className="px-4 pt-4">
                <div
                  className="rounded-2xl px-4 py-3"
                  style={{
                    background: 'rgba(201,168,76,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderLeft: '2px solid rgba(201,168,76,0.35)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2.5">
                    <span className="text-sm leading-none">📋</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/35">{dc.dayBrief}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {day.estimatedDailyCost && (
                      <span
                        className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.28)', color: '#C9A84C' }}
                      >
                        💳 {day.estimatedDailyCost}
                      </span>
                    )}
                    {day.transportTip && (
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg"
                        style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)', color: 'rgba(52,211,153,0.85)' }}
                      >
                        🚌 {day.transportTip}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Genre Cubes ─────────────────────────────────────────── */}
            {(Object.entries(byGenre) as [ActivityGenre, PlaceCardData[]][])
              .filter(([, places]) => places.length > 0)
              .map(([key, places]) => {
                const cfg = GENRE_CONFIG[key];
                // All genre cubes use 2-column grid for consistent side-by-side card layout.
                const cols = 2 as const;
                return (
                  <div key={key} className="px-4 pt-3">
                    <GenreCube
                      icon={cfg.icon}
                      label={dc.genreLabel[key]}
                      accent={cfg.accent}
                      places={places}
                      columns={cols}
                      onOpen={handleGenreOpen}
                      onSelect={handlePlaceSelect}
                      smartSwap={
                        swapEligible && itinerary && onCommitActivitySwap
                          ? {
                              itinerary,
                              profile: profile ?? null,
                              onCommitSlot: onCommitActivitySwap,
                            }
                          : undefined
                      }
                      swapUi={swapEligible ? { ui, dc } : undefined}
                    />
                  </div>
                );
              })}

            {/* ── 📅 Day Timeline ──────────────────────────────────────── */}
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
                  <span className="text-[10px] font-bold uppercase tracking-widest text-rose-400/80">{dc.dayTimeline}</span>
                </div>
                <DayTimeline
                  day={day}
                  dayIndex={index}
                  destination={destination ?? ''}
                  ui={ui}
                  onSwapSlot={(slot, request) => onSwapSlot?.(slot, request)}
                  onNeighborhoodClick={() => {}}
                />
              </div>
            </div>

            {/* ── 📍 Day Route — Interactive Map ───────────────────────── */}
            {/*
             * The map lives here in the itinerary (DayCard), not in /explore.
             * flyToId updates when a GenreCube opens (handleGenreOpen) or a
             * PlaceCard tile is clicked (handlePlaceSelect), triggering a
             * smooth mapbox flyTo animation to that location.
             */}
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-400/80">{dc.dayRoute}</span>
                  </div>
                  {mapPlaces.length > 0 && (
                    <span className="text-[9px] text-indigo-400/45 font-medium">
                      {dc.mapLocationCount(mapPlaces.length)}
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

            {/* ── 🤫 Insider Intel ─────────────────────────────────────── */}
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
                    <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400/80">{dc.insiderIntelHeader}</span>
                  </div>
                  <InsiderReveal insights={day.webInsights ?? []} dc={dc} />
                </div>
              </div>
            )}
            {tipInsights.length === 0 && <div className="pb-4" />}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
