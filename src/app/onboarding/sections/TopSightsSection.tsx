'use client';

/**
 * TopSightsSection — Step 7 of onboarding ("Our Picks").
 *
 * Pulls city-specific landmarks from /api/landmarks (backed by public.places
 * rows with top_pick_category set) and renders them as a cuboid-card grid
 * inside three category panels: Sightseeing · History · Local Food.
 *
 * Cuboid card:
 *   • 3:4 aspect tile with the landmark's Google Places photo at the top
 *   • Soft inner shadow + 1px ivory hairline → faint architectural depth
 *   • Sharp serif name, 11-px tracked sub for description
 *   • Selected state — 1-px gold border + tiny corner dot (no glow)
 *
 * Choices are optional. The footer CTA on /onboarding stays as the single
 * primary action; the section never has its own buttons.
 */

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import type { Landmark } from '@/app/api/landmarks/route';

const MAX_NOTE_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB — matches /api/scan-notes cap
const ACCEPTED_NOTE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const IVORY        = '#0d2b27';
const IVORY_DIM    = '#3a7068';
const IVORY_FAINT  = '#5a908a';
const ACCENT       = '#c4a26a';
const SURFACE      = 'rgba(255,255,255,0.65)';
const SURFACE_SEL  = 'rgba(255,255,255,0.88)';
const BORDER       = '1px solid rgba(90,173,165,0.28)';
const BORDER_SEL   = `1px solid ${ACCENT}`;

interface LandmarksByCategory {
  city: string;
  sightseeing: Landmark[];
  history:     Landmark[];
  food:        Landmark[];
}

const CATEGORY_META: Array<{ key: 'sightseeing' | 'history' | 'food'; label: string }> = [
  { key: 'sightseeing', label: 'Sightseeing' },
  { key: 'history',     label: 'History'     },
  { key: 'food',        label: 'Local Food'  },
];

