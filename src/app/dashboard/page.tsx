'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripRow {
  id:          string;
  destination: string;
  start_date:  string | null;
  hotel_info:  string | null;
  created_at:  string;
}

// ── Grain texture ─────────────────────────────────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

// ── City emoji map ─────────────────────────────────────────────────────────────
const CITY_EMOJI: Record<string, string> = {
  rome: '🏛️', paris: '🗼', london: '🎡', tokyo: '⛩️', barcelona: '🌊',
  nyc: '🗽', 'new york': '🗽', dubai: '🌆', bali: '🌴', amsterdam: '🚲',
  athens: '🏺', budapest: '♨️', lisbon: '🛤️', marrakech: '🕌', kyoto: '⛩️',
  singapore: '🌃', sydney: '🦘', istanbul: '🕌', prague: '🏰', vienna: '🎶',
};

function cityEmoji(destination: string): string {
  const key = destination.toLowerCase();
  for (const [city, emoji] of Object.entries(CITY_EMOJI)) {
    if (key.includes(city)) return emoji;
  }
  return '✈️';
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch { return ''; }
}

// ── Trip photo hook ───────────────────────────────────────────────────────────

function useTripPhoto(destination: string) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ name: destination, city: destination });
    fetch(`/api/place-photo?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setPhotoUrl(d.photoUrl ?? null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [destination]);

  return { photoUrl, loading };
}

// ── Trip Card ─────────────────────────────────────────────────────────────────

function TripCard({ trip, index }: { trip: TripRow; index: number }) {
  const { photoUrl, loading } = useTripPhoto(trip.destination);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  const emoji = cityEmoji(trip.destination);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 340, damping: 28 }}
      className="rounded-3xl overflow-hidden flex flex-col group"
      style={{
        background: 'rgba(255,255,255,0.035)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 4px 24px -8px rgba(0,0,0,0.5)',
      }}
    >
      {/* Photo header */}
      <div className="relative overflow-hidden" style={{ height: 160 }}>
        {/* Skeleton */}
        {loading && (
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        )}
        {/* Real photo */}
        {photoUrl && !imgError && (
          <motion.img
            src={photoUrl}
            alt={trip.destination}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0 }}
            animate={{ opacity: imgLoaded ? 1 : 0 }}
            transition={{ duration: 0.5 }}
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
          />
        )}
        {/* Emoji fallback */}
        {!loading && (!photoUrl || imgError) && (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(255,90,95,0.12), rgba(139,92,246,0.12))' }}
          >
            <span className="text-6xl select-none">{emoji}</span>
          </div>
        )}
        {/* Bottom gradient */}
        {photoUrl && imgLoaded && !imgError && (
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
        )}
        {/* Destination overlay */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 z-10">
          <h3 className="font-black text-lg text-white tracking-tight drop-shadow-lg leading-tight">
            {trip.destination}
          </h3>
          {trip.start_date && (
            <p className="text-xs text-white/55 mt-0.5">{formatDate(trip.start_date)}</p>
          )}
        </div>
        {/* Top neon rule */}
        <div
          className="absolute top-0 inset-x-0 h-px z-10"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(255,90,95,0.7) 50%, transparent 95%)' }}
        />
      </div>

      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {trip.hotel_info && (
          <p className="text-[11px] text-white/35 flex items-center gap-1.5">
            <span>🏨</span>
            <span className="truncate">{trip.hotel_info}</span>
          </p>
        )}
        <p className="text-[10px] text-white/20 mt-auto">
          Saved {new Date(trip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <Link
          href={`/itinerary/${trip.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-xs font-bold text-white transition-all hover:brightness-115"
          style={{
            background: 'linear-gradient(135deg, rgba(255,90,95,0.18), rgba(139,92,246,0.18))',
            border: '1px solid rgba(255,90,95,0.28)',
          }}
        >
          View Trip →
        </Link>
      </div>
    </motion.div>
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router              = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const [trips,    setTrips]    = useState<TripRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [user, authLoading, router]);

  // Fetch user's saved trips
  useEffect(() => {
    if (!user) return;
    setFetching(true);
    supabase
      .from('itineraries')
      .select('id, destination, start_date, hotel_info, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setTrips(data as TripRow[]);
        setFetching(false);
      });
  }, [user]);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push('/');
  };

  if (authLoading || !user) return null;

  return (
    <main
      className="min-h-screen relative"
      style={{ backgroundColor: '#080b12' }}
    >
      {/* Grain */}
      <div
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.022] mix-blend-overlay"
        style={{ backgroundImage: GRAIN, backgroundSize: '180px 180px' }}
      />

      {/* Ambient */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] rounded-full blur-[160px] pointer-events-none"
        style={{ background: 'rgba(255,90,95,0.07)' }} />

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-white/6"
        style={{ background: 'rgba(8,11,18,0.85)', backdropFilter: 'blur(16px)' }}
      >
        <Link href="/" className="text-lg font-bold text-white tracking-tight">
          Travel<span className="text-[#ff5a5f]">OS</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-white/30 truncate max-w-[180px]">
            {user.email}
          </span>
          <Link
            href="/plan"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #ff5a5f, #ff8c5a)',
              boxShadow: '0 4px 16px -4px rgba(255,90,95,0.4)',
            }}
          >
            + New Trip
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-white/35 hover:text-white/70 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.08)' }}
          >
            {signingOut ? '…' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">

        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-1">
            My Trips
          </h1>
          <p className="text-white/35 text-sm">
            {fetching ? 'Loading…' : trips.length === 0
              ? 'No saved trips yet — generate your first one!'
              : `${trips.length} trip${trips.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>

        {/* Loading skeleton */}
        <AnimatePresence>
          {fetching && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="h-40 animate-shimmer" style={{ background: 'linear-gradient(90deg,rgba(255,255,255,0.03) 0%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 100%)', backgroundSize: '200% 100%' }} />
                  <div className="p-4 space-y-3">
                    <div className="h-4 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)', width: '60%' }} />
                    <div className="h-3 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.04)', width: '40%' }} />
                    <div className="h-9 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!fetching && trips.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-24"
          >
            <div className="text-6xl mb-6">🗺️</div>
            <h2 className="text-xl font-bold text-white mb-2">No trips saved yet</h2>
            <p className="text-white/35 text-sm mb-8 max-w-xs">
              Generate your first AI-crafted itinerary and it will appear here automatically.
            </p>
            <Link
              href="/plan"
              className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #ff5a5f, #ff8c5a)',
                boxShadow: '0 8px 32px -4px rgba(255,90,95,0.40)',
              }}
            >
              Plan My First Trip ✈️
            </Link>
          </motion.div>
        )}

        {/* Trips grid */}
        {!fetching && trips.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip, i) => (
              <TripCard key={trip.id} trip={trip} index={i} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
