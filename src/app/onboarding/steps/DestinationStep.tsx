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

import { useState } from 'react';
import { motion } from 'framer-motion';
import { sceneContent } from '@/three/tunnel';
import { CompassScene } from '@/three/CompassScene';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const PRIMARY   = '#9e363a';
const PRIMARY_H = '#b5404a';

// ── Featured destinations ─────────────────────────────────────────────────────
const DESTINATIONS = [
  { name: 'Paris',      flag: '🇫🇷', tagline: 'City of Light'           },
  { name: 'Tokyo',      flag: '🇯🇵', tagline: 'Neon & Tradition'        },
  { name: 'Rome',       flag: '🇮🇹', tagline: 'La Dolce Vita'           },
  { name: 'New York',   flag: '🇺🇸', tagline: 'The City That Never Sleeps' },
  { name: 'Barcelona',  flag: '🇪🇸', tagline: 'Gaudí & Tapas'           },
  { name: 'Bali',       flag: '🇮🇩', tagline: 'Island of the Gods'      },
  { name: 'Dubai',      flag: '🇦🇪', tagline: 'Luxury in the Desert'    },
  { name: 'London',     flag: '🇬🇧', tagline: 'Iconic & Eclectic'       },
  { name: 'Marrakech',  flag: '🇲🇦', tagline: 'Spice & Labyrinth'       },
  { name: 'Santorini',  flag: '🇬🇷', tagline: 'Caldera Sunsets'         },
];

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

export function DestinationStep({ onNext }: { onNext: () => void }) {
  const { destination, setDestination } = useOnboardingStore();
  const [inputVal, setInputVal] = useState(destination);

  const handleSelect = (name: string) => {
    setInputVal(name);
    setDestination(name);
  };

  const handleInputChange = (v: string) => {
    setInputVal(v);
    setDestination(v);
  };

  const canContinue = inputVal.trim().length >= 2;

  return (
    <>
      {/* Inject the full 3D compass into the canvas background */}
      <sceneContent.In>
        <CompassScene />
      </sceneContent.In>

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

        {/* Text input */}
        <div>
          <label
            className="block text-xs font-semibold mb-2 tracking-wider uppercase"
            style={{ color: '#4f5f76' }}
          >
            City or country
          </label>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && canContinue && onNext()}
            placeholder="e.g. Tokyo, Japan"
            autoFocus
            className="w-full px-4 py-3.5 rounded-2xl text-white text-base font-medium outline-none transition-all"
            style={{
              background: `rgba(15,40,98,0.30)`,
              border: `1.5px solid ${canContinue ? `rgba(158,54,58,0.55)` : `rgba(255,255,255,0.10)`}`,
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Featured destination chips */}
        <div className="grid grid-cols-2 gap-2">
          {DESTINATIONS.map(({ name, flag, tagline }) => {
            const active = destination === name;
            return (
              <button
                key={name}
                onClick={() => handleSelect(name)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-xs font-semibold transition-all"
                style={{
                  background: active ? `rgba(158,54,58,0.20)` : `rgba(15,40,98,0.20)`,
                  border: active
                    ? `1.5px solid rgba(158,54,58,0.55)`
                    : `1.5px solid rgba(255,255,255,0.07)`,
                  color: active ? PRIMARY : '#4f5f76',
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(158,54,58,0.30)';
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                }}
              >
                <span className="text-base shrink-0">{flag}</span>
                <div className="min-w-0">
                  <div className="font-bold truncate" style={{ color: active ? PRIMARY : '#ffffff' }}>
                    {name}
                  </div>
                  <div className="text-[10px] opacity-50 truncate">{tagline}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="w-full py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            background: canContinue
              ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_H})`
              : `rgba(255,255,255,0.06)`,
            boxShadow: canContinue ? `0 8px 32px -4px rgba(158,54,58,0.50)` : 'none',
          }}
        >
          {canContinue ? `Explore ${inputVal.trim()} →` : 'Pick a destination'}
        </button>
      </motion.div>
    </>
  );
}
