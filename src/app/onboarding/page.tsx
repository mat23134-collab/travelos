'use client';

/**
 * Onboarding — slide wizard (most important → simplest).
 *
 * Step 0 · Destination   — country → trip type → city/cities
 * Step 1 · Dates         — calendar range + optional travel times
 * Step 2 · Accommodation — booked (search) or preferences (type + budget)
 * Step 3 · Travel style  — who's coming + preferred pace
 * Step 4 · Budget & vibe — daily spend + interests
 *                          → "Generate My Itinerary" (only CTA)
 *
 * One section fills the viewport at a time; steps slide in from the right
 * and exit to the left (reverse on back). A single progress bar sits at the
 * top. Back arrow in the header. No duplicate action buttons anywhere.
 */

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';

// ── Lazy-load heavy step components ──────────────────────────────────────────
const DestinationSection = dynamic(
  () => import('./sections/DestinationSection').then((m) => ({ default: m.DestinationSection })),
  { ssr: false }
);
const DatesSection = dynamic(
  () => import('./sections/DatesSection').then((m) => ({ default: m.DatesSection })),
  { ssr: false }
);
const SmartHotelStep = dynamic(
  () => import('./sections/SmartHotelStep').then((m) => ({ default: m.SmartHotelStep })),
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

// ── Steps meta ────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Destination', color: '#9e363a' },
  { label: 'Dates',       color: '#4a7bde' },
  { label: 'Stay',        color: '#c5912a' },
  { label: 'Style',       color: '#7b6fcf' },
  { label: 'Interests',   color: '#2e9e74' },
] as const;

// ── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => {
        const done   = i < step;
        const active = i === step;
        return (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              height: 5,
              width:  active ? 24 : done ? 8 : 6,
              background: active
                ? STEPS[i]?.color ?? '#fff'
                : done
                  ? (STEPS[i]?.color ?? '#fff') + '70'
                  : 'rgba(255,255,255,0.10)',
            }}
          />
        );
      })}
    </div>
  );
}

// ── Slide animation ───────────────────────────────────────────────────────────
const slide = {
  enter:  (dir: number) => ({ x: dir > 0 ? '100%' : '-60%', opacity: 0 }),
  center: {
    x: 0, opacity: 1,
    transition: { type: 'spring' as const, stiffness: 300, damping: 32, mass: 0.9 },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? '-40%' : '100%', opacity: 0,
    transition: { duration: 0.22, ease: 'easeIn' as const },
  }),
};

