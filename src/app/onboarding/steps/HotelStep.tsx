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

import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { sceneContent } from '@/three/tunnel';
import { useOnboardingStore } from '@/state/onboardingStore';
import { supabase } from '@/lib/supabase';

// ── Palette ───────────────────────────────────────────────────────────────────
const GOLD    = '#c5912a';   // hotel anchor gold
const GOLD_H  = '#d4a235';
const PRIMARY = '#9e363a';   // fallback

// ── Session key — stable anonymous identifier ─────────────────────────────────
function getSessionKey(): string {
  if (typeof window === 'undefined') return 'ssr';
  const KEY = 'travelos_session_key';
  let k = sessionStorage.getItem(KEY);
  if (!k) {
    k = crypto.randomUUID();
    sessionStorage.setItem(KEY, k);
  }
  return k;
}

// ── Geocoding via OpenStreetMap Nominatim (free, no API key) ──────────────────
interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; displayName: string } | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?` +
    `q=${encodeURIComponent(address)}&format=json&limit=1&addressdetails=0`;

  const res = await fetch(url, {
    headers: {
      // Nominatim requires a descriptive User-Agent
      'User-Agent': 'TravelOS/1.0 (travel-os-app)',
      'Accept-Language': 'en',
    },
  });

  if (!res.ok) return null;
  const data: NominatimResult[] = await res.json();
  if (!data.length) return null;

  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

// ── 3D Pin Scene — gold glowing sphere + ring ─────────────────────────────────

function PinScene({ confirmed }: { confirmed: boolean }) {
  const sphereRef = useRef<THREE.Mesh>(null);
  const ringRef   = useRef<THREE.Mesh>(null);
  const glowRef   = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    if (sphereRef.current) {
      sphereRef.current.position.y = Math.sin(t * 1.2) * 0.12;
      sphereRef.current.rotation.y = t * 0.6;
    }

    if (ringRef.current) {
      const scale = 1 + Math.sin(t * 2.0) * 0.12;
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshStandardMaterial).opacity =
        0.55 - Math.sin(t * 2.0) * 0.25;
    }

    if (glowRef.current) {
      glowRef.current.intensity = confirmed
        ? 2.8 + Math.sin(t * 2.5) * 0.5
        : 1.2 + Math.sin(t * 1.8) * 0.3;
    }
  });

  const color = confirmed ? GOLD : '#4a7aad';

  return (
    <group position={[2.2, 0, 0]}>
      <ambientLight intensity={0.2} />
      <pointLight position={[3, 4, 4]} intensity={1.0} color="#b8d0f0" />
      <pointLight
        ref={glowRef}
        position={[0, 0, 3]}
        intensity={1.2}
        color={color}
        distance={12}
        decay={2}
      />

      {/* Main sphere — the hotel anchor */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={confirmed ? 1.8 : 0.6}
          metalness={0.55}
          roughness={0.18}
        />
      </mesh>

      {/* Pulsing halo ring */}
      <mesh ref={ringRef}>
        <torusGeometry args={[0.72, 0.028, 12, 64]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* Outer atmosphere */}
      <mesh>
        <sphereGeometry args={[0.85, 12, 8]} />
        <meshBasicMaterial color={color} transparent opacity={confirmed ? 0.045 : 0.018} />
      </mesh>

      {/* Pin stem */}
      <mesh position={[0, -0.65, 0]}>
        <cylinderGeometry args={[0.022, 0.008, 0.46, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          metalness={0.6}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

// ── Step UI ───────────────────────────────────────────────────────────────────

const CONTAINER_VARIANTS = {
  hidden:  { opacity: 0, x: -40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 40, transition: { duration: 0.35 } },
};

type Status = 'idle' | 'loading' | 'found' | 'error';

const HOTEL_PRESETS = [
  'Hotel name + city',
  'Airbnb address',
  'Hostel / guesthouse',
  'Resort name',
];

export function HotelStep({
  onNext,
  onBack,
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const { hotelAddress, hotelLat, hotelLng, setHotelLocation, clearHotelLocation } =
    useOnboardingStore();

  const [query,   setQuery]   = useState(hotelAddress);
  const [status,  setStatus]  = useState<Status>(hotelLat != null ? 'found' : 'idle');
  const [display, setDisplay] = useState('');
  const [errMsg,  setErrMsg]  = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const confirmed = status === 'found' && hotelLat != null;

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setStatus('loading');
    setErrMsg('');

    try {
      const result = await geocodeAddress(query.trim());
      if (!result) {
        setStatus('error');
        setErrMsg('Address not found. Try adding the city or country.');
        return;
      }

      setHotelLocation(query.trim(), result.lat, result.lng);
      setDisplay(result.displayName);
      setStatus('found');

      // Persist to Supabase (fire-and-forget — don't block the UI)
      void supabase.from('hotel_anchors').insert({
        session_key: getSessionKey(),
        address:     query.trim(),
        lat:         result.lat,
        lng:         result.lng,
      });

    } catch {
      setStatus('error');
      setErrMsg('Network error. Please check your connection and try again.');
    }
  }, [query, setHotelLocation]);

  const handleClear = () => {
    clearHotelLocation();
    setQuery('');
    setStatus('idle');
    setDisplay('');
    setErrMsg('');
  };

  return (
    <>
      <sceneContent.In>
        <PinScene confirmed={confirmed} />
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
              color: GOLD,
              border: `1px solid rgba(197,145,42,0.32)`,
            }}
          >
            Step 4 of 4
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase"
            style={{ background: `rgba(158,54,58,0.12)`, color: PRIMARY }}
          >
            The Anchor
          </span>
        </div>

        {/* Heading */}
        <div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
            Where are you<br />
            <span style={{ color: GOLD }}>staying?</span>
          </h2>
          <p className="mt-2 text-sm max-w-xs" style={{ color: '#4f5f76' }}>
            Your hotel becomes the gravitational center — every day radiates
            out from here with zero wasted transit.
          </p>
        </div>

        {/* Address input + search */}
        <div>
          <label
            className="block text-xs font-semibold mb-2 tracking-wider uppercase"
            style={{ color: '#4f5f76' }}
          >
            Hotel name or address
          </label>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); if (status === 'found') setStatus('idle'); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="e.g. Marriott Paris Champs-Élysées"
              className="flex-1 px-4 py-3.5 rounded-2xl text-white text-sm font-medium outline-none transition-all"
              style={{
                background: `rgba(15,40,98,0.30)`,
                border: confirmed
                  ? `1.5px solid rgba(197,145,42,0.55)`
                  : `1.5px solid rgba(255,255,255,0.10)`,
                colorScheme: 'dark',
              }}
            />
            <button
              onClick={handleSearch}
              disabled={!query.trim() || status === 'loading'}
              className="px-4 py-3.5 rounded-2xl text-sm font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              style={{
                background: `rgba(197,145,42,0.20)`,
                border: `1.5px solid rgba(197,145,42,0.35)`,
                color: GOLD,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = `rgba(197,145,42,0.32)`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = `rgba(197,145,42,0.20)`;
              }}
            >
              {status === 'loading' ? '⏳' : '📍 Find'}
            </button>
          </div>

          {/* Helper hint */}
          <p className="mt-1.5 text-[11px]" style={{ color: 'rgba(79,95,118,0.7)' }}>
            Try: hotel name + city, or full street address
          </p>
        </div>

        {/* Preset hint chips */}
        {status === 'idle' && (
          <div className="flex flex-wrap gap-2">
            {HOTEL_PRESETS.map((p) => (
              <span
                key={p}
                className="px-2.5 py-1 rounded-lg text-[10px] font-medium"
                style={{
                  background: `rgba(15,40,98,0.22)`,
                  border: `1px solid rgba(255,255,255,0.06)`,
                  color: '#4f5f76',
                }}
              >
                {p}
              </span>
            ))}
          </div>
        )}

        {/* Result card */}
        <AnimatePresence mode="wait">
          {status === 'found' && hotelLat != null && (
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
                <p className="text-sm font-bold" style={{ color: GOLD }}>
                  Hotel anchor set
                </p>
                <p
                  className="text-xs mt-0.5 truncate"
                  style={{ color: '#4f5f76' }}
                  title={display || query}
                >
                  {display || query}
                </p>
                <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(79,95,118,0.6)' }}>
                  {hotelLat.toFixed(5)}, {hotelLng!.toFixed(5)}
                </p>
              </div>
              <button
                onClick={handleClear}
                className="shrink-0 text-xs transition-colors mt-0.5"
                style={{ color: 'rgba(197,145,42,0.5)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = GOLD)}
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
            The compass on the right will show your hotel as a gold marker.
            Every day in your itinerary radiates within walking distance of this anchor.
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
