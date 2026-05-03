'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { PlacesGrid, PlaceCardData } from '@/components/PlaceCard';

interface Section {
  key: string;
  label: string;
  icon: string;
  places: PlaceCardData[];
  accentColor: string;
}

interface ExploreClientProps {
  city: string;
  sections: Section[];
  totalPlaces: number;
  /** True only when the server confirmed a valid admin session cookie. */
  isAdmin: boolean;
}

const sectionVariants = {
  hidden: { opacity: 0, y: 32 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 280, damping: 28 },
  },
};

export function ExploreClient({ city, sections, totalPlaces, isAdmin }: ExploreClientProps) {
  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(160deg, #080b12 0%, #0d0f18 60%, #090c14 100%)' }}
    >
      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-30 border-b border-white/6"
        style={{ background: 'rgba(8,11,18,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <Link href="/" className="text-base font-bold tracking-tight text-white">
            Travel<span style={{ color: '#ff5a5f' }}>OS</span>
          </Link>

          <div className="flex items-center gap-3">
            {/* Admin-only: Scout Intelligence live badge */}
            {isAdmin && (
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
            )}

            {/* Admin-only: one-click logout */}
            {isAdmin && (
              <Link
                href="?logout=1"
                className="text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: 'rgba(255,255,255,0.28)',
                }}
              >
                Log out
              </Link>
            )}

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

        {/* ── Hero ────────────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          className="mb-12"
        >
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
            {totalPlaces > 0 && (
              <>
                <span className="h-3.5 w-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
                <span style={{ color: isAdmin ? '#4ade80' : '#60a5fa' }}>
                  {totalPlaces} {isAdmin ? 'Scout Picks' : 'Curated Spots'}
                </span>
              </>
            )}
          </div>

          <h1
            className="text-5xl sm:text-7xl font-black tracking-tighter text-white leading-none mb-4"
            style={{
              textShadow: isAdmin
                ? '0 0 60px rgba(168,85,247,0.35)'
                : '0 0 60px rgba(59,130,246,0.28)',
            }}
          >
            {city}
          </h1>

          <p className="text-white/45 text-base max-w-md leading-relaxed">
            {isAdmin
              ? 'Underground spots, viral trends, and local secrets — verified by TravelOS Scout. Tap any card to explore.'
              : `Hand-picked places and local favorites — curated for your next trip to ${city}. Tap any card to explore.`}
          </p>
        </motion.div>

        {/* ── Content: sections or empty state ─────────────────────────────────── */}
        {sections.length === 0 ? (
          isAdmin ? (
            /* ── Admin empty state: CLI hint ─────────────────────────────── */
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
              <p className="text-white/20 text-xs mt-4">
                Or trigger remotely via{' '}
                <code className="text-white/35">POST /api/admin/scout-trigger</code>
              </p>
            </div>
          ) : (
            /* ── Public empty state: no CLI, no admin hints ──────────────── */
            <div className="text-center py-24">
              <div className="text-5xl mb-4 select-none opacity-35">✨</div>
              <h2 className="text-white/65 font-semibold text-lg mb-2">
                Curated picks coming soon
              </h2>
              <p className="text-white/28 text-sm max-w-xs mx-auto leading-relaxed">
                Our team is hand-picking the best spots in {city}. Check back soon, or build
                a full itinerary right now.
              </p>
              <Link
                href="/plan"
                className="inline-flex items-center gap-2 mt-8 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all"
                style={{ background: '#ff5a5f', boxShadow: '0 4px 20px rgba(255,90,95,0.28)' }}
              >
                Build a {city} Itinerary ✈️
              </Link>
            </div>
          )
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

                <PlacesGrid places={section.places} columns={3} />
              </motion.section>
            ))}
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────────── */}
        <div className="mt-20 pt-8 border-t border-white/6 text-center">
          <p className="text-white/18 text-xs mb-4">
            {isAdmin
              ? 'Scout Intelligence · Verified via Exa live search · TravelOS Admin'
              : `Curated picks for ${city} · TravelOS`}
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