export function TopSightsSection() {
  const { destination, mustHaveItems, toggleMustHave } = useOnboardingStore();
  const [data, setData] = useState<LandmarksByCategory | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty' | 'ready' | 'error'>('idle');
  const [activeDetail, setActiveDetail] = useState<Landmark | null>(null);

  useEffect(() => {
    const city = (destination ?? '').trim();
    if (!city) { setStatus('idle'); setData(null); return; }
    const ctrl = new AbortController();
    setStatus('loading');
    fetch(`/api/landmarks?city=${encodeURIComponent(city)}`, { signal: ctrl.signal })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
      .then((body: LandmarksByCategory) => {
        const total = body.sightseeing.length + body.history.length + body.food.length;
        setData(body);
        setStatus(total === 0 ? 'empty' : 'ready');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[TopSightsSection] fetch failed:', err);
        setStatus('error');
      });
    return () => ctrl.abort();
  }, [destination]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h2
          className="font-serif text-[28px] leading-[1.1] tracking-[-0.015em]"
          style={{ color: IVORY, fontWeight: 400 }}
        >
          Top sights for {destination || 'your trip'}
        </h2>
        <p className="mt-2 text-[13px] tracking-wide" style={{ color: IVORY_DIM }}>
          Pick what you don&apos;t want to miss. We&apos;ll build the rest of the itinerary around them.
          <span className="ml-1.5" style={{ color: IVORY_FAINT }}>Optional — feel free to skip.</span>
        </p>
      </div>

      {/* Status states */}
      {status === 'loading' && (
        <div className="flex flex-col gap-6">
          {CATEGORY_META.map(({ label }) => (
            <CategorySkeleton key={label} label={label} />
          ))}
        </div>
      )}

      {(status === 'empty' || status === 'error') && (
        <div
          className="rounded-3xl p-7 text-center backdrop-blur-xl"
          style={{ background: SURFACE, border: BORDER }}
        >
          <p className="font-serif text-[18px] leading-tight" style={{ color: IVORY }}>
            We don&apos;t have curated picks for {destination || 'this city'} yet.
          </p>
          <p className="mt-2 text-[12px] tracking-wide" style={{ color: IVORY_DIM }}>
            Skip this step — your itinerary will be built from your earlier answers and live web intelligence.
          </p>
        </div>
      )}

      {/* Detail popup */}
      <AnimatePresence>
        {activeDetail && (
          <LandmarkDetailPopup
            landmark={activeDetail}
            selected={mustHaveItems.includes(activeDetail.name)}
            onToggle={() => toggleMustHave(activeDetail.name)}
            onClose={() => setActiveDetail(null)}
          />
        )}
      </AnimatePresence>

      {/* Scan-your-own-notes */}
      <NoteScanner destination={destination} />

      {status === 'ready' && data && (
        <AnimatePresence mode="wait">
          <motion.div
            key={data.city}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0 }}
            className="flex flex-col gap-6"
          >
            {CATEGORY_META.map(({ key, label }) => {
              const items = data[key];
              if (items.length === 0) return null;
              return (
                <div key={key}>
                  <p
                    className="text-[11px] uppercase tracking-[0.22em] mb-3"
                    style={{ color: IVORY_DIM }}
                  >
                    {label}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {items.map((landmark) => (
                      <CuboidCard
                        key={landmark.id}
                        landmark={landmark}
                        selected={mustHaveItems.includes(landmark.name)}
                        onToggle={() => toggleMustHave(landmark.name)}
                        onOpenDetail={() => setActiveDetail(landmark)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Cuboid card ──────────────────────────────────────────────────────────────

function CuboidCard({
  landmark,
  selected,
  onToggle,
  onOpenDetail,
}: {
  landmark: Landmark;
  selected: boolean;
  onToggle: () => void;
  onOpenDetail: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onOpenDetail}
      whileTap={{ scale: 0.985 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col text-left rounded-2xl overflow-hidden transition-colors"
      style={{
        background: selected ? SURFACE_SEL : SURFACE,
        border: selected ? BORDER_SEL : BORDER,
        // Architectural depth — bottom-heavy soft shadow, no glow.
        boxShadow: selected
          ? '0 2px 12px rgba(0,0,0,0.06), 0 0 0 0 rgba(196,162,106,0)'
          : '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Photo (3:4 cuboid proportion) */}
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: '3 / 4', background: 'rgba(90,173,165,0.12)' }}
      >
        {landmark.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={landmark.photo_url}
            alt={landmark.name}
            loading="lazy"
            className="absolute inset-0 w-full h-full object-cover"
            style={{ filter: selected ? 'none' : 'saturate(0.94)' }}
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(90,173,165,0.15), rgba(90,173,165,0.06))' }}
          >
            <span className="text-3xl" style={{ opacity: 0.4 }}>
              {landmark.category_emoji || '◻︎'}
            </span>
          </div>
        )}

        {/* Bottom-edge gradient so the serif name reads on any photo */}
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(9,13,20,0.78), rgba(9,13,20,0) 100%)',
          }}
        />

        {/* Selection mark — minimal corner pip */}
        <AnimatePresence>
          {selected && (
            <motion.span
              key="dot"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, transition: { duration: 0.18 } }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center"
              style={{
                background: ACCENT,
                boxShadow: '0 4px 10px -2px rgba(196,162,106,0.45)',
              }}
            >
              <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
                <path d="M2.5 6.2L4.8 8.5L9.5 3.8" fill="none" stroke="#1a1308" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Caption */}
      <div className="p-3.5 flex flex-col gap-1.5">
        <div
          className="font-serif text-[14.5px] leading-tight tracking-[-0.01em] line-clamp-1"
          style={{ color: selected ? IVORY : '#1a4a44' }}
        >
          {landmark.name}
        </div>
        {landmark.description && (
          <div
            className="text-[11px] leading-snug tracking-wide line-clamp-2"
            style={{ color: selected ? IVORY_DIM : IVORY_FAINT }}
          >
            {landmark.description}
          </div>
        )}
      </div>
    </motion.button>
  );
}

// ─── Landmark detail popup ────────────────────────────────────────────────────

function LandmarkDetailPopup({
  landmark,
  selected,
  onToggle,
  onClose,
}: {
  landmark: Landmark;
  selected: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(8,20,18,0.55)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />

      {/* Card */}
      <motion.div
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden flex flex-col"
        style={{
          background: 'rgba(255,255,255,0.92)',
          border: BORDER,
          boxShadow: '0 24px 60px -12px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(20px)',
        }}
        initial={{ scale: 0.88, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      >
        {/* Photo */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: '16 / 9', background: 'rgba(90,173,165,0.12)' }}>
          {landmark.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={landmark.photo_url}
              alt={landmark.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-5xl" style={{ opacity: 0.3 }}>{landmark.category_emoji || '📍'}</span>
            </div>
          )}
          {/* Top bar: emoji + close */}
          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-4">
            <span
              className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(0,0,0,0.45)', color: '#fff', backdropFilter: 'blur(6px)' }}
            >
              {landmark.category_emoji}
            </span>
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.85 }}
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs"
              style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)' }}
            >✕</motion.button>
          </div>
          {/* Bottom gradient */}
          <div
            className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
            style={{ background: 'linear-gradient(to top, rgba(255,255,255,0.7), transparent)' }}
          />
        </div>

        {/* Content */}
        <div className="px-5 pb-5 pt-4 flex flex-col gap-3">
          <h3
            className="font-serif text-[20px] leading-tight tracking-[-0.015em]"
            style={{ color: IVORY }}
          >
            {landmark.name}
          </h3>

          {landmark.description && (
            <p
              className="text-[13px] leading-relaxed tracking-wide"
              style={{ color: IVORY_DIM }}
            >
              {landmark.description}
            </p>
          )}

          {/* Action button */}
          <motion.button
            type="button"
            onClick={() => { onToggle(); onClose(); }}
            whileTap={{ scale: 0.97 }}
            className="mt-1 w-full py-3 rounded-2xl text-[13px] font-bold tracking-wide transition-colors"
            style={selected
              ? { background: 'rgba(196,162,106,0.12)', color: ACCENT, border: `1px solid ${ACCENT}` }
              : { background: IVORY, color: '#fff', border: `1px solid ${IVORY}` }
            }
          >
            {selected ? '✓ Added to my picks · Tap to remove' : '+ Add to my picks'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Note scanner ─────────────────────────────────────────────────────────────
//
// Lets the traveler upload a photo of their own notes (a screenshot, a
// handwritten list, anything) so we can pull out concrete ideas — place
// names, dishes, neighborhoods — and fold the ones they keep into their
// must-haves above, alongside our curated picks.

type ScanStatus = 'idle' | 'reading' | 'scanning' | 'ready' | 'empty' | 'error';

function NoteScanner({ destination }: { destination: string }) {
  const { mustHaveItems, toggleMustHave } = useOnboardingStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [items, setItems] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleFile(file: File | undefined | null) {
    if (!file) return;
    setErrorMsg(null);
    setItems([]);

    if (!ACCEPTED_NOTE_IMAGE_TYPES.includes(file.type)) {
      setStatus('error');
      setErrorMsg('Please upload a JPEG, PNG, WEBP, or GIF image.');
      return;
    }
    if (file.size > MAX_NOTE_IMAGE_BYTES) {
      setStatus('error');
      setErrorMsg('That image is a bit large — try one under 8 MB.');
      return;
    }

    setStatus('reading');
    const dataUrl: string = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    }).catch(() => '');

    if (!dataUrl) {
      setStatus('error');
      setErrorMsg('Could not read that file — try a different photo.');
      return;
    }

    setPreviewUrl(dataUrl);
    setStatus('scanning');
    try {
      const res = await fetch('/api/scan-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl, destination }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const found: string[] = Array.isArray(body?.items) ? body.items : [];
      setItems(found);
      setStatus(found.length ? 'ready' : 'empty');
      // Pre-select everything we found — the traveler can deselect what doesn't fit.
      found.forEach((item) => {
        if (!mustHaveItems.includes(item)) toggleMustHave(item);
      });
    } catch (err) {
      console.warn('[NoteScanner] scan failed:', err);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Could not read that image — try a clearer photo.');
    }
  }

  function reset() {
    setStatus('idle');
    setPreviewUrl(null);
    setItems([]);
    setErrorMsg(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div
      className="rounded-3xl p-6 backdrop-blur-xl"
      style={{ background: SURFACE, border: BORDER }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-serif text-[16px] leading-tight" style={{ color: IVORY }}>
            Already have a list of your own?
          </p>
          <p className="mt-1.5 text-[12px] leading-snug tracking-wide" style={{ color: IVORY_DIM }}>
            Upload a photo of any notes — a screenshot, a handwritten list, anything — and
            we&apos;ll pull out the highlights and weave the ones that fit into your itinerary.
          </p>
        </div>
        {status !== 'idle' && (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 text-[11px] tracking-wide underline underline-offset-2"
            style={{ color: IVORY_FAINT }}
          >
            Start over
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_NOTE_IMAGE_TYPES.join(',')}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {status === 'idle' && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-4 flex items-center justify-center gap-2 w-full rounded-2xl py-4 text-[12px] tracking-wide transition-colors"
          style={{ border: `1px dashed ${IVORY_FAINT}`, color: IVORY_DIM }}
        >
          <span aria-hidden="true">📷</span>
          Upload a photo of your notes
        </button>
      )}

      {status !== 'idle' && (
        <div className="mt-4 flex flex-col sm:flex-row gap-4">
          {previewUrl && (
            <div
              className="relative shrink-0 rounded-xl overflow-hidden"
              style={{ width: 88, height: 88, border: BORDER }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Uploaded note" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {(status === 'reading' || status === 'scanning') && (
              <p className="text-[12px] tracking-wide animate-pulse" style={{ color: IVORY_DIM }}>
                {status === 'reading' ? 'Reading your photo…' : 'Scanning for things you mentioned…'}
              </p>
            )}

            {status === 'error' && (
              <p className="text-[12px] tracking-wide" style={{ color: '#9e363a' }}>
                {errorMsg || 'Something went wrong — try again.'}
              </p>
            )}

            {status === 'empty' && (
              <p className="text-[12px] tracking-wide" style={{ color: IVORY_DIM }}>
                We couldn&apos;t make out any specific places or activities in that photo. Try a clearer shot, or skip this.
              </p>
            )}

            {status === 'ready' && (
              <>
                <p className="text-[11px] uppercase tracking-[0.22em] mb-2.5" style={{ color: IVORY_DIM }}>
                  Found in your photo — tap to keep or remove
                </p>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => {
                    const selected = mustHaveItems.includes(item);
                    return (
                      <motion.button
                        key={item}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => toggleMustHave(item)}
                        className="px-3.5 py-2 rounded-full text-[12px] tracking-wide transition-colors"
                        style={{
                          background: selected ? SURFACE_SEL : 'transparent',
                          border: selected ? BORDER_SEL : BORDER,
                          color: selected ? IVORY : IVORY_DIM,
                        }}
                      >
                        {selected && <span className="mr-1.5" style={{ color: ACCENT }}>✓</span>}
                        {item}
                      </motion.button>
                    );
                  })}
                </div>
                <p className="mt-3 text-[11px] tracking-wide" style={{ color: IVORY_FAINT }}>
                  Kept items join your must-haves above — we&apos;ll fit them into the plan where they make sense.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CategorySkeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: IVORY_DIM }}>
        {label}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl overflow-hidden animate-pulse"
            style={{ background: SURFACE, border: BORDER }}
          >
            <div className="w-full" style={{ aspectRatio: '3 / 4', background: 'rgba(90,173,165,0.12)' }} />
            <div className="p-3.5 flex flex-col gap-2">
              <div className="h-3 rounded" style={{ background: 'rgba(90,173,165,0.18)', width: '70%' }} />
              <div className="h-2.5 rounded" style={{ background: 'rgba(90,173,165,0.12)', width: '90%' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
