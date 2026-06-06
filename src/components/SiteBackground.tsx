'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STEP_BACKGROUNDS } from '@/lib/stepBackgrounds';
import { ITIN_RESULTS_NOISE_DATA_URL } from '@/lib/itineraryResultsPalette';

export function SiteBackground() {
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBgIdx((i) => (i + 1) % STEP_BACKGROUNDS.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <AnimatePresence initial={false}>
        <motion.div
          key={bgIdx}
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -20,
            backgroundImage: `url("${STEP_BACKGROUNDS[bgIdx].imageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: -19, background: 'rgba(180,228,222,0.82)' }}
      />

      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.022]"
        style={{
          zIndex: -18,
          backgroundImage: `url(${ITIN_RESULTS_NOISE_DATA_URL})`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'multiply',
        }}
      />
    </>
  );
}