// ── Skeleton ──────────────────────────────────────────────────────────────────
function StepSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-8 w-48 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }} />
      <div className="h-4 w-64 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }} />
      <div className="h-40 rounded-2xl mt-2" style={{ background: 'rgba(255,255,255,0.04)' }} />
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
function OnboardingPageContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

  const {
    destination, startDate, endDate,
    arrivalTime, departureTime, dailyStartTime, skipDay1,
    hotelAddress, hotelLat, hotelLng,
    accommodation, hotelNightlyBudget,
    groupType, pace, budget, interests,
    step: storeStep, goToStep, reset, setDestination,
  } = useOnboardingStore();

  // Wizard step (0-4) — separate from store.step so back/forward doesn't
  // clobber persisted completion state.
  const [wizardStep, setWizardStep] = useState(0);
  const [direction,  setDirection]  = useState(1); // 1=forward, -1=backward

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  // Seed destination / resume from query params
  useEffect(() => {
    if (!user) return;
    const resume   = searchParams.get('resume') === '1';
    const seedDest = searchParams.get('destination')?.trim() ?? '';

    if (resume) {
      // Re-enter at the appropriate step
      const resumeAt = Math.min(storeStep, STEPS.length - 1);
      setWizardStep(resumeAt);
      return;
    }
    if (seedDest) {
      reset();
      setDestination(seedDest);
      return;
    }
    const hasProgress = destination.trim().length > 0 || storeStep > 0;
    if (!hasProgress) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-8"
        style={{ backgroundColor: '#091f36' }}>
        <StepSkeleton />
      </main>
    );
  }

  // ── Navigation helpers ──────────────────────────────────────────────────────
  function goNext() {
    setDirection(1);
    setWizardStep((s) => Math.min(s + 1, STEPS.length - 1));
    // Keep store.step in sync (for resume)
    goToStep(Math.min(wizardStep + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function goBack() {
    setDirection(-1);
    setWizardStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ── Final action: generate trip ─────────────────────────────────────────────
  function handleGenerateTrip() {
    const params = new URLSearchParams();

    // Core
    if (destination)    params.set('destination',    destination);
    if (startDate)      params.set('startDate',      startDate);
    if (endDate)        params.set('endDate',        endDate);
    if (arrivalTime)    params.set('arrivalTime',    arrivalTime);
    if (departureTime)  params.set('departureTime',  departureTime);
    if (dailyStartTime) params.set('dailyStartTime', dailyStartTime);
    if (skipDay1)       params.set('skipDay1',       '1');

    // Hotel
    if (hotelAddress) params.set('hotelAddress', hotelAddress);
    if (hotelLat != null && hotelLng != null) {
      params.set('hotelLat', String(hotelLat));
      params.set('hotelLng', String(hotelLng));
    }

    // Accommodation preferences (if no hotel booked)
    if (accommodation)      params.set('accommodation',      accommodation);
    if (hotelNightlyBudget) params.set('hotelNightlyBudget', hotelNightlyBudget);

    // Style + budget + interests
    if (groupType)        params.set('groupType',  groupType);
    if (pace)             params.set('pace',       pace);
    if (budget)           params.set('budget',     budget);
    if (interests.length) params.set('interests',  interests.join(','));

    // Ask plan page to auto-generate (skip its own wizard)
    params.set('autoGenerate', '1');

    const lang = readTripLanguagePref();
    if (lang === 'he' || lang === 'en') params.set('tripLang', lang);

    router.push(`/plan?${params.toString()}`);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const stepColor = STEPS[wizardStep]?.color ?? '#9e363a';

  return (
    <main
      className="min-h-screen relative"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `radial-gradient(ellipse 80% 60% at 50% -10%, ${stepColor}22 0%, transparent 60%)`,
        transition: 'background-image 0.6s ease',
      }}
    >
      {/* Ambient blob */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute -top-32 -left-32 w-[460px] h-[460px] rounded-full blur-[140px] opacity-18"
          style={{ background: `radial-gradient(circle, ${stepColor}44 0%, transparent 70%)`, transition: 'background 0.6s ease' }} />
      </div>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-8 pt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            {/* Back arrow */}
            <AnimatePresence>
              {wizardStep > 0 && (
                <motion.button
                  key="back"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  onClick={goBack}
                  aria-label="Go back"
                  className="w-8 h-8 rounded-full flex items-center justify-center hover-bg-subtle transition-colors"
                  style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.10)' }}
                >
                  ‹
                </motion.button>
              )}
            </AnimatePresence>
            <BrandWordmark accent={stepColor} className="text-sm" />
          </div>
          <ProgressBar step={wizardStep} total={STEPS.length} />
        </div>

        {/* Step label */}
        <AnimatePresence mode="wait">
          <motion.p
            key={wizardStep}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[11px] font-bold uppercase tracking-widest mt-3 mb-8"
            style={{ color: stepColor }}
          >
            Step {wizardStep + 1} of {STEPS.length} · {STEPS[wizardStep]?.label}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* ── Step content (slides) ────────────────────────────────────────────── */}
      <div className="relative z-10 overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={wizardStep}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            className="max-w-xl mx-auto px-5 sm:px-8 pb-20"
          >
            <Suspense fallback={<StepSkeleton />}>

              {/* Step 0: Destination */}
              {wizardStep === 0 && (
                <DestinationSection
                  isCompleted={false}
                  onComplete={goNext}
                  onEdit={() => {}}
                />
              )}

              {/* Step 1: Dates */}
              {wizardStep === 1 && (
                <DatesSection
                  isCompleted={false}
                  onComplete={goNext}
                  onEdit={() => {}}
                />
              )}

              {/* Step 2: Accommodation */}
              {wizardStep === 2 && (
                <SmartHotelStep
                  onComplete={goNext}
                  onSkip={goNext}
                />
              )}

              {/* Step 3: Travel style */}
              {wizardStep === 3 && (
                <VibeSection
                  isCompleted={false}
                  onComplete={goNext}
                  onEdit={() => {}}
                />
              )}

              {/* Step 4: Budget & interests → final generate */}
              {wizardStep === 4 && (
                <PreferencesSection
                  isCompleted={false}
                  onComplete={handleGenerateTrip}
                  onEdit={() => {}}
                />
              )}

            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen flex items-center justify-center px-8"
        style={{ backgroundColor: '#091f36' }}>
        <div className="flex flex-col gap-4 w-full max-w-xl animate-pulse">
          <div className="h-8 w-48 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }} />
          <div className="h-40 rounded-2xl mt-2" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      </main>
    }>
      <OnboardingPageContent />
    </Suspense>
  );
}
