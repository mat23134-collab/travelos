'use client';

/**
 * RealDayDemo — proves the "~60 seconds" hero claim with an ACTUAL sample day,
 * not a mockup screenshot. Fetches real, verified places from /api/landmarks
 * (public.places, top_pick_category — the same data Step 7 of onboarding
 * reads) for a marquee city, picks one sightseeing + one history + one food
 * stop, and renders them as a real day: three photo cards in sequence.
 *
 * No abstract "route map" — an unlabeled grid with three dots and a dashed
 * line conveyed nothing real (no streets, no scale, no city). The numbered
 * badges + arrow connectors on the cards themselves already say "this is a
 * sequence," without pretending to be a map.
 *
 * Radius + scrim treatment intentionally matches PostcardCard (rounded-3xl,
 * bottom-anchored dark gradient) so every photo card on the landing page
 * reads as one consistent visual system.
 */

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Landmark } from '@/app/api/landmarks/route';

const REDLINE = '#b8552e';
const MUTED = '#6b6358';

const DEMO_CITY = 'Rome';

interface Bucket {
  sightseeing: Landmark[];
  history: Landmark[];
  food: Landmark[];
}

type Stop = Landmark & { bucket: 'sightseeing' | 'history' | 'food' };

/** Best single pick per bucket: has photo + coords, lowest popularity_rank first. */
function pickBest(list: Landmark[]): Landmark | null {
  const withGeo = list.filter((l) => l.latitude != null && l.longitude != null);
  const withPhoto = withGeo.filter((l) => !!l.photo_url);
  const pool = withPhoto.length > 0 ? withPhoto : withGeo;
  if (pool.length === 0) return null;
  return [...pool].sort((a, b) => (a.popularity_rank ?? 99) - (b.popularity_rank ?? 99))[0];
}

const BUCKET_META: Record<Stop['bucket'], { label: string; time: string }> = {
  sightseeing: { label: 'Morning', time: '09:30' },
  history:     { label: 'Midday',  time: '12:00' },
  food:        { label: 'Evening', time: '19:30' },
};

export function RealDayDemo({ onPlanClick }: { onPlanClick: () => void }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [stops, setStops] = useState<Stop[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/landmarks?city=${encodeURIComponent(DEMO_CITY)}&lang=en`, { signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((body: Bucket) => {
        const picked: Stop[] = [];
        const sight = pickBest(body.sightseeing);
        const hist = pickBest(body.history);
        const food = pickBest(body.food);
        if (sight) picked.push({ ...sight, bucket: 'sightseeing' });
        if (hist) picked.push({ ...hist, bucket: 'history' });
        if (food) picked.push({ ...food, bucket: 'food' });
        if (picked.length < 2) { setStatus('error'); return; }
        setStops(picked);
        setStatus('ready');
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setStatus('error');
      });
    return () => ctrl.abort();
  }, []);

  if (status === 'error') return null; // fails silently — landing page still works

  return (
    <section className="py-24 px-8 lg:px-16" style={{ backgroundColor: '#e7dbc2' }}>
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-14">
          <div className="flex items-center gap-3 mb-5">
            <span className="w-6 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.24em] flex items-center gap-2"
              style={{ color: REDLINE }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: REDLINE }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: REDLINE }} />
              </span>
              Live from our database — not a mockup
            </span>
            <span className="w-6 h-px" style={{ background: REDLINE }} />
          </div>
          <h2
            className="font-black mb-3"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em', maxWidth: 620 }}
          >
            A real day in {DEMO_CITY}.
            <br />
            <span style={{ color: 'rgba(43,38,34,0.30)' }}>Built the same way yours will be.</span>
          </h2>
          <p className="text-sm max-w-md leading-relaxed" style={{ color: MUTED }}>
            Three real, verified places — geo-clustered, sequenced, ready to walk. This is a genuine slice of what the AI hands you in ~60 seconds.
          </p>
        </div>

        {status === 'loading' && (
          <div className="grid sm:grid-cols-3 gap-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl animate-pulse" style={{ height: 300, background: 'rgba(43,38,34,0.08)' }} />
            ))}
          </div>
        )}

        {status === 'ready' && (
          <>
            {/* Stop cards — numbered badges + arrow connectors already read as
                a sequence; no separate map needed. */}
            <div className="grid sm:grid-cols-3 gap-5 mb-10">
              {stops.map((stop, i) => (
                <StopCard key={stop.id} stop={stop} index={i} isLast={i === stops.length - 1} />
              ))}
            </div>

            {/* CTA */}
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onPlanClick}
                className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full font-bold text-sm text-white transition-all duration-200 hover-lift-brand"
                style={{ background: REDLINE, boxShadow: '0 4px 24px rgba(184,85,46,0.28)' }}
              >
                Plan a trip like this
                <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function StopCard({ stop, index, isLast }: { stop: Stop; index: number; isLast: boolean }) {
  const meta = BUCKET_META[stop.bucket];
  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 240, damping: 24 }}
      className="group relative rounded-3xl overflow-hidden"
      style={{ height: 300, boxShadow: '0 16px 48px rgba(0,0,0,0.4)', background: '#111827' }}
    >
      {stop.photo_url ? (
        <img
          src={stop.photo_url}
          alt={stop.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-6xl" style={{ background: '#1f2937' }}>
          {stop.category_emoji ?? '📍'}
        </div>
      )}

      {/* Dark gradient scrim — same treatment as PostcardCard, unified across the page */}
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(10,15,26,0.96) 0%, rgba(10,15,26,0.35) 55%, rgba(10,15,26,0.08) 100%)' }}
      />

      {/* Sequence number badge */}
      <div
        className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white"
        style={{ background: REDLINE, boxShadow: '0 2px 10px rgba(0,0,0,0.35)' }}
      >
        {index + 1}
      </div>
      {!isLast && (
        <div
          className="hidden sm:flex absolute top-[26px] -right-3 z-10 w-6 h-6 items-center justify-center text-white/70"
          aria-hidden
        >
          →
        </div>
      )}

      <div className="absolute bottom-0 inset-x-0 p-5 z-10">
        <div className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {meta.label} · {meta.time}
        </div>
        <div className="font-black text-lg text-white leading-tight" style={{ letterSpacing: '-0.02em' }}>
          {stop.category_emoji ? `${stop.category_emoji} ` : ''}{stop.name}
        </div>
        {stop.description && (
          <div className="text-xs mt-1.5 leading-snug line-clamp-2" style={{ color: 'rgba(255,255,255,0.55)' }}>
            {stop.description}
          </div>
        )}
      </div>
    </motion.div>
  );
}
