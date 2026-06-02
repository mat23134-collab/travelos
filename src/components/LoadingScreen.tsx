'use client';

/**
 * LoadingScreen — Cinematic Intel Dashboard
 *
 * Shows while /api/generate or /api/generate-stream is running.
 * Receives live SSE data (places, tips, status) from plan/page.tsx.
 *
 * Features:
 * - Real percentage based on buildSignals count (capped at 95 until redirect)
 * - Destination name in cinematic editorial typography
 * - Horizontal step pills (done / active / pending states)
 * - Live place discovery cards (last 4, newest first)
 * - Rotating destination facts from getDestinationFacts()
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TripLanguage } from '@/lib/types';
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';
import { getDestinationFacts } from '@/lib/destinationFacts';

// ── SSE event types (exported so plan/page.tsx can import them) ───────────────
export type PlaceEvent = {
  name: string;
  emoji: string;
  description: string;
  slot: string;
  day: number;
  vibeLabel: string;
};
export type StatusEvent = { message: string; icon: string };

// ── Step definitions ──────────────────────────────────────────────────────────
const LOADING_STEPS = [
  { icon: '📡', label: 'Scanning travel signals' },
  { icon: '🍜', label: 'Checking food blogs' },
  { icon: '🗺️', label: 'Clustering by neighborhood' },
  { icon: '✨', label: 'Tuning to your style' },
  { icon: '💎', label: 'Filtering weak picks' },
] as const;

// ── Badge per vibeLabel ───────────────────────────────────────────────────────
type BadgeConfig = { text: string; type: 'gem' | 'local' } | null;

function resolveBadge(vibeLabel: string): BadgeConfig {
  if (vibeLabel === 'hidden-gem')     return { text: '💎 Hidden Gem', type: 'gem' };
  if (vibeLabel === 'local-favorite') return { text: '🏘 Local Pick', type: 'local' };
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface LoadingScreenProps {
  destination: string;
  lang: TripLanguage;
  streamedPlaces: PlaceEvent[];
  streamedTips: string[];
  streamStatus: StatusEvent | null;
}

export function LoadingScreen({
  destination,
  lang: _lang,
  streamedPlaces,
  streamedTips,
  streamStatus,
}: LoadingScreenProps) {
  // ── Progress maths ──────────────────────────────────────────────────────────
  const buildSignals = streamedPlaces.length + streamedTips.length + (streamStatus ? 1 : 0);
  const percent = Math.min(95, Math.round((buildSignals / 14) * 100));
  const activeStep = Math.min(LOADING_STEPS.length - 1, Math.floor(buildSignals / 2));
  const bgUrl = resolveBackgroundImage(destination, activeStep);

  // ── Rotating destination facts ──────────────────────────────────────────────
  const facts = useMemo(() => getDestinationFacts(destination), [destination]);
  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIndex((i) => (i + 1) % facts.length), 7000);
    return () => clearInterval(id);
  }, [facts.length]);

  // ── Recent places (last 4, newest first) ────────────────────────────────────
  const recentPlaces = useMemo(
    () => [...streamedPlaces].slice(-4).reverse(),
    [streamedPlaces],
  );

  const statusText = streamStatus
    ? `${streamStatus.icon} ${streamStatus.message}`
    : 'Analyzing your preferences…';

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `linear-gradient(rgba(9,31,54,0.65), rgba(9,31,54,0.90)), url("${bgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ── Cinematic vignette ────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: [
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 25%, rgba(0,0,0,0.60) 100%)',
            'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.82) 100%)',
            'radial-gradient(ellipse 120% 60% at 50% 100%, rgba(158,54,58,0.20) 0%, transparent 55%)',
            'radial-gradient(ellipse 60% 40% at 80% 70%, rgba(74,123,222,0.12) 0%, transparent 50%)',
          ].join(','),
        }}
      />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <span
          className="text-[11px] font-bold tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          TravelOS
        </span>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#9e363a', boxShadow: '0 0 8px #9e363a' }}
          />
          <span
            className="text-[11px] font-bold tracking-[0.08em] uppercase"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            AI Build Live
          </span>
        </div>
      </div>

      {/* ── Main two-column layout ────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-end gap-8 lg:gap-0 px-8 pb-16 lg:pb-20">

        {/* ── LEFT: Cinematic progress ─────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-end pb-1 lg:pr-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Eyebrow */}
            <p
              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Building your trip to{' '}
              <span style={{ color: '#c5912a' }}>
                {destination || 'your destination'}
              </span>
            </p>

            {/* Destination name — editorial */}
            <h1
              className="font-black text-white leading-[0.9] mb-6"
              style={{
                fontSize: 'clamp(38px, 6vw, 80px)',
                letterSpacing: '-2px',
              }}
            >
              {destination || 'Your Trip'}
            </h1>

            {/* Percentage display */}
            <div className="flex items-end gap-3 mb-5">
              <motion.span
                className="font-black leading-none text-white tabular-nums"
                style={{
                  fontSize: 'clamp(64px, 9vw, 108px)',
                  letterSpacing: '-4px',
                }}
                key={percent}
                initial={{ opacity: 0.6, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {percent}
              </motion.span>
              <div className="pb-3 flex flex-col gap-1">
                <span
                  className="font-bold"
                  style={{ fontSize: '24px', color: 'rgba(255,255,255,0.40)' }}
                >
                  %
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  Complete
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="w-full max-w-lg h-[3px] rounded-full mb-5 relative overflow-visible"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #9e363a 0%, #c5912a 50%, #4a7bde 100%)',
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Glowing tip */}
                <span
                  className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-white"
                  style={{
                    transform: 'translate(50%, -50%)',
                    boxShadow: '0 0 8px #fff, 0 0 16px rgba(255,255,255,0.5)',
                  }}
                />
              </motion.div>
            </div>

            {/* Step pills */}
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {LOADING_STEPS.map((step, i) => {
                const done   = i < activeStep;
                const active = i === activeStep;
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 25 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                    style={
                      active
                        ? {
                            background: 'rgba(158,54,58,0.18)',
                            borderColor: 'rgba(158,54,58,0.45)',
                            color: '#fff',
                            boxShadow: '0 0 16px rgba(158,54,58,0.15)',
                          }
                        : done
                        ? {
                            background: 'rgba(255,255,255,0.02)',
                            borderColor: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.20)',
                            textDecoration: 'line-through',
                          }
                        : {
                            background: 'rgba(255,255,255,0.02)',
                            borderColor: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.16)',
                          }
                    }
                  >
                    {active && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                        style={{ background: '#f87171', boxShadow: '0 0 6px #f87171' }}
                      />
                    )}
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT: Live discoveries ───────────────────────────────── */}
        <motion.div
          className="w-full lg:w-80 xl:w-88 shrink-0 flex flex-col gap-2.5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Live discoveries
          </p>

          {/* Place cards */}
          <AnimatePresence initial={false}>
            {recentPlaces.map((place) => {
              const badge = resolveBadge(place.vibeLabel);
              return (
                <motion.div
                  key={`${place.name}-${place.day}-${place.slot}`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md"
                  style={{
                    background:
                      place.vibeLabel === 'hidden-gem'
                        ? 'rgba(158,54,58,0.12)'
                        : place.vibeLabel === 'local-favorite'
                        ? 'rgba(74,123,222,0.10)'
                        : 'rgba(255,255,255,0.06)',
                    borderColor:
                      place.vibeLabel === 'hidden-gem'
                        ? 'rgba(158,54,58,0.28)'
                        : place.vibeLabel === 'local-favorite'
                        ? 'rgba(74,123,222,0.22)'
                        : 'rgba(255,255,255,0.10)',
                  }}
                >
                  <span className="text-xl flex-shrink-0">{place.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{place.name}</p>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: 'rgba(255,255,255,0.38)' }}
                    >
                      {place.description || place.slot}
                    </p>
                  </div>
                  {badge && (
                    <span
                      className="flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full border whitespace-nowrap"
                      style={
                        badge.type === 'gem'
                          ? {
                              background: 'rgba(197,145,42,0.20)',
                              color: '#c5912a',
                              borderColor: 'rgba(197,145,42,0.30)',
                            }
                          : {
                              background: 'rgba(74,123,222,0.20)',
                              color: '#748ffc',
                              borderColor: 'rgba(74,123,222,0.30)',
                            }
                      }
                    >
                      {badge.text}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {recentPlaces.length === 0 && (
            <div
              className="px-4 py-3 rounded-2xl border"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                Scanning for the best spots…
              </p>
            </div>
          )}

          {/* Rotating destination fact */}
          <AnimatePresence mode="wait">
            <motion.div
              key={factIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md mt-1"
              style={{
                background: 'rgba(15,40,98,0.22)',
                borderColor: 'rgba(74,123,222,0.18)',
              }}
            >
              <span className="text-base flex-shrink-0 mt-0.5">💡</span>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.48)' }}
              >
                {facts[factIndex]}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Status pill ───────────────────────────────────────────────── */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full border flex-shrink-0 animate-spin"
          style={{
            borderColor: 'rgba(255,255,255,0.20)',
            borderTopColor: 'rgba(255,255,255,0.65)',
          }}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={statusText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-medium"
          >
            {statusText}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
