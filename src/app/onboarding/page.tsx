'use client';

/**
 * Onboarding page — logistics-first flow.
 *
 * Three steps:
 *  0 — ArrivalTimeStep   (when do you land?)
 *  1 — DepartureTimeStep (when do you fly home?)
 *  2 — HotelStep         (The Anchor — your hotel center of gravity)
 *
 * Step transitions use a Framer Motion Y-axis "cube flip".
 * After all 3 steps the user is pushed to /plan with params.
 *
 * Palette: Purple Shadow (#091f36) bg + Redline (#9e363a) accents.
 */

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useOnboardingStore } from '@/state/onboardingStore';

// All step components use R3F (useFrame) + tunnel-rat — must be ssr:false
const ArrivalTimeStep = dynamic(
  () => import('./steps/ArrivalTimeStep').then((m) => ({ default: m.ArrivalTimeStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const DepartureTimeStep = dynamic(
  () => import('./steps/DepartureTimeStep').then((m) => ({ default: m.DepartureTimeStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);
const HotelStep = dynamic(
  () => import('./steps/HotelStep').then((m) => ({ default: m.HotelStep })),
  { ssr: false, loading: () => <StepSkeleton /> }
);

function StepSkeleton() {
  return (
    <div
      className="h-64 animate-pulse rounded-2xl"
      style={{ background: 'rgba(15,40,98,0.18)' }}
    />
  );
}

// ── Cube-flip transition variants ─────────────────────────────────────────────

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

// ── Step dot colors per step ──────────────────────────────────────────────────
// step 0: Redline  |  step 1: Blue-steel  |  step 2: Gold
const STEP_ACTIVE_COLORS = ['#9e363a', '#4a7bde', '#c5912a'];

const TOTAL_STEPS = 3;

export default function OnboardingPage() {
  const router = useRouter();
  const {
    step,
    arrivalTime,
    departureTime,
    dailyStartTime,
    skipDay1,
    hotelLat,
    hotelLng,
    nextStep,
    prevStep,
  } = useOnboardingStore();

  const dir = 1; // always forward

  const handleComplete = () => {
    const params = new URLSearchParams();
    if (arrivalTime)    params.set('arrivalTime',    arrivalTime);
    if (departureTime)  params.set('departureTime',  departureTime);
    if (dailyStartTime) params.set('dailyStartTime', dailyStartTime);
    if (skipDay1)       params.set('skipDay1',       '1');
    if (hotelLat != null && hotelLng != null) {
      params.set('hotelLat', String(hotelLat));
      params.set('hotelLng', String(hotelLng));
    }
    router.push(`/plan?${params.toString()}`);
  };

  return (
    <main
      className="min-h-screen flex flex-col md:flex-row relative overflow-hidden"
      style={{ backgroundColor: '#091f36' }}
    >
      {/* ── Ambient blobs ──────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        {/* Redline top-left */}
        <div
          className="absolute -top-32 -left-32 w-[550px] h-[550px] rounded-full blur-[140px] opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(158,54,58,0.30) 0%, transparent 70%)' }}
        />
        {/* Blue Popsicle bottom-right */}
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[130px] opacity-22"
          style={{ background: 'radial-gradient(circle, rgba(15,40,98,0.55) 0%, transparent 70%)' }}
        />
        {/* Gold flare — visible during hotel step */}
        {step === 2 && (
          <div
            className="absolute top-1/2 right-0 w-[400px] h-[400px] rounded-full blur-[120px] opacity-12"
            style={{ background: 'radial-gradient(circle, rgba(197,145,42,0.40) 0%, transparent 70%)' }}
          />
        )}
      </div>

      {/* ── Left panel — form steps ────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col justify-center w-full md:w-[440px] lg:w-[480px] min-h-screen px-8 sm:px-12 py-16 shrink-0">

        {/* Logo */}
        <div className="absolute top-8 left-8">
          <span className="text-sm font-black text-white tracking-tight">
            Travel<span style={{ color: '#9e363a' }}>OS</span>
          </span>
        </div>

        {/* Step progress dots */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
            const activeColor = STEP_ACTIVE_COLORS[i];
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width:  i === step ? 20 : 6,
                  height: 6,
                  background: i === step
                    ? activeColor
                    : i < step
                      ? `${activeColor}55`
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
              {step === 0 && (
                <ArrivalTimeStep onNext={nextStep} />
              )}
              {step === 1 && (
                <DepartureTimeStep onNext={nextStep} onBack={prevStep} />
              )}
              {step === 2 && (
                <HotelStep onNext={handleComplete} onBack={prevStep} />
              )}
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
            Skip logistics — I&apos;ll fill in details later
          </button>
        </div>
      </div>

      {/* ── Right panel — 3D canvas shines through here ────────────────────── */}
      <div
        className="hidden md:flex flex-1 relative items-center justify-center"
        aria-hidden="true"
      >
        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.032]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />

        {/* Step label hint */}
        <div className="text-center select-none">
          <p
            className="text-[10px] tracking-widest uppercase font-semibold"
            style={{ color: 'rgba(79,95,118,0.5)' }}
          >
            Live 3D preview
          </p>
        </div>
      </div>
    </main>
  );
}
