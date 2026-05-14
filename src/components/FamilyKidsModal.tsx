'use client';

import { useEffect, useState } from 'react';
import type { FamilyKidsByAge } from '@/lib/types';
import {
  FAMILY_BAND_LABEL,
  FAMILY_CHILD_AGE_BANDS,
  emptyFamilyKidsByAge,
  totalFamilyKids,
} from '@/lib/familyKids';

type Props = {
  open: boolean;
  initial: FamilyKidsByAge | null | undefined;
  initialParents?: 1 | 2;
  /** Receives both the kids breakdown AND the parents count */
  onSave: (counts: FamilyKidsByAge, parents: 1 | 2) => void;
  onCancel: () => void;
};

const PRIMARY = '#9e363a';
const MUTED = '#4f5f76';

function clampCount(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(12, Math.floor(n));
}

export function FamilyKidsModal({ open, initial, initialParents, onSave, onCancel }: Props) {
  const [counts, setCounts] = useState<FamilyKidsByAge>(() => emptyFamilyKidsByAge());
  const [parents, setParents] = useState<1 | 2>(initialParents ?? 2);

  useEffect(() => {
    if (!open) return;
    const next = emptyFamilyKidsByAge();
    for (const k of FAMILY_CHILD_AGE_BANDS) {
      const v = initial?.[k];
      next[k] = v != null && v > 0 ? clampCount(v) : 0;
    }
    setCounts(next);
    setParents(initialParents ?? 2);
  }, [open, initial, initialParents]);

  if (!open) return null;

  const totalKids = totalFamilyKids(counts);
  const totalPeople = parents + totalKids;
  const canSave = totalKids >= 1;

  const bump = (key: (typeof FAMILY_CHILD_AGE_BANDS)[number], delta: number) => {
    setCounts((prev) => {
      const cur = clampCount(prev[key] ?? 0);
      return { ...prev, [key]: clampCount(cur + delta) };
    });
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center px-4 py-8"
      style={{ background: 'rgba(7,22,41,0.85)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-kids-title"
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-7"
        style={{ background: '#0b1d35', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <h3
          id="family-kids-title"
          className="text-xl font-black mb-1"
          style={{ letterSpacing: '-0.02em', color: '#fff' }}
        >
          Who's coming?
        </h3>
        <p className="text-sm mb-6" style={{ color: MUTED }}>
          Tell us how many parents and kids are on this trip — we'll use it for pacing, room sizing, and kid-friendly picks.
        </p>

        {/* ── Parents ──────────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Parents / Adults
        </p>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {([1, 2] as const).map((n) => {
            const selected = parents === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setParents(n)}
                className="flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-colors"
                style={
                  selected
                    ? { background: 'rgba(158,54,58,0.20)', border: `1.5px solid ${PRIMARY}`, color: '#fff' }
                    : { background: 'rgba(15,40,98,0.35)', border: '1.5px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.70)' }
                }
              >
                <span className="text-base">{n === 1 ? '🧑' : '👫'}</span>
                {n === 1 ? '1 Parent' : '2 Parents'}
                {selected && <span className="ml-1 text-xs" style={{ color: PRIMARY }}>✓</span>}
              </button>
            );
          })}
        </div>

        {/* ── Children ─────────────────────────────────────────────────────── */}
        <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
          Children by age band
        </p>

        <div className="space-y-3 mb-5">
          {FAMILY_CHILD_AGE_BANDS.map((band) => {
            const n = clampCount(counts[band] ?? 0);
            const label = `${FAMILY_BAND_LABEL[band].en} yrs`;
            return (
              <div
                key={band}
                className="flex items-center justify-between gap-4 rounded-xl px-4 py-3"
                style={{ background: 'rgba(15,40,98,0.35)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <span className="text-sm font-medium text-white/90 shrink-0">{label}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Decrease ${label}`}
                    className="w-9 h-9 rounded-lg text-lg font-bold leading-none"
                    style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                    onClick={() => bump(band, -1)}
                    disabled={n <= 0}
                  >
                    −
                  </button>
                  <span
                    className="min-w-[2rem] text-center tabular-nums text-base font-bold"
                    style={{ color: PRIMARY }}
                  >
                    {n}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase ${label}`}
                    className="w-9 h-9 rounded-lg text-lg font-bold leading-none"
                    style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                    onClick={() => bump(band, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Summary ──────────────────────────────────────────────────────── */}
        <div
          className="rounded-xl px-4 py-3 mb-6 flex items-center justify-between"
          style={{ background: 'rgba(158,54,58,0.10)', border: '1px solid rgba(158,54,58,0.25)' }}
        >
          <span className="text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Total travelers
          </span>
          <span className="text-lg font-black" style={{ color: '#fff' }}>
            {totalPeople} <span className="text-sm font-normal" style={{ color: 'rgba(255,255,255,0.45)' }}>
              ({parents} {parents === 1 ? 'parent' : 'parents'} + {totalKids} {totalKids === 1 ? 'child' : 'children'})
            </span>
          </span>
        </div>

        {!canSave && (
          <p className="text-xs mb-4 text-center" style={{ color: 'rgba(255,255,255,0.40)' }}>
            Add at least one child, or go back and pick another travel style.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            className="flex-1 py-3.5 rounded-xl text-sm font-bold"
            style={{
              background: canSave ? PRIMARY : 'rgba(158,54,58,0.35)',
              color: '#fff',
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            disabled={!canSave}
            onClick={() => canSave && onSave(counts, parents)}
          >
            Save — {totalPeople} travelers
          </button>
          <button
            type="button"
            className="flex-1 py-3.5 rounded-xl text-sm font-semibold"
            style={{ border: '1px solid rgba(255,255,255,0.14)', color: 'rgba(255,255,255,0.85)' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
