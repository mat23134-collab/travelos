'use client';

/**
 * CompassScene — metallic 3D compass with crimson/black aesthetic.
 *
 * Inspired by the classic directional compass aesthetic (metallic bezel,
 * detailed compass rose, cardinal labels, graduated degree ring) but
 * re-skinned in TravelOS crimson + deep black instead of blue.
 *
 * Features:
 *  - Spring-physics "build" entry animation after a 900ms delay
 *  - Compass needle tracks the mouse cursor direction
 *  - Whole compass tilts subtly toward mouse (parallax depth effect)
 *  - Viewport-responsive: shifts left on narrow screens
 *  - locationMarker prop ready to accept hotel {lat,lng} coordinates
 *
 * Pointer events:
 *  - Canvas is z-index:-1 with pointer-events:none (CanvasShell)
 *  - Mouse read via window.mousemove in CanvasShell → mouseStore.ts
 *  - Canvas NEVER receives clicks; HTML buttons always work
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
      const ang     = (i / 72) * Math.PI * 2;
      const isMaj   = i % 6 === 0;  // every 30°
      const isMed   = i % 2 === 0;  // every 10°
      const len     = isMaj ? 0.17 : isMed ? 0.10 : 0.055;
      const r0      = 1.64;
      const r1      = r0 + len;
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
      <lineBasicMaterial color="#ffffff" transparent opacity={0.5} />
    </lineSegments>
  );
}

// ─── Compass rose (8-pointed) ─────────────────────────────────────────────────

const ROSE_POINTS = [
  { angle: 0,   h: 1.25, r: 0.085, color: '#ef4444', emissive: '#ef4444', ei: 4.0, label: 'N' },
  { angle: 45,  h: 0.58, r: 0.052, color: '#7f1d1d', emissive: '#dc2626', ei: 0.6, label: ''  },
  { angle: 90,  h: 0.90, r: 0.068, color: '#94a3b8', emissive: '#e2e8f0', ei: 0.3, label: 'E' },
  { angle: 135, h: 0.58, r: 0.052, color: '#64748b', emissive: '#ffffff', ei: 0.1, label: ''  },
  { angle: 180, h: 0.90, r: 0.068, color: '#475569', emissive: '#94a3b8', ei: 0.4, label: 'S' },
  { angle: 225, h: 0.58, r: 0.052, color: '#4b5563', emissive: '#ffffff', ei: 0.1, label: ''  },
  { angle: 270, h: 0.90, r: 0.068, color: '#94a3b8', emissive: '#e2e8f0', ei: 0.3, label: 'W' },
  { angle: 315, h: 0.58, r: 0.052, color: '#64748b', emissive: '#ffffff', ei: 0.1, label: ''  },
] as const;

function CompassRose() {
  return (
    <group position={[0, 0, 0.09]}>
      {ROSE_POINTS.map((p, i) => {
        const rad = (p.angle * Math.PI) / 180;
        return (
          <group key={i} rotation={[0, 0, rad]}>
            {/* Diamond cone pointing radially outward.
                ConeGeometry tip is at +Y = top, so positioning the cone
                at [0, h/2, 0] puts its base at center and tip at +h. */}
            <mesh position={[0, p.h / 2, 0]}>
              <coneGeometry args={[p.r, p.h, 12]} />
              <meshStandardMaterial
                color={p.color}
                emissive={p.emissive}
                emissiveIntensity={p.ei}
                roughness={0.14}
                metalness={0.68}
              />
            </mesh>

            {/* Cardinal label — counter-rotated so text stays upright */}
            {p.label && (
              <Text
                position={[0, p.h + 0.26, 0]}
                rotation={[0, 0, -rad]}
                fontSize={0.19}
                color={p.label === 'N' ? '#ef4444' : 'rgba(255,255,255,0.72)'}
                anchorX="center"
                anchorY="middle"
                // Ensure the Text renders above all opaque geometry
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
      {/* ── North half — crimson ── */}
      {/* Tip cone */}
      <mesh position={[0, 0.58, 0]}>
        <coneGeometry args={[0.063, 0.75, 14]} />
        <meshStandardMaterial
          color="#ef4444" emissive="#ef4444" emissiveIntensity={3}
          metalness={0.55} roughness={0.1}
        />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.38, 10]} />
        <meshStandardMaterial
          color="#ef4444" emissive="#ef4444" emissiveIntensity={1.8}
          metalness={0.5} roughness={0.15}
        />
      </mesh>

      {/* ── South half — dark steel ── */}
      {/* Tip cone */}
      <mesh position={[0, -0.58, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.063, 0.75, 14]} />
        <meshStandardMaterial color="#1e293b" metalness={0.82} roughness={0.16} />
      </mesh>
      {/* Shaft */}
      <mesh position={[0, -0.2, 0]}>
        <cylinderGeometry args={[0.036, 0.036, 0.38, 10]} />
        <meshStandardMaterial color="#334155" metalness={0.74} roughness={0.2} />
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
  // Three separate ref layers for clean separation of concerns:
  //  tiltRef   → mouse-driven tilt (rotation only)
  //  buildRef  → spring-animated scale on entry
  //  needleRef → tracks mouse bearing (rotation on Z)
  const tiltRef   = useRef<THREE.Group>(null);
  const buildRef  = useRef<THREE.Group>(null);
  const needleRef = useRef<THREE.Group>(null);

  const { invalidate, viewport } = useThree();

  // Spring state for entry animation
  const spring  = useRef<SpringState>({ pos: 0, vel: 0 });
  const started = useRef(false);

  // Kick off build after 900ms so the page content loads first
  useEffect(() => {
    const t = setTimeout(() => {
      started.current = true;
    }, 900);
    // Prime the first frame
    invalidate();
    return () => clearTimeout(t);
  }, [invalidate]);

  useFrame((_, dt) => {
    if (!tiltRef.current || !buildRef.current || !needleRef.current) return;

    // ── Build spring animation ────────────────────────────────────────
    if (started.current) {
      tickSpring(spring.current, 1, 210, 22, dt);
    }
    const s = THREE.MathUtils.clamp(spring.current.pos, 0, 1.06);
    buildRef.current.scale.setScalar(s);
    buildRef.current.visible = s > 0.01;

    // ── Tilt toward mouse (parallax feel) ────────────────────────────
    // Resting tilt: 0.22 rad on X so face is angled slightly toward viewer
    const targetX = 0.22 + mousePos.y * 0.26;
    const targetY = mousePos.x  * 0.20;
    tiltRef.current.rotation.x = THREE.MathUtils.lerp(
      tiltRef.current.rotation.x, targetX, 0.04
    );
    tiltRef.current.rotation.y = THREE.MathUtils.lerp(
      tiltRef.current.rotation.y, targetY, 0.04
    );

    // ── Needle tracks mouse bearing ───────────────────────────────────
    // atan2(x, y) gives the angle from +Y axis (north) toward the cursor
    const bearing = Math.atan2(mousePos.x, mousePos.y);
    needleRef.current.rotation.z = THREE.MathUtils.lerp(
      needleRef.current.rotation.z, -bearing, 0.07
    );

    // Keep frameloop="demand" running while compass is animated
    invalidate();
  });

  // Responsive X position: right-third on wide screens, center-right on medium,
  // center on mobile so it shows as an abstract glow behind text
  const posX =
    viewport.width > 7.5 ? 2.65 :
    viewport.width > 5.0 ? 1.60 :
    0.20;

  return (
    // Position group — static, responsive
    <group position={[posX, -0.15, 0]}>

      {/* ── Scene lighting ─────────────────────────────────────────── */}
      <ambientLight intensity={0.1} />
      {/* Front crimson key light */}
      <pointLight position={[0, 0, 6]}   intensity={5}   color="#dc2626" distance={18} decay={2} />
      {/* White rim from upper-left */}
      <pointLight position={[-4, 5, 4]}  intensity={1.6} color="#f8fafc" distance={20} decay={2} />
      {/* Deep red under-fill */}
      <pointLight position={[2, -4, 2]}  intensity={0.7} color="#7f1d1d" distance={14} decay={2} />

      {/* ── Tilt group — mouse parallax ───────────────────────────── */}
      <group ref={tiltRef}>

        {/* ── Build group — spring scale on entry ───────────────── */}
        <group ref={buildRef} visible={false}>

          {/* ── Outer bezel ring ─────────────────────────────────── */}
          {/* Main metallic torus */}
          <mesh>
            <torusGeometry args={[2.04, 0.235, 36, 148]} />
            <meshStandardMaterial
              color="#18181b"
              metalness={0.94}
              roughness={0.06}
            />
          </mesh>
          {/* Bevelled highlight strip on inner bezel edge */}
          <mesh>
            <torusGeometry args={[1.82, 0.042, 18, 128]} />
            <meshStandardMaterial
              color="#3f3f46"
              metalness={0.90}
              roughness={0.10}
            />
          </mesh>
          {/* Crimson glow ring — the signature TravelOS accent */}
          <mesh>
            <torusGeometry args={[1.875, 0.026, 18, 128]} />
            <meshStandardMaterial
              color="#dc2626"
              emissive="#dc2626"
              emissiveIntensity={3.8}
              metalness={0.3}
              roughness={0.2}
            />
          </mesh>

          {/* ── Compass face ─────────────────────────────────────── */}
          <mesh>
            <cylinderGeometry args={[1.80, 1.80, 0.06, 80]} />
            <meshStandardMaterial
              color="#04060d"
              roughness={0.42}
              metalness={0.22}
            />
          </mesh>

          {/* ── Degree tick ring ─────────────────────────────────── */}
          <DegreeRing />

          {/* ── Compass rose ─────────────────────────────────────── */}
          <CompassRose />

          {/* ── Needle (rotation controlled in useFrame) ─────────── */}
          <group ref={needleRef}>
            <Needle />
          </group>

          {/* ── Center pivot cap ─────────────────────────────────── */}
          <mesh position={[0, 0, 0.175]}>
            <sphereGeometry args={[0.108, 26, 26]} />
            <meshStandardMaterial
              color="#dc2626"
              emissive="#dc2626"
              emissiveIntensity={2.8}
              metalness={0.62}
              roughness={0.08}
            />
          </mesh>
          {/* Small dark ring around center cap */}
          <mesh position={[0, 0, 0.14]}>
            <torusGeometry args={[0.14, 0.018, 12, 48]} />
            <meshStandardMaterial color="#09090b" metalness={0.88} roughness={0.12} />
          </mesh>

          {/* ── Outer atmosphere glow ────────────────────────────── */}
          <mesh>
            <sphereGeometry args={[2.52, 12, 8]} />
            <meshBasicMaterial
              color="#dc2626"
              transparent
              opacity={0.014}
            />
          </mesh>

          {/* ── Hotel location marker — ready for coordinates ─────── */}
          {/* When a hotel {lat, lng} is provided, a gold pin appears on
              the compass face. Exact lat/lng → compass position mapping
              is implemented in the hotel feature milestone. */}
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
