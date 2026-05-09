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
  onSave: (counts: FamilyKidsByAge) => void;
  onCancel: () => void;
};

const PRIMARY = '#9e363a';
const MUTED = '#4f5f76';

function clampCount(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(12, Math.floor(n));
}

export function FamilyKidsModal({ open, initial, onSave, onCancel }: Props) {
  const [counts, setCounts] = useState<FamilyKidsByAge>(() => emptyFamilyKidsByAge());

  useEffect(() => {
    if (!open) return;
    const next = emptyFamilyKidsByAge();
    for (const k of FAMILY_CHILD_AGE_BANDS) {
      const v = initial?.[k];
      next[k] = v != null && v > 0 ? clampCount(v) : 0;
    }
    setCounts(next);
  }, [open, initial]);

  if (!open) return null;

  const total = totalFamilyKids(counts);
  const canSave = total >= 1;

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
          Children on this trip
        </h3>
        <p className="text-sm mb-1" style={{ color: MUTED }}>
          How many kids fall in each age band? We use this for stroller access, nap windows, and kid-friendly pacing.
        </p>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.38)' }} dir="rtl">
          כמה ילדים בכל טווח גילים? (שנים) — נשתמש בזה לקצב מתאים למשפחות, מנוחות ונגישות.
        </p>

        <div className="space-y-3 mb-6">
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

        <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Total children: <span className="font-bold text-white">{total}</span>
          {total < 1 && ' — add at least one child, or go back and pick another travel style.'}
        </p>

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
            onClick={() => canSave && onSave(counts)}
          >
            Save
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
