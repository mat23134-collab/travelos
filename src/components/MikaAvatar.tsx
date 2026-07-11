'use client';

/**
 * MikaAvatar — the assistant's animated 3D character ("Mika").
 *
 * State-driven: swaps between four rendered poses via a smooth opacity
 * crossfade (all layers preloaded, so there's no load-flash on swap). Her hat
 * pops slightly above the circular frame for a dimensional, "sticker" feel, and
 * her compass glows in the thinking state.
 *
 * Lightweight by design — pure <img> layers + CSS transitions/keyframes, no
 * WebGL/rendering engine.
 *
 * ── Assets you provide ────────────────────────────────────────────────────────
 * Drop four TRANSPARENT PNG/WebP cut-outs (same character, same framing) in
 * /public/mika/:  idle.png · thinking.png · success.png · correction.png
 * Transparent background is what lets the hat break out of the circle. If a file
 * is missing it falls back to idle; if idle is missing too, a tiny inline SVG
 * placeholder renders — so the UI never breaks while you're producing art.
 */

import { useEffect, useState } from 'react';
import { AssistantAvatar } from '@/components/AssistantAvatar';

export type MikaState = 'idle' | 'thinking' | 'success' | 'correction';

const STATES: MikaState[] = ['idle', 'thinking', 'success', 'correction'];
const SRC = (s: MikaState) => `/mika/${s}.png`;

export function MikaAvatar({
  state = 'idle',
  size = 56,
  className = '',
}: {
  state?: MikaState;
  size?: number;
  className?: string;
}) {
  // Track which pose files actually loaded; fall back gracefully otherwise.
  const [loaded, setLoaded] = useState<Record<MikaState, boolean>>({
    idle: false, thinking: false, success: false, correction: false,
  });
  const [idleFailed, setIdleFailed] = useState(false);

  // Resolve the pose to show: requested → idle fallback.
  const shown: MikaState = loaded[state] ? state : 'idle';

  // No usable art yet → inline SVG placeholder (keeps the chat alive).
  if (idleFailed && !STATES.some((s) => loaded[s])) {
    return <AssistantAvatar size={size} className={className} />;
  }

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size, overflow: 'visible' }}
      aria-label="Mika, your travel assistant"
      role="img"
    >
      {/* Circular frame / backdrop */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: 'radial-gradient(120% 120% at 50% 25%, #124a42 0%, #0d2b27 70%)',
          boxShadow: 'inset 0 1px 3px rgba(255,255,255,0.12), 0 6px 16px -6px rgba(0,0,0,0.5)',
        }}
      />

      {/* Compass glow — only while thinking (positioned lower-centre, over the gadget) */}
      {state === 'thinking' && (
        <div
          className="mika-glow absolute rounded-full pointer-events-none"
          style={{
            left: '50%', bottom: '6%', width: size * 0.5, height: size * 0.5,
            transform: 'translateX(-50%)',
            background: 'radial-gradient(circle, rgba(56,208,255,0.9) 0%, rgba(56,208,255,0) 70%)',
            filter: 'blur(1px)',
          }}
        />
      )}

      {/* Character layers — all preloaded, crossfaded by opacity. Bottom-aligned
          and taller than the frame so the hat overflows above (pop-out). */}
      <div className={`absolute inset-0 ${state === 'idle' ? 'mika-breathe' : ''}`} style={{ overflow: 'visible' }}>
        {STATES.map((s) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s}
            src={SRC(s)}
            alt=""
            aria-hidden
            onLoad={() => setLoaded((m) => (m[s] ? m : { ...m, [s]: true }))}
            onError={() => { if (s === 'idle') setIdleFailed(true); }}
            className="absolute left-1/2 bottom-0"
            style={{
              width: size * 1.12,
              height: 'auto',
              transform: 'translateX(-50%)',
              transformOrigin: 'bottom center',
              opacity: s === shown ? 1 : 0,
              transition: 'opacity 260ms ease',
              filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.35))',
              // clip nothing at the top (hat pops out); mask the bottom to the disc
              WebkitMaskImage: 'radial-gradient(140% 100% at 50% 100%, #000 78%, transparent 100%)',
              maskImage: 'radial-gradient(140% 100% at 50% 100%, #000 78%, transparent 100%)',
            }}
          />
        ))}
      </div>
    </div>
  );
}
