'use client';

/**
 * CanvasShell — persistent R3F Canvas that lives in the root layout.
 *
 * Architecture:
 *  - Mounted once at z-0 (background layer). HTML content sits above it
 *    naturally at its own z-index — no z-fighting, no click interception.
 *  - pointer-events: none on BOTH the wrapper div AND the <canvas> element
 *    so clicks always pass through to the HTML UI layer.
 *  - Individual pages inject 3D content via the sceneContent tunnel
 *    (src/three/tunnel.ts). When no content is active the canvas is
 *    transparent and invisible.
 *
 * Mouse reactivity WITHOUT canvas pointer events:
 *  - A window.mousemove listener (passive, no scroll cost) writes the
 *    normalized cursor position into the module-level mousePos object
 *    (src/three/mouseStore.ts).
 *  - R3F scene components read mousePos inside useFrame to tilt/rotate.
 *  - The canvas itself NEVER receives pointer events.
 *
 * Performance:
 *  - frameloop="demand"  — renders only when a scene calls invalidate()
 *  - AdaptiveDpr         — caps pixel-ratio on low-end hardware
 */

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { sceneContent } from './tunnel';
import { mousePos } from './mouseStore';

function useGPUTier(): 0 | 1 | 2 {
  const [tier, setTier] = useState<0 | 1 | 2>(1);
  useEffect(() => {
    const mem   = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 2) { setTier(0); return; }
    if (mem >= 6 && cores >= 6) { setTier(2); return; }
    setTier(1);
  }, []);
  return tier;
}

export function CanvasShell() {
  const tier = useGPUTier();
  const dpr: [number, number] = tier === 0 ? [1, 1] : tier === 1 ? [1, 1.5] : [1, 2];

  // Listen for mouse movement on the HTML layer (canvas has pointer-events:none
  // so we cannot use R3F's built-in raycaster events). The normalized values
  // are written into mousePos and consumed by scene components in useFrame.
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mousePos.x = (e.clientX / window.innerWidth)  *  2 - 1;
      mousePos.y = (e.clientY / window.innerHeight) * -2 + 1;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  return (
    // Keep canvas on base layer; individual pages place UI above it with
    // local z-index where needed. Pointer events stay disabled.
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      aria-hidden="true"
    >
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: tier > 0, alpha: true, powerPreference: 'high-performance' }}
        // Also set pointerEvents:none on the <canvas> DOM element directly —
        // R3F overrides inherited CSS on its canvas, so this explicit inline
        // style is required as a belt-and-suspenders guarantee.
        style={{ background: 'transparent', pointerEvents: 'none' }}
      >
        <AdaptiveDpr pixelated />
        <sceneContent.Out />
      </Canvas>
    </div>
  );
}
