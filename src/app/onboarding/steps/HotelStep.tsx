'use client';

/**
 * HotelStep — Step 3 of the onboarding flow: "The Anchor".
 *
 * Asks the user for their hotel address, geocodes it via the free
 * OpenStreetMap Nominatim API (no key required), persists the result
 * to both Zustand (onboardingStore) and Supabase (hotel_anchors table).
 *
 * Once coordinates are stored the landing page CompassInjector picks
 * them up from the store and renders a gold marker on the 3D compass.
 *
 * 3D scene: a glowing gold location-pin sphere injected into the canvas
 * via the sceneContent tunnel, replacing the clock/airplane for this step.
 *
 * Supabase table required (create once in SQL editor):
 *
 *   create table if not exists public.hotel_anchors (
 *     id           uuid primary key default gen_random_uuid(),
 *     user_id      uuid references auth.users on delete set null,
 *     session_key  text not null,
 *     address      text not null,
 *     lat          float8 not null,
 *     lng          float8 not null,
 *     created_at   timestamptz not null default now()
 *   );
 *   alter table public.hotel_anchors enable row level security;
 *   create policy "anon insert" on public.hotel_anchors for insert with check (true);
 *   create policy "own select" on public.hotel_anchors for select using (
 *     auth.uid() = user_id or session_key = current_setting('request.headers')::json->>'x-session-key'
 *   );
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
const GOLD = '#c5912a';
const GOLD_H = '#d4a235';
const GREY_BLUE = '#4f5f76';

// ── Step UI ───────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

type Status = 'idle' | 'loading' | 'found' | 'error';
interface SuggestedHotel {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

export function HotelStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const {
    destination,
    destinationLat,
    destinationLng,
    hotelAddress,
    hotelLat,
    hotelLng,
    setHotelLocation,
    clearHotelLocation,
  } = useOnboardingStore();

  const [status, setStatus] = useState<Status>(hotelLat != null ? 'found' : 'idle');
  const [errMsg, setErrMsg] = useState('');
  const [manualResult, setManualResult] = useState<SuggestedHotel | null>(null);
  const [manualQuery, setManualQuery] = useState('');
  const [isManualSearching, setIsManualSearching] = useState(false);

  const confirmed = status === 'found' && hotelLat != null && hotelLng != null;
  useEffect(() => {
    if (destinationLat == null || destinationLng == null) {
      setStatus('error');
      setErrMsg('Please choose one of the featured destinations first.');
    }
  }, [destinationLat, destinationLng]);

  const handlePickHotel = (hotel: SuggestedHotel) => {
    setHotelLocation(`${hotel.name}, ${hotel.address}`, hotel.lat, hotel.lng);
    setStatus('found');
    setErrMsg('');
  };

  const handleManualSearch = async () => {
    if (!manualQuery.trim()) return;
    setIsManualSearching(true);
    setErrMsg('');
    try {
      const q = `${manualQuery.trim()} ${destination || ''}`.trim();
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
        },
      });
      if (!res.ok) throw new Error('Could not search this hotel right now');
      const data: NominatimResult[] = await res.json();
      const first = data?.[0];
      if (!first) {
        setStatus('error');
        setErrMsg('Hotel not found. Try a more specific name (hotel + city).');
        return;
      }
      const lat = Number(first.lat);
      const lng = Number(first.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setStatus('error');
        setErrMsg('Found hotel but coordinates are invalid. Please try again.');
        return;
      }
      const label = first.display_name || manualQuery.trim();
      const parsed: SuggestedHotel = {
        id: `manual-${Date.now()}`,
        name: manualQuery.trim().toUpperCase(),
        address: label,
        lat,
        lng,
      };
      setManualResult(parsed);
      setHotelLocation(parsed.address, parsed.lat, parsed.lng);
      setStatus('found');
      setErrMsg('');
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Manual search failed');
    } finally {
      setIsManualSearching(false);
    }
  };

  const handleClear = () => {
    clearHotelLocation();
    setManualResult(null);
    setStatus('idle');
    setErrMsg('');
  };

  return (
    <motion.div
        variants={CONTAINER_VARIANTS}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="relative z-10 flex flex-col gap-6"
      >
        {/* Step badge */}
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest uppercase"
            style={{
              background: `rgba(197,145,42,0.15)`,
              color: '#c5912a',
              border: `1px solid rgba(197,145,42,0.32)`,
            }}
          >
            Step 4 of 4
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
            style={{ background: `rgba(158,54,58,0.12)`, color: '#9e363a' }}
          >
            The Anchor
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Pick your hotel<br />
            <span style={{ color: '#c5912a' }}>anchor</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            Search your hotel and we will set it as your base camp.
          </p>
        </div>

        {/* Free text search */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-widest" style={{ color: GREY_BLUE }}>
            Search your own hotel
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualQuery}
              onChange={(e) => setManualQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleManualSearch()}
              placeholder="e.g. Hilton Athens"
              className="flex-1 px-4 py-3 rounded-2xl text-sm text-white outline-none"
              style={{
                background: 'rgba(15,40,98,0.36)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            />
            <button
              onClick={() => void handleManualSearch()}
              disabled={!manualQuery.trim() || isManualSearching}
              className="px-4 py-3 rounded-2xl text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(197,145,42,0.18)',
                border: '1px solid rgba(197,145,42,0.35)',
                color: '#d4a235',
              }}
            >
              {isManualSearching ? 'Searching...' : 'Find'}
            </button>
          </div>
        </div>

        {manualResult && (
          <button
            onClick={() => handlePickHotel(manualResult)}
            className="w-full text-left p-4 rounded-2xl border transition-all"
            style={{
              background: 'rgba(15,40,98,0.52)',
              borderColor: 'rgba(197,145,42,0.55)',
              boxShadow: '0 10px 24px -14px rgba(0,0,0,0.7)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <div className="text-sm font-bold text-white">{manualResult.name}</div>
            <div className="text-xs mt-1" style={{ color: GREY_BLUE }}>{manualResult.address}</div>
            <div className="text-[11px] mt-2" style={{ color: '#d4a235' }}>
              Selected as your base camp
            </div>
          </button>
        )}

        {/* Result card */}
        <AnimatePresence mode="wait">
          {status === 'found' && hotelLat != null && hotelLng != null && (
            <motion.div
              key="found"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-3 px-4 py-4 rounded-2xl"
              style={{
                background: `rgba(197,145,42,0.10)`,
                border: `1px solid rgba(197,145,42,0.28)`,
              }}
            >
              <span className="text-xl shrink-0 mt-0.5">📍</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold" style={{ color: '#c5912a' }}>
                  Hotel anchor set
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: '#4f5f76' }}
                  title={hotelAddress}
                >
                  {hotelAddress}
                </p>
                <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(79,95,118,0.6)' }}>
                  {hotelLat.toFixed(5)}, {hotelLng.toFixed(5)}
                </p>
              </div>
              <button
                onClick={handleClear}
                className="shrink-0 text-xs transition-colors mt-0.5"
                style={{ color: 'rgba(197,145,42,0.5)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#c5912a')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(197,145,42,0.5)')}
              >
                ✕
              </button>
            </motion.div>
          )}

          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: `rgba(158,54,58,0.10)`,
                border: `1px solid rgba(158,54,58,0.28)`,
              }}
            >
              <span className="text-lg shrink-0">⚠️</span>
              <p className="text-sm" style={{ color: '#f87171' }}>{errMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info note about the anchor */}
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-2xl"
          style={{
            background: `rgba(15,40,98,0.22)`,
            border: `1px solid rgba(74,123,222,0.14)`,
          }}
        >
          <span className="text-base shrink-0">🧭</span>
          <p className="text-xs leading-relaxed" style={{ color: '#4f5f76' }}>
            Compass receives your selected hotel coordinates and locks the trip around this anchor.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <motion.button
            onClick={onBack}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className="flex-1 py-4 rounded-full text-sm font-bold transition-colors"
            style={{
              color: '#4f5f76',
              border: `1.5px solid rgba(255,255,255,0.07)`,
              background: 'transparent',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4f5f76')}
          >
            ← Back
          </motion.button>
          <motion.button
            onClick={onNext}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className="flex-[2] py-4 rounded-full text-sm font-black tracking-wide"
            style={{
              background: confirmed
                ? `linear-gradient(135deg, ${GOLD}, ${GOLD_H})`
                : `rgba(255,255,255,0.08)`,
              boxShadow: confirmed ? `0 0 40px rgba(197,145,42,0.45), 0 8px 24px -4px rgba(197,145,42,0.35)` : 'none',
              color: confirmed ? '#071629' : 'rgba(255,255,255,0.35)',
            }}
          >
            {confirmed ? 'Build My Trip →' : 'Skip for now →'}
          </motion.button>
        </div>
      </motion.div>
  );
}
