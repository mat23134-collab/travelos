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

import { useState, useRef } from 'react';
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
    orUpload: 'או העלו תמונה של המלון',
    uploadPhoto: 'העלו תמונה של המלון',
    scanning: 'סורק את התמונה…',
    fromPhoto: (n: string) => `זוהה מהתמונה: ${n}`,
    photoNoResult: 'לא זיהינו מלון בתמונה — נסו תמונה ברורה יותר או חיפוש בטקסט.',
    priceTitle: 'מחיר המלון לכל התקופה',
    priceHint: 'המחיר יתווסף אוטומטית לתקציב הקלסר (קטגוריית לינה).',
    pricePlaceholder: 'סכום',
    savePrice: 'שמירה',
    saved: '✓ נשמר',
    scanConfirmation: 'סרקו אישור הזמנה למילוי המחיר',
    scanningPrice: 'קורא את האישור…',
    priceFromScan: (n: string) => `מהאישור: ${n}`,
    scanNoPrice: 'לא נמצא מחיר באישור — הזינו ידנית.',
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
    orUpload: 'or upload a photo of the hotel',
    uploadPhoto: 'Upload a photo of the hotel',
    scanning: 'Scanning the photo…',
    fromPhoto: (n: string) => `Read from photo: ${n}`,
    photoNoResult: "Couldn't spot a hotel in that photo — try a clearer one or search by text.",
    priceTitle: 'Hotel price for the whole stay',
    priceHint: 'Added to the Binder budget automatically (accommodation).',
    pricePlaceholder: 'Amount',
    savePrice: 'Save',
    saved: '✓ Saved',
    scanConfirmation: 'Scan a booking confirmation to fill the price',
    scanningPrice: 'Reading the confirmation…',
    priceFromScan: (n: string) => `From confirmation: ${n}`,
    scanNoPrice: 'No price found in that confirmation — enter it manually.',
  },
} as const;

interface LocateResult { name: string; address: string | null; lat: number; lng: number; photoUrl?: string | null; }
const ACCEPTED_IMG = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface HotelBaseTabProps {
  lang: Lang;
  destination: string;
  /** The active base (itinerary.baseLocation) or the onboarding hotel fallback. */
  base: TripBaseLocation | null;
  onSetBase: (base: TripBaseLocation | null) => void;
  /** Trip id + token so the hotel price can maintain an accommodation budget line. */
  itineraryId: string | null;
  accessToken: string | null;
}

