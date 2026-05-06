'use client';

/**
 * DepartureTimeStep — Step 2 of the onboarding flow.
 *
 * Asks for the user's departure time on the last day. Injects a 3D airplane
 * scene into the persistent canvas. The plane tilts to reflect departure urgency.
 *
 * Logic: departure time is passed to buildUserPrompt as DEPARTURE_TIME_LAST_DAY,
 * which instructs Claude to end all last-day activities 2 hours before this time.
 */

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── 3D Plane Scene ────────────────────────────────────────────────────────────

function PlaneScene({ time }: { time: string }) {
  const planeRef  = useRef<THREE.Group>(null);
  const trailRef  = useRef<THREE.Mesh>(null);
  const glowRef   = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (!planeRef.current) return;
    const t = clock.elapsedTime;

    // Gentle floating bob + slight yaw
    planeRef.current.position.y = Math.sin(t * 0.8) * 0.12;
    planeRef.current.rotation.z = Math.sin(t * 0.5) * 0.06;
    planeRef.current.rotation.x = 0.15 + Math.sin(t * 0.6) * 0.04;

    // Parse time → tilt urgency: early departure = nose up, late = level
    const [h = 12] = (time ?? '').split(':').map(Number);
    const urgency = Math.max(0, (14 - h) / 14); // peaks around 06:00
    planeRef.current.rotation.x += urgency * 0.18;

    // Pulse engine glow
    if (glowRef.current) {
      glowRef.current.intensity = 1.0 + Math.sin(t * 3) * 0.25;
    }

    // Trail fade
    if (trailRef.current) {
      (trailRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.25 + Math.sin(t * 1.5) * 0.12;
    }
  });

  const [h = 12] = (time ?? '').split(':').map(Number);
  const isEarlyDep = h < 10;
  const accentColor = isEarlyDep ? '#f97316' : '#a855f7';

  return (
    <group position={[2.0, 0, 0]}>
      <ambientLight intensity={0.3} />
      <pointLight position={[4, 5, 3]} intensity={1.5} color="#ffffff" />
      <pointLight ref={glowRef} position={[-1, 0, 2]} intensity={1.0} color={accentColor} />

      <group ref={planeRef}>
        {/* Fuselage */}
        <mesh position={[0, 0, 0]}>
          <capsuleGeometry args={[0.12, 0.85, 8, 16]} />
          <meshStandardMaterial
            color="#e8eaf6"
            roughness={0.15}
            metalness={0.8}
          />
        </mesh>

        {/* Left wing */}
        <mesh position={[-0.42, 0, -0.05]} rotation={[0, 0, -0.18]}>
          <boxGeometry args={[0.52, 0.04, 0.22]} />
          <meshStandardMaterial color="#c5cae9" roughness={0.2} metalness={0.7} />
        </mesh>

        {/* Right wing */}
        <mesh position={[0.42, 0, -0.05]} rotation={[0, 0, 0.18]}>
          <boxGeometry args={[0.52, 0.04, 0.22]} />
          <meshStandardMaterial color="#c5cae9" roughness={0.2} metalness={0.7} />
        </mesh>

        {/* Tail fin */}
        <mesh position={[0, 0.16, -0.38]} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.18]} />
          <meshStandardMaterial color="#c5cae9" roughness={0.2} metalness={0.7} />
        </mesh>

        {/* Horizontal stabiliser */}
        <mesh position={[0, 0.02, -0.40]}>
          <boxGeometry args={[0.34, 0.03, 0.10]} />
          <meshStandardMaterial color="#c5cae9" roughness={0.2} metalness={0.7} />
        </mesh>

        {/* Left engine */}
        <mesh position={[-0.28, -0.06, 0.05]}>
          <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} roughness={0.2} metalness={0.6} />
        </mesh>

        {/* Right engine */}
        <mesh position={[0.28, -0.06, 0.05]}>
          <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} roughness={0.2} metalness={0.6} />
        </mesh>
      </group>

      {/* Contrail */}
      <mesh ref={trailRef} position={[0, -0.05, 0.7]}>
        <planeGeometry args={[0.08, 1.1]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ── Step UI ───────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40,  transition: { duration: 0.35 } },
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
      {/* Inject 3D plane into canvas */}
      <sceneContent.In>
        <PlaneScene time={departureTime || '14:00'} />
      </sceneContent.In>

      {/* 2D UI overlay */}
      <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex flex-col gap-6"
      >
        {/* Step label */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}
          >
            Step 2 of 2
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            When do you<br />
            <span style={{ color: '#a855f7' }}>fly home?</span>
          </h2>
          <p className="mt-2 text-sm text-white/40 max-w-xs">
            We&apos;ll make sure the last day wraps up in time — no missed flights.
          </p>
        </div>

        {/* Time input */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 tracking-wider uppercase">
            Departure time (local)
          </label>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-white text-lg font-mono font-bold outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1.5px solid rgba(255,255,255,0.12)',
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Quick-select buttons */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_TIMES.map(({ label, value, emoji }) => {
            const active = departureTime === value;
            return (
              <button
                key={value}
                onClick={() => setDepartureTime(value)}
                className="flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(168,85,247,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                  color: active ? '#a855f7' : 'rgba(255,255,255,0.5)',
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
            style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)' }}
          >
            <span className="text-lg shrink-0">⏰</span>
            <div>
              <p className="text-sm font-bold text-orange-400">Early flight detected</p>
              <p className="text-xs text-white/40 mt-0.5">
                Your last day ends before {String(h + 2).padStart(2, '0')}:00 — we&apos;ll keep it light with a great breakfast and a quick morning stop.
              </p>
            </div>
          </motion.div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl text-sm font-bold text-white/40 hover:text-white/70 transition-all"
            style={{ border: '1.5px solid rgba(255,255,255,0.08)' }}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={!departureTime}
            className="flex-[2] py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
            style={{
              background: departureTime
                ? 'linear-gradient(135deg, #a855f7, #6366f1)'
                : 'rgba(255,255,255,0.08)',
              boxShadow: departureTime ? '0 8px 32px -4px rgba(168,85,247,0.45)' : 'none',
            }}
          >
            Build My Trip →
          </button>
        </div>
      </motion.div>
    </>
  );
}
