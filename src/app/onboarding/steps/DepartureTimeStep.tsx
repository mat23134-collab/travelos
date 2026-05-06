'use client';

/**
 * DepartureTimeStep — Step 2 of the onboarding flow.
 *
 * Palette: Purple Shadow bg + Blue Popsicle accent (#4a7bde).
 * Injects a 3D airplane scene into the persistent canvas.
 * Early departure (<10:00) triggers warning banner.
 */

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const ACCENT   = '#4a7bde';   // steel-blue departure accent
const ACCENT_H = '#5a8bee';
const WARN     = '#f97316';   // early-departure orange

// ── 3D Plane Scene ────────────────────────────────────────────────────────────

function PlaneScene({ time }: { time: string }) {
  const planeRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!planeRef.current) return;
    const t = clock.elapsedTime;

    planeRef.current.position.y = Math.sin(t * 0.8) * 0.12;
    planeRef.current.rotation.z = Math.sin(t * 0.5) * 0.06;
    planeRef.current.rotation.x = 0.15 + Math.sin(t * 0.6) * 0.04;

    const [h = 12] = (time ?? '').split(':').map(Number);
    const urgency = Math.max(0, (14 - h) / 14);
    planeRef.current.rotation.x += urgency * 0.18;

    if (glowRef.current) {
      glowRef.current.intensity = 1.0 + Math.sin(t * 3) * 0.25;
    }
    if (trailRef.current) {
      (trailRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.25 + Math.sin(t * 1.5) * 0.12;
    }
  });

  const [h = 12] = (time ?? '').split(':').map(Number);
  const isEarlyDep  = h < 10;
  const accentColor = isEarlyDep ? WARN : ACCENT;

  return (
    <group position={[2.0, 0, 0]}>
      <ambientLight intensity={0.25} />
      <pointLight position={[4, 5, 3]} intensity={1.5} color="#b8d0f0" />
      <pointLight ref={glowRef} position={[-1, 0, 2]} intensity={1.0} color={accentColor} />

      <group ref={planeRef}>
        {/* Fuselage */}
        <mesh>
          <capsuleGeometry args={[0.12, 0.85, 8, 16]} />
          <meshStandardMaterial color="#c8d8f0" roughness={0.15} metalness={0.82} />
        </mesh>
        {/* Left wing */}
        <mesh position={[-0.42, 0, -0.05]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[0.52, 0.04, 0.22]} />
          <meshStandardMaterial color="#9ab8d8" roughness={0.20} metalness={0.75} />
        </mesh>
        {/* Right wing */}
        <mesh position={[0.42, 0, -0.05]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.52, 0.04, 0.22]} />
          <meshStandardMaterial color="#9ab8d8" roughness={0.20} metalness={0.75} />
        </mesh>
        {/* Tail fin */}
        <mesh position={[0, 0.16, -0.38]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.18]} />
          <meshStandardMaterial color="#9ab8d8" roughness={0.20} metalness={0.75} />
        </mesh>
        {/* Horizontal stabiliser */}
        <mesh position={[0, 0.02, -0.40]}>
          <boxGeometry args={[0.34, 0.03, 0.10]} />
          <meshStandardMaterial color="#9ab8d8" roughness={0.20} metalness={0.75} />
        </mesh>
        {/* Left engine */}
        <mesh position={[-0.28, -0.06, 0.05]}>
          <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.55} roughness={0.20} metalness={0.65} />
        </mesh>
        {/* Right engine */}
        <mesh position={[0.28, -0.06, 0.05]}>
          <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.55} roughness={0.20} metalness={0.65} />
        </mesh>
      </group>

      {/* Contrail */}
      <mesh ref={trailRef} position={[0, -0.05, 0.7]}>
        <planeGeometry args={[0.08, 1.1]} />
        <meshStandardMaterial color="#b8d0f0" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Step UI ───────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

const QUICK_TIMES = [
  { label: 'Dawn',      value: '06:00', emoji: '🌄' },
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '12:00', emoji: '☀️' },
  { label: 'Afternoon', value: '15:00', emoji: '🌤️' },
  { label: 'Evening',   value: '18:00', emoji: '🌆' },
  { label: 'Night',     value: '22:00', emoji: '🌙' },
];

export function DepartureTimeStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { departureTime, setDepartureTime } = useOnboardingStore();
  const [h = 12] = (departureTime ?? '').split(':').map(Number);
  const isEarlyDep = !!departureTime && h < 10;

  return (
    <>
      <sceneContent.In>
        <PlaneScene time={departureTime || '14:00'} />
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
            Step 2 of 3
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            When do you<br />
            <span style={{ color: ACCENT }}>fly home?</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            We&apos;ll make sure the last day wraps up in time — no missed flights.
          </p>
        </div>

        {/* Time input */}
        <div>
          <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: '#4f5f76' }}>
            Departure time (local)
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-white text-lg font-mono font-bold outline-none transition-all"
            style={{
              background: `rgba(15,40,98,0.30)`,
              border: `1.5px solid rgba(74,123,222,0.25)`,
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Quick-select chips */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_TIMES.map(({ label, value, emoji }) => {
            const active = departureTime === value;
            return (
              <button
                key={value}
                onClick={() => setDepartureTime(value)}
                className="flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? `rgba(74,123,222,0.20)` : `rgba(15,40,98,0.20)`,
                  border: active ? `1.5px solid rgba(74,123,222,0.55)` : `1.5px solid rgba(255,255,255,0.07)`,
                  color: active ? ACCENT : '#4f5f76',
                }}
              >
                <span className="text-base mb-0.5">{emoji}</span>
                <span>{label}</span>
                <span className="text-[9px] opacity-60 font-mono">{value}</span>
              </button>
            );
          })}
        </div>

        {/* Early departure notice */}
        {isEarlyDep && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: `rgba(249,115,22,0.10)`,
              border: `1px solid rgba(249,115,22,0.28)`,
            }}
          >
            <span className="text-lg shrink-0">⏰</span>
            <div>
              <p className="text-sm font-bold text-orange-400">Early flight detected</p>
              <p className="text-xs mt-0.5" style={{ color: '#4f5f76' }}>
                Your last day ends before {String(h + 2).padStart(2, '0')}:00 — we&apos;ll keep it light with a great breakfast and a quick morning stop.
              </p>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl text-sm font-bold transition-all"
            style={{
              color: '#4f5f76',
              border: `1.5px solid rgba(255,255,255,0.07)`,
              background: 'transparent',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4f5f76')}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!departureTime}
            className="flex-[2] py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: departureTime
                ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT_H})`
                : `rgba(255,255,255,0.06)`,
              boxShadow: departureTime ? `0 8px 32px -4px rgba(74,123,222,0.50)` : 'none',
            }}
          >
            Continue →
          </button>
        </div>
      </motion.div>
    </>
  );
}
