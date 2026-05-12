'use client';

/**
 * PlaceCard — glassmorphic card with Framer Motion layoutId card→modal morphing.
 *
 * Export surface:
 *   PlaceCardData   — unified interface (maps from Place | Activity)
 *   PlacesGrid      — grid container managing selected state + overlay
 *
 * Color system — one neon accent per vibe_label:
 *   viral-trend    → Neon Purple   #a855f7
 *   hidden-gem     → Electric Green #22c55e
 *   local-favorite → Sunset Orange  #f97316
 *   classic        → Neon Blue      #3b82f6
 *   luxury-pick    → Luxury gold   #C9A84C
 *   budget-pick    → Cyan           #06b6d4
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MapPin, ExternalLink, Navigation, X, Globe } from 'lucide-react';
import { VerificationBadge } from '@/components/VerificationBadge';
import type { Activity, Itinerary, TravelerProfile } from '@/lib/types';
import { classifyActivity, type ActivityGenre } from '@/lib/activityGenre';
import { buildCubeUnsplashSearchQuery } from '@/lib/cubeUnsplashQuery';
import Image from 'next/image';
import { SmartSwapSheet } from '@/components/SmartSwapSheet';
import { dayCardUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { TripPill } from '@/components/TripPill';
import { pickMoodUnsplashPair } from '@/lib/moodImageFallback';

// ── Unified data interface ─────────────────────────────────────────────────────
// Maps from either Place (Scout Agent / Supabase) or Activity (itinerary).

export interface PlaceCardData {
  id: string;               // unique key — used as layoutId
  name: string;
  emoji: string;
  vibeLabel: string;        // hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick
  description: string;
  highlights?: string[];    // optional bullet points; auto-extracted from description if absent
  lat?: number;
  lng?: number;
  /** Pre-computed Google Maps URL — rendered as "Maps" link on tile + modal button.
   *  Falls back to ?query={lat},{lng} if omitted but lat/lng are present. */
  mapsUrl?: string;
  socialProofUrl?: string | null;
  neighborhood?: string;
  /** City name — context for Unsplash cube imagery + Places website lookup. */
  city?: string;
  /** Genre for cube hero search (itinerary cubes set this from activity classification). */
  cubePhotoGenre?: ActivityGenre;
  category?: string;
  estimatedCost?: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';  // 3-Meal Rule — controls ordering + badge in Food cube
  verificationStatus?: 'verified-open' | 'flagged-closed' | 'flagged-renovating' | 'unverified';
  verifiedAt?: string;
  /** Official website URL — shown as "Visit Official Website" button in the modal.
   *  Auto-fetched from Google Places if not supplied; supply to skip the fetch. */
  website?: string;
  /** When set, this card can open smart swap (same-genre alternatives). */
  smartSwap?: {
    slot: 'morning' | 'afternoon' | 'evening';
    dayIndex: number;
    activity: Activity;
  };
}

export type PlacesGridSmartSwap = {
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  onCommitSlot: (slot: 'morning' | 'afternoon' | 'evening', activity: Activity, summary: string) => Promise<void>;
};

// ── Neon vibe color system ────────────────────────────────────────────────────

interface VibeColor {
  border: string;
  bg: string;
  text: string;
  glow: string;
  badgeBg: string;
  label: string;
  icon: string;
}

