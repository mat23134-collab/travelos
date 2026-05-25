'use client';

/**
 * Onboarding page — single-page progressive flow.
 *
 * Five sections reveal one after another as the user completes each:
 *   1. Destination  — country → trip type → city/cities
 *   2. Dates        — calendar range + optional travel details
 *   3. Vibe         — who's traveling + pace (2 quick taps, auto-advances)
 *   4. Preferences  — budget (required) + interests (optional multi-select)
 *   5. Hotel        — optional anchor hotel (skip available)
 *
 * Completed sections collapse to a summary bar with an Edit button.
 * The floating "Generate My Itinerary" CTA appears once dates are set,
 * so the user always has an escape hatch — more sections = better trip.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';

const DestinationSection = dynamic(
  () => import('./sections/DestinationSection').then((m) => ({ default: m.DestinationSection })),
  { ssr: false }
);
const DatesSection = dynamic(
  () => import('./sections/DatesSection').then((m) => ({ default: m.DatesSection })),
  { ssr: false }
);
const VibeSection = dynamic(
  () => import('./sections/VibeSection').then((m) => ({ default: m.VibeSection })),
  { ssr: false }
);
const PreferencesSection = dynamic(
  () => import('./sections/PreferencesSection').then((m) => ({ default: m.PreferencesSection })),
  { ssr: false }
);
const HotelSection = dynamic(
  () => import('./sections/HotelSection').then((m) => ({ default: m.HotelSection })),
  { ssr: false }
);

// ── Progress bar ──────────────────────────────────────────────────────────────
//  step 0 = destination active   → 0 / 5 filled
//  step 1 = dates active         → 1 / 5 filled
//  step 2 = vibe active          → 2 / 5 filled
//  step 3 = preferences active   → 3 / 5 filled
//  step 4 = hotel active         → 4 / 5 filled

const STEP_LABELS = ['Destination', 'Dates', 'Vibe', 'Style', 'Hotel'];
const STEP_COLORS = ['#9e363a', '#4a7bde', '#7b6fcf', '#c5912a', '#2e9e74'];

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const done    = i < step;
        const active  = i === step;
        return (
          <div key={label} className="relative flex flex-col items-center gap-1">
            <div
              className="rounded-full transition-all duration-500"
              style={{
                width:  active ? 22 : done ? 8 : 6,
                height: 6,
                background: done    ? STEP_COLORS[i]
                           : active ? STEP_COLORS[i]
                           : 'rgba(255,255,255,0.10)',
                opacity: done ? 0.65 : 1,
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="h-48 animate-pulse rounded-2xl"
      style={{ background: 'rgba(15,40,98,0.18)' }} />
  );
}

// ── Connector line ────────────────────────────────────────────────────────────
function Connector({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex justify-center my-4">
      <div className="w-px h-6"
        style={{ background: `linear-gradient(to bottom, ${from}, ${to})` }} />
    </div>
  );
}

// ── Section reveal animation ──────────────────────────────────────────────────
const sectionReveal = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
};

// ── Page ──────────────────────────────────────────────────────────────────────
function OnboardingPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const {
    step, destination, startDate, endDate,
    arrivalTime, departureTime, dailyStartTime,
    skipDay1, hotelAddress, hotelLat, hotelLng,
    groupType, pace, budget, interests,
    nextStep, goToStep, reset, setDestination,
  } = useOnboardingStore();

  // Refs for auto-scroll when new sections appear
  const datesRef       = useRef<HTMLDivElement>(null);
  const vibeRef        = useRef<HTMLDivElement>(null);
  const prefsRef       = useRef<HTMLDivElement>(null);
  const hotelRef       = useRef<HTMLDivElement>(null);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  // Seed destination from query param (from landing page CTA)
  useEffect(() => {
    if (!user) return;
    const resume   = searchParams.get('resume') === '1';
    const seedDest = searchParams.get('destination')?.trim() ?? '';

    if (resume) { goToStep(4); return; }
    if (seedDest) { reset(); setDestination(seedDest); return; }

    const hasProgress = destination.trim().length > 0 || step > 0;
    if (!hasProgress) reset();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-8"
        style={{ backgroundColor: '#091f36' }}>
        <Skeleton />
      </main>
    );
  }

  // ── Navigation helpers ─────────────────────────────────────────────────────
  function scrollToRef(ref: React.RefObject<HTMLDivElement | null>) {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }

  function onDestinationComplete() {
    nextStep(); // 0 → 1
    scrollToRef(datesRef);
  }

  function onDatesComplete() {
    nextStep(); // 1 → 2
    scrollToRef(vibeRef);
  }

  function onVibeComplete() {
    nextStep(); // 2 → 3
    scrollToRef(prefsRef);
  }

  function onPrefsComplete() {
    nextStep(); // 3 → 4
    scrollToRef(hotelRef);
  }

  function handleGenerateTrip() {
    const params = new URLSearchParams();
    if (destination)    params.set('destination',    destination);
    if (startDate)      params.set('startDate',      startDate);
    if (endDate)        params.set('endDate',        endDate);
    if (arrivalTime)    params.set('arrivalTime',    arrivalTime);
    if (departureTime)  params.set('departureTime',  departureTime);
    if (dailyStartTime) params.set('dailyStartTime', dailyStartTime);
    if (skipDay1)       params.set('skipDay1',       '1');
    if (hotelAddress)   params.set('hotelAddress',   hotelAddress);
    if (hotelLat != null && hotelLng != null) {
      params.set('hotelLat', String(hotelLat));
      params.set('hotelLng', String(hotelLng));
    }
    // New preference params — let plan page skip those questions
    if (groupType)        params.set('groupType',  groupType);
    if (pace)             params.set('pace',       pace);
    if (budget)           params.set('budget',     budget);
    if (interests.length) params.set('interests',  interests.join(','));

    const lang = readTripLanguagePref();
    if (lang === 'he' || lang === 'en') params.set('tripLang', lang);
    router.push(`/plan?${params.toString()}`);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(158,54,58,0.14) 0%, transparent 60%)',
      }}
    >
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(158,54,58,0.28) 0%, transparent 70%)' }} />
        <div className="absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full blur-[130px] opacity-18"
          style={{ background: 'radial-gradient(circle, rgba(15,40,98,0.50) 0%, transparent 70%)' }} />
      </div>

      {/* Content column */}
      <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-8 py-8 pb-36">

        {/* Top bar */}
        <div className="flex items-center justify-between mb-10">
          <BrandWordmark accent="#9e363a" className="text-sm" />
          <ProgressBar step={step} />
        </div>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Build your<br />
            <span style={{ color: '#9e363a' }}>perfect trip</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.38)' }}>
            Answer a few questions — we'll do the rest.
          </p>
        </div>

        {/* ── Section 1: Destination ─────────────────────────────────────── */}
        <motion.div variants={sectionReveal} initial="hidden" animate="visible" className="mb-4">
          <Suspense fallback={<Skeleton />}>
            <DestinationSection
              isCompleted={step >= 1}
              onComplete={onDestinationComplete}
              onEdit={() => goToStep(0)}
            />
          </Suspense>
        </motion.div>

        {/* ── Section 2: Dates ───────────────────────────────────────────── */}
        <AnimatePresence>
          {step >= 1 && (
            <motion.div ref={datesRef} key="dates-section"
              variants={sectionReveal} initial="hidden" animate="visible">
              <Connector from="rgba(158,54,58,0.30)" to="rgba(74,123,222,0.30)" />
              <Suspense fallback={<Skeleton />}>
                <DatesSection
                  isCompleted={step >= 2}
                  onComplete={onDatesComplete}
                  onEdit={() => goToStep(1)}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Section 3: Vibe ────────────────────────────────────────────── */}
        <AnimatePresence>
          {step >= 2 && (
            <motion.div ref={vibeRef} key="vibe-section"
              variants={sectionReveal} initial="hidden" animate="visible">
              <Connector from="rgba(74,123,222,0.30)" to="rgba(123,111,207,0.30)" />
              <Suspense fallback={<Skeleton />}>
                <VibeSection
                  isCompleted={step >= 3}
                  onComplete={onVibeComplete}
                  onEdit={() => goToStep(2)}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Section 4: Preferences ─────────────────────────────────────── */}
        <AnimatePresence>
          {step >= 3 && (
            <motion.div ref={prefsRef} key="prefs-section"
              variants={sectionReveal} initial="hidden" animate="visible">
              <Connector from="rgba(123,111,207,0.30)" to="rgba(197,145,42,0.30)" />
              <Suspense fallback={<Skeleton />}>
                <PreferencesSection
                  isCompleted={step >= 4}
                  onComplete={onPrefsComplete}
                  onEdit={() => goToStep(3)}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Section 5: Hotel ───────────────────────────────────────────── */}
        <AnimatePresence>
          {step >= 4 && (
            <motion.div ref={hotelRef} key="hotel-section"
              variants={sectionReveal} initial="hidden" animate="visible">
              <Connector from="rgba(197,145,42,0.30)" to="rgba(46,158,116,0.30)" />
              <Suspense fallback={<Skeleton />}>
                <HotelSection
                  isCompleted={false}
                  onComplete={handleGenerateTrip}
                  onSkip={handleGenerateTrip}
                  onEdit={() => {}}
                />
              </Suspense>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Floating CTA — appears once preferences are set ────────────────── */}
      <AnimatePresence>
        {step >= 4 && (
          <motion.div
            key="floating-cta"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-20 px-5 pb-6 pt-4"
            style={{
              background: 'linear-gradient(to top, rgba(9,31,54,0.97) 60%, transparent)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div className="max-w-xl mx-auto">
              <motion.button
                onClick={handleGenerateTrip}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="w-full py-4 rounded-full text-sm font-black text-white tracking-wide"
                style={{
                  background: 'linear-gradient(135deg, #9e363a, #b5404a)',
                  boxShadow: '0 0 48px rgba(158,54,58,0.50), 0 8px 24px -4px rgba(158,54,58,0.38)',
                }}
              >
                Generate My Itinerary ✨
              </motion.button>
              <p className="text-center text-xs mt-2.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {destination && startDate && endDate
                  ? `${destination} · ${new Date(startDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${new Date(endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : 'AI-powered · takes ~20 seconds'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center px-8"
        style={{ backgroundColor: '#091f36' }}>
        <div className="h-48 animate-pulse rounded-2xl w-full max-w-xl"
          style={{ background: 'rgba(15,40,98,0.18)' }} />
      </main>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
