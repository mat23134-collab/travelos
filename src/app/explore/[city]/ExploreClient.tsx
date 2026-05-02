'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlacesGrid, PlaceCardData } from '@/components/PlaceCard';

interface Section {
  key: string;          // vibe_label or category
  label: string;        // display title
  icon: string;
  places: PlaceCardData[];
  accentColor: string;  // section header accent
}

interface ExploreClientProps {
  city: string;
  sections: Section[];
  totalPlaces: number;
}

// Stagger variants for sections entering viewport
const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 28 },
  },
};

export function ExploreClient({ city, sections, totalPlaces }: ExploreClientProps) {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #080b12 0%, #0d0f18 60%, #090c14 100%)' }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-30 border-b border-white/6"
        style={{ background: 'rgba(8,11,18,0.85)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold tracking-tight text-white">
            Travel<span style={{ color: '#ff5a5f' }}>OS</span>
          </Link>
          <div className="flex items-center gap-3">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs"
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'rgba(255,255,255,0.55)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: '#22c55e' }}
              />
              Scout Intelligence
            </div>
            <Link
              href="/plan"
              className="text-xs font-semibold px-4 py-2 rounded-xl text-white transition-all"
              style={{ background: '#ff5a5f', boxShadow: '0 4px 16px rgba(255,90,95,0.30)' }}
            >
              Plan Trip ✈️
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-5 py-10 sm:py-14">

        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="mb-12"
        >
          {/* City pill */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold mb-5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            <span>📍</span>
            {city}
            <span
              className="h-3.5 w-px"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            />
            <span style={{ color: '#4ade80' }}>{totalPlaces} Scout Picks</span>
          </div>

          <h1
            className="text-5xl sm:text-7xl font-black tracking-tighter text-white leading-none mb-4"
            style={{ textShadow: '0 0 60px rgba(168,85,247,0.35)' }}
          >
            {city}
          </h1>
          <p className="text-white/45 text-base max-w-md leading-relaxed">
            Underground spots, viral trends, and local secrets — verified by TravelOS Scout.
            Tap any card to explore.
          </p>
        </motion.div>

        {/* Sections */}
        {sections.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-white font-bold text-lg mb-2">No places scouted yet</h2>
            <p className="text-white/40 text-sm mb-6">
              Run the Scout Agent to pre-research {city}:
            </p>
            <code
              className="block text-sm px-4 py-3 rounded-xl text-left max-w-sm mx-auto"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: '#4ade80',
              }}
            >
              npm run scout -- {city}
            </code>
          </div>
        ) : (
          <div className="flex flex-col gap-14">
            {sections.map((section, i) => (
              <motion.section
                key={section.key}
                variants={sectionVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: '-48px' }}
                transition={{ delay: i * 0.04 }}
              >
                {/* Section header */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-2xl leading-none">{section.icon}</span>
                  <h2
                    className="text-xl font-extrabold tracking-tight"
                    style={{ color: section.accentColor }}
                  >
                    {section.label}
                  </h2>
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${section.accentColor}15`,
                      border: `1px solid ${section.accentColor}35`,
                      color: `${section.accentColor}90`,
                    }}
                  >
                    {section.places.length}
                  </span>
                  <div className="flex-1 h-px" style={{ background: `${section.accentColor}20` }} />
                </div>

                {/* Card grid — layoutId morphing lives inside PlacesGrid */}
                <PlacesGrid places={section.places} columns={3} />
              </motion.section>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-20 pt-8 border-t border-white/6 text-center">
          <p className="text-white/25 text-xs mb-4">
            Places researched by TravelOS Scout · Verified via Exa live search
          </p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all"
            style={{ background: '#ff5a5f', boxShadow: '0 4px 20px rgba(255,90,95,0.28)' }}
          >
            Build a {city} Itinerary ✈️
          </Link>
        </div>

      </div>
    </div>
  );
}
