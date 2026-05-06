'use client';

/**
 * Onboarding page — 4-step pre-flight flow.
 *
 * Step 0 — DestinationStep : Where are you going?
 * Step 1 — DatesStep       : When are you traveling?
 * Step 2 — LogisticsStep   : Arrival + departure times (skipDay1 logic lives here)
 * Step 3 — HotelStep       : The Anchor — hotel center of gravity
 *
 * On completion, pushes to /plan with all collected data as query params
 * so the plan page can pre-fill and skip re-asking the same questions.
 *
 * Transitions: Y-axis "cube flip" via Framer Motion.
 * Palette: Purple Shadow (#091f36) + per-step accents.
 */

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useOnboardingStore } from '@/state/onboardingStore';

// All step components use R3F (useFrame) + tunnel-rat → must be ssr:false
function StepSkeleton() {
  return (
    <div
      className="h-64 animate-pulse rounded-2xl"
      style={{ background: 'rgba(15,40,98,0.18)' }}
    />
  );
}

const DestinationStep = dynamic(
  () => import('./steps/DestinationStep').then((m) => ({ default: m.DestinationStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const DatesStep = dynamic(
  () => import('./steps/DatesStep').then((m) => ({ default: m.DatesStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const LogisticsStep = dynamic(
  () => import('./steps/LogisticsStep').then((m) => ({ default: m.LogisticsStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const HotelStep = dynamic(
  () => import('./steps/HotelStep').then((m) => ({ default: m.HotelStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);

// ── Cube-flip transition ──────────────────────────────────────────────────────

const FLIP_VARIANTS = {
  enter: (dir: number) => ({
    rotateY: dir > 0 ? -90 : 90,
    opacity: 0,
    scale: 0.94,
  }),
  center: {
    rotateY: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
  exit: (dir: number) => ({
    rotateY: dir > 0 ? 90 : -90,
    opacity: 0,
    scale: 0.94,
    transition: { duration: 0.35, ease: [0.55, 0, 0.78, 0] },
  }),
};

// ── Step dot accent colors ────────────────────────────────────────────────────
// 0=Redline  1=Steel-blue  2=Redline  3=Gold
const STEP_COLORS = ['#9e363a', '#4a7bde', '#9e363a', '#c5912a'];

const TOTAL_STEPS = 4;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const {
    step,
    destination,
    startDate,
    endDate,
    arrivalTime,
    departureTime,
    dailyStartTime,
    skipDay1,
    hotelAddress,
    hotelLat,
    hotelLng,
    nextStep,
    prevStep,
    reset,
  } = useOnboardingStore();

  const dir = 1; // always forward

  useEffect(() => {
    // Always start onboarding from a clean slate on every entry.
    reset();
  }, [reset]);

  const handleComplete = () => {
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
    router.push(`/plan?${params.toString()}`);
  };

  // Gold flare on hotel step
  const isHotelStep = step === 3;

  return (
    <main
      className="min-h-screen flex flex-col md:flex-row relative overflow-hidden"
      style={{ backgroundColor: '#091f36' }}
    >
      {/* ── Ambient blobs ──────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div
          className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(158,54,58,0.30) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[130px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(15,40,98,0.55) 0%, transparent 70%)' }}
        />
        {isHotelStep && (
          <div
            className="absolute top-1/3 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(197,145,42,0.40) 0%, transparent 70%)' }}
          />
        )}
      </div>

      {/* ── Left panel — step form ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col justify-center w-full md:w-[440px] lg:w-[480px] min-h-screen px-8 sm:px-12 py-16 shrink-0">

        {/* Logo */}
        <div className="absolute top-8 left-8">
          <span className="text-sm font-black text-white tracking-tight">
            Travel<span style={{ color: '#9e363a' }}>OS</span>
          </span>
        </div>

        {/* Progress dots */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const color = STEP_COLORS[i];
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === step ? 20 : 6,
                  height: 6,
                  background: i === step
                    ? color
                    : i < step
                      ? `${color}66`
                      : 'rgba(255,255,255,0.12)',
                }}
              />
            );
          })}
        </div>

        {/* Animated step content */}
        <div style={{ perspective: '1200px' }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={FLIP_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ transformStyle: 'preserve-3d' }}
            >
              {step === 0 && <DestinationStep onNext={nextStep} />}
              {step === 1 && <DatesStep       onNext={nextStep}       onBack={prevStep} />}
              {step === 2 && <LogisticsStep   onNext={nextStep}       onBack={prevStep} />}
              {step === 3 && <HotelStep       onNext={handleComplete} onBack={prevStep} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip link */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <button
            onClick={handleComplete}
            className="text-xs transition-colors"
            style={{ color: 'rgba(79,95,118,0.7)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(79,95,118,0.7)')}
          >
            Skip setup — go straight to planning
          </button>
        </div>
      </div>

      {/* ── Right panel — 3D canvas (CanvasShell renders here at z-index:-1) ── */}
      <div
        className="hidden md:flex flex-1 relative items-center justify-center"
        aria-hidden="true"
      >
        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.032]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <p
          className="text-[10px] tracking-widest uppercase font-semibold select-none"
          style={{ color: 'rgba(79,95,118,0.45)' }}
        >
          Live 3D preview
        </p>
      </div>
    </main>
  );
}
