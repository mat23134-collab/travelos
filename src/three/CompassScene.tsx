'use client';

/**
 * CompassScene — R3F wireframe globe with crimson glow.
 *
 * Lives inside the persistent R3F Canvas (via the sceneContent tunnel).
 * Reads mouse position from the module-level mousePos object (written by
 * CanvasShell's window.mousemove listener) — canvas itself stays
 * pointer-events: none so HTML buttons remain fully clickable.
 *
 * Animation:
 *  - Continuous slow Y-axis auto-rotation
 *  - Smooth tilt toward cursor (mousePos.x → extra Y, mousePos.y → X)
 *  - Calls invalidate() each frame to keep frameloop="demand" running
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { mousePos } from './mouseStore';

export function CompassScene() {
  const groupRef   = useRef<THREE.Group>(null);
  const autoRotY   = useRef(0);
  const { invalidate } = useThree();

  // Bootstrap the demand loop on mount
  useEffect(() => {
    invalidate();
  }, [invalidate]);

  useFrame(() => {
    if (!groupRef.current) return;

    // Idle auto-rotation
    autoRotY.current += 0.0025;

    // Target rotations including mouse offset
    const targetX =  mousePos.y * 0.35;
    const targetY =  autoRotY.current + mousePos.x * 0.18;

    // Smooth lerp toward targets
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x, targetX, 0.035
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y, targetY, 0.035
    );

    // Keep the demand loop alive
    invalidate();
  });

  return (
    // Position: right-center of scene. Camera at z=5, fov=50 →
    // at z=0 scene width ≈ 9.3 units for 16:9. x=3.2 puts the
    // center in the right third, radius=2.2 partially crops off-screen.
    <group ref={groupRef} position={[3.2, -0.1, -0.5]}>

      {/* ── Lights ─────────────────────────────────────────────────── */}
      <ambientLight intensity={0.08} />
      {/* Key crimson point light — front face glow */}
      <pointLight position={[0, 0, 4]}   intensity={3.5} color="#dc2626" distance={14} decay={2} />
      {/* Soft white rim from upper-left */}
      <pointLight position={[-3, 4, 3]}  intensity={0.9} color="#ffffff" distance={12} decay={2} />
      {/* Warm fill from below */}
      <pointLight position={[1, -3, 2]}  intensity={0.4} color="#7f1d1d" distance={10} decay={2} />

      {/* ── Wireframe sphere — primary globe structure ───────────────── */}
      <mesh>
        <sphereGeometry args={[2.2, 40, 26]} />
        <meshBasicMaterial
          color="#dc2626"
          wireframe
          transparent
          opacity={0.09}
        />
      </mesh>

      {/* ── Dark inner fill — so the far-side wireframe reads clearly ── */}
      <mesh>
        <sphereGeometry args={[2.17, 20, 14]} />
        <meshStandardMaterial
          color="#050709"
          transparent
          opacity={0.75}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* ── Equator ring — brightest accent line ────────────────────── */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.2, 0.008, 10, 140]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={3}
          transparent
          opacity={0.95}
          roughness={0.1}
          metalness={0.5}
        />
      </mesh>

      {/* ── Prime meridian ring ─────────────────────────────────────── */}
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={[2.2, 0.006, 10, 140]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={2.2}
          transparent
          opacity={0.8}
          roughness={0.15}
          metalness={0.5}
        />
      </mesh>

      {/* ── Diagonal accent ring (compass bearing line) ──────────────── */}
      <mesh rotation={[Math.PI / 4, 0, Math.PI / 5]}>
        <torusGeometry args={[2.2, 0.004, 8, 120]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={1.4}
          transparent
          opacity={0.45}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>

      {/* ── North needle — sharpest crimson point ───────────────────── */}
      <mesh position={[0, 2.36, 0]}>
        <coneGeometry args={[0.072, 0.52, 10]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={5}
          roughness={0.05}
          metalness={0.8}
        />
      </mesh>

      {/* ── South marker — subtler ──────────────────────────────────── */}
      <mesh position={[0, -2.36, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.05, 0.32, 10]} />
        <meshStandardMaterial
          color="#dc2626"
          emissive="#dc2626"
          emissiveIntensity={2.5}
          transparent
          opacity={0.55}
          roughness={0.1}
        />
      </mesh>

      {/* ── Outer glow halo — large faint sphere for bloom effect ──── */}
      <mesh>
        <sphereGeometry args={[2.85, 10, 8]} />
        <meshBasicMaterial
          color="#dc2626"
          transparent
          opacity={0.018}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}
