'use client';

/**
 * Onboarding page — logistics-first flow.
 *
 * Renders a full-screen dark shell with a left panel (2D form steps) and a
 * right panel (3D canvas, rendered by CanvasShell in layout).
 *
 * Step transitions use a Framer Motion Y-axis "cube flip" — the outgoing
 * step rotates away on the Y axis while the incoming step rotates in from
 * the opposite side, giving the illusion of turning a card/face.
 *
 * After both logistics steps are complete, the user is forwarded to /plan
 * with the collected times pre-populated via query params that plan/page.tsx
 * reads on mount.
 */

import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useOnboardingStore } from '@/state/onboardingStore';

// Step components use @react-three/fiber (useFrame) and tunnel-rat — both
// require the browser. Dynamic import with ssr: false prevents the crash
// that happens when Next.js tries to prerender this client page.
const ArrivalTimeStep = dynamic(
  () => import('./steps/ArrivalTimeStep').then((m) => ({ default: m.ArrivalTimeStep })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} /> }
);
const DepartureTimeStep = dynamic(
  () => import('./steps/DepartureTimeStep').then((m) => ({ default: m.DepartureTimeStep })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)' }} /> }
);

// ── Cube-flip page transition variants ───────────────────────────────────────
// The "cube" effect: outgoing panel rotates away (rotateY: 90deg) while
// incoming panel rotates in from -90deg. Perspective is set on the container.

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

const TOTAL_STEPS = 2;

export default function OnboardingPage() {
  const router = useRouter();
  const { step, arrivalTime, departureTime, dailyStartTime, skipDay1, nextStep, prevStep } =
    useOnboardingStore();

  const dir = 1; // always forward for now (back button triggers prevStep)

  const handleComplete = () => {
    // Build query string so /plan pre-populates the time fields
    const params = new URLSearchParams();
    if (arrivalTime)    params.set('arrivalTime',    arrivalTime);
    if (departureTime)  params.set('departureTime',  departureTime);
    if (dailyStartTime) params.set('dailyStartTime', dailyStartTime);
    if (skipDay1)       params.set('skipDay1',       '1');
    router.push(`/plan?${params.toString()}`);
  };

  return (
    <main
      className="min-h-screen flex flex-col md:flex-row relative overflow-hidden"
      style={{ backgroundColor: '#080b12' }}
    >
      {/* ── Ambient blobs ──────────────────────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        aria-hidden="true"
      >
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full blur-[140px] opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(255,90,95,0.18) 0%, transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full blur-[130px] opacity-25"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.18) 0%, transparent 70%)' }}
        />
      </div>

      {/* ── Left panel — form steps ────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col justify-center w-full md:w-[440px] lg:w-[480px] min-h-screen px-8 sm:px-12 py-16 shrink-0">
        {/* Logo */}
        <div className="absolute top-8 left-8">
          <span className="text-sm font-black text-white tracking-tight">
            Travel<span style={{ color: '#ff5a5f' }}>OS</span>
          </span>
        </div>

        {/* Step dots */}
        <div className="absolute top-8 right-8 flex items-center gap-2">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width:  i === step ? 20 : 6,
                height: 6,
                background: i === step
                  ? '#ff5a5f'
                  : i < step
                    ? 'rgba(255,90,95,0.4)'
                    : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
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
                <DepartureTimeStep onNext={handleComplete} onBack={prevStep} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip link */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center">
          <button
            onClick={handleComplete}
            className="text-xs text-white/25 hover:text-white/50 transition-colors"
          >
            Skip logistics — I&apos;ll fill in times later
          </button>
        </div>
      </div>

      {/* ── Right panel — 3D canvas placeholder (real canvas is fixed overlay) ── */}
      {/* The CanvasShell in layout.tsx renders the actual Three.js scene here.
          This panel just provides the visual background for the 3D side. */}
      <div
        className="hidden md:flex flex-1 relative items-center justify-center"
        aria-hidden="true"
      >
        {/* Subtle grid lines */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Center label */}
        <div className="text-center select-none">
          <p className="text-[11px] text-white/15 tracking-widest uppercase font-semibold">
            Live 3D preview
          </p>
        </div>
      </div>
    </main>
  );
}
