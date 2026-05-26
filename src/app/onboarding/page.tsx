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
import { Suspense, useEffect, useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';
import { STEP_BACKGROUNDS, getStepBackground } from '@/lib/stepBackgrounds';

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
    country, tripType, cities,
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

  // ── Background image: match the chosen destination, fall back to rotating ──
  const bgUrl = useMemo(() => {
    for (const city of cities) {
      const found = STEP_BACKGROUNDS.find(
        (b) => b.city.toLowerCase() === city.name.toLowerCase()
      );
      if (found) return found.imageUrl;
    }
    if (country) {
      const found = STEP_BACKGROUNDS.find(
        (b) => b.country.toLowerCase() === country.toLowerCase()
      );
      if (found) return found.imageUrl;
    }
    return getStepBackground(wizardStep, 3).imageUrl;
  }, [cities, country, wizardStep]);

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

  // ── Per-step validation (drives the sticky footer CTA) ─────────────────────
  const nightCount = (startDate && endDate)
    ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    : null;

  const stepState: { canContinue: boolean; label: string } = (() => {
    switch (wizardStep) {
      case 0:
        if (!country)        return { canContinue: false, label: 'Pick a country' };
        if (!tripType)       return { canContinue: false, label: 'Single or multi-city?' };
        if (!cities.length)  return { canContinue: false, label: 'Select at least one city' };
        return {
          canContinue: true,
          label: cities.length > 1
            ? `Plan ${cities.length}-city tour →`
            : `Plan ${cities[0]?.name ?? country} →`,
        };
      case 1:
        if (!startDate || !endDate) return { canContinue: false, label: 'Pick your travel dates' };
        return { canContinue: true, label: nightCount ? `${nightCount} nights · Continue →` : 'Continue →' };
      case 2:
        if (hotelAddress)  return { canContinue: true, label: 'Stay confirmed · Continue →' };
        if (accommodation) return { canContinue: true, label: 'Preferences set · Continue →' };
        return { canContinue: true, label: 'Skip hotel for now →' };
      case 3:
        if (!groupType) return { canContinue: false, label: "Who's coming?" };
        if (!pace)      return { canContinue: false, label: 'Choose your pace' };
        return { canContinue: true, label: 'Continue →' };
      case 4:
        if (!budget) return { canContinue: false, label: 'Pick a budget level' };
        return { canContinue: true, label: 'Generate My Itinerary ✨' };
      default:
        return { canContinue: false, label: 'Continue' };
    }
  })();

  function handleContinue() {
    if (!stepState.canContinue) return;
    if (wizardStep === STEPS.length - 1) handleGenerateTrip();
    else goNext();
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
        backgroundImage: `linear-gradient(rgba(9,31,54,0.76), rgba(9,31,54,0.91)), url("${bgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Step-colour accent glow on top of photo */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute top-0 left-0 right-0 h-64 transition-all duration-700"
          style={{
            background: `radial-gradient(ellipse 80% 100% at 50% -10%, ${stepColor}30 0%, transparent 70%)`,
          }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-48 transition-all duration-700"
          style={{
            background: `linear-gradient(to top, ${stepColor}15 0%, transparent 100%)`,
          }}
        />
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
            className="max-w-xl mx-auto px-5 sm:px-8 pb-40"
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

      {/* ── Sticky footer navigation ──────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          background: 'linear-gradient(to top, rgba(9,31,54,0.98) 60%, transparent 100%)',
          paddingTop: 36,
        }}
      >
        <div className="max-w-xl mx-auto px-5 sm:px-8 pb-8 flex items-center gap-3">

          {/* Back */}
          <AnimatePresence>
            {wizardStep > 0 && (
              <motion.button
                key="footer-back"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                onClick={goBack}
                className="flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-bold shrink-0 transition-colors"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                ‹ Back
              </motion.button>
            )}
          </AnimatePresence>

          {/* Continue / Generate */}
          <AnimatePresence mode="wait">
            <motion.button
              key={`footer-cta-${wizardStep}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              onClick={handleContinue}
              whileHover={stepState.canContinue ? { scale: 1.02, y: -1 } : {}}
              whileTap={stepState.canContinue ? { scale: 0.97 } : {}}
              className="flex-1 py-3.5 rounded-full text-sm font-black tracking-wide transition-all"
              style={{
                background: stepState.canContinue
                  ? wizardStep === STEPS.length - 1
                    ? 'linear-gradient(135deg, #9e363a, #b5404a)'
                    : stepColor
                  : 'rgba(255,255,255,0.07)',
                color: stepState.canContinue ? '#fff' : 'rgba(255,255,255,0.35)',
                boxShadow: stepState.canContinue
                  ? wizardStep === STEPS.length - 1
                    ? '0 0 40px rgba(158,54,58,0.42), 0 8px 24px -4px rgba(158,54,58,0.28)'
                    : `0 0 28px ${stepColor}60, 0 6px 18px -4px ${stepColor}50`
                  : 'none',
                opacity: stepState.canContinue ? 1 : 0.55,
                cursor: stepState.canContinue ? 'pointer' : 'default',
              }}
            >
              {stepState.label}
            </motion.button>
          </AnimatePresence>

        </div>
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
