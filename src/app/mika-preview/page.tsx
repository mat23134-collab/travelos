'use client';

/**
 * /mika-preview — internal QA page for the Mika avatar art.
 *
 * Drop your four transparent cut-outs in /public/mika/ (idle/thinking/success/
 * correction .png) and open this page to eyeball each state, the hat pop-out,
 * the thinking glow, and the crossfade — against light/paper/dark backgrounds
 * so you can catch any leftover background fringe on the transparency.
 */

import { useEffect, useState } from 'react';
import { MikaAvatar, type MikaState } from '@/components/MikaAvatar';

const STATES: { key: MikaState; label: string; note: string }[] = [
  { key: 'idle',       label: 'Idle / Listening', note: 'warm smile, gentle breathe' },
  { key: 'thinking',   label: 'Thinking',         note: 'compass glows blue, pulsing' },
  { key: 'success',    label: 'Winning Pick',     note: 'excited, points at the card' },
  { key: 'correction', label: 'Friendly Correction', note: 'one finger up, knowing smile' },
];

const BACKGROUNDS = [
  { key: 'paper', label: 'Paper', css: 'var(--color-paper)' },
  { key: 'white', label: 'White', css: '#ffffff' },
  { key: 'dark',  label: 'Dark',  css: '#0d1a17' },
] as const;

export default function MikaPreviewPage() {
  const [bg, setBg] = useState<typeof BACKGROUNDS[number]['key']>('paper');
  const [size, setSize] = useState(150);
  const [cycle, setCycle] = useState<MikaState>('idle');

  // Auto-cycle the big hero avatar so you can preview the crossfades live.
  useEffect(() => {
    const order: MikaState[] = ['idle', 'thinking', 'success', 'correction'];
    let i = 0;
    const id = setInterval(() => { i = (i + 1) % order.length; setCycle(order[i]); }, 1600);
    return () => clearInterval(id);
  }, []);

  const bgCss = BACKGROUNDS.find((b) => b.key === bg)!.css;
  const isDark = bg === 'dark';
  const ink = isDark ? '#f1ece3' : 'var(--color-ink-warm)';

  return (
    <main className="min-h-screen p-6 sm:p-10" style={{ background: bgCss, color: ink }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Mika — avatar preview</h1>
        <p className="text-sm mb-6" style={{ opacity: 0.7 }}>
          Files expected in <code>/public/mika/</code>: idle.png · thinking.png · success.png · correction.png (transparent).
          Missing files fall back to idle, then to the inline SVG.
        </p>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest" style={{ opacity: 0.6 }}>Background</span>
            {BACKGROUNDS.map((b) => (
              <button
                key={b.key}
                onClick={() => setBg(b.key)}
                className="px-3 py-1.5 rounded-lg text-[13px] font-semibold"
                style={{
                  background: bg === b.key ? 'var(--color-terracotta)' : 'rgba(128,128,128,0.15)',
                  color: bg === b.key ? '#fff' : ink,
                }}
              >
                {b.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-xs uppercase tracking-widest" style={{ opacity: 0.6 }}>Size</span>
            <input type="range" min={48} max={240} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            <span>{size}px</span>
          </label>
        </div>

        {/* Live auto-cycling hero */}
        <div className="flex items-center gap-5 mb-10 p-5 rounded-2xl" style={{ background: 'rgba(128,128,128,0.08)' }}>
          <MikaAvatar size={size} state={cycle} />
          <div>
            <div className="text-xs uppercase tracking-widest" style={{ opacity: 0.6 }}>Live crossfade</div>
            <div className="text-lg font-bold capitalize">{cycle}</div>
            <p className="text-[13px]" style={{ opacity: 0.7 }}>Auto-cycling every 1.6s — watch the swap + glow.</p>
          </div>
        </div>

        {/* All four states side by side */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {STATES.map((s) => (
            <div key={s.key} className="flex flex-col items-center text-center gap-2">
              <MikaAvatar size={size} state={s.key} />
              <div className="text-[13px] font-bold">{s.label}</div>
              <div className="text-[11px]" style={{ opacity: 0.65 }}>{s.note}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
