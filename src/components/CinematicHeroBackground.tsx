'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HERO_OPENING_VIDEO, HERO_SLIDE_IMAGES } from '@/lib/travelImagery';

/**
 * Full-bleed hero: looping travel video with cinematic still crossfade fallback.
 * Respects prefers-reduced-motion — slideshow only, no video.
 */
export function CinematicHeroBackground() {
  const [slideIdx, setSlideIdx]     = useState(0);
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const t = setInterval(
      () => setSlideIdx((i) => (i + 1) % HERO_SLIDE_IMAGES.length),
      7000,
    );
    return () => clearInterval(t);
  }, []);

  const showVideo = !reduceMotion && !videoFailed;

  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Crossfading stills — always present as base layer */}
      <AnimatePresence mode="wait">
        <motion.div
          key={slideIdx}
          initial={{ opacity: 0, scale: 1.06 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url("${HERO_SLIDE_IMAGES[slideIdx]}")` }}
        />
      </AnimatePresence>

      {/* Opening video — subtle drift over the stills */}
      {showVideo && (
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          onLoadedData={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-[1800ms]"
          style={{ opacity: videoReady ? 0.72 : 0 }}
        >
          <source src={HERO_OPENING_VIDEO} type="video/mp4" />
        </video>
      )}

      {/* TravelOS dark wash — a gentle full-bleed base tone only; the real
          contrast guarantee for the headline is the scoped radial scrim
          rendered in page.tsx behind just the text column, so this stays
          light enough not to flatten the destination photo itself. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(11,18,32,0.38) 0%, rgba(11,18,32,0.55) 45%, rgba(11,18,32,0.95) 100%)',
        }}
      />

      {/* Redline ambient glow at horizon */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(158,54,58,0.14) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}
