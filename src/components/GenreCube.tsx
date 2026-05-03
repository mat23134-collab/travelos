'use client';

/**
 * GenreCube — collapsible hub card for one genre (Food, Sightseeing, etc.)
 *
 * Each GenreCube:
 *   • shows icon + label + "{n} Spots Found" count badge when collapsed
 *   • expands with a spring animation to reveal a PlacesGrid
 *   • PlaceCards inside use the full layoutId card→modal morphing
 *
 * Used by DayCard to organise the day's activities into:
 *   🏛️ Sightseeing & Vibes  |  🍽️ Food & Dining
 *   🛍️ Shopping & Style     |  🎶 Nightlife & Culture
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlacesGrid, PlaceCardData } from '@/components/PlaceCard';

export interface GenreCubeProps {
  icon: string;
  label: string;
  accent: string;         // hex — drives the cube border + badge + header tint
  places: PlaceCardData[];
  defaultOpen?: boolean;
}

// Spring for the height accordion
const CUBE_SPRING = { type: 'spring' as const, stiffness: 290, damping: 30 };

export function GenreCube({
  icon,
  label,
  accent,
  places,
  defaultOpen = false,
}: GenreCubeProps) {
  const [open, setOpen] = useState(defaultOpen);

  // Never render an empty cube
  if (places.length === 0) return null;

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: `${accent}09`,
        border: `1px solid ${accent}28`,
        boxShadow: `0 2px 16px -4px ${accent}18`,
      }}
    >
      {/* ── Header (always visible) ───────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors focus:outline-none"
        style={{
          background: open ? `${accent}12` : 'transparent',
        }}
      >
        {/* Genre icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}35`,
            boxShadow: `0 0 12px ${accent}20`,
          }}
        >
          {icon}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <span
            className="font-bold text-sm tracking-tight"
            style={{ color: open ? '#ffffff' : 'rgba(255,255,255,0.80)' }}
          >
            {label}
          </span>
        </div>

        {/* Count badge */}
        <span
          className="text-[10px] font-extrabold px-2.5 py-1 rounded-full whitespace-nowrap flex-shrink-0"
          style={{
            background: `${accent}18`,
            border: `1px solid ${accent}42`,
            color: accent,
            boxShadow: open ? `0 0 10px ${accent}30` : 'none',
          }}
        >
          {places.length} Spot{places.length !== 1 ? 's' : ''} Found
        </span>

        {/* Chevron */}
        <motion.div
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 30 }}
          className="flex-shrink-0"
          style={{ color: `${accent}80` }}
        >
          <svg width="14" height="9" viewBox="0 0 14 9" fill="none">
            <path
              d="M1 1.5L7 7.5L13 1.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.div>
      </button>

      {/* ── Expandable PlaceCards grid ─────────────────────────────────── */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={CUBE_SPRING}
            className="overflow-hidden"
          >
            {/* Divider line */}
            <div
              className="mx-4 h-px"
              style={{ background: `${accent}20` }}
            />
            <div className="p-4">
              <PlacesGrid places={places} columns={2} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
