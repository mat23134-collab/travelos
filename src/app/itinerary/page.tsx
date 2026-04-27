'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { DayCard } from '@/components/DayCard';
import { QuickEdit } from '@/components/QuickEdit';
import { SharePanel } from '@/components/SharePanel';
import { LogisticsDashboard } from '@/components/LogisticsDashboard';
import { DraftOverview } from '@/components/DraftOverview';
import { ItinerarySkeleton } from '@/components/ItinerarySkeleton';
import type { SwapResult } from '@/app/api/swap/route';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  { ssr: false, loading: () => <div className="w-full rounded-2xl bg-[#f0ede4] animate-pulse" style={{ height: 380 }} /> }
);

type ViewMode = 'draft' | 'final';

// ─── Hero animation ───────────────────────────────────────────────────────────

const heroVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

// ─── Mobile map overlay ───────────────────────────────────────────────────────

function MobileMapOverlay({
  days,
  destination,
  focusedNeighborhood,
  onClose,
}: {
  days: Itinerary['days'];
  destination: string;
  focusedNeighborhood?: string;
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
          className="relative mt-auto bg-white rounded-t-3xl overflow-hidden"
          style={{ height: '85dvh' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#e5e7eb]">
            <h3 className="font-bold text-[#111827] text-sm tracking-tight">Route Map</h3>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-[#f3f4f6] text-[#6b7280] text-sm hover:bg-[#e5e7eb] transition-colors"
            >
              ✕
            </motion.button>
          </div>
          <div className="h-full pb-14">
            <ItineraryMap
              days={days}
              destination={destination}
              focusedNeighborhood={focusedNeighborhood}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ItineraryPage() {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('draft');
  const [error, setError] = useState('');
  const [editBanner, setEditBanner] = useState('');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [focusedNeighborhood, setFocusedNeighborhood] = useState<string | undefined>();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('travelos_itinerary');
      const rawProfile = sessionStorage.getItem('travelos_profile');
      if (!raw) { router.replace('/plan'); return; }
      setItinerary(JSON.parse(raw));
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {
      setError('Could not load your itinerary. Please try again.');
    }
  }, [router]);

  const persistAndSet = useCallback((updated: Itinerary) => {
    setItinerary(updated);
    sessionStorage.setItem('travelos_itinerary', JSON.stringify(updated));
  }, []);

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
    slot: 'morning' | 'afternoon' | 'evening'
  ) => {
    if (!itinerary) return;
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itinerary, dayIndex, slot, request: `Suggest a better ${slot} activity` }),
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

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-[#111827] mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-[#6b7280] mb-6">{error}</p>
        <Link href="/plan" className="px-6 py-3 rounded-xl bg-[#ff5a5f] text-white font-semibold text-sm hover:bg-[#e04a4f] transition-colors">
          Try again
        </Link>
      </div>
    );
  }

  // ── Skeleton loading state (replaces bare spinner) ──────────────────────────
  if (!itinerary) {
    return (
      <div className="min-h-screen bg-[#f8f7f2]">
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-[#e5e7eb]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight text-[#111827]">
              Travel<span className="text-[#ff5a5f]">OS</span>
            </div>
            <div className="skeleton-bar w-28 h-7 rounded-lg" />
          </div>
        </div>
        <ItinerarySkeleton count={3} />
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#f8f7f2]">
      {/* Edit banner */}
      <AnimatePresence>
        {editBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 inset-x-0 z-50 bg-[#111827] text-white text-sm py-2.5 px-6 text-center shadow-lg print:hidden"
          >
            ✓ {editBanner}
          </motion.div>
        )}
      </AnimatePresence>

      <nav className={`sticky z-40 bg-white/90 backdrop-blur-sm border-b border-[#e5e7eb] transition-all print:hidden ${editBanner ? 'top-10' : 'top-0'}`}>
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[#111827]">
            Travel<span className="text-[#ff5a5f]">OS</span>
          </Link>
          <div className="flex items-center gap-2">
            <motion.button
              onClick={() => setViewMode('draft')}
              whileTap={{ scale: 0.92, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
              className="text-xs font-medium px-3 py-2 rounded-lg border border-[#e5e7eb] text-[#6b7280] hover:bg-[#f3f4f6] transition-colors"
            >
              ← Draft
            </motion.button>
            <SharePanel itinerary={itinerary} profile={profile} />
            <Link href="/plan" className="text-sm font-medium px-4 py-2 rounded-lg border border-[#e5e7eb] text-[#374151] hover:bg-[#f3f4f6] transition-colors">
              ← New Trip
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Hero — dark card with noise orbs */}
        <motion.div
          variants={heroVariant}
          initial="hidden"
          animate="show"
          className="bg-[#0f1117] rounded-2xl p-6 sm:p-10 mb-8 text-white relative overflow-hidden"
        >
          {/* Coral orb with noise */}
          <div className="noise absolute top-0 right-0 w-96 h-96 bg-[#ff5a5f]/12 rounded-full blur-[80px] pointer-events-none" />
          {/* Violet orb with noise */}
          <div className="noise absolute bottom-0 left-1/4 w-64 h-64 bg-[#8b5cf6]/10 rounded-full blur-[80px] pointer-events-none" />
          {/* Cyan accent */}
          <div className="absolute top-1/2 right-1/3 w-32 h-32 bg-[#00d4ff]/6 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-xs text-white/60 mb-6 flex-wrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse" />
              AI-Crafted · {new Date().getFullYear()} Live Data
              {itinerary._meta?.searchEnabled && <>
                <span className="opacity-40">·</span>
                <span>{itinerary._meta.sourcesFound} sources</span>
                {(itinerary._meta.hiddenGems ?? 0) > 0 && <span className="text-purple-400">💎 {itinerary._meta.hiddenGems} hidden gems</span>}
                {(itinerary._meta.trapsFiltered ?? 0) > 0 && <span className="text-amber-400">⚠️ {itinerary._meta.trapsFiltered} traps filtered</span>}
                {(itinerary._meta.contradictionsFound ?? 0) > 0 && <span className="text-red-400">🔴 {itinerary._meta.contradictionsFound} contradictions flagged</span>}
              </>}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 tracking-tight">{itinerary.destination}</h1>
            <p className="text-white/60 text-sm mb-6">
              {itinerary.totalDays}-day itinerary
              {profile && ` · ${profile.groupType} · ${profile.budget} budget · ${profile.pace} pace`}
            </p>
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-xs font-semibold uppercase tracking-widest text-[#ff5a5f] mb-2">Strategic Overview</div>
              <p className="text-white/80 text-sm leading-relaxed">{itinerary.strategicOverview}</p>
            </div>
          </div>
        </motion.div>

        {/* Budget summary */}
        {itinerary.budgetSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 26 }}
            className="bg-white rounded-2xl border border-[#e5e7eb] p-6 mb-8 grid sm:grid-cols-3 gap-4"
          >
            <div className="text-center p-4 rounded-xl bg-[#f8f7f2]">
              <div className="text-xs text-[#9ca3af] uppercase tracking-widest mb-1">Daily Average</div>
              <div className="text-xl font-bold text-[#111827] tracking-tight">{itinerary.budgetSummary.dailyAverage}</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-[#fff0f0]">
              <div className="text-xs text-[#9ca3af] uppercase tracking-widest mb-1">Total Estimate</div>
              <div className="text-xl font-bold text-[#ff5a5f] tracking-tight">{itinerary.budgetSummary.totalEstimate}</div>
            </div>
            <div className="text-center p-4 rounded-xl bg-[#f8f7f2]">
              <div className="text-xs text-[#9ca3af] uppercase tracking-widest mb-1">Includes</div>
              <div className="text-sm text-[#6b7280] leading-relaxed">{itinerary.budgetSummary.includes}</div>
            </div>
          </motion.div>
        )}

        {/* Map — desktop only */}
        <section className="mb-8 print:hidden hidden sm:block" data-map-container>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-[#111827] tracking-tight">Route Map</h2>
            <div className="flex-1 h-px bg-[#e5e7eb]" />
            <span className="text-xs text-[#9ca3af]">Clustered by neighborhood</span>
          </div>
          <ItineraryMap
            days={itinerary.days}
            destination={itinerary.destination}
            focusedNeighborhood={focusedNeighborhood}
          />
        </section>

        {/* Day cards — scroll-reveal with 3D depth */}
        <div
          className="flex flex-col gap-6 mb-8"
          style={{ perspective: '1200px' }}
        >
          {itinerary.days.map((day, i) => (
            <motion.div
              key={`${day.day}-${i}`}
              initial={{ opacity: 0, y: 48, rotateX: 6 }}
              whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{
                type: 'spring',
                stiffness: 280,
                damping: 26,
                delay: Math.min(i * 0.06, 0.2),
              }}
              style={{ transformOrigin: 'top center', willChange: 'transform, opacity' }}
            >
              <DayCard
                day={day}
                index={i}
                destination={itinerary.destination}
                onSwapSlot={(slot) => handleSlotSwap(i, slot)}
                onNeighborhoodClick={handleNeighborhoodClick}
              />
            </motion.div>
          ))}
        </div>

        {/* Packing + tips */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {itinerary.packingTips?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="bg-white rounded-2xl border border-[#e5e7eb] p-6"
            >
              <h3 className="font-bold text-[#111827] mb-4 flex items-center gap-2 tracking-tight"><span>🎒</span> Packing Essentials</h3>
              <ul className="flex flex-col gap-2">
                {itinerary.packingTips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#6b7280]">
                    <span className="text-[#ff5a5f] flex-shrink-0 mt-0.5">✓</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          {itinerary.bestLocalTips?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.08 }}
              className="bg-white rounded-2xl border border-[#e5e7eb] p-6"
            >
              <h3 className="font-bold text-[#111827] mb-4 flex items-center gap-2 tracking-tight"><span>🗝️</span> Local Insider Tips</h3>
              <ul className="flex flex-col gap-2">
                {itinerary.bestLocalTips.map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm text-[#6b7280]">
                    <span className="text-[#ff5a5f] flex-shrink-0 mt-0.5">✦</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>

        {profile && <LogisticsDashboard profile={profile} />}

        <div className="text-center py-8 border-t border-[#e5e7eb] print:hidden">
          <p className="text-[#6b7280] text-sm mb-4">Want to start from scratch?</p>
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
            className="inline-block"
          >
            <Link href="/plan" className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] text-white font-semibold text-sm transition-colors shadow-md shadow-[#ff5a5f]/20">
              Plan Another Trip →
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
        className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-[#0f1117] text-white text-sm font-semibold shadow-xl shadow-black/30 print:hidden"
      >
        <span>🗺</span> Map
      </motion.button>

      {/* Mobile map overlay */}
      {mobileMapOpen && (
        <MobileMapOverlay
          days={itinerary.days}
          destination={itinerary.destination}
          focusedNeighborhood={focusedNeighborhood}
          onClose={() => { setMobileMapOpen(false); setFocusedNeighborhood(undefined); }}
        />
      )}

      <div className="print:hidden">
        <QuickEdit itinerary={itinerary} onUpdate={handleQuickEditUpdate} />
      </div>
    </div>
  );
}