const VIBE_COLORS: Record<string, VibeColor> = {
  'viral-trend':    { border: '#a855f7', bg: 'rgba(168,85,247,0.11)',  text: '#c084fc', glow: 'rgba(168,85,247,0.28)', badgeBg: 'rgba(168,85,247,0.18)', label: 'Viral',       icon: '🔥' },
  'hidden-gem':     { border: '#22c55e', bg: 'rgba(34,197,94,0.11)',   text: '#4ade80', glow: 'rgba(34,197,94,0.28)',  badgeBg: 'rgba(34,197,94,0.18)',  label: 'Hidden Gem',  icon: '💎' },
  'local-favorite': { border: '#f97316', bg: 'rgba(249,115,22,0.11)',  text: '#fb923c', glow: 'rgba(249,115,22,0.28)', badgeBg: 'rgba(249,115,22,0.18)', label: 'Local Fave',  icon: '🏘️' },
  'classic':        { border: '#3b82f6', bg: 'rgba(59,130,246,0.11)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.28)', badgeBg: 'rgba(59,130,246,0.18)', label: 'Classic',     icon: '🏛️' },
  'luxury-pick':    { border: '#C9A84C', bg: 'rgba(201,168,76,0.11)',   text: '#d4c8a8', glow: 'rgba(201,168,76,0.30)', badgeBg: 'rgba(201,168,76,0.18)',  label: 'Luxury',      icon: '✨' },
  'budget-pick':    { border: '#06b6d4', bg: 'rgba(6,182,212,0.11)',   text: '#22d3ee', glow: 'rgba(6,182,212,0.28)',  badgeBg: 'rgba(6,182,212,0.18)',  label: 'Budget Pick', icon: '💰' },
};

const DEFAULT_VIBE: VibeColor = {
  border: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.08)', text: 'rgba(255,255,255,0.78)',
  glow: 'rgba(255,255,255,0.1)', badgeBg: 'rgba(255,255,255,0.12)', label: 'Spot', icon: '📍',
};

/** Warm hairline on tiles — reads against teal itinerary surfaces */
const PLACE_TILE_AMBER_EDGE = 'rgba(251, 191, 36, 0.22)';

function getVibe(vibeLabel: string): VibeColor {
  return VIBE_COLORS[vibeLabel] ?? DEFAULT_VIBE;
}

/** Deterministic mood image when Unsplash API misses or the hero fails to load */
function cubePhotoFallback(query: string, salt = ''): CubePhotoPayload {
  const raw = `${query}${salt}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  const seed = raw || 'travel-mood';
  const { thumb, url } = pickMoodUnsplashPair(seed);
  return {
    url,
    thumb,
    credit: 'Unsplash',
    creditUrl: 'https://unsplash.com/?utm_source=travelos&utm_medium=referral',
    source: 'unsplash',
  };
}

// ── Highlight extractor — splits description into bullets when none provided ──

function buildHighlights(description: string, provided?: string[]): string[] {
  if (provided?.length) return provided.slice(0, 3);
  return description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18 && s.length < 130)
    .slice(0, 3);
}

/** Split "nightlife / wine · hidden-gem" style lines into separate chips (slashes / pipes only — not commas). */
function expandHighlightFragments(bullet: string): string[] {
  const t = bullet.trim();
  if (!t) return [];
  if (t.length <= 120 && /[/|·]/.test(t)) {
    return t.split(/\s*[/|·]\s*/).map((s) => s.trim()).filter(Boolean);
  }
  return [t];
}

const TAG_ICON_HINTS: readonly [string, string][] = [
  ['hidden', '💎'],
  ['gem', '💎'],
  ['viral', '🔥'],
  ['night', '🌙'],
  ['wine', '🍷'],
  ['bar', '🍸'],
  ['food', '🍽️'],
  ['dinner', '🍽️'],
  ['lunch', '🥙'],
  ['breakfast', '🥐'],
  ['coffee', '☕'],
  ['café', '☕'],
  ['cafe', '☕'],
  ['museum', '🏛️'],
  ['gallery', '🎨'],
  ['art', '🎨'],
  ['walk', '🚶'],
  ['hike', '🥾'],
  ['view', '🌅'],
  ['sunset', '🌅'],
  ['rooftop', '🌆'],
  ['music', '🎵'],
  ['shop', '🛍️'],
  ['market', '🛒'],
  ['budget', '💰'],
  ['luxury', '✨'],
  ['family', '👨‍👩‍👧'],
  ['beach', '🏖️'],
  ['spa', '🧖'],
];

function iconForHighlightTag(fragment: string): string {
  const n = fragment.toLowerCase().replace(/_/g, ' ');
  for (const [word, icon] of TAG_ICON_HINTS) {
    if (n.includes(word)) return icon;
  }
  return '✦';
}

function humanizeHighlightTag(fragment: string): string {
  return fragment.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Meal slot config (3-Meal Rule) ───────────────────────────────────────────

const MEAL_SLOT_CFG: Record<'breakfast' | 'lunch' | 'dinner', { icon: string; label: string; color: string }> = {
  breakfast: { icon: '🌅', label: 'Breakfast', color: '#b8a066' },
  lunch:     { icon: '☀️',  label: 'Lunch',     color: '#f97316' },
  dinner:    { icon: '🌙', label: 'Dinner',    color: '#8b5cf6' },
};

// ── Google Places details hook (photo + website) ──────────────────────────────
// Fetches via /api/place-photo (server-side proxy — API key never exposed).
// Returns photoUrl for the header image and website for the "Visit" button.

function usePlaceDetails(name: string, city?: string) {
  const [state, setState] = useState<{ photoUrl: string | null; website: string | null; loading: boolean }>({
    photoUrl: null,
    website: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ photoUrl: null, website: null, loading: true });

    const params = new URLSearchParams({ name: name.slice(0, 100) });
    if (city) params.set('city', city);

    fetch(`/api/place-photo?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ photoUrl: d.photoUrl ?? null, website: d.website ?? null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ photoUrl: null, website: null, loading: false });
      });

    return () => { cancelled = true; };
  }, [name, city]);

  return state;
}

