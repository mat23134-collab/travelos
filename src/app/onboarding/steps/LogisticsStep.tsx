'use client';

/**
 * LogisticsStep — Step 3 of 4 in the onboarding flow.
 *
 * Combined arrival + departure logistics on ONE screen.
 * Replaces the old ArrivalTimeStep + DepartureTimeStep (two separate steps).
 *
 * skipDay1 logic: if arrivalTime hour >= 20, skipDay1 = true in the store
 * (set automatically by setArrivalTime). This is the single source of truth.
 *
 * 3D: clock scene tracking the arrival time.
 * Palette: Redline (#9e363a) for arrival, warm orange (#f97316) for early-departure warning.
 */

import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';

// ── Palette ───────────────────────────────────────────────────────────────────
const PRIMARY   = '#9e363a';
const PRIMARY_H = '#b5404a';

// ── 3D Clock Scene (arrival time visual) ─────────────────────────────────────

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
    if (hourRef.current) hourRef.current.rotation.z = -((h % 12) / 12 + m / 720) * Math.PI * 2;
    if (minRef.current)  minRef.current.rotation.z  = -(m / 60) * Math.PI * 2;
    if (glowRef.current) {
      glowRef.current.intensity = 1.4 + Math.sin(clock.elapsedTime * 2) * 0.3;
    }
  });

  const { h } = parseTime(time);
  const isLate  = h >= 20;
  const accent  = isLate ? PRIMARY_H : PRIMARY;

  return (
    <group position={[2.2, 0.2, 0]} scale={[0.9, 0.9, 0.9]}>
      <ambientLight intensity={0.28} />
      <pointLight position={[3, 4, 4]} intensity={1.2} color="#b8d0f0" />
      <pointLight ref={glowRef} position={[0, 0, 2]} intensity={1.4} color={accent} />

      {/* Face */}
      <mesh>
        <circleGeometry args={[1.1, 64]} />
        <meshStandardMaterial color="#050f1e" roughness={0.25} metalness={0.65} />
      </mesh>
      {/* Ring */}
      <mesh>
        <torusGeometry args={[1.1, 0.045, 16, 80]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.65} roughness={0.10} metalness={0.82} />
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
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.45} />
      </mesh>
      {/* Center cap */}
      <mesh position={[0, 0, 0.05]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.9} />
      </mesh>
    </group>
  );
}

// ── Quick-select chip data ────────────────────────────────────────────────────

const ARRIVAL_TIMES = [
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '13:00', emoji: '☀️' },
  { label: 'Afternoon', value: '16:00', emoji: '🌤️' },
  { label: 'Evening',   value: '19:00', emoji: '🌆' },
  { label: 'Late',      value: '21:00', emoji: '🌙' },
  { label: 'Night',     value: '23:30', emoji: '🌃' },
];

const DEPARTURE_TIMES = [
  { label: 'Dawn',      value: '06:00', emoji: '🌄' },
  { label: 'Morning',   value: '09:00', emoji: '🌅' },
  { label: 'Midday',    value: '12:00', emoji: '☀️' },
  { label: 'Afternoon', value: '15:00', emoji: '🌤️' },
  { label: 'Evening',   value: '18:00', emoji: '🌆' },
  { label: 'Night',     value: '22:00', emoji: '🌙' },
];

// ── Animation variants ────────────────────────────────────────────────────────
const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

