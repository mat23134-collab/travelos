'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile, Basecamp, HotelRecommendation } from '@/lib/types';
import { DayCard } from '@/components/DayCard';
import { DayPhoto } from '@/components/DayPhoto';
import { QuickEdit } from '@/components/QuickEdit';
import { SharePanel } from '@/components/SharePanel';
import { LogisticsDashboard } from '@/components/LogisticsDashboard';
import { DraftOverview } from '@/components/DraftOverview';
import { TrendingTicker } from '@/components/TrendingTicker';
import type { SwapResult } from '@/app/api/swap/route';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  { ssr: false, loading: () => <div className="w-full rounded-2xl animate-pulse" style={{ height: 380, background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.07)' }} /> }
);

type ViewMode = 'draft' | 'final';

// ─── Basecamp section ─────────────────────────────────────────────────────────

function HotelCard({ hotel }: { hotel: HotelRecommendation }) {
  return (
    <div
      className="relative flex flex-col rounded-2xl border border-white/10 overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-[#9e363a]/40"
      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9e363a]/50 to-transparent" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a] bg-[#9e363a]/12 px-2 py-0.5 rounded-full">
            {hotel.neighborhoodVibe}
          </span>
          <span className="text-[10px] text-white/40 font-mono">{hotel.priceRange}</span>
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">{hotel.name}</p>
          <p className="text-[11px] text-white/45 mt-0.5">📍 {hotel.neighborhood}</p>
        </div>
        <p className="text-xs text-white/65 leading-relaxed">{hotel.whyItFits}</p>
        <div
          className="mt-auto rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Neighborhood Edge</p>
          <p className="text-[11px] text-white/60 leading-relaxed">{hotel.neighborhoodInsight}</p>
        </div>
      </div>
    </div>
  );
}

