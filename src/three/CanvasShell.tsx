'use client';

/**
 * CanvasShell — persistent R3F Canvas that lives in the root layout.
 *
 * It is always mounted; individual pages inject their 3D content via
 * the `sceneContent` tunnel (src/three/tunnel.ts). When no tunnel content
 * is active the canvas is transparent and pointer-events: none, so it
 * never blocks page interaction.
 *
 * Performance:
 *  - frameloop="demand"  — only renders when invalidated (zero idle GPU drain)
 *  - AdaptiveDpr         — caps pixel-ratio on low-end GPUs (< tier 2)
 *  - AdaptiveEvents      — pools pointer events for perf
 */

import { useRef, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import { sceneContent } from './tunnel';

// Detect rough GPU tier from device memory + hardware concurrency.
// We avoid the heavy detect-gpu package for a zero-latency estimate.
function useGPUTier(): 0 | 1 | 2 {
  const [tier, setTier] = useState<0 | 1 | 2>(1);
  useEffect(() => {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const cores = navigator.hardwareConcurrency ?? 4;
    if (mem <= 2 || cores <= 2) { setTier(0); return; }
    if (mem >= 6 && cores >= 6) { setTier(2); return; }
    setTier(1);
  }, []);
  return tier;
}

export function CanvasShell() {
  const tier = useGPUTier();
  // Cap DPR: tier-0 → 1, tier-1 → 1.5, tier-2 → 2 (clamped by device)
  const dpr: [number, number] = tier === 0 ? [1, 1] : tier === 1 ? [1, 1.5] : [1, 2];

  return (
    <div
      className="fixed inset-0 pointer-events-none z-50"
      aria-hidden="true"
    >
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: tier > 0, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        {/* All scene content is injected here from individual pages via tunnel */}
        <sceneContent.Out />
      </Canvas>
    </div>
  );
}
