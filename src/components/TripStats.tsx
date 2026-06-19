'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';

export interface StatItem {
  value: number | string;
  label: string;
}

/** Animates a number from 0 → `to` the first time it scrolls into view. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to]);

  return <span ref={ref}>{val}</span>;
}

/** Floating stat strip that overlaps the hero above it. Hidden items (falsy value) are dropped. */
export function TripStats({ items }: { items: StatItem[] }) {
  const shown = items.filter((it) => it.value !== 0 && it.value !== '' && it.value != null);
  if (shown.length === 0) return null;

  return (
    <div className="relative z-10 mx-3 sm:mx-12 -mt-10 sm:-mt-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {shown.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
            className="rounded-2xl px-4 py-4 text-center"
            style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
          >
            <div
              className="font-display text-2xl sm:text-3xl leading-none tabular-nums"
              style={{ color: 'var(--color-ink-warm)' }}
            >
              {typeof it.value === 'number' ? <CountUp to={it.value} /> : it.value}
            </div>
            <div
              className="mt-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-ink-warm-mut)' }}
            >
              {it.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