function BasecampSection({ basecamp }: { basecamp: Basecamp }) {
  if (basecamp.type === 'booked' && basecamp.booked) {
    const { name, neighborhood, neighborhoodInsight } = basecamp.booked;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#9e363a]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-[#8b5cf6]/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a]">🏠 Your Basecamp</span>
            <span className="text-[10px] text-white/30 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">Pre-booked</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{name}</h3>
          <p className="text-sm text-white/45 mt-0.5">📍 {neighborhood}</p>
          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8c8f] mb-1">Neighborhood Strategy</p>
            <p className="text-sm text-white/75 leading-relaxed">{neighborhoodInsight}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (basecamp.type === 'recommendations' && basecamp.recommendations?.length) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#9e363a]/08 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#8b5cf6]/08 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a]">🏠 Basecamp</span>
            <span className="text-[10px] text-white/30">Squad-Approved Picks</span>
          </div>
          <h3 className="text-base font-bold text-white mb-4">Where should your squad stay?</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {basecamp.recommendations.map((hotel, i) => (
              <HotelCard key={i} hotel={hotel} />
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-4 text-center">
            Based on your interests, budget, and optimal neighborhood positioning
          </p>
        </div>
      </motion.div>
    );
  }

  return null;
}

// ─── Trip Intelligence modal ──────────────────────────────────────────────────

function TripIntelligenceButton({ meta }: { meta: NonNullable<Itinerary['_meta']> }) {
  const [open, setOpen] = useState(false);

  if (!meta.searchEnabled) return null;

  const stats = [
    { icon: '🔍', label: 'Sources scanned', value: meta.sourcesFound, color: 'text-white' },
    { icon: '💎', label: 'Hidden gems found', value: meta.hiddenGems ?? 0, color: 'text-purple-400' },
    { icon: '⚠️', label: 'Tourist traps filtered', value: meta.trapsFiltered ?? 0, color: 'text-amber-400' },
    { icon: '🔴', label: 'Contradictions flagged', value: meta.contradictionsFound ?? 0, color: 'text-red-400' },
  ];

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/70 hover:bg-white/15 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#9e363a] animate-pulse" />
        Trip Intelligence
        <span className="text-white/40 ml-0.5">↗</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-sm bg-[#0f1117] rounded-2xl border border-white/10 p-6 shadow-2xl"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#9e363a]/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-white font-bold text-base tracking-tight">Trip Intelligence</h3>
                    <p className="text-white/40 text-xs mt-0.5">How your itinerary was built</p>
                  </div>
                  <motion.button
                    onClick={() => setOpen(false)}
                    whileTap={{ scale: 0.85 }}
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/15 transition-colors text-xs"
                  >
                    ✕
                  </motion.button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {stats.map(({ icon, label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{icon}</span>
                        <span className="text-white/60 text-xs">{label}</span>
                      </div>
                      <span className={`font-bold text-sm tabular-nums ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-white/25 text-[10px] mt-4 leading-relaxed text-center">
                  AI cross-referenced {meta.sourcesFound} live web sources to surface the best spots, filter traps, and flag conflicting info.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Hero animation ───────────────────────────────────────────────────────────

const heroVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

// ─── Mobile map overlay ───────────────────────────────────────────────────────

function MobileMapOverlay({
  days, destination, focusedNeighborhood, basecampMarker, onClose,
}: {
  days: Itinerary['days'];
  destination: string;
  focusedNeighborhood?: string;
  basecampMarker?: { lat: number; lng: number; label?: string } | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative mt-auto rounded-t-3xl overflow-hidden"
          style={{ height: '85dvh', background: '#0d1f36', border: '1px solid rgba(255,255,255,0.10)' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h3 className="font-bold text-white text-sm tracking-tight">Route Map</h3>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
              className="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
            >
              ✕
            </motion.button>
          </div>
          <div className="h-full pb-14">
            <ItineraryMap
              days={days}
              destination={destination}
              focusedNeighborhood={focusedNeighborhood}
              basecampMarker={basecampMarker}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  initialItinerary: Itinerary;
  initialProfile: TravelerProfile | null;
  initialViewMode?: ViewMode;
}

export function ItineraryClient({ initialItinerary, initialProfile, initialViewMode = 'draft' }: Props) {
  const [itinerary, setItinerary] = useState<Itinerary>(initialItinerary);
  const [profile] = useState<TravelerProfile | null>(initialProfile);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [editBanner, setEditBanner] = useState('');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [focusedNeighborhood, setFocusedNeighborhood] = useState<string | undefined>();
  const basecampMarker = useMemo(() => {
    if (
      profile?.hotelLat != null &&
      profile?.hotelLng != null &&
      Number.isFinite(profile.hotelLat) &&
      Number.isFinite(profile.hotelLng)
    ) {
      return {
        lat: profile.hotelLat,
        lng: profile.hotelLng,
        label: profile.hotelAddress || profile.hotelBooked || 'Base Camp',
      };
    }
    return null;
  }, [profile]);

  // Admin check — reads the client-readable cookie set by middleware on ?key= login.
  // Used purely for UI visibility; actual data filtering happens server-side.
  const isAdmin = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((c) => c.trim() === 'travelos_admin_ui=1');
  }, []);

  // If React reuses this component instance during client-side navigation (e.g.
  // /itinerary → /itinerary/[id]), useState won't reinitialise. Sync from props
  // so server-fetched Supabase data always wins over any stale local state.
  useEffect(() => {
    setItinerary(initialItinerary);
    setViewMode(initialViewMode ?? 'draft');
  }, [initialItinerary, initialViewMode]);

  // Only write back to sessionStorage for the sessionStorage-backed route
  // (/itinerary). The [id] route always re-fetches from Supabase, so writing
  // here would pollute sessionStorage with a different trip's data.
  const sessionPersist = initialViewMode !== 'final';

  const persistAndSet = useCallback((updated: Itinerary) => {
    setItinerary(updated);
    if (sessionPersist) {
      try { sessionStorage.setItem('travelos_itinerary', JSON.stringify(updated)); } catch { /* ignore */ }
    }
  }, [sessionPersist]);

  const handleQuickEditUpdate = useCallback((updated: Itinerary, summary: string) => {
    persistAndSet(updated);
    setEditBanner(summary);
    setTimeout(() => setEditBanner(''), 5000);
  }, [persistAndSet]);

  const handleDraftUpdate = useCallback((updated: Itinerary) => {
    persistAndSet(updated);
  }, [persistAndSet]);

  const handleSlotSwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => {
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined, // enables targeted row-level DB update
        dayIndex,
        slot,
        request: request?.trim() || `Suggest a better ${slot} activity`,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');

    const updatedDays = itinerary.days.map((day, i) =>
      i !== dayIndex ? day : { ...day, [slot]: data.activity }
    );
    persistAndSet({ ...itinerary, days: updatedDays });
    setEditBanner(data.summary);
    setTimeout(() => setEditBanner(''), 5000);
  }, [itinerary, persistAndSet]);

  const handleNeighborhoodClick = useCallback((neighborhood: string) => {
    setFocusedNeighborhood(neighborhood);
    setMobileMapOpen(true);
  }, []);

  // ── DRAFT MODE ──────────────────────────────────────────────────────────────
  if (viewMode === 'draft') {
    return (
      <DraftOverview
        itinerary={itinerary}
        onUpdate={handleDraftUpdate}
        onFinalize={() => setViewMode('final')}
      />
    );
  }

  // ── FINAL MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#091f36' }}>
      {/* Edit banner */}
      <AnimatePresence>
        {editBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 inset-x-0 z-50 text-white text-sm py-2.5 px-6 text-center shadow-lg print:hidden"
            style={{ background: 'rgba(9,31,54,0.96)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            ✓ {editBanner}
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className={`sticky z-40 backdrop-blur-sm border-b transition-all print:hidden ${editBanner ? 'top-10' : 'top-0'}`}
        style={{ background: 'rgba(9,31,54,0.90)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Travel<span style={{ color: '#9e363a' }}>OS</span>
          </Link>
          <div className="flex items-center gap-2">
            {initialViewMode !== 'final' && (
              <motion.button
                onClick={() => setViewMode('draft')}
                whileTap={{ scale: 0.92, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
                className="text-xs font-medium px-3 py-2 rounded-lg border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'; }}
              >
                ← Draft
              </motion.button>
            )}
            <SharePanel itinerary={itinerary} profile={profile} />
            {isAdmin && (
              <Link
                href={`/explore/${encodeURIComponent(itinerary.destination)}`}
                className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}
              >
                Scout Picks 💎
              </Link>
            )}
            <Link
              href="/plan"
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}
            >
              ← New Trip
            </Link>
          </div>
        </div>
      </nav>

      {/* Trending Now ticker — social proof belt below nav */}
      <TrendingTicker destination={itinerary.destination} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Hero — full-bleed destination photo with glassmorphism */}
        <motion.div
          variants={heroVariant}
          initial="hidden"
          animate="show"
          className="rounded-2xl mb-8 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <DayPhoto
              query={`${itinerary.destination} cityscape`}
              alt={itinerary.destination}
              height={520}
              dark
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/30 pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#9e363a]/20 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-[#8b5cf6]/18 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-[#00d4ff]/10 rounded-full blur-[70px] pointer-events-none" />

          <div className="relative z-10 p-6 sm:p-10">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/70 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9e363a] animate-pulse" />
                AI-Crafted · {new Date().getFullYear()} Live Intel
              </div>
              {itinerary._meta && <TripIntelligenceButton meta={itinerary._meta} />}
            </div>
            <h1
              className="text-6xl sm:text-8xl font-black mb-3 tracking-tighter leading-none"
              style={{ textShadow: '0 4px 40px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {itinerary.destination ?? 'Your Trip'}
            </h1>
            <p className="text-white/65 text-sm mb-6">
              {itinerary.totalDays ?? '?'}-day itinerary
              {profile && ` · ${profile.groupType} · ${profile.budget} budget · ${profile.pace} pace`}
            </p>
            {itinerary.strategicOverview && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-[#ff8c8f] mb-2">Your Squad's Master Plan</div>
                <p className="text-white/85 text-sm leading-relaxed">{itinerary.strategicOverview}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Basecamp */}
        {itinerary.basecamp && <BasecampSection basecamp={itinerary.basecamp} />}

        {/* Budget summary */}
        {itinerary.budgetSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 26 }}
            className="rounded-2xl p-6 mb-8 grid sm:grid-cols-3 gap-4"
            style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.30)' }}
          >
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Daily Average</div>
              <div className="text-xl font-bold text-white tracking-tight">{itinerary.budgetSummary.dailyAverage ?? '—'}</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(158,54,58,0.12)', border: '1px solid rgba(158,54,58,0.22)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Total Estimate</div>
              <div className="text-xl font-bold tracking-tight" style={{ color: '#c05060' }}>{itinerary.budgetSummary.totalEstimate ?? '—'}</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>Includes</div>
              <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{itinerary.budgetSummary.includes ?? '—'}</div>
            </div>
          </motion.div>
        )}

        {/* Map — desktop only */}
        <section className="mb-8 print:hidden hidden sm:block">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">Squad Route</h2>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Pinned by neighborhood</span>
          </div>
          <ItineraryMap
            days={itinerary.days}
            destination={itinerary.destination}
            focusedNeighborhood={focusedNeighborhood}
            basecampMarker={basecampMarker}
          />
        </section>

        {/* Day cards — staggered fade-in */}
        <motion.div
          className="flex flex-col gap-6 mb-8"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.13 } } }}
        >
          {itinerary.days.map((day, i) => (
            <motion.div
              key={`${day.day}-${i}`}
              variants={{
                hidden: { opacity: 0, y: 56, scale: 0.97 },
                show: {
                  opacity: 1, y: 0, scale: 1,
                  transition: { type: 'spring', stiffness: 260, damping: 28 },
                },
              }}
              style={{ willChange: 'transform, opacity' }}
            >
              <DayCard
                day={day}
                index={i}
                destination={itinerary.destination}
                onSwapSlot={(slot, req) => handleSlotSwap(i, slot, req)}
                onNeighborhoodClick={handleNeighborhoodClick}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Packing + tips */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {(itinerary.packingTips?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.25)' }}
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 tracking-tight"><span>🎒</span> Squad Packing List</h3>
              <ul className="flex flex-col gap-2">
                {(itinerary.packingTips ?? []).map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#9e363a' }}>✓</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          {(itinerary.bestLocalTips?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.08 }}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.25)' }}
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 tracking-tight"><span>🗝️</span> Insider Intel</h3>
              <ul className="flex flex-col gap-2">
                {(itinerary.bestLocalTips ?? []).map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#9e363a' }}>✦</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>

        {profile && <LogisticsDashboard profile={profile} />}

        <div className="text-center py-8 print:hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>New destination? New squad?</p>
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
            className="inline-block"
          >
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ background: '#9e363a', boxShadow: '0 6px 24px -4px rgba(158,54,58,0.38)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#7a2a2d')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#9e363a')}
            >
              Plan a New Trip ✈️
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Mobile floating map button */}
      <motion.button
        onClick={() => setMobileMapOpen(true)}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 26 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.90, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold shadow-xl print:hidden"
        style={{ background: 'rgba(15,40,98,0.90)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.60)' }}
      >
        <span>🗺</span> Map
      </motion.button>

      {mobileMapOpen && (
        <MobileMapOverlay
          days={itinerary.days}
          destination={itinerary.destination}
          focusedNeighborhood={focusedNeighborhood}
          basecampMarker={basecampMarker}
          onClose={() => { setMobileMapOpen(false); setFocusedNeighborhood(undefined); }}
        />
      )}

      <div className="print:hidden">
        <QuickEdit itinerary={itinerary} onUpdate={handleQuickEditUpdate} />
      </div>
    </div>
  );
}
