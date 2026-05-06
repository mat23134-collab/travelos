'use client';

/**
 * CompassScene — metallic 3D compass with Purple-Shadow navy + Redline aesthetic.
 *
 * Palette v1.10.21:
 *  - Bezel      : #0d1f3c deep navy metallic (Purple Shadow derived)
 *  - Glow ring  : #9e363a Redline emissive
 *  - Face       : #050f1e near-black navy
 *  - Compass rose: N in #9e363a Redline, others in steel-blue
 *  - Needle N   : #9e363a Redline
 *  - Center cap : #9e363a emissive
 *
 * Features:
 *  - Spring-physics "build" entry animation after a 900ms delay
 *  - Compass needle tracks the mouse cursor direction
 *  - Whole compass tilts subtly toward mouse (parallax depth effect)
 *  - Viewport-responsive: shifts left on narrow screens
 *  - locationMarker prop: when hotel {lat,lng} is provided, gold marker appears
 */

import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { mousePos } from './mouseStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LocationMarker {
  lat: number;
  lng: number;
  label?: string;
}

// ─── Spring physics helper ────────────────────────────────────────────────────

interface SpringState { pos: number; vel: number }

function tickSpring(
  s: SpringState,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): void {
  const force = (target - s.pos) * stiffness - s.vel * damping;
  s.vel += force * dt;
  s.pos += s.vel * dt;
}

// ─── Degree ring (72 tick marks as line segments — 1 draw call) ───────────────

function DegreeRing() {
  const geo = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 72; i++) {
      const ang   = (i / 72) * Math.PI * 2;
      const isMaj = i % 6 === 0;   // every 30°
      const isMed = i % 2 === 0;   // every 10°
      const len   = isMaj ? 0.17 : isMed ? 0.10 : 0.055;
      const r0    = 1.64;
      const r1    = r0 + len;
      pts.push(
        Math.sin(ang) * r0, Math.cos(ang) * r0, 0.065,
        Math.sin(ang) * r1, Math.cos(ang) * r1, 0.065,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);

  return (
    <lineSegments geometry={geo}>
      {/* Steel-blue ticks to complement navy palette */}
      <lineBasicMaterial color="#4a7aad" transparent opacity={0.45} />
    </lineSegments>
  );
}

// ─── Compass rose (8-pointed) ─────────────────────────────────────────────────

const ROSE_POINTS = [
  // North: Redline
  { angle: 0,   h: 1.25, r: 0.085, color: '#9e363a', emissive: '#9e363a', ei: 3.8, label: 'N' },
  // NE: dark navy-steel
  { angle: 45,  h: 0.58, r: 0.052, color: '#1e3a6e', emissive: '#4a7aad', ei: 0.5, label: ''  },
  // East: steel-blue
  { angle: 90,  h: 0.90, r: 0.068, color: '#4a7aad', emissive: '#7aaad8', ei: 0.3, label: 'E' },
  // SE: dim
  { angle: 135, h: 0.58, r: 0.052, color: '#2a4a7a', emissive: '#ffffff', ei: 0.1, label: ''  },
  // South: muted steel
  { angle: 180, h: 0.90, r: 0.068, color: '#2e4a6a', emissive: '#5a8ab8', ei: 0.3, label: 'S' },
  // SW: dim
  { angle: 225, h: 0.58, r: 0.052, color: '#1a3055', emissive: '#ffffff', ei: 0.1, label: ''  },
  // West: steel-blue
  { angle: 270, h: 0.90, r: 0.068, color: '#4a7aad', emissive: '#7aaad8', ei: 0.3, label: 'W' },
  // NW: dim
  { angle: 315, h: 0.58, r: 0.052, color: '#2a4a7a', emissive: '#ffffff', ei: 0.1, label: ''  },
] as const;

