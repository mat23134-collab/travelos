'use client';

/**
 * ArrivalTimeStep — Step 1 of the onboarding flow.
 *
 * Asks for the user's arrival time on Day 1. Injects a 3D clock-face scene
 * into the persistent canvas via the sceneContent tunnel. The clock hands
 * animate to the selected time in real-time.
 *
 * Crucial logic: if arrival hour >= 20 (8 PM), `skipDay1` is set to true
 * in onboardingStore so the itinerary generator receives the flag and omits
 * Day 1 activities entirely.
 */

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── 3D Clock Scene — injected into the persistent canvas ─────────────────────

function parseTime(hhmm: string): { h: number; m: number } {
  const [h = 0, m = 0] = (hhmm ?? '').split(':').map(Number);
  return { h, m };
}

function ClockScene({ time }: { time: string }) {
  const hourRef  = useRef<THREE.Mesh>(null);
  const minRef   = useRef<THREE.Mesh>(null);
  const glowRef  = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const { h, m } = parseTime(time);
    // Hour hand: full circle = 12h (2π / 12h)
    const hourAngle = -((h % 12) / 12 + m / 720) * Math.PI * 2;
    // Minute hand: full circle = 60m
    const minAngle  = -(m / 60) * Math.PI * 2;

    if (hourRef.current) hourRef.current.rotation.z = hourAngle;
    if (minRef.current)  minRef.current.rotation.z  = minAngle;

    // Pulse the glow
    if (glowRef.current) {
      glowRef.current.intensity = 1.4 + Math.sin(clock.elapsedTime * 2) * 0.3;
    }
  });

  const { h } = parseTime(time);
  const isLate = h >= 20;
  const accentColor = isLate ? '#ef4444' : '#ff5a5f';

  return (
    <group position={[2.2, 0.2, 0]} scale={[0.9, 0.9, 0.9]}>
      {/* Ambient + key light */}
      <ambientLight intensity={0.35} />
      <pointLight position={[3, 4, 4]} intensity={1.2} color="#ffffff" />
      <pointLight ref={glowRef} position={[0, 0, 2]} intensity={1.4} color={accentColor} />

      {/* Clock face */}
      <mesh>
        <circleGeometry args={[1.1, 64]} />
        <meshStandardMaterial
          color="#0d0f1a"
          roughness={0.2}
          metalness={0.6}
        />
      </mesh>

      {/* Outer ring */}
      <mesh>
        <torusGeometry args={[1.1, 0.045, 16, 80]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.6}
          roughness={0.1}
          metalness={0.8}
        />
      </mesh>

      {/* Hour markers (12 ticks) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.sin(angle) * 0.9;
        const y = Math.cos(angle) * 0.9;
        return (
          <mesh key={i} position={[x, y, 0.01]}>
            <circleGeometry args={[0.035, 8]} />
            <meshStandardMaterial color="rgba(255,255,255,0.5)" />
          </mesh>
        );
      })}

      {/* Hour hand */}
      <mesh ref={hourRef} position={[0, 0.22, 0.02]}>
        <boxGeometry args={[0.07, 0.5, 0.04]} />
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Minute hand */}
      <mesh ref={minRef} position={[0, 0.32, 0.03]}>
        <boxGeometry args={[0.045, 0.72, 0.03]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={accentColor}
          emissiveIntensity={0.4}
        />
      </mesh>

      {/* Center cap */}
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.8} />
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
  { label: 'Morning',  value: '09:00', emoji: '🌅' },
  { label: 'Midday',   value: '13:00', emoji: '☀️' },
  { label: 'Afternoon',value: '16:00', emoji: '🌤️' },
  { label: 'Evening',  value: '19:00', emoji: '🌆' },
  { label: 'Late',     value: '21:00', emoji: '🌙' },
  { label: 'Night',    value: '23:30', emoji: '🌃' },
];

export function ArrivalTimeStep({ onNext }: { onNext: () => void }) {
  const { arrivalTime, skipDay1, setArrivalTime } = useOnboardingStore();

  return (
    <>
      {/* Inject 3D clock into canvas */}
      <sceneContent.In>
        <ClockScene time={arrivalTime || '12:00'} />
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
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{ background: 'rgba(255,90,95,0.15)', color: '#ff5a5f', border: '1px solid rgba(255,90,95,0.25)' }}>
            Step 1 of 2
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            When do you<br />
            <span style={{ color: '#ff5a5f' }}>land?</span>
          </h2>
          <p className="mt-2 text-sm text-white/40 max-w-xs">
            We&apos;ll schedule Day 1 around your arrival — no rushed check-ins.
          </p>
        </div>

        {/* Time input */}
        <div>
          <label className="block text-xs font-semibold text-white/50 mb-2 tracking-wider uppercase">
            Arrival time (local)
          </label>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full px-4 py-3.5 rounded-2xl text-white text-lg font-mono font-bold outline-none focus:ring-2 transition-all"
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
            const active = arrivalTime === value;
            return (
              <button
                key={value}
                onClick={() => setArrivalTime(value)}
                className="flex flex-col items-center py-2.5 px-1 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: active ? 'rgba(255,90,95,0.18)' : 'rgba(255,255,255,0.04)',
                  border: active ? '1.5px solid rgba(255,90,95,0.5)' : '1.5px solid rgba(255,255,255,0.08)',
                  color: active ? '#ff5a5f' : 'rgba(255,255,255,0.5)',
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
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)' }}
          >
            <span className="text-lg shrink-0">🌙</span>
            <div>
              <p className="text-sm font-bold text-red-400">Late arrival detected</p>
              <p className="text-xs text-white/40 mt-0.5">
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
              ? 'linear-gradient(135deg, #ff5a5f, #ff8c5a)'
              : 'rgba(255,255,255,0.08)',
            boxShadow: arrivalTime ? '0 8px 32px -4px rgba(255,90,95,0.45)' : 'none',
          }}
        >
          Continue →
        </button>
      </motion.div>
    </>
  );
}