export function HotelBaseTab({ lang, destination, base, onSetBase, itineraryId, accessToken }: HotelBaseTabProps) {
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [editing, setEditing] = useState(!base);

  const canBudget = !!itineraryId && !!accessToken;
  const authHeaders = (): HeadersInit => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` });

  // Create/update the accommodation budget line this hotel owns, returning its id.
  async function upsertHotelBudgetLine(b: TripBaseLocation, price: number, currency: string): Promise<string | null> {
    if (!canBudget) return b.budgetItemId ?? null;
    try {
      const res = await fetch('/api/trip-budget', {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          itineraryId, id: b.budgetItemId ?? undefined,
          label: b.name, category: 'accommodation',
          plannedCost: price, actualCost: price, currency, status: 'booked',
        }),
      });
      if (!res.ok) return b.budgetItemId ?? null;
      const data = (await res.json().catch(() => ({}))) as { item?: { id?: string } };
      return data.item?.id ?? b.budgetItemId ?? null;
    } catch { return b.budgetItemId ?? null; }
  }

  async function deleteHotelBudgetLine(id: string) {
    if (!canBudget || !id) return;
    try {
      await fetch('/api/trip-budget', { method: 'DELETE', headers: authHeaders(), body: JSON.stringify({ itineraryId, id }) });
    } catch { /* best-effort */ }
  }

  async function savePrice(price: number | null, currency: string) {
    if (!base) return;
    if (price == null || price <= 0) {
      if (base.budgetItemId) await deleteHotelBudgetLine(base.budgetItemId);
      onSetBase({ ...base, totalPrice: null, currency, budgetItemId: null });
      return;
    }
    const budgetItemId = await upsertHotelBudgetLine(base, price, currency);
    onSetBase({ ...base, totalPrice: price, currency, budgetItemId });
  }

  async function removeBase() {
    if (base?.budgetItemId) await deleteHotelBudgetLine(base.budgetItemId);
    onSetBase(null);
  }

  return (
    <div dir={dir} className="flex flex-col gap-4">
      <div>
        <h3 className="text-[16px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>🏨 {t.title}</h3>
        <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.intro}</p>
      </div>

      {base && !editing ? (
        <>
          <CurrentBaseCard base={base} lang={lang} onChange={() => setEditing(true)} onRemove={removeBase} />
          {canBudget && <HotelPriceEditor base={base} lang={lang} onSave={savePrice} />}
        </>
      ) : (
        <BaseSearch
          lang={lang}
          destination={destination}
          onCancel={base ? () => setEditing(false) : undefined}
          onConfirm={(b) => { onSetBase({ ...b, totalPrice: base?.totalPrice ?? null, currency: base?.currency ?? null, budgetItemId: base?.budgetItemId ?? null }); setEditing(false); }}
        />
      )}
    </div>
  );
}

/** Total-stay price + currency, with an optional confirmation scan that fills it.
 *  Saving pushes the amount into the Binder budget via the parent's onSave. */
function HotelPriceEditor({ base, lang, onSave }: {
  base: TripBaseLocation; lang: Lang; onSave: (price: number | null, currency: string) => Promise<void>;
}) {
  const t = COPY[lang];
  const [price, setPrice] = useState(base.totalPrice != null ? String(base.totalPrice) : '');
  const [currency, setCurrency] = useState(base.currency || 'ILS');
  const [status, setStatus] = useState<'idle' | 'scanning' | 'saving' | 'saved' | 'noprice'>('idle');
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function scanForPrice(file: File | null | undefined) {
    if (!file || !ACCEPTED_IMG.includes(file.type)) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    }).catch(() => '');
    if (fileRef.current) fileRef.current.value = '';
    if (!dataUrl) return;
    setStatus('scanning');
    try {
      const res = await fetch('/api/scan-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, mode: 'confirmation' }),
      });
      const data = (await res.json().catch(() => ({}))) as { confirmation?: { totalPrice?: number | null; currency?: string | null } };
      const p = data.confirmation?.totalPrice;
      if (typeof p === 'number' && p > 0) {
        setPrice(String(p));
        if (data.confirmation?.currency) setCurrency(data.confirmation.currency);
        setStatus('idle');
      } else {
        setStatus('noprice');
      }
    } catch { setStatus('noprice'); }
  }

  async function save() {
    setStatus('saving');
    const num = price.trim() === '' ? null : Math.round(Number(price) * 100) / 100;
    await onSave(num != null && Number.isFinite(num) ? num : null, currency.trim().toUpperCase() || 'ILS');
    setStatus('saved');
    setTimeout(() => setStatus((s) => (s === 'saved' ? 'idle' : s)), 1600);
  }

  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-2.5" style={{ background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(43,38,34,0.12)' }}>
      <div>
        <h4 className="text-[13.5px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>💳 {t.priceTitle}</h4>
        <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.priceHint}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={price}
          onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="decimal"
          placeholder={t.pricePlaceholder}
          className="flex-1 rounded-xl px-3 py-2.5 text-[13px] outline-none"
          style={{ background: '#fff', border: '1px solid rgba(43,38,34,0.14)', color: 'var(--color-ink-warm)' }}
        />
        <input
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 4))}
          className="w-16 rounded-xl px-2 py-2.5 text-[13px] text-center uppercase outline-none"
          style={{ background: '#fff', border: '1px solid rgba(43,38,34,0.14)', color: 'var(--color-ink-warm)' }}
        />
        <button
          onClick={save}
          disabled={status === 'saving' || status === 'scanning'}
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-50"
          style={{ background: 'var(--color-terracotta)', color: '#fff' }}
        >
          {status === 'saved' ? t.saved : t.savePrice}
        </button>
      </div>
      <input ref={fileRef} type="file" accept={ACCEPTED_IMG.join(',')} className="sr-only" onChange={(e) => scanForPrice(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status === 'scanning'}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-2 text-[12px] font-semibold disabled:opacity-50"
        style={{ border: '1px dashed rgba(184,85,46,0.4)', color: 'var(--color-terracotta-deep)', background: 'rgba(255,255,255,0.4)' }}
      >
        📄 {status === 'scanning' ? t.scanningPrice : t.scanConfirmation}
      </button>
      {status === 'noprice' && <p className="text-[11.5px]" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.scanNoPrice}</p>}
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
  const [status, setStatus] = useState<'idle' | 'loading' | 'scanning' | 'done' | 'empty'>('idle');
  const [results, setResults] = useState<LocateResult[]>([]);
  const [picked, setPicked] = useState<LocateResult | null>(null);
  const [fromPhoto, setFromPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function locate(payload: { query?: string; image?: string }, scanning = false) {
    setPicked(null);
    setFromPhoto(null);
    setStatus(scanning ? 'scanning' : 'loading');
    try {
      const res = await fetch('/api/hotels/locate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, near: destination }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: LocateResult | null; from?: string | null };
      if (data.from) setFromPhoto(data.from);
      if (data.result) {
        setResults([data.result]);
        setPicked(data.result);
        setStatus('done');
      } else {
        setResults([]);
        setStatus('empty');
      }
    } catch {
      setStatus('empty');
    }
  }

  function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    void locate({ query: q });
  }

  async function handleFile(file: File | null | undefined) {
    if (!file || !ACCEPTED_IMG.includes(file.type)) return;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    }).catch(() => '');
    if (dataUrl) void locate({ image: dataUrl }, true);
    if (fileRef.current) fileRef.current.value = '';
  }

  function confirm(r: LocateResult) {
    if (!Number.isFinite(r.lat) || !Number.isFinite(r.lng)) return;
    onConfirm({ name: r.name, address: r.address, lat: r.lat, lng: r.lng, thumbnailUrl: r.photoUrl || staticMapThumb(r.lat, r.lng) });
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
          disabled={query.trim().length < 3 || status === 'loading' || status === 'scanning'}
          className="px-4 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-40"
          style={{ background: 'var(--color-terracotta)', color: '#fff' }}
        >
          {status === 'loading' ? t.searching : t.search}
        </button>
      </div>

      {/* Photo upload */}
      <input ref={fileRef} type="file" accept={ACCEPTED_IMG.join(',')} className="sr-only" onChange={(e) => handleFile(e.target.files?.[0])} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status === 'scanning'}
        className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 text-[12.5px] font-semibold disabled:opacity-50"
        style={{ border: '1px dashed rgba(184,85,46,0.4)', color: 'var(--color-terracotta-deep)', background: 'rgba(255,255,255,0.4)' }}
      >
        📷 {t.orUpload}
      </button>

      {status === 'scanning' && (
        <p className="text-[12.5px] px-1 animate-pulse" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.scanning}</p>
      )}
      {fromPhoto && status === 'done' && (
        <p className="text-[12px] px-1" style={{ color: 'var(--color-terracotta-deep)' }}>📷 {t.fromPhoto(fromPhoto)}</p>
      )}

      {/* Empty prompt before searching */}
      {status === 'idle' && (
        <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(255,255,255,0.5)', border: '1px dashed rgba(43,38,34,0.18)' }}>
          <div className="text-3xl mb-2">🏨</div>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--color-ink-warm)' }}>{t.empty}</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--color-ink-warm-mut)' }}>{t.emptySub}</p>
        </div>
      )}

      {status === 'empty' && (
        <p className="text-[12.5px] px-1" style={{ color: 'var(--color-ink-warm-mut)' }}>{fromPhoto === null ? t.noResults : t.photoNoResult}</p>
      )}

      {/* Results */}
      {status === 'done' && (
        <div className="flex flex-col gap-2">
          {results.map((r, i) => {
            const on = picked === r;
            return (
              <motion.button
                key={`${r.lat}-${r.lng}-${i}`}
                whileTap={{ scale: 0.99 }}
                onClick={() => setPicked(r)}
                className="flex items-start gap-2.5 p-3 rounded-xl text-start transition-colors"
                style={{ background: on ? 'var(--color-terracotta-soft)' : 'rgba(255,255,255,0.6)', border: on ? '1px solid var(--color-terracotta)' : '1px solid rgba(43,38,34,0.12)' }}
              >
                <span className="text-lg leading-none mt-0.5">📍</span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold truncate" style={{ color: 'var(--color-ink-warm)' }}>{r.name}</span>
                  {r.address && <span className="block text-[11.5px] truncate" style={{ color: 'var(--color-ink-warm-mut)' }}>{r.address}</span>}
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