function CompassRose() {
  return (
    <group position={[0, 0, 0.09]}>
      {ROSE_POINTS.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        return (
          <group key={i} rotation={[0, 0, rad]}>
            <mesh position={[0, p.h / 2, 0]}>
              <coneGeometry args={[p.r, p.h, 12]} />
              <meshStandardMaterial
                color={p.color}
                emissive={p.emissive}
                emissiveIntensity={p.ei}
                roughness={0.14}
                metalness={0.72}
              />
            </mesh>

            {p.label && (
              <Text
                position={[0, p.h + 0.26, 0]}
                rotation={[0, 0, -rad]}
                fontSize={0.19}
                color={p.label === 'N' ? '#9e363a' : 'rgba(120,170,220,0.72)'}
                anchorX="center"
                anchorY="middle"
                renderOrder={1}
              >
                {p.label}
              </Text>
            )}
          </group>
        );
      })}
    </group>
  );
}

// ─── Compass needle (tracks mouse bearing) ────────────────────────────────────

function Needle() {
  return (
    <group position={[0, 0, 0.13]}>
      {/* ── North half — Redline ── */}
      <mesh position={[0, 0.58, 0]}>
        <coneGeometry args={[0.063, 0.75, 14]} />
        <meshStandardMaterial
          color="#9e363a" emissive="#9e363a" emissiveIntensity={2.8}
          metalness={0.55} roughness={0.10}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.38, 10]} />
        <meshStandardMaterial
          color="#9e363a" emissive="#9e363a" emissiveIntensity={1.6}
          metalness={0.5} roughness={0.15}
        />
      </mesh>

      {/* ── South half — deep navy steel ── */}
      <mesh position={[0, -0.58, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.063, 0.75, 14]} />
        <meshStandardMaterial color="#0d1f3c" metalness={0.88} roughness={0.14} />
      </mesh>
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.38, 10]} />
        <meshStandardMaterial color="#1a3258" metalness={0.80} roughness={0.18} />
      </mesh>
    </group>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function CompassScene({
  locationMarker,
}: {
  locationMarker?: LocationMarker | null;
}) {
  const tiltRef   = useRef<THREE.Group>(null);
  const buildRef  = useRef<THREE.Group>(null);
  const needleRef = useRef<THREE.Group>(null);

  const { invalidate, viewport } = useThree();

  const spring  = useRef<SpringState>({ pos: 0, vel: 0 });
  const started = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => { started.current = true; }, 900);
    invalidate();
    return () => clearTimeout(t);
  }, [invalidate]);

  useFrame((_, dt) => {
    if (!tiltRef.current || !buildRef.current || !needleRef.current) return;

    // ── Build spring ─────────────────────────────────────────────────────────
    if (started.current) {
      tickSpring(spring.current, 1, 210, 22, dt);
    }
    const s = THREE.MathUtils.clamp(spring.current.pos, 0, 1.06);
    buildRef.current.scale.setScalar(s);
    buildRef.current.visible = s > 0.01;

    // ── Tilt toward mouse (parallax) ─────────────────────────────────────────
    const targetX = 0.22 + mousePos.y * 0.26;
    const targetY = mousePos.x  * 0.20;
    tiltRef.current.rotation.x = THREE.MathUtils.lerp(tiltRef.current.rotation.x, targetX, 0.04);
    tiltRef.current.rotation.y = THREE.MathUtils.lerp(tiltRef.current.rotation.y, targetY, 0.04);

    // ── Needle tracks mouse bearing ───────────────────────────────────────────
    const bearing = Math.atan2(mousePos.x, mousePos.y);
    needleRef.current.rotation.z = THREE.MathUtils.lerp(needleRef.current.rotation.z, -bearing, 0.07);

    invalidate();
  });

  const posX =
    viewport.width > 7.5 ? 2.65 :
    viewport.width > 5.0 ? 1.60 :
    0.20;

  return (
    <group position={[posX, -0.15, 0]}>

      {/* ── Scene lighting ─────────────────────────────────────────────── */}
      <ambientLight intensity={0.08} />
      {/* Front Redline key light */}
      <pointLight position={[0, 0, 6]}   intensity={4.5} color="#9e363a" distance={18} decay={2} />
      {/* Blue-white rim from upper-left */}
      <pointLight position={[-4, 5, 4]}  intensity={1.8} color="#b8d0f0" distance={20} decay={2} />
      {/* Deep navy under-fill */}
      <pointLight position={[2, -4, 2]}  intensity={0.6} color="#0f2862" distance={14} decay={2} />

      {/* ── Tilt group ─────────────────────────────────────────────────── */}
      <group ref={tiltRef}>

        {/* ── Build group ────────────────────────────────────────────── */}
        <group ref={buildRef} visible={false}>

          {/* ── Outer bezel — deep navy metallic ─────────────────────── */}
          <mesh>
            <torusGeometry args={[2.04, 0.235, 36, 148]} />
            <meshStandardMaterial
              color="#0d1f3c"
              metalness={0.96}
              roughness={0.05}
            />
          </mesh>
          {/* Bevelled highlight — steel-blue inner edge */}
          <mesh>
            <torusGeometry args={[1.82, 0.042, 18, 128]} />
            <meshStandardMaterial
              color="#1e3a6e"
              metalness={0.92}
              roughness={0.08}
            />
          </mesh>
          {/* Redline glow ring — TravelOS signature accent */}
          <mesh>
            <torusGeometry args={[1.875, 0.026, 18, 128]} />
            <meshStandardMaterial
              color="#9e363a"
              emissive="#9e363a"
              emissiveIntensity={3.6}
              metalness={0.3}
              roughness={0.2}
            />
          </mesh>

          {/* ── Compass face — deep navy ──────────────────────────────── */}
          <mesh>
            <cylinderGeometry args={[1.80, 1.80, 0.06, 80]} />
            <meshStandardMaterial
              color="#050f1e"
              roughness={0.40}
              metalness={0.20}
            />
          </mesh>

          {/* ── Degree tick ring ─────────────────────────────────────── */}
          <DegreeRing />

          {/* ── Compass rose ─────────────────────────────────────────── */}
          <CompassRose />

          {/* ── Needle ───────────────────────────────────────────────── */}
          <group ref={needleRef}>
            <Needle />
          </group>

          {/* ── Center pivot cap ─────────────────────────────────────── */}
          <mesh position={[0, 0, 0.175]}>
            <sphereGeometry args={[0.108, 26, 26]} />
            <meshStandardMaterial
              color="#9e363a"
              emissive="#9e363a"
              emissiveIntensity={2.6}
              metalness={0.62}
              roughness={0.08}
            />
          </mesh>
          <mesh position={[0, 0, 0.14]}>
            <torusGeometry args={[0.14, 0.018, 12, 48]} />
            <meshStandardMaterial color="#071629" metalness={0.90} roughness={0.10} />
          </mesh>

          {/* ── Outer atmosphere glow ────────────────────────────────── */}
          <mesh>
            <sphereGeometry args={[2.52, 12, 8]} />
            <meshBasicMaterial color="#9e363a" transparent opacity={0.013} />
          </mesh>

          {/* ── Hotel location marker (gold) ──────────────────────────── */}
          {/* Appears when hotel coordinates are provided via onboardingStore */}
          {locationMarker && (
            <group position={[0, 0.6, 0.18]}>
              {/* Gold dot */}
              <mesh>
                <sphereGeometry args={[0.072, 14, 14]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#fbbf24"
                  emissiveIntensity={5}
                />
              </mesh>
              {/* Pulsing ring */}
              <mesh>
                <torusGeometry args={[0.13, 0.013, 8, 44]} />
                <meshStandardMaterial
                  color="#fbbf24"
                  emissive="#fbbf24"
                  emissiveIntensity={3}
                  transparent
                  opacity={0.75}
                />
              </mesh>
            </group>
          )}

        </group>{/* /buildRef */}
      </group>{/* /tiltRef */}
    </group>
  );
}
