'use client';

/**
 * DestinationStep — Step 1 of 4 in the onboarding flow.
 *
 * The user picks (or types) their destination. The 3D compass from the
 * landing page is injected here via sceneContent so it's visible as they
 * choose — the compass *is* TravelOS: where are you going?
 *
 * Palette: Redline (#9e363a) accents on Purple Shadow (#091f36) bg.
 */

import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { DESTINATIONS } from '@/lib/destinations';

// ── Palette ───────────────────────────────────────────────────────────────────
const PRIMARY   = '#9e363a';
const PRIMARY_H = '#b5404a';

// ── Featured destinations ─────────────────────────────────────────────────────

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

export function DestinationStep({ onNext }: { onNext: () => void }) {
  const { destination, setDestinationGeo } = useOnboardingStore();

  const handleSelect = (name: string, lat: number, lng: number) => {
    setDestinationGeo(name, lat, lng);
  };

  const canContinue = destination.trim().length >= 2;

  return (
    <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex flex-col gap-6"
      >
        {/* Step badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: `rgba(158,54,58,0.15)`,
              color: PRIMARY,
              border: `1px solid rgba(158,54,58,0.30)`,
            }}
          >
            Step 1 of 4
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Where are you<br />
            <span style={{ color: PRIMARY }}>going?</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            Your destination shapes everything — AI, neighborhoods, hidden gems.
          </p>
        </div>

        {/* Featured destination postcards */}
        <div className="grid grid-cols-2 gap-2.5">
          {DESTINATIONS.map(({ name, flag, tagline, lat, lng }) => {
            const active = destination === name;
            return (
              <motion.button
                key={name}
                onClick={() => handleSelect(name, lat, lng)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                animate={active
                  ? { boxShadow: `0 0 0 2px ${PRIMARY}, 0 12px 32px -6px rgba(158,54,58,0.32)` }
                  : { boxShadow: '0 4px 16px rgba(0,0,0,0.28)' }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className="relative flex flex-col gap-1 px-3.5 py-4 rounded-2xl text-left transition-colors overflow-hidden"
                style={{
                  background: active ? `rgba(158,54,58,0.18)` : `rgba(15,40,98,0.28)`,
                  border: active ? `1.5px solid rgba(158,54,58,0.55)` : `1.5px solid rgba(255,255,255,0.07)`,
                }}
              >
                {active && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: PRIMARY }}
                  >
                    <span className="text-white text-[9px] font-bold">✓</span>
                  </motion.div>
                )}
                <span className="text-2xl leading-none">{flag}</span>
                <div className="font-black text-sm leading-tight mt-1"
                  style={{ color: active ? '#ff9fa3' : '#ffffff' }}>
                  {name}
                </div>
                <div className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  {tagline}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* CTA */}
        <motion.button
          onClick={onNext}
          disabled={!canContinue}
          whileHover={canContinue ? { scale: 1.02, y: -2 } : {}}
          whileTap={canContinue ? { scale: 0.97 } : {}}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
          className="w-full py-4 rounded-full text-sm font-black text-white tracking-wide disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            background: canContinue
              ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_H})`
              : `rgba(255,255,255,0.06)`,
            boxShadow: canContinue ? `0 0 40px rgba(158,54,58,0.45), 0 8px 24px -4px rgba(158,54,58,0.30)` : 'none',
          }}
        >
          {canContinue ? `Explore ${destination.trim()} →` : 'Pick a destination'}
        </motion.button>
      </motion.div>
  );
}
