'use client';

/**
 * DatesStep — Step 2 of 4 in the onboarding flow.
 *
 * Collects the trip start and end dates. Auto-calculates duration.
 * Injects a twin-orbit 3D scene: two glowing spheres orbiting each
 * other represent "departure day" and "return day".
 *
 * Palette: Blue-steel (#4a7bde) accent on Purple Shadow bg.
 */

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT   = '#4a7bde';
const ACCENT_H = '#5a8bee';
const GOLD     = '#c5912a';

// ── 3D Twin-Orbit Scene ───────────────────────────────────────────────────────

function OrbitScene({ hasRange }: { hasRange: boolean }) {
  const orbitRef  = useRef<THREE.Group>(null);
  const sphere1Ref = useRef<THREE.Mesh>(null);
  const sphere2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (orbitRef.current) {
      orbitRef.current.rotation.z = t * 0.35;
      orbitRef.current.rotation.x = 0.3 + Math.sin(t * 0.4) * 0.08;
    }

    if (sphere1Ref.current) {
      (sphere1Ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.8 + Math.sin(t * 1.6) * 0.3;
    }
    if (sphere2Ref.current) {
      (sphere2Ref.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        hasRange ? 0.8 + Math.sin(t * 1.6 + Math.PI) * 0.3 : 0.2;
    }
  });

  return (
    <group position={[2.0, 0, 0]}>
      <ambientLight intensity={0.15} />
      <pointLight position={[3, 4, 4]}  intensity={1.2} color="#b8d0f0" />
      <pointLight position={[0, 0, 3]}  intensity={1.8} color={ACCENT} distance={12} decay={2} />
      {hasRange && (
        <pointLight position={[0, 0, 3]} intensity={1.0} color={GOLD} distance={10} decay={2} />
      )}

      {/* Central axis */}
      <mesh>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshStandardMaterial color="#1e3a6e" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Ring track */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.9, 0.008, 8, 64]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.18} />
      </mesh>

      {/* Orbiting spheres */}
      <group ref={orbitRef}>
        {/* Departure — always blue */}
        <mesh ref={sphere1Ref} position={[0.9, 0, 0]}>
          <sphereGeometry args={[0.18, 20, 20]} />
          <meshStandardMaterial
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={0.8}
            metalness={0.55}
            roughness={0.18}
          />
        </mesh>
        {/* Return — gold when range is set */}
        <mesh ref={sphere2Ref} position={[-0.9, 0, 0]}>
          <sphereGeometry args={[0.16, 20, 20]} />
          <meshStandardMaterial
            color={hasRange ? GOLD : '#1e3a6e'}
            emissive={hasRange ? GOLD : '#1e3a6e'}
            emissiveIntensity={hasRange ? 0.8 : 0.2}
            metalness={0.55}
            roughness={0.18}
          />
        </mesh>
      </group>

      {/* Outer atmosphere */}
      <mesh>
        <sphereGeometry args={[1.4, 10, 8]} />
        <meshBasicMaterial color={ACCENT} transparent opacity={0.012} />
      </mesh>
    </group>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tripDuration(start: string, end: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const days = Math.round(ms / 86400000);
  return days > 0 ? days : null;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

const PRESETS = [
  { label: '3 days',  days: 3 },
  { label: '5 days',  days: 5 },
  { label: '7 days',  days: 7 },
  { label: '10 days', days: 10 },
  { label: '2 weeks', days: 14 },
];

export function DatesStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { destination, startDate, endDate, setDateRange } = useOnboardingStore();
  const duration = tripDuration(startDate, endDate);
  const hasRange = duration !== null;

  const applyPreset = (days: number) => {
    const start = startDate || todayString();
    const end = new Date(new Date(start).getTime() + days * 86400000)
      .toISOString()
      .slice(0, 10);
    setDateRange(start, end);
  };

  const canContinue = hasRange;

  return (
    <>
      <sceneContent.In>
        <OrbitScene hasRange={hasRange} />
      </sceneContent.In>

      <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex flex-col gap-6"
      >
        {/* Step badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: `rgba(74,123,222,0.15)`,
              color: ACCENT,
              border: `1px solid rgba(74,123,222,0.30)`,
            }}
          >
            Step 2 of 4
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            When are you<br />
            <span style={{ color: ACCENT }}>
              {destination ? `in ${destination}?` : 'traveling?'}
            </span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            Exact dates help us nail seasonal tips, crowd levels, and pricing.
          </p>
        </div>

        {/* Date inputs */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: '#4f5f76' }}>
              Departure date
            </label>
            <input
              type="date"
              value={startDate}
              min={todayString()}
              onChange={(e) => setDateRange(e.target.value, endDate)}
              className="w-full px-4 py-3.5 rounded-2xl text-white text-base font-medium outline-none transition-all"
              style={{
                background: `rgba(15,40,98,0.30)`,
                border: `1.5px solid ${startDate ? `rgba(74,123,222,0.50)` : `rgba(255,255,255,0.10)`}`,
                colorScheme: 'dark',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: '#4f5f76' }}>
              Return date
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || todayString()}
              onChange={(e) => setDateRange(startDate, e.target.value)}
              className="w-full px-4 py-3.5 rounded-2xl text-white text-base font-medium outline-none transition-all"
              style={{
                background: `rgba(15,40,98,0.30)`,
                border: `1.5px solid ${endDate ? `rgba(197,145,42,0.50)` : `rgba(255,255,255,0.10)`}`,
                colorScheme: 'dark',
              }}
            />
          </div>
        </div>

        {/* Duration display */}
        {hasRange && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-2"
          >
            <span className="text-2xl font-black" style={{ color: ACCENT }}>{duration}</span>
            <span className="text-sm ml-1.5" style={{ color: '#4f5f76' }}>
              {duration === 1 ? 'day' : 'days'} · perfect for a deep dive
            </span>
          </motion.div>
        )}

        {/* Quick duration chips */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: '#4f5f76' }}>
            Quick fill
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(({ label, days }) => {
              const active = duration === days;
              return (
                <button
                  key={label}
                  onClick={() => applyPreset(days)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
                  style={{
                    background: active ? `rgba(74,123,222,0.22)` : `rgba(15,40,98,0.20)`,
                    border: active ? `1.5px solid rgba(74,123,222,0.55)` : `1.5px solid rgba(255,255,255,0.07)`,
                    color: active ? ACCENT : '#4f5f76',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl text-sm font-bold transition-all"
            style={{ color: '#4f5f76', border: `1.5px solid rgba(255,255,255,0.07)`, background: 'transparent' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4f5f76')}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!canContinue}
            className="flex-[2] py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: canContinue
                ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_H})`
                : `rgba(255,255,255,0.06)`,
              boxShadow: canContinue ? `0 8px 32px -4px rgba(74,123,222,0.50)` : 'none',
            }}
          >
            {canContinue ? `${duration} days → Let's time it →` : 'Pick your dates'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