// ── Small time chip grid ──────────────────────────────────────────────────────
function TimeChips({
  times,
  selected,
  accentColor,
  onSelect,
}: {
  times: typeof ARRIVAL_TIMES;
  selected: string;
  accentColor: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {times.map(({ label, value, emoji }) => {
        const active = selected === value;
        const rgb = accentColor === PRIMARY ? '158,54,58' : '249,115,22';
        return (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className="flex flex-col items-center py-2 px-1 rounded-xl text-[10px] font-semibold transition-all"
            style={{
              background: active ? `rgba(${rgb},0.20)` : `rgba(15,40,98,0.18)`,
              border: active ? `1.5px solid rgba(${rgb},0.55)` : `1.5px solid rgba(255,255,255,0.06)`,
              color: active ? accentColor : '#4f5f76',
            }}
          >
            <span className="text-sm mb-0.5">{emoji}</span>
            <span>{label}</span>
            <span className="text-[8px] opacity-50 font-mono">{value}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LogisticsStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    arrivalTime, departureTime, skipDay1,
    setArrivalTime, setDepartureTime,
  } = useOnboardingStore();

  // Early departure warning (< 10:00)
  const [depH = 12] = (departureTime ?? '').split(':').map(Number);
  const isEarlyDep = !!departureTime && depH < 10;

  // Both fields are optional — can always proceed
  const canContinue = true;

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
        className="relative z-10 flex flex-col gap-5"
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
            Step 3 of 4
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
            style={{ background: `rgba(15,40,98,0.22)`, color: '#4f5f76' }}
          >
            Logistics
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
            Time your trip<br />
            <span style={{ color: PRIMARY }}>perfectly.</span>
          </h2>
          <p className="mt-1.5 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            We&apos;ll schedule around your flights — no rushed check-ins or missed planes.
          </p>
        </div>

        {/* ── Arrival ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: `rgba(15,40,98,0.20)`, border: `1px solid rgba(158,54,58,0.15)` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🛬</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: PRIMARY }}>
              Day 1 — Arrival
            </span>
          </div>
          <input
            type="time"
            value={arrivalTime}
            onChange={(e) => setArrivalTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white text-base font-mono font-bold outline-none mb-3 transition-all"
            style={{
              background: `rgba(9,31,54,0.50)`,
              border: `1.5px solid rgba(158,54,58,0.25)`,
              colorScheme: 'dark',
            }}
          />
          <TimeChips
            times={ARRIVAL_TIMES}
            selected={arrivalTime}
            accentColor={PRIMARY}
            onSelect={setArrivalTime}
          />

          {/* Late-arrival notice */}
          {skipDay1 && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(158,54,58,0.12)`, border: `1px solid rgba(158,54,58,0.28)` }}
            >
              <span className="text-sm shrink-0">🌙</span>
              <div>
                <p className="text-xs font-bold" style={{ color: '#f87171' }}>Late arrival — Day 1 simplified</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4f5f76' }}>
                  Arriving after 8 PM? Day 1 = hotel check-in + dinner only. Full schedule starts Day 2.
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Departure ────────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4"
          style={{ background: `rgba(15,40,98,0.20)`, border: `1px solid rgba(74,123,222,0.15)` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🛫</span>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#4a7bde' }}>
              Last Day — Departure
            </span>
          </div>
          <input
            type="time"
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white text-base font-mono font-bold outline-none mb-3 transition-all"
            style={{
              background: `rgba(9,31,54,0.50)`,
              border: `1.5px solid rgba(74,123,222,0.25)`,
              colorScheme: 'dark',
            }}
          />
          <TimeChips
            times={DEPARTURE_TIMES}
            selected={departureTime}
            accentColor="#f97316"
            onSelect={setDepartureTime}
          />

          {/* Early-departure notice */}
          {isEarlyDep && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 mt-3 px-3 py-2.5 rounded-xl"
              style={{ background: `rgba(249,115,22,0.10)`, border: `1px solid rgba(249,115,22,0.28)` }}
            >
              <span className="text-sm shrink-0">⏰</span>
              <div>
                <p className="text-xs font-bold text-orange-400">Early flight</p>
                <p className="text-[10px] mt-0.5" style={{ color: '#4f5f76' }}>
                  Last day ends before {String(depH + 2).padStart(2, '0')}:00 — light morning itinerary only.
                </p>
              </div>
            </motion.div>
          )}
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
            className="flex-[2] py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all"
            style={{
              background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_H})`,
              boxShadow: `0 8px 32px -4px rgba(158,54,58,0.45)`,
            }}
          >
            Set Home Base →
          </button>
        </div>

        {/* Skip hint */}
        <p className="text-center text-[10px]" style={{ color: 'rgba(79,95,118,0.6)' }}>
          Both fields are optional — you can skip and fill in later
        </p>
      </motion.div>
    </>
  );
}
