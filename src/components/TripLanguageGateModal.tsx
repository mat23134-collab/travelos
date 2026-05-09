'use client';

import type { TripLanguage } from '@/lib/types';

const PRIMARY = '#9e363a';
const MUTED = '#4f5f76';

type Props = {
  open: boolean;
  onSelect: (lang: TripLanguage) => void;
  /** Omit to hide the cancel control */
  onCancel?: () => void;
  cancelLabel?: string;
};

export function TripLanguageGateModal({ open, onSelect, onCancel, cancelLabel = 'Cancel' }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center px-4"
      style={{ background: 'rgba(7,22,41,0.82)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="trip-lang-gate-title"
    >
      <div
        className="w-full max-w-md rounded-2xl p-7"
        style={{ background: '#0b1d35', border: '1px solid rgba(255,255,255,0.10)' }}
      >
        <h3
          id="trip-lang-gate-title"
          className="text-xl font-black mb-2"
          style={{ letterSpacing: '-0.02em', color: '#fff' }}
        >
          Result language
        </h3>
        <p className="text-sm mb-1" style={{ color: MUTED }}>
          Choose the language for your trip plan text and on-page tips. Venue and place names stay in English for maps and search.
        </p>
        <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }} dir="rtl">
          בחרו שפה לטקסטים והסברים בטיול. שמות מקומות יישארו באנגלית למפות ולחיפוש.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            className="px-4 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
            style={{ background: PRIMARY, color: '#fff' }}
            onClick={() => onSelect('en')}
          >
            English
          </button>
          <button
            type="button"
            className="px-4 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
            style={{
              background: 'rgba(15,40,98,0.55)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff',
            }}
            onClick={() => onSelect('he')}
          >
            עברית
          </button>
        </div>
        {onCancel && (
          <button
            type="button"
            className="w-full py-3 rounded-xl text-sm font-semibold"
            style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
        )}
      </div>
    </div>
  );
}
