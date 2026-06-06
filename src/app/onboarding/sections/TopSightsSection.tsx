'use client';

/**
 * TopSightsSection — Step 7 of onboarding ("Our Picks").
 *
 * Pulls city-specific landmarks from /api/landmarks (backed by public.places
 * rows with top_pick_category set) and renders them as a cuboid-card grid
 * inside three category panels: Sightseeing · History · Local Food.
 *
 * Cuboid card:
 *   • 3:4 aspect tile with the landmark's Google Places photo at the top
 *   • Soft inner shadow + 1px ivory hairline → faint architectural depth
 *   • Sharp serif name, 11-px tracked sub for description
 *   • Selected state — 1-px gold border + tiny corner dot (no glow)
 *
 * Choices are optional. The footer CTA on /onboarding stays as the single
 * primary action; the section never has its own buttons.
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import type { Landmark } from '@/app/api/landmarks/route';

const IVORY        = '#0d2b27';
const IVORY_DIM    = '#3a7068';
const IVORY_FAINT  = '#5a908a';
const ACCENT       = '#c4a26a';
const SURFACE      = 'rgba(255,255,255,0.65)';
const SURFACE_SEL  = 'rgba(255,255,255,0.88)';
const BORDER       = '1px solid rgba(90,173,165,0.28)';
const BORDER_SEL   = `1px solid ${ACCENT}`;

interface LandmarksByCategory {
  city: string;
  sightseeing: Landmark[];
  history:     Landmark[];
  food:        Landmark[];
}

const CATEGORY_META: Array<{ key: 'sightseeing' | 'history' | 'food'; label: string }> = [
  { key: 'sightseeing', label: 'Sightseeing' },
  { key: 'history',     label: 'History'     },
  { key: 'food',        label: 'Local Food'  },
];

export function TopSightsSection() {
  const { destination, mustHaveItems, toggleMustHave } = useOnboardingStore();
  const [data, setData] = useState<LandmarksByCategory | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'ready' | 'error'>('idle');

  useEffect(() => {
    const city = (destination ?? '').trim();
    if (!city) { setStatus('idle'); setData(null); return; }
    const ctrl = new AbortController();
    setStatus('loading');
    fetch(`/api/landmarks?city=${encodeURIComponent(city)}`, { signal: ctrl.signal })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then((body: LandmarksByCategory) => {
        const total = body.sightseeing.length + body.history.length + body.food.length;
        setData(body);
        setStatus(total === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[TopSightsSection] fetch failed:', err);
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [destination]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="font-serif text-[28px] leading-[1.1] tracking-[-0.015em]"
          style={{ color: IVORY, fontWeight: 400 }}
        >
          Top sights for {destination || 'your trip'}
        </h2>
        <p className="mt-2 text-[13px] tracking-wide" style={{ color: IVORY_DIM }}>
          Pick what you don&apos;t want to miss. We&apos;ll build the rest of the itinerary around them.
          <span className="ml-1.5" style={{ color: IVORY_FAINT }}>Optional — feel free to skip.</span>
        </p>
      </div>

      {/* Status states */}
      {status === 'loading' && (
        <div className="flex flex-col gap-6">
          {CATEGORY_META.map(({ label }) => (
            <CategorySkeleton key={label} label={label} />
          ))}
        </div>
      )}

      {(status === 'empty' || status === 'error') && (
        <div
          className="rounded-3xl p-7 text-center backdrop-blur-xl"
          style={{ background: SURFACE, border: BORDER }}
        >
          <p className="font-serif text-[18px] leading-tight" style={{ color: IVORY }}>
            We don&apos;t have curated picks for {destination || 'this city'} yet.
          </p>
          <p className="mt-2 text-[12px] tracking-wide" style={{ color: IVORY_DIM }}>
            Skip this step — your itinerary will be built from your earlier answers and live web intelligence.
          </p>
        </div>
      )}

      {status === 'ready' && data && (
        <AnimatePresence mode="wait">
          <motion.div
            key={data.city}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6"
          >
            {CATEGORY_META.map(({ key, label }) => {
              const items = data[key];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <p
                    className="text-[11px] uppercase tracking-[0.22em] mb-3"
                    style={{ color: IVORY_DIM }}
                  >
                    {label}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((landmark) => (
                      <CuboidCard
                        key={landmark.id}
                        landmark={landmark}
                        selected={mustHaveItems.includes(landmark.name)}
                        onToggle={() => toggleMustHave(landmark.name)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Cuboid card ──────────────────────────────────────────────────────────────

function CuboidCard({
  landmark,
  selected,
  onToggle,
}: {
  landmark: Landmark;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col text-left rounded-2xl overflow-hidden transition-colors"
      style={{
        background: selected ? SURFACE_SEL : SURFACE,
        border: selected ? BORDER_SEL : BORDER,
        // Architectural depth — bottom-heavy soft shadow, no glow.
        boxShadow: selected
          ? '0 2px 12px rgba(0,0,0,0.06), 0 0 0 0 rgba(196,162,106,0)'
          : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Photo (3:4 cuboid proportion) */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3 / 4', background: 'rgba(90,173,165,0.12)' }}
      >
        {landmark.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={landmark.photo_url}
            alt={landmark.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: selected ? 'none' : 'saturate(0.94)' }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(90,173,165,0.15), rgba(90,173,165,0.06))' }}
          >
            <span className="text-3xl" style={{ opacity: 0.4 }}>
              {landmark.category_emoji || '◻︎'}
            </span>
          </div>
        )}

        {/* Bottom-edge gradient so the serif name reads on any photo */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(9,13,20,0.78), rgba(9,13,20,0) 100%)',
          }}
        />

        {/* Selection mark — minimal corner pip */}
        <AnimatePresence>
          {selected && (
            <motion.span
              key="dot"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.18 } }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: ACCENT,
                boxShadow: '0 4px 10px -2px rgba(196,162,106,0.45)',
              }}
            >
              <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                <path d="M2.5 6.2L4.8 8.5L9.5 3.8" fill="none" stroke="#1a1308" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Caption */}
      <div className="p-3.5 flex flex-col gap-1.5">
        <div
          className="font-serif text-[14.5px] leading-tight tracking-[-0.01em] line-clamp-1"
          style={{ color: selected ? IVORY : '#1a4a44' }}
        >
          {landmark.name}
        </div>
        {landmark.description && (
          <div
            className="text-[11px] leading-snug tracking-wide line-clamp-2"
            style={{ color: selected ? IVORY_DIM : IVORY_FAINT }}
          >
            {landmark.description}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CategorySkeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: IVORY_DIM }}>
        {label}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden animate-pulse"
            style={{ background: SURFACE, border: BORDER }}
          >
            <div className="w-full" style={{ aspectRatio: '3 / 4', background: 'rgba(90,173,165,0.12)' }} />
            <div className="p-3.5 flex flex-col gap-2">
              <div className="h-3 rounded" style={{ background: 'rgba(90,173,165,0.18)', width: '70%' }} />
              <div className="h-2.5 rounded" style={{ background: 'rgba(90,173,165,0.12)', width: '90%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
