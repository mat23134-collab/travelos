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
 *   luxury-pick    → Gold           #eab308
 *   budget-pick    → Cyan           #06b6d4
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { MapPin, ExternalLink, Navigation, X } from 'lucide-react';
import { VerificationBadge } from '@/components/VerificationBadge';

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
  /** City name — used as context for Google Places photo lookup. */
  city?: string;
  category?: string;
  estimatedCost?: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';  // 3-Meal Rule — controls ordering + badge in Food cube
  verificationStatus?: 'verified-open' | 'flagged-closed' | 'flagged-renovating' | 'unverified';
  verifiedAt?: string;
}

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
  'viral-trend':    { border: '#a855f7', bg: 'rgba(168,85,247,0.08)',  text: '#c084fc', glow: 'rgba(168,85,247,0.28)', badgeBg: 'rgba(168,85,247,0.15)', label: 'Viral',       icon: '🔥' },
  'hidden-gem':     { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',   text: '#4ade80', glow: 'rgba(34,197,94,0.28)',  badgeBg: 'rgba(34,197,94,0.15)',  label: 'Hidden Gem',  icon: '💎' },
  'local-favorite': { border: '#f97316', bg: 'rgba(249,115,22,0.08)',  text: '#fb923c', glow: 'rgba(249,115,22,0.28)', badgeBg: 'rgba(249,115,22,0.15)', label: 'Local Fave',  icon: '🏘️' },
  'classic':        { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  text: '#60a5fa', glow: 'rgba(59,130,246,0.28)', badgeBg: 'rgba(59,130,246,0.15)', label: 'Classic',     icon: '🏛️' },
  'luxury-pick':    { border: '#eab308', bg: 'rgba(234,179,8,0.08)',   text: '#facc15', glow: 'rgba(234,179,8,0.28)',  badgeBg: 'rgba(234,179,8,0.15)',  label: 'Luxury',      icon: '✨' },
  'budget-pick':    { border: '#06b6d4', bg: 'rgba(6,182,212,0.08)',   text: '#22d3ee', glow: 'rgba(6,182,212,0.28)',  badgeBg: 'rgba(6,182,212,0.15)',  label: 'Budget Pick', icon: '💰' },
};

const DEFAULT_VIBE: VibeColor = {
  border: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.05)', text: 'rgba(255,255,255,0.7)',
  glow: 'rgba(255,255,255,0.1)', badgeBg: 'rgba(255,255,255,0.08)', label: 'Spot', icon: '📍',
};

