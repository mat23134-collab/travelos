'use client';

/**
 * ArrivalTimeStep — Step 1 of the onboarding flow.
 *
 * Palette: Purple Shadow bg (#091f36) + Redline accent (#9e363a).
 * Injects a 3D clock scene into the persistent canvas.
 * Late arrival (hour >= 20) sets skipDay1 = true in the store.
 */

import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const PRIMARY   = '#9e363a';   // Redline
const PRIMARY_H = '#b5404a';   // Redline hover
const CARD      = '#0f2862';   // Blue Popsicle

// ── 3D Clock Scene ────────────────────────────────────────────────────────────

function parseTime(hhmm: string): { h: number; m: number } {
  const [h = 0, m = 0] = (hhmm ?? '').split(':').map(Number);
  return { h, m };
}

function ClockScene({ time }: { time: string }) {
  const hourRef = useRef<THREE.Mesh>(null);
  const minRef  = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const { h, m } = parseTime(time);
    const hourAngle = -((h % 12) / 12 + m / 720) * Math.PI * 2;
    const minAngle  = -(m / 60) * Math.PI * 2;
    if (hourRef.current) hourRef.current.rotation.z = hourAngle;
    if (minRef.current)  minRef.current.rotation.z  = minAngle;
    if (glowRef.current) {
      glowRef.current.intensity = 1.4 + Math.sin(clock.elapsedTime * 2) * 0.3;
    }
  });

  const { h } = parseTime(time);
  const isLate      = h >= 20;
  const accentColor = isLate ? PRIMARY_H : PRIMARY;

  return (
    <group position={[2.2, 0.2, 0]} scale={[0.9, 0.9, 0.9]}>
      <ambientLight intensity={0.28} />
      <pointLight position={[3, 4, 4]} intensity={1.2} color="#b8d0f0" />
      <pointLight ref={glowRef} position={[0, 0, 2]} intensity={1.4} color={accentColor} />

      {/* Clock face */}
      <mesh>
        <circleGeometry args={[1.1, 64]} />
        <meshStandardMaterial color="#050f1e" roughness={0.25} metalness={0.65} />
      </mesh>

      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[1.1, 0.045, 16, 80]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.65}
          roughness={0.10}
          metalness={0.82}
        />
      </mesh>

      {/* Hour markers */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(angle) * 0.9, Math.cos(angle) * 0.9, 0.01]}>
            <circleGeometry args={[0.035, 8]} />
            <meshStandardMaterial color="#4a7aad" transparent opacity={0.7} />
          </mesh>
        );
      })}

      {/* Hour hand */}
      <mesh ref={hourRef} position={[0, 0.22, 0.02]}>
        <boxGeometry args={[0.07, 0.5, 0.04]} />
        <meshStandardMaterial color="#c8daf0" roughness={0.3} metalness={0.75} />
      </mesh>

      {/* Minute hand */}
      <mesh ref={minRef} position={[0, 0.32, 0.03]}>
        <boxGeometry args={[0.045, 0.72, 0.03]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.45} />
      </mesh>

      {/* Center cap */}
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.9} />
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
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '13:00', emoji: '☀️' },
  { label: 'Afternoon', value: '16:00', emoji: '🌤️' },
  { label: 'Evening',   value: '19:00', emoji: '🌆' },
  { label: 'Late',      value: '21:00', emoji: '🌙' },
  { label: 'Night',     value: '23:30', emoji: '🌃' },
];

export function ArrivalTimeStep({ onNext }: { onNext: () => void }) {
  const { arrivalTime, skipDay1, setArrivalTime } = useOnboardingStore();

  return (
    <>
      <sceneContent.In>
        <ClockScene time={arrivalTime || '12:00'} />
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
              background: `rgba(158,54,58,0.15)`,
              color: PRIMARY,
              border: `1px solid rgba(158,54,58,0.30)`,
            }}
          >
            Step 1 of 3
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            When do you<br />
            <span style={{ color: PRIMARY }}>land?</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            We&apos;ll schedule Day 1 around your arrival — no rushed check-ins.
          </p>
        </div>

        {/* Time input */}
        <div>
          <label className="block text-xs font-semibold mb-2 tracking-wider uppercase" style={{ color: '#4f5f76' }}>
            Arrival time (local)
          </label>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-white text-lg font-mono font-bold outline-none transition-all"
            style={{
              background: `rgba(15,40,98,0.30)`,
              border: `1.5px solid rgba(158,54,58,0.25)`,
              colorScheme: 'dark',
            }}
          />
        </div>

        {/* Quick-select chips */}
        <div className="grid grid-cols-3 gap-2">
          {QUICK_TIMES.map(({ label, value, emoji }) => {
            const active = arrivalTime === value;
            return (
              <button
                key={value}
                onClick={() => setArrivalTime(value)}
                className="flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? `rgba(158,54,58,0.20)` : `rgba(15,40,98,0.20)`,
                  border: active ? `1.5px solid rgba(158,54,58,0.55)` : `1.5px solid rgba(255,255,255,0.07)`,
                  color: active ? PRIMARY : '#4f5f76',
                }}
              >
                <span className="text-base mb-0.5">{emoji}</span>
                <span>{label}</span>
                <span className="text-[9px] opacity-60 font-mono">{value}</span>
              </button>
            );
          })}
        </div>

        {/* Late-arrival notice */}
        {skipDay1 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 px-4 py-3 rounded-2xl"
            style={{
              background: `rgba(158,54,58,0.12)`,
              border: `1px solid rgba(158,54,58,0.30)`,
            }}
          >
            <span className="text-lg shrink-0">🌙</span>
            <div>
              <p className="text-sm font-bold" style={{ color: '#f87171' }}>Late arrival detected</p>
              <p className="text-xs mt-0.5" style={{ color: '#4f5f76' }}>
                Arriving after 8 PM? We&apos;ll skip Day 1 activities and start fresh on Day 2 — just hotel and rest.
              </p>
            </div>
          </motion.div>
        )}

        {/* CTA */}
        <button
          onClick={onNext}
          disabled={!arrivalTime}
          className="w-full py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all disabled:opacity-35 disabled:cursor-not-allowed"
          style={{
            background: arrivalTime
              ? `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_H})`
              : `rgba(255,255,255,0.06)`,
            boxShadow: arrivalTime ? `0 8px 32px -4px rgba(158,54,58,0.50)` : 'none',
          }}
        >
          Continue →
        </button>
      </motion.div>
    </>
  );
}
