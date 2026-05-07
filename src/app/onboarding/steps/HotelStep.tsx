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

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { sceneContent } from '@/three/tunnel';
import { CompassScene } from '@/three/CompassScene';
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
  const [hotels, setHotels] = useState<SuggestedHotel[]>([]);

  const confirmed = status === 'found' && hotelLat != null && hotelLng != null;
  const locationMarker = useMemo(
    () => (confirmed ? { lat: hotelLat!, lng: hotelLng!, label: hotelAddress || 'Hotel anchor' } : null),
    [confirmed, hotelAddress, hotelLat, hotelLng],
  );

  useEffect(() => {
    if (destinationLat == null || destinationLng == null) {
      setStatus('error');
      setErrMsg('Please choose one of the featured destinations first.');
      return;
    }

    let cancelled = false;
    const loadHotels = async () => {
      setStatus('loading');
      setErrMsg('');
      try {
        const res = await fetch(`/api/hotels/search?lat=${destinationLat}&lng=${destinationLng}&radius=25`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? 'Failed loading hotels');
        const picks: SuggestedHotel[] = (data?.hotels ?? []).slice(0, 3);
        if (!cancelled) {
          setHotels(picks);
          if (!picks.length) {
            setStatus('error');
            setErrMsg('No nearby hotels found for this destination.');
          } else if (!confirmed) {
            setStatus('idle');
          }
        }
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setErrMsg(e instanceof Error ? e.message : 'Could not fetch Booking.com hotels');
        }
      }
    };
    void loadHotels();
    return () => {
      cancelled = true;
    };
  }, [confirmed, destinationLat, destinationLng]);

  const handlePickHotel = (hotel: SuggestedHotel) => {
    setHotelLocation(`${hotel.name}, ${hotel.address}`, hotel.lat, hotel.lng);
    setStatus('found');
    setErrMsg('');
  };

  const handleClear = () => {
    clearHotelLocation();
    setStatus('idle');
    setErrMsg('');
  };

  return (
    <>
      <sceneContent.In>
        <CompassScene locationMarker={locationMarker} />
      </sceneContent.In>

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
            Top 3 Booking.com suggestions around {destination || 'your destination'}.
            Choose one to center your itinerary around it.
          </p>
        </div>
        {status === 'loading' && (
          <div className="px-4 py-3 rounded-2xl border text-sm" style={{ background: 'rgba(15,40,98,0.35)', borderColor: 'rgba(255,255,255,0.08)', color: '#fff' }}>
            Loading Booking.com hotels...
          </div>
        )}

        {hotels.length > 0 && (
          <div className="grid gap-3">
            {hotels.map((hotel) => {
              const selected = hotelAddress.includes(hotel.name);
              return (
                <button
                  key={hotel.id}
                  onClick={() => handlePickHotel(hotel)}
                  className="w-full text-left p-4 rounded-2xl border transition-all"
                  style={{
                    background: selected ? 'rgba(15,40,98,0.52)' : 'rgba(15,40,98,0.34)',
                    borderColor: selected ? 'rgba(197,145,42,0.55)' : 'rgba(255,255,255,0.12)',
                    boxShadow: '0 10px 24px -14px rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div className="text-sm font-bold text-white">{hotel.name}</div>
                  <div className="text-xs mt-1" style={{ color: GREY_BLUE }}>{hotel.address}</div>
                  <div className="text-[11px] mt-2" style={{ color: selected ? '#d4a235' : 'rgba(255,255,255,0.55)' }}>
                    {selected ? 'Selected as your base camp' : 'Use as base camp'}
                  </div>
                </button>
              );
            })}
          </div>
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
          <button
            onClick={onBack}
            className="flex-1 py-4 rounded-2xl text-sm font-bold transition-all"
            style={{
              color: '#4f5f76',
              border: `1.5px solid rgba(255,255,255,0.07)`,
              background: 'transparent',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4f5f76')}
          >
            ← Back
          </button>
          <button
            onClick={onNext}
            className="flex-[2] py-4 rounded-2xl text-sm font-black text-white tracking-wide transition-all"
            style={{
              background: confirmed
                ? `linear-gradient(135deg, ${GOLD}, ${GOLD_H})`
                : `rgba(255,255,255,0.08)`,
              boxShadow: confirmed ? `0 8px 32px -4px rgba(197,145,42,0.50)` : 'none',
              color: confirmed ? '#071629' : 'rgba(255,255,255,0.35)',
            }}
          >
            {confirmed ? 'Build My Trip →' : 'Skip for now →'}
          </button>
        </div>
      </motion.div>
    </>
  );
}
