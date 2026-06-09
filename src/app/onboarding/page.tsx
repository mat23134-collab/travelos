'use client';

/**
 * Onboarding — slide wizard (most important → simplest).
 *
 * Step 0 · Destination   — country → trip type → city/cities
 * Step 1 · Dates         — calendar range + optional travel times
 * Step 2 · Budget & vibe — daily spend + interests
 * Step 3 · Travel style  — who's coming + preferred pace
 * Step 4 · Accommodation — booked (search) or preferences (type + budget)
 * Step 5 · Dining       — dietary preferences (optional)
 * Step 6 · Our picks    — recommendation categories + must-haves (optional)
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
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';
import { COUNTRIES } from '@/lib/countries';

// ── Chunk-load resilience ────────────────────────────────────────────────────
// Mobile networks + post-deploy chunk-hash changes make a single dynamic import
// occasionally fail, leaving the step area blank until a manual refresh. We
// retry the import a few times with backoff before surfacing the error, which
// turns almost all transient failures into a brief skeleton instead of a dead
// screen. (A global ChunkLoadError auto-reload handler in the component covers
// the stale-deploy case where the file is simply gone.)
function retryImport<T>(factory: () => Promise<T>, retries = 4, delay = 350): Promise<T> {
  return factory().catch((err) => {
    if (retries <= 0) throw err;
    return new Promise<T>((resolve, reject) => {
      setTimeout(() => {
        retryImport(factory, retries - 1, Math.min(delay * 1.6, 2500)).then(resolve, reject);
      }, delay);
    });
  });
}

// ── Lazy-load heavy step components ──────────────────────────────────────────
// Every section ships with a visible loading skeleton so the step area is never
// blank while its chunk is in flight.
const DestinationSection = dynamic(
  () => retryImport(() => import('./sections/DestinationSection')).then((m) => ({ default: m.DestinationSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const DatesSection = dynamic(
  () => retryImport(() => import('./sections/DatesSection')).then((m) => ({ default: m.DatesSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const SmartHotelStep = dynamic(
  () => retryImport(() => import('./sections/SmartHotelStep')).then((m) => ({ default: m.SmartHotelStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const VibeSection = dynamic(
  () => retryImport(() => import('./sections/VibeSection')).then((m) => ({ default: m.VibeSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const PreferencesSection = dynamic(
  () => retryImport(() => import('./sections/PreferencesSection')).then((m) => ({ default: m.PreferencesSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const FinishingTouchesSection = dynamic(
  () => retryImport(() => import('./sections/FinishingTouchesSection')).then((m) => ({ default: m.FinishingTouchesSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const TopSightsSection = dynamic(
  () => retryImport(() => import('./sections/TopSightsSection')).then((m) => ({ default: m.TopSightsSection })),
  { ssr: false, loading: () => <StepSkeleton /> }
);

// ── Steps meta ────────────────────────────────────────────────────────────────
const STEPS = [
  { label: 'Destination', color: '#9e363a' },
  { label: 'Dates',       color: '#4a7bde' },
  { label: 'Interests',   color: '#2e9e74' },
  { label: 'Style',       color: '#7b6fcf' },
  { label: 'Stay',        color: '#c5912a' },
  { label: 'Dining',      color: '#9e363a' },
  { label: 'Our Picks',   color: '#9e363a' },
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
    accommodation, hotelNightlyBudget, hotelLocationPref, hotelAmenities,
    groupType, groupDynamics, pace, budget, interests,
    familyAdults, familyChildAges, groupSize,
    dietaryRestrictions, mustHaveItems, mustHaveOther,
    step: storeStep, goToStep, reset,
    setCountry, setTripType, setCities, setDestination,
  } = useOnboardingStore();

  // Wizard step (0-4) — separate from store.step so back/forward doesn't
  // clobber persisted completion state.
  const [wizardStep, setWizardStep] = useState(0);
  const [direction,  setDirection]  = useState(1); // 1=forward, -1=backward

  // ── Background image: match the chosen destination, fall back to rotating ──
  const bgUrl = useMemo(() => {
    if (cities.length) return resolveBackgroundImage(cities[0].name, wizardStep, country);
    return resolveBackgroundImage(destination, wizardStep, country);
  }, [cities, destination, country, wizardStep]);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) router.replace('/auth');
  }, [loading, user, router]);

  // ── ChunkLoadError safety net ───────────────────────────────────────────────
  // After a new deploy, an open client holds HTML that references old chunk
  // hashes which no longer exist on the server. Loading a lazy step then 404s
  // and the area stays blank. We catch that specific error once and hard-reload
  // to pull fresh HTML + chunk references. A sessionStorage guard prevents any
  // reload loop.
  useEffect(() => {
    const RELOAD_KEY = 'sarto_chunk_reloaded';
    function looksLikeChunkError(message: string): boolean {
      return /ChunkLoadError|Loading chunk [\d]+ failed|Loading CSS chunk|error loading dynamically imported module|importing a module script failed/i.test(message);
    }
    function handle(message: string) {
      if (!looksLikeChunkError(message)) return;
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return; // already retried once
        sessionStorage.setItem(RELOAD_KEY, '1');
      } catch { /* ignore */ }
      window.location.reload();
    }
    const onError = (e: ErrorEvent) => handle(e?.message ?? e?.error?.message ?? '');
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason;
      handle(typeof r === 'string' ? r : (r?.message ?? ''));
    };
    // Clear the guard once a load fully succeeds so a future real deploy can retry.
    const clearGuard = () => { try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* ignore */ } };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    const settle = setTimeout(clearGuard, 8000);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
      clearTimeout(settle);
    };
  }, []);

  // Seed destination / resume from query params
  useEffect(() => {
    if (!user) return;
    const resume   = searchParams.get('resume') === '1';
    const seedDest = searchParams.get('destination')?.trim() ?? '';
    const seedCity = searchParams.get('city')?.trim() || seedDest;
    const seedCountry = searchParams.get('country')?.trim() ?? '';

    if (resume) {
      // Re-enter at the appropriate step
      const resumeAt = Math.min(storeStep, STEPS.length - 1);
      setWizardStep(resumeAt);
      return;
    }
    if (seedDest) {
      reset();
      const matchedCountry = COUNTRIES.find((c) =>
        c.name.toLowerCase() === seedCountry.toLowerCase() ||
        c.cities.some((city) => city.name.toLowerCase() === seedCity.toLowerCase()),
      );
      const matchedCity = matchedCountry?.cities.find(
        (city) => city.name.toLowerCase() === seedCity.toLowerCase(),
      );

      if (matchedCountry && matchedCity) {
        setCountry(matchedCountry.name);
        setTripType('single');
        setCities([matchedCity]);
        goToStep(1);
        setWizardStep(1);
      } else {
        setDestination(seedDest);
      }
      return;
    }
    const hasProgress = destination.trim().length > 0 || storeStep > 0;
    if (!hasProgress) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (loading || !user) {
    return (
      <main className="min-h-screen flex items-center justify-center px-8">
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
        if (!budget) return { canContinue: false, label: 'Pick a budget level' };
        return { canContinue: true, label: 'Next: travel style →' };
      case 3: {
        if (!groupType) return { canContinue: false, label: "Who's coming?" };
        if (groupType === 'family') {
          if (!familyAdults || familyAdults < 1) return { canContinue: false, label: 'Add at least one adult' };
        }
        if (groupType === 'group' && (!groupSize || groupSize < 3)) {
          return { canContinue: false, label: 'Pick your group size' };
        }
        // Dynamics required for everyone except Family (whose composition acts as its dynamics).
        const needsDyn = groupType === 'solo' || groupType === 'couple' || groupType === 'group';
        if (needsDyn && !groupDynamics) return { canContinue: false, label: 'Pick your style of travel' };
        if (!pace) return { canContinue: false, label: 'Choose your pace' };
        return { canContinue: true, label: 'Continue' };
      }
      case 4:
        // Path A: hotel geocoded and confirmed
        if (hotelAddress) return { canContinue: true, label: 'Next: dining rules →' };
        // Path B: all three required blocks complete (amenities are optional)
        if (accommodation && hotelNightlyBudget && hotelLocationPref.length > 0)
          return { canContinue: true, label: 'Next: dining rules →' };
        // Path B partial — tell user exactly what's missing
        if (accommodation && hotelNightlyBudget)
          return { canContinue: false, label: 'Pick your location preference' };
        if (accommodation)
          return { canContinue: false, label: 'Pick nightly budget' };
        // Nothing selected — user must complete a path or tap Skip
        return { canContinue: false, label: 'Select an option or skip' };
      case 5:
        return { canContinue: true, label: 'Next: our recommendations →' };
      case 6: {
        const picks = mustHaveItems.length;
        const label = picks === 0
          ? 'Skip & generate'
          : picks === 1
            ? 'Generate with 1 pick'
            : `Generate with ${picks} picks`;
        return { canContinue: true, label };
      }
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
    if (accommodation)             params.set('accommodation',      accommodation);
    if (hotelNightlyBudget)        params.set('hotelNightlyBudget', hotelNightlyBudget);
    if (hotelLocationPref?.length) params.set('hotelLocationPref',  hotelLocationPref.join(','));
    if (hotelAmenities?.length)    params.set('hotelAmenities',     hotelAmenities.join(','));

    // Style + budget + interests
    if (groupType)           params.set('groupType',     groupType);
    if (groupDynamics)       params.set('groupDynamics', groupDynamics.subType);
    if (pace)                params.set('pace',          pace);
    if (budget)              params.set('budget',        budget);
    if (interests.length)    params.set('interests',     interests.join(','));

    // Composition — Family / Group specifics
    if (groupType === 'family') {
      params.set('familyAdults', String(familyAdults));
      if (familyChildAges.length) params.set('familyChildAges', familyChildAges.join(','));
    }
    if (groupType === 'group') {
      params.set('groupSize', String(groupSize));
    }

    // Finishing touches
    if (dietaryRestrictions.length) params.set('dietary', dietaryRestrictions.join(','));
    if (mustHaveItems.length)       params.set('mustHave', mustHaveItems.join(','));
    if (mustHaveOther.trim())       params.set('mustHaveOther', mustHaveOther.trim());

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
        backgroundImage: `linear-gradient(rgba(180,228,222,0.82), rgba(180,228,222,0.82)), url("${bgUrl}")`,
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
                  style={{ color: '#3a6460', border: '1px solid rgba(90,173,165,0.35)' }}
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

              {/* Step 2: Budget & interests */}
              {wizardStep === 2 && (
                <PreferencesSection
                  isCompleted={false}
                  onComplete={goNext}
                  onEdit={() => {}}
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

              {/* Step 4: Accommodation */}
              {wizardStep === 4 && (
                <SmartHotelStep
                  onComplete={goNext}
                  onSkip={goNext}
                />
              )}

              {/* Step 5: Dietary preferences */}
              {wizardStep === 5 && (
                <FinishingTouchesSection mode="dietary" stepBadge={6} />
              )}

              {/* Step 6: City-specific Top Sights → generate */}
              {wizardStep === 6 && (
                <TopSightsSection />
              )}

            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Sticky footer navigation ──────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-20"
        style={{
          background: 'linear-gradient(to top, rgba(180,228,222,0.97) 60%, transparent 100%)',
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
                  background: 'rgba(255,255,255,0.45)',
                  border: '1px solid rgba(90,173,165,0.35)',
                  color: '#3a6460',
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
      <main className="min-h-screen flex items-center justify-center px-8">
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
