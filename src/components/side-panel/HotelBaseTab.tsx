'use client';

/**
 * HotelBaseTab — the "Hotel as Base" module of the trip companion drawer.
 *
 * Lets the traveler pick (or change) the home base for the whole trip. The base
 * is stored on the itinerary JSON body (itinerary.baseLocation) via the hook's
 * setTripBase, which re-derives the map's basecamp marker — so every day's map
 * re-anchors to these coordinates (morning start / evening return).
 *
 * Search uses the existing /api/geocode endpoint (same one onboarding's
 * SmartHotelStep uses). No new tables, no new API.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { TripBaseLocation } from '@/lib/types';

type Lang = 'he' | 'en';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? '';

/** A small static-map thumbnail for a coordinate (falls back to a gradient). */
function staticMapThumb(lat: number, lng: number, w = 320, h = 150): string | null {
  if (!MAPBOX_TOKEN) return null;
  const pin = `pin-s-lodging+b8552e(${lng},${lat})`;
  return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${pin}/${lng},${lat},14,0/${w}x${h}@2x?access_token=${MAPBOX_TOKEN}`;
}

const COPY = {
  he: {
    title: 'המלון כבסיס הטיול',
    intro: 'הגדירו את המלון שלכם כנקודת המוצא של כל יום — כל המסלולים יתחילו וייגמרו כאן.',
    currentBase: 'הבסיס הנוכחי',
    setAsBase: 'הגדר מלון זה כבסיס לטיול',
    changeBase: 'שינוי הבסיס',
    removeBase: 'הסרת הבסיס',
    isBase: '✓ מוגדר כבסיס הטיול',
    searchPlaceholder: 'חפשו מלון או כתובת…',
    search: 'חיפוש',
    searching: 'מחפש…',
    empty: 'עדיין לא הוגדר בסיס לטיול',
    emptySub: 'חפשו את המלון שלכם והגדירו אותו כנקודת המוצא היומית.',
    noResults: 'לא נמצאו תוצאות — נסו שם מדויק יותר או הוסיפו את שם העיר.',
    confirmTitle: 'להגדיר כבסיס?',
    stars: 'כוכבים',
  },
  en: {
    title: 'Hotel as trip base',
    intro: 'Set your hotel as the anchor for every day — routes will start and end here.',
    currentBase: 'Current base',
    setAsBase: 'Set this hotel as the trip base',
    changeBase: 'Change base',
    removeBase: 'Remove base',
    isBase: '✓ Set as your trip base',
    searchPlaceholder: 'Search a hotel or address…',
    search: 'Search',
    searching: 'Searching…',
    empty: 'No base set for this trip yet',
    emptySub: 'Search your hotel and set it as the daily starting point.',
    noResults: 'No matches — try a more specific name or add the city.',
    confirmTitle: 'Set as base?',
    stars: 'stars',
  },
} as const;

interface GeoResult { display_name: string; lat: string; lon: string; }

interface HotelBaseTabProps {
  lang: Lang;
  destination: string;
  /** The active base (itinerary.baseLocation) or the onboarding hotel fallback. */
  base: TripBaseLocation | null;
  onSetBase: (base: TripBaseLocation | null) => void;
}

export function HotelBaseTab({ lang, destination, base, onSetBase }: HotelBaseTabProps) {
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [editing, setEditing] = useState(!base);

  return (
    <div dir={dir} className="flex flex-col gap-4">
      <div>
        <h3 className="text-[16px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>🏨 {t.title}</h3>
        <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.intro}</p>
      </div>

      {base && !editing ? (
        <CurrentBaseCard base={base} lang={lang} onChange={() => setEditing(true)} onRemove={() => onSetBase(null)} />
      ) : (
        <BaseSearch
          lang={lang}
          destination={destination}
          onCancel={base ? () => setEditing(false) : undefined}
          onConfirm={(b) => { onSetBase(b); setEditing(false); }}
        />
      )}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  const full = Math.round(n);
  return (
    <span aria-label={`${full} stars`} style={{ color: 'var(--color-sunrise)' }}>
      {'★'.repeat(Math.max(0, Math.min(5, full)))}
      <span style={{ color: 'rgba(0,0,0,0.18)' }}>{'★'.repeat(Math.max(0, 5 - full))}</span>
    </span>
  );
}

function CurrentBaseCard({ base, lang, onChange, onRemove }: {
  base: TripBaseLocation; lang: Lang; onChange: () => void; onRemove: () => void;
}) {
  const t = COPY[lang];
  const thumb = base.thumbnailUrl || staticMapThumb(base.lat, base.lng);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(43,38,34,0.12)', boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}>
      <div className="relative h-[130px] w-full" style={{ background: 'var(--color-paper-sunk)' }}>
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={base.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-4xl" style={{ opacity: 0.4 }}>🏨</div>
        )}
        <span className="absolute top-2.5 inset-inline-start-2.5 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: 'var(--color-terracotta)', color: '#fff' }}>
          {t.isBase}
        </span>
      </div>
      <div className="p-3.5 flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[15px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>{base.name}</span>
          {typeof base.stars === 'number' && base.stars > 0 && <Stars n={base.stars} />}
        </div>
        {base.address && <p className="text-[12px]" style={{ color: 'var(--color-ink-warm-mut)' }}>📍 {base.address}</p>}
        <p className="text-[11px] font-mono" style={{ color: 'rgba(107,99,88,0.72)' }}>{base.lat.toFixed(4)}, {base.lng.toFixed(4)}</p>
        <div className="flex items-center gap-2 mt-2">
          <button onClick={onChange} className="flex-1 py-2 rounded-xl text-[12.5px] font-semibold" style={{ background: 'var(--color-terracotta)', color: '#fff' }}>
            {t.changeBase}
          </button>
          <button onClick={onRemove} className="py-2 px-3 rounded-xl text-[12.5px] font-semibold" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(43,38,34,0.12)', color: 'var(--color-ink-warm)' }}>
            {t.removeBase}
          </button>
        </div>
      </div>
    </div>
  );
}

function BaseSearch({ lang, destination, onCancel, onConfirm }: {
  lang: Lang; destination: string; onCancel?: () => void; onConfirm: (base: TripBaseLocation) => void;
}) {
  const t = COPY[lang];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'empty'>('idle');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [picked, setPicked] = useState<GeoResult | null>(null);

  async function geocode(q: string): Promise<GeoResult[]> {
    // Scope results to the trip city (`near`) so a search can't return a match
    // in another city; ask for a few options rather than a single best guess.
    const params = new URLSearchParams({ q, limit: '6' });
    if (destination) params.set('near', destination);
    const res = await fetch(`/api/geocode?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json().catch(() => []);
    return Array.isArray(data) ? data : [];
  }

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus('loading');
    setPicked(null);
    try {
      const found = await geocode(q);
      setResults(found.slice(0, 6));
      setStatus(found.length ? 'done' : 'empty');
    } catch {
      setStatus('empty');
    }
  }

  function confirm(r: GeoResult) {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const name = r.display_name.split(',')[0]?.trim() || r.display_name;
    onConfirm({ name, address: r.display_name, lat, lng, thumbnailUrl: staticMapThumb(lat, lng) });
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
          placeholder={t.searchPlaceholder}
          className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none"
          style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(43,38,34,0.14)', color: 'var(--color-ink-warm)' }}
        />
        <button
          onClick={handleSearch}
          disabled={query.trim().length < 3 || status === 'loading'}
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--color-terracotta)', color: '#fff' }}
        >
          {status === 'loading' ? t.searching : t.search}
        </button>
      </div>

      {/* Empty prompt before searching */}
      {status === 'idle' && (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1px dashed rgba(43,38,34,0.18)' }}>
          <div className="text-3xl mb-2">🏨</div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-ink-warm)' }}>{t.empty}</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.emptySub}</p>
        </div>
      )}

      {status === 'empty' && (
        <p className="text-[12.5px] px-1" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.noResults}</p>
      )}

      {/* Results */}
      {status === 'done' && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => {
            const on = picked === r;
            return (
              <motion.button
                key={`${r.lat}-${r.lon}-${i}`}
                whileTap={{ scale: 0.99 }}
                onClick={() => setPicked(r)}
                className="flex items-start gap-2.5 p-3 rounded-xl text-start transition-colors"
                style={{ background: on ? 'var(--color-terracotta-soft)' : 'rgba(255,255,255,0.6)', border: on ? '1px solid var(--color-terracotta)' : '1px solid rgba(43,38,34,0.12)' }}
              >
                <span className="text-lg leading-none mt-0.5">📍</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--color-ink-warm)' }}>{r.display_name.split(',')[0]}</span>
                  <span className="block text-[11.5px] truncate" style={{ color: 'var(--color-ink-warm-mut)' }}>{r.display_name}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Confirm actions */}
      {(picked || onCancel) && (
        <div className="flex items-center gap-2 pt-1">
          {onCancel && (
            <button onClick={onCancel} className="py-2.5 px-4 rounded-xl text-[13px] font-semibold" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(43,38,34,0.12)', color: 'var(--color-ink-warm-mut)' }}>
              ✕
            </button>
          )}
          <button
            onClick={() => picked && confirm(picked)}
            disabled={!picked}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-40"
            style={{ background: 'var(--color-terracotta)', color: '#fff' }}
          >
            {t.setAsBase}
          </button>
        </div>
      )}
    </div>
  );
}
