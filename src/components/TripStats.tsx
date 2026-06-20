'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useInView, animate } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';

export interface StatDetailRow {
  name: string;
  /** Single day this row belongs to. */
  day?: number;
  /** Multiple days (e.g. a neighborhood visited on several days). */
  days?: number[];
  /** Slot/kind, e.g. "Morning" or "Dinner". */
  sub?: string;
}

export interface StatDetail {
  title: string;
  rows: StatDetailRow[];
}

export interface StatItem {
  value: number | string;
  label: string;
  /** Decorative emoji watermarked into the card. */
  icon?: string;
  /** When present (and non-empty), the card is clickable and opens a list panel. */
  detail?: StatDetail;
}

/** Animates a number from 0 → `to` the first time it scrolls into view. */
function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, to, { duration: 1.1, ease: 'easeOut', onUpdate: (v) => setVal(Math.round(v)) });
    return () => controls.stop();
  }, [inView, to]);

  return <span ref={ref}>{val}</span>;
}

function DayBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-terracotta-deep)' }}
    >
      {children}
    </span>
  );
}

function StatModal({ detail, onClose }: { detail: StatDetail; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative z-10 w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col"
        style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-soft)', maxHeight: '82dvh' }}
        initial={{ y: '100%', scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: '60%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 32 }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="font-display italic text-2xl" style={{ color: 'var(--color-ink-warm)' }}>{detail.title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm)' }}
          >
            ✕
          </button>
        </div>

        <ul className="overflow-y-auto px-5 pb-6">
          {detail.rows.map((row, i) => (
            <li
              key={`${row.name}-${i}`}
              className="flex items-center justify-between gap-3 py-2.5"
              style={{ borderTop: i ? '1px solid rgba(43,38,34,0.08)' : 'none' }}
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink-warm)' }}>{row.name}</p>
                {row.sub && <p className="text-[11px]" style={{ color: 'var(--color-ink-warm-mut)' }}>{row.sub}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-1 flex-shrink-0">
                {row.days?.length
                  ? row.days.map((d) => <DayBadge key={d}>Day {d}</DayBadge>)
                  : row.day != null && <DayBadge>Day {row.day}</DayBadge>}
              </div>
            </li>
          ))}
        </ul>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Floating stat strip that overlaps the hero above it. Clickable cards open a list panel. */
export function TripStats({ items, photoQuery }: { items: StatItem[]; photoQuery?: string }) {
  const shown = items.filter((it) => it.value !== 0 && it.value !== '' && it.value != null);
  const [open, setOpen] = useState<StatDetail | null>(null);
  if (shown.length === 0) return null;

  return (
    <>
      <div className="relative z-10 mx-3 sm:mx-12 -mt-10 sm:-mt-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {shown.map((it, i) => {
            const clickable = !!it.detail && it.detail.rows.length > 0;
            return (
              <motion.button
                key={it.label}
                type="button"
                disabled={!clickable}
                onClick={clickable ? () => setOpen(it.detail!) : undefined}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
                whileHover={clickable ? { y: -3 } : undefined}
                whileTap={clickable ? { scale: 0.97 } : undefined}
                className={`relative overflow-hidden rounded-2xl text-center ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
              >
                {/* Faint cinematic destination photo */}
                {photoQuery && (
                  <div className="absolute inset-0">
                    <DayPhoto query={photoQuery} alt="" height={120} dark hideCredit />
                  </div>
                )}
                {/* Warm scrim — keeps it a warm card, photo reads as subtle texture */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(155deg, rgba(239,227,205,0.80) 0%, rgba(228,212,184,0.90) 100%)' }}
                />
                {/* Icon watermark fills the empty space */}
                {it.icon && (
                  <span aria-hidden className="absolute -bottom-3 end-1.5 text-[58px] leading-none opacity-[0.10] select-none pointer-events-none">
                    {it.icon}
                  </span>
                )}

                <div className="relative px-4 py-4">
                  <div className="font-display text-2xl sm:text-3xl leading-none tabular-nums" style={{ color: 'var(--color-terracotta-deep)' }}>
                    {typeof it.value === 'number' ? <CountUp to={it.value} /> : it.value}
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-ink-warm)' }}>
                    {it.label}
                    {clickable && <span aria-hidden style={{ color: 'var(--color-terracotta-deep)' }}>›</span>}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {open && <StatModal detail={open} onClose={() => setOpen(null)} />}
      </AnimatePresence>
    </>
  );
}