// ── Photo header — shared by tile (compact) and modal (tall) ─────────────────

interface PhotoHeaderProps {
  data: PlaceCardData;
  height: number;
}

interface CubePhotoPayload {
  url: string;
  thumb: string;
  credit: string | null;
  creditUrl: string | null;
  source: 'unsplash' | 'picsum';
}

function PlacePhotoHeader({ data, height }: PhotoHeaderProps) {
  const vibe = getVibe(data.vibeLabel);
  const searchQuery = buildCubeUnsplashSearchQuery({
    city: data.city,
    name: data.name,
    mealSlot: data.mealSlot,
    cubePhotoGenre: data.cubePhotoGenre,
    category: data.category,
    description: data.description,
    highlights: data.highlights,
  });

  const [photo, setPhoto] = useState<CubePhotoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const imgFailCount = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setPhoto(null);
    setLoading(true);
    setImgLoaded(false);
    setImgError(false);
    imgFailCount.current = 0;

    fetch(`/api/photos?q=${encodeURIComponent(searchQuery)}`)
      .then((r) => r.json())
      .then((d: CubePhotoPayload) => {
        if (cancelled) return;
        if (d?.thumb && d?.url) setPhoto(d);
        else setPhoto(cubePhotoFallback(searchQuery));
      })
      .catch(() => {
        if (!cancelled) setPhoto(cubePhotoFallback(searchQuery));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [searchQuery]);

  const src = photo?.thumb || photo?.url;
  const hasPhoto = !!src && !imgError;

  return (
    <div className="relative w-full overflow-hidden flex-shrink-0" style={{ height }}>
      {loading && (
        <div
          className="absolute inset-0 animate-shimmer"
          style={{
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {hasPhoto && (
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: imgLoaded ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Image
            src={src!}
            alt={data.name}
            fill
            sizes="(max-width: 768px) 50vw, 400px"
            className="object-cover"
            onLoad={() => setImgLoaded(true)}
            onError={() => {
              imgFailCount.current += 1;
              if (imgFailCount.current <= 3) {
                setImgError(false);
                setImgLoaded(false);
                setPhoto(cubePhotoFallback(searchQuery, `-f${imgFailCount.current}`));
              } else {
                setImgError(true);
              }
            }}
            unoptimized={photo?.source === 'picsum'}
          />
        </motion.div>
      )}

      {!loading && !hasPhoto && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${vibe.bg} 0%, rgba(6,8,15,0.65) 100%)`,
          }}
        >
          <span
            className="text-5xl select-none"
            style={{ filter: 'drop-shadow(0 4px 18px rgba(0,0,0,0.55))' }}
          >
            {data.emoji}
          </span>
        </div>
      )}

      {hasPhoto && imgLoaded && (
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
      )}

      {photo?.source === 'unsplash' && photo.credit && imgLoaded && (
        <a
          href={photo.creditUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1 right-2 z-[12] text-[8px] text-white/45 hover:text-white/75 transition-colors max-w-[55%] truncate"
          onClick={(e) => e.stopPropagation()}
        >
          {photo.credit} / Unsplash
        </a>
      )}

      <div
        className="absolute top-0 inset-x-0 h-px z-10"
        style={{
          background: `linear-gradient(90deg, transparent 5%, ${vibe.border} 50%, transparent 95%)`,
        }}
      />
    </div>
  );
}

// ── Collapsed tile (in grid) ──────────────────────────────────────────────────

interface TileProps {
  data: PlaceCardData;
  onClick: () => void;
  isSelected: boolean;
  smartSwapLabel?: string;
  onSmartSwap?: () => void;
  dc?: ReturnType<typeof dayCardUi>;
}

function PlaceTile({ data, onClick, isSelected, smartSwapLabel, onSmartSwap, dc }: TileProps) {
  const vibe = getVibe(data.vibeLabel);
  const vibeLbl = dc
    ? ((dc.vibeLabel[data.vibeLabel as keyof typeof dc.vibeLabel] as string | undefined) ?? vibe.label)
    : vibe.label;

  return (
    <motion.button
      layoutId={`pc-${data.id}`}
      onClick={onClick}
      className="relative w-full text-left rounded-2xl overflow-hidden focus:outline-none flex flex-col"
      style={{
        background: `linear-gradient(162deg, ${vibe.bg} 0%, rgba(30,36,48,0.72) 48%, rgba(36,44,58,0.78) 100%)`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: `1px solid ${PLACE_TILE_AMBER_EDGE}`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 0 0 1px ${vibe.border}35, 0 4px 24px -6px ${vibe.glow}`,
        // fade out in-place while modal is animating from this position
        opacity: isSelected ? 0 : 1,
        pointerEvents: isSelected ? 'none' : undefined,
      }}
      whileHover={{
        scale: 1.02,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.09), 0 8px 32px -6px ${vibe.glow}, 0 0 0 1px rgba(253,224,71,0.28)`,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      {/* Unsplash mood / landmark hero (compact) */}
      <PlacePhotoHeader data={data} height={130} />

      <div className="p-4">
        {/* Row 1 — emoji + vibe badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-3xl leading-none select-none">{data.emoji}</span>
          <TripPill variant="vibe" vibeKey={data.vibeLabel} label={vibeLbl} size="sm" />
        </div>

        {/* Meal slot badge (Breakfast / Lunch / Dinner) — only shown inside Food cube */}
        {data.mealSlot && (() => {
          const ms = MEAL_SLOT_CFG[data.mealSlot];
          const mealLabel =
            data.mealSlot === 'breakfast'
              ? (dc?.mealBreakfast ?? ms.label)
              : data.mealSlot === 'lunch'
                ? (dc?.mealLunch ?? ms.label)
                : (dc?.mealDinner ?? ms.label);
          return (
            <div className="mb-2.5">
              <TripPill variant="meal" icon={ms.icon} label={mealLabel} accentColor={ms.color} size="sm" />
            </div>
          );
        })()}

        {/* Name */}
        <h3
          className="font-bold text-sm text-white leading-snug tracking-tight line-clamp-2 mb-1"
          style={{ textShadow: `0 0 24px ${vibe.glow}` }}
        >
          {data.name}
        </h3>

        {/* Neighborhood */}
        {data.neighborhood && (
          <p className="text-[11px] text-white/50 mb-2 truncate flex items-center gap-1">
            <MapPin size={9} className="flex-shrink-0 opacity-60" />
            {data.neighborhood}
          </p>
        )}

        {/* Description preview */}
        <p className="text-[11px] text-white/60 leading-relaxed line-clamp-2 mb-3">
          {data.description}
        </p>

        {/* Footer — social pulse · maps shortcut · expand cue */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          {data.socialProofUrl ? (
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-semibold"
              style={{ color: vibe.text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: vibe.border, boxShadow: `0 0 6px ${vibe.border}` }}
              />
              Social Verified
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {data.smartSwap && onSmartSwap && smartSwapLabel && (
              <motion.button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSmartSwap();
                }}
                whileTap={{ scale: 0.92 }}
                className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-lg text-white shrink-0"
                style={{
                  background: 'rgba(201,168,76,0.5)',
                  border: '1px solid rgba(255,255,255,0.18)',
                  boxShadow: `0 0 12px ${vibe.glow}`,
                }}
              >
                {smartSwapLabel}
              </motion.button>
            )}
            {/* Maps shortcut — only rendered when a URL is available */}
            {(data.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([data.name, data.city].filter(Boolean).join(' '))}`) && (
              <a
                href={data.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([data.name, data.city].filter(Boolean).join(' '))}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-md px-1.5 py-0.5 transition-colors"
                style={{
                  color: 'rgba(255,255,255,0.38)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(255,255,255,0.04)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = vibe.text;
                  e.currentTarget.style.borderColor = `${vibe.border}55`;
                  e.currentTarget.style.background = `${vibe.bg}`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(255,255,255,0.38)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                }}
              >
                <MapPin size={8} />
                Maps
              </a>
            )}
            <span className="text-[10px]" style={{ color: `${vibe.text}55` }}>tap →</span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ── Expanded modal — shares layoutId with PlaceTile ───────────────────────────

interface ModalProps {
  data: PlaceCardData;
  onClose: () => void;
  swapUi?: { ui: ItineraryUiStrings; dc: ReturnType<typeof dayCardUi> };
  smartSwap?: PlacesGridSmartSwap;
  onTriggerSmartSwap?: () => void;
}

function PlaceModal({ data, onClose, swapUi, smartSwap, onTriggerSmartSwap }: ModalProps) {
  const vibe     = getVibe(data.vibeLabel);
  const dcModal  = swapUi?.dc;
  const vibeLbl = dcModal
    ? ((dcModal.vibeLabel[data.vibeLabel as keyof typeof dcModal.vibeLabel] as string | undefined) ?? vibe.label)
    : vibe.label;
  const bullets  = buildHighlights(data.description, data.highlights);
  // Use explicit mapsUrl when set; fall back to coordinate-based URL; null = no button
  const cityKey = (data.city ?? '').trim().toLowerCase();
  const countryHint = cityKey === 'budapest' ? 'Hungary'
    : cityKey === 'athens' ? 'Greece'
    : cityKey === 'paris' ? 'France'
    : cityKey === 'london' ? 'United Kingdom'
    : cityKey === 'rome' ? 'Italy'
    : '';
  const placeQuery = [data.name, data.neighborhood, data.city, countryHint].filter(Boolean).join(', ');
  const mapUrl = data.mapsUrl ??
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery)}`;

  // Fetch website from Google Places (server-cached; near-instant if photo was already fetched)
  const { website: fetchedWebsite } = usePlaceDetails(data.name, data.city);
  const websiteUrl = data.website ?? fetchedWebsite ?? null;

  return (
    <>
      {/* Scrim — separate from the shared element so it can fade independently */}
      <motion.div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />

      {/* Centering shell (not animated — just positions the shared element) */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">

        {/* Shared-layout element — morphs from tile position */}
        <motion.div
          layoutId={`pc-${data.id}`}
          className="relative w-full max-w-md rounded-2xl overflow-hidden flex flex-col pointer-events-auto"
          style={{
            background: `linear-gradient(162deg, ${vibe.bg} 0%, rgba(22,26,36,0.88) 42%, rgba(14,16,24,0.96) 100%)`,
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${PLACE_TILE_AMBER_EDGE}`,
            boxShadow: `0 0 0 1px ${vibe.border}28, 0 40px 100px -20px rgba(0,0,0,0.9), 0 0 80px ${vibe.glow}`,
            maxHeight: '88dvh',
          }}
        >
          {/* Unsplash hero — modal */}
          <PlacePhotoHeader data={data} height={185} />

          {/* Ambient orb */}
          <div
            className="absolute top-0 right-0 w-56 h-56 rounded-full pointer-events-none"
            style={{ background: vibe.border, opacity: 0.045, filter: 'blur(55px)' }}
          />

          {/* Close — floats above the photo */}
          <motion.button
            onClick={onClose}
            className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
            whileTap={{ scale: 0.82 }}
          >
            <X size={13} className="text-white/75" />
          </motion.button>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 p-5 relative z-10">

            {/* Header — name + neighborhood (emoji removed; photo is the visual anchor) */}
            <div className="flex items-start gap-3 mb-4 pr-8">
              <span className="text-4xl leading-none select-none mt-0.5">{data.emoji}</span>
              <div className="flex-1 min-w-0">
                <h2 className="font-black text-xl text-white tracking-tight leading-tight">
                  {data.name}
                </h2>
                {data.neighborhood && (
                  <p className="text-xs text-white/38 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} className="flex-shrink-0" />
                    {data.neighborhood}
                  </p>
                )}
              </div>
            </div>

            {/* Badge row */}
            <div className="flex flex-wrap gap-2 mb-4">
              {data.mealSlot && (() => {
                const ms = MEAL_SLOT_CFG[data.mealSlot!];
                const mealLabel =
                  data.mealSlot === 'breakfast'
                    ? (dcModal?.mealBreakfast ?? ms.label)
                    : data.mealSlot === 'lunch'
                      ? (dcModal?.mealLunch ?? ms.label)
                      : (dcModal?.mealDinner ?? ms.label);
                return (
                  <TripPill variant="meal" icon={ms.icon} label={mealLabel} accentColor={ms.color} size="md" />
                );
              })()}
              <TripPill variant="vibe" vibeKey={data.vibeLabel} label={vibeLbl} size="md" />
              {data.category && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/6 border border-white/10 text-white/40 capitalize">
                  {data.category}
                </span>
              )}
              {data.estimatedCost && (
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-white/6 border border-white/10 text-white/40">
                  💳 {data.estimatedCost}
                </span>
              )}
              <VerificationBadge
                status={data.verificationStatus}
                verifiedAt={data.verifiedAt}
              />
            </div>

            {/* Full description */}
            <div
              className="rounded-xl p-4 mb-4"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: `1px solid rgba(251,191,36,0.12)`,
              }}
            >
              <p className="text-sm text-white/80 leading-relaxed">{data.description}</p>
            </div>

            {/* Why you'll love it — pill tags (not JSON-style bullets) */}
            {bullets.length > 0 && (
              <div className="mb-5">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-widest mb-3"
                  style={{ color: vibe.text }}
                >
                  {"Why You'll Love It"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {bullets
                    .flatMap((b) => expandHighlightFragments(b))
                    .slice(0, 12)
                    .map((fragment, i) => {
                      const icon = iconForHighlightTag(fragment);
                      const label = humanizeHighlightTag(fragment);
                      const isLong = label.length > 72;
                      return (
                        <motion.span
                          key={`${fragment}-${i}`}
                          initial={{ opacity: 0, scale: 0.92 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.08 + i * 0.04, type: 'spring', stiffness: 400, damping: 28 }}
                          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-snug max-w-full"
                          style={{
                            background: `linear-gradient(135deg, ${vibe.border}22 0%, rgba(255,255,255,0.06) 100%)`,
                            borderColor: `${vibe.border}55`,
                            color: 'rgba(255,255,255,0.88)',
                            boxShadow: `0 0 14px ${vibe.glow}`,
                          }}
                          title={isLong ? label : undefined}
                        >
                          <span className="text-[12px] leading-none flex-shrink-0" aria-hidden>
                            {icon}
                          </span>
                          <span className={isLong ? 'line-clamp-2' : ''}>{label}</span>
                        </motion.span>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
              {data.smartSwap && smartSwap && swapUi && onTriggerSmartSwap && (
                <motion.button
                  type="button"
                  onClick={onTriggerSmartSwap}
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, #a89254 0%, #C9A84C 50%, #8f7a42 100%)`,
                    border: `1px solid ${vibe.border}55`,
                    boxShadow: `0 6px 22px rgba(201,168,76,0.35)`,
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                >
                  ✨ {swapUi.dc.smartSwapTitle}
                </motion.button>
              )}

              {mapUrl && (
                <motion.a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold text-white"
                  style={{
                    background: `linear-gradient(135deg, ${vibe.border}35 0%, ${vibe.border}18 100%)`,
                    border: `1px solid ${vibe.border}55`,
                    boxShadow: `0 0 24px ${vibe.glow}`,
                  }}
                  whileHover={{
                    scale: 1.02,
                    boxShadow: `0 0 36px ${vibe.glow}`,
                  }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Navigation size={15} />
                  Open in Google Maps
                </motion.a>
              )}

              {websiteUrl && (
                <motion.a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${vibe.border}30`,
                    color: vibe.text,
                  }}
                  whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.08)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Globe size={14} className="opacity-80" />
                  Visit Official Website
                  <ExternalLink size={11} className="opacity-45" />
                </motion.a>
              )}

              {data.socialProofUrl && (
                <motion.a
                  href={data.socialProofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: `1px solid ${vibe.border}35`,
                    color: vibe.text,
                  }}
                  whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.09)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span
                    className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                    style={{ background: vibe.border, boxShadow: `0 0 8px ${vibe.border}` }}
                  />
                  Watch on Social
                  <ExternalLink size={12} className="opacity-55" />
                </motion.a>
              )}
            </div>

          </div>
        </motion.div>
      </div>
    </>
  );
}

// ── PlacesGrid ─────────────────────────────────────────────────────────────────
// Manages selected state. Renders the tile grid + the animated overlay modal.
// Wrap in <LayoutGroup> so layoutId morphing works correctly across the tree.

interface PlacesGridProps {
  places: PlaceCardData[];
  columns?: 1 | 2 | 3;
  className?: string;
  /** Called when a tile is clicked — useful for wiring fly-to on the day map. */
  onSelect?: (placeId: string) => void;
  smartSwap?: PlacesGridSmartSwap;
  swapUi?: { ui: ItineraryUiStrings; dc: ReturnType<typeof dayCardUi> };
}

export function PlacesGrid({
  places,
  columns = 2,
  className = '',
  onSelect,
  smartSwap,
  swapUi,
}: PlacesGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [smartSwapPlaceId, setSmartSwapPlaceId] = useState<string | null>(null);
  const selected = places.find((p) => p.id === selectedId) ?? null;

  const colClass =
    columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
    columns === 1 ? 'grid-cols-1' :
                    'grid-cols-1 sm:grid-cols-2';

  return (
    <LayoutGroup>
      <div className={`grid ${colClass} gap-3 ${className}`}>
        {places.map((place) => (
          <PlaceTile
            key={place.id}
            data={place}
            onClick={() => {
              setSelectedId(place.id);
              onSelect?.(place.id);
            }}
            isSelected={selectedId === place.id}
            smartSwapLabel={swapUi?.dc.smartSwapButton}
            dc={swapUi?.dc}
            onSmartSwap={
              smartSwap && swapUi && place.smartSwap
                ? () => setSmartSwapPlaceId(place.id)
                : undefined
            }
          />
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <PlaceModal
            data={selected}
            onClose={() => setSelectedId(null)}
            swapUi={swapUi}
            smartSwap={smartSwap}
            onTriggerSmartSwap={
              smartSwap && swapUi && selected.smartSwap
                ? () => {
                    const id = selected.id;
                    setSelectedId(null);
                    setSmartSwapPlaceId(id);
                  }
                : undefined
            }
          />
        )}
      </AnimatePresence>

      {smartSwap &&
        swapUi &&
        smartSwapPlaceId &&
        (() => {
          const card = places.find((p) => p.id === smartSwapPlaceId);
          const meta = card?.smartSwap;
          if (!card || !meta) return null;
          const g = classifyActivity(meta.activity);
          return (
            <SmartSwapSheet
              open
              onClose={() => setSmartSwapPlaceId(null)}
              itinerary={smartSwap.itinerary}
              dayIndex={meta.dayIndex}
              slot={meta.slot}
              activity={meta.activity}
              profile={smartSwap.profile}
              genreLabel={swapUi.dc.genreLabel[g] ?? g}
              onCommit={async (act, summary) => {
                await smartSwap.onCommitSlot(meta.slot, act, summary);
              }}
              ui={swapUi.ui}
              dc={swapUi.dc}
            />
          );
        })()}
    </LayoutGroup>
  );
}