function getVibe(vibeLabel: string): VibeColor {
  return VIBE_COLORS[vibeLabel] ?? DEFAULT_VIBE;
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

// ── Meal slot config (3-Meal Rule) ───────────────────────────────────────────

const MEAL_SLOT_CFG: Record<'breakfast' | 'lunch' | 'dinner', { icon: string; label: string; color: string }> = {
  breakfast: { icon: '🌅', label: 'Breakfast', color: '#f59e0b' },
  lunch:     { icon: '☀️',  label: 'Lunch',     color: '#f97316' },
  dinner:    { icon: '🌙', label: 'Dinner',    color: '#8b5cf6' },
};

// ── Google Places photo hook ──────────────────────────────────────────────────
// Fetches via /api/place-photo (server-side proxy — API key never exposed).

function usePlacePhoto(name: string, city?: string) {
  const [state, setState] = useState<{ url: string | null; loading: boolean }>({
    url: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    setState({ url: null, loading: true });

    const params = new URLSearchParams({ name: name.slice(0, 100) });
    if (city) params.set('city', city);

    fetch(`/api/place-photo?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState({ url: d.photoUrl ?? null, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, loading: false });
      });

    return () => { cancelled = true; };
  }, [name, city]);

  return state;
}

// ── Photo header — shared by tile (compact) and modal (tall) ─────────────────

interface PhotoHeaderProps {
  name: string;
  city?: string;
  emoji: string;
  vibe: VibeColor;
  height: number;
}

function PlacePhotoHeader({ name, city, emoji, vibe, height }: PhotoHeaderProps) {
  const { url, loading } = usePlacePhoto(name, city);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError]   = useState(false);

  const hasPhoto = !!url && !imgError;

  return (
    <div className="relative w-full overflow-hidden flex-shrink-0" style={{ height }}>
      {/* Shimmer skeleton while loading */}
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

      {/* Real Google Places photo with fade-in */}
      {hasPhoto && (
        <motion.img
          src={url!}
          alt={name}
          className="absolute inset-0 w-full h-full"
          style={{ objectFit: 'cover' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: imgLoaded ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          onLoad={() => setImgLoaded(true)}
          onError={() => setImgError(true)}
        />
      )}

      {/* Emoji fallback when no photo is available */}
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
            {emoji}
          </span>
        </div>
      )}

      {/* Bottom gradient for text legibility */}
      {hasPhoto && imgLoaded && (
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
      )}

      {/* Vibe-coloured neon rule on top */}
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
}

function PlaceTile({ data, onClick, isSelected }: TileProps) {
  const vibe = getVibe(data.vibeLabel);

  return (
    <motion.button
      layoutId={`pc-${data.id}`}
      onClick={onClick}
      className="relative w-full text-left rounded-2xl overflow-hidden focus:outline-none flex flex-col"
      style={{
        background: `linear-gradient(160deg, ${vibe.bg} 0%, rgba(13,15,22,0.82) 100%)`,
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: `1px solid ${vibe.border}45`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 24px -6px ${vibe.glow}`,
        // fade out in-place while modal is animating from this position
        opacity: isSelected ? 0 : 1,
        pointerEvents: isSelected ? 'none' : undefined,
      }}
      whileHover={{
        scale: 1.02,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.07), 0 8px 32px -6px ${vibe.glow}, 0 0 0 1px ${vibe.border}60`,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 420, damping: 30 }}
    >
      {/* Google Places photo header (130px) — includes neon rule */}
      <PlacePhotoHeader
        name={data.name}
        city={data.city}
        emoji={data.emoji}
        vibe={vibe}
        height={130}
      />

      <div className="p-4">
        {/* Row 1 — emoji + vibe badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-3xl leading-none select-none">{data.emoji}</span>
          <span
            className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              background: vibe.badgeBg,
              border: `1px solid ${vibe.border}55`,
              color: vibe.text,
              boxShadow: `0 0 10px ${vibe.glow}`,
            }}
          >
            {vibe.icon} {vibe.label}
          </span>
        </div>

        {/* Meal slot badge (Breakfast / Lunch / Dinner) — only shown inside Food cube */}
        {data.mealSlot && (() => {
          const ms = MEAL_SLOT_CFG[data.mealSlot];
          return (
            <div className="mb-2.5">
              <span
                className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full"
                style={{
                  background: `${ms.color}18`,
                  border: `1px solid ${ms.color}42`,
                  color: ms.color,
                  boxShadow: `0 0 8px ${ms.color}30`,
                }}
              >
                {ms.icon} {ms.label}
              </span>
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
          <p className="text-[11px] text-white/38 mb-2 truncate flex items-center gap-1">
            <MapPin size={9} className="flex-shrink-0 opacity-60" />
            {data.neighborhood}
          </p>
        )}

        {/* Description preview */}
        <p className="text-[11px] text-white/48 leading-relaxed line-clamp-2 mb-3">
          {data.description}
        </p>

        {/* Footer — social pulse · maps shortcut · expand cue */}
        <div className="flex items-center justify-between pt-2 border-t border-white/6">
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
          <div className="flex items-center gap-2.5">
            {/* Maps shortcut — only rendered when a URL is available */}
            {(data.mapsUrl ?? (data.lat && data.lng
              ? `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`
              : null)) && (
              <a
                href={data.mapsUrl ?? `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`}
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
}

function PlaceModal({ data, onClose }: ModalProps) {
  const vibe     = getVibe(data.vibeLabel);
  const bullets  = buildHighlights(data.description, data.highlights);
  // Use explicit mapsUrl when set; fall back to coordinate-based URL; null = no button
  const mapUrl =
    data.mapsUrl ??
    (data.lat && data.lng
      ? `https://www.google.com/maps/search/?api=1&query=${data.lat},${data.lng}`
      : null);

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
            background: `linear-gradient(160deg, ${vibe.bg} 0%, rgba(10,12,19,0.98) 45%)`,
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: `1px solid ${vibe.border}55`,
            boxShadow: `0 0 0 1px ${vibe.border}20, 0 40px 100px -20px rgba(0,0,0,0.9), 0 0 80px ${vibe.glow}`,
            maxHeight: '88dvh',
          }}
        >
          {/* Google Places photo header (185px) — includes neon rule */}
          <PlacePhotoHeader
            name={data.name}
            city={data.city}
            emoji={data.emoji}
            vibe={vibe}
            height={185}
          />

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
              {/* Meal slot (shown first when present) */}
              {data.mealSlot && (() => {
                const ms = MEAL_SLOT_CFG[data.mealSlot!];
                return (
                  <span
                    className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-3 py-1 rounded-full"
                    style={{
                      background: `${ms.color}18`,
                      border: `1px solid ${ms.color}50`,
                      color: ms.color,
                      boxShadow: `0 0 14px ${ms.color}35`,
                    }}
                  >
                    {ms.icon} {ms.label}
                  </span>
                );
              })()}
              <span
                className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full"
                style={{
                  background: vibe.badgeBg,
                  border: `1px solid ${vibe.border}60`,
                  color: vibe.text,
                  boxShadow: `0 0 14px ${vibe.glow}`,
                }}
              >
                {vibe.icon} {vibe.label}
              </span>
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
                background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${vibe.border}18`,
              }}
            >
              <p className="text-sm text-white/72 leading-relaxed">{data.description}</p>
            </div>

            {/* Why you'll love it — bullet highlights */}
            {bullets.length > 0 && (
              <div className="mb-5">
                <p
                  className="text-[10px] font-extrabold uppercase tracking-widest mb-3"
                  style={{ color: vibe.text }}
                >
                  Why You'll Love It
                </p>
                <ul className="flex flex-col gap-2.5">
                  {bullets.map((bullet, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.12 + i * 0.07, type: 'spring', stiffness: 380, damping: 28 }}
                      className="flex items-start gap-2.5 text-[13px] text-white/60 leading-relaxed"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-[5px]"
                        style={{ background: vibe.border, boxShadow: `0 0 6px ${vibe.glow}` }}
                      />
                      {bullet}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2.5">
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
}

export function PlacesGrid({ places, columns = 2, className = '', onSelect }: PlacesGridProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
          />
        ))}
      </div>

      <AnimatePresence>
        {selected && (
          <PlaceModal
            data={selected}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
