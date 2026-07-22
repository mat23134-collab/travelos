'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { BrandWordmark } from '@/components/BrandWordmark';
import { MarketingConsentPrompt } from '@/components/MarketingConsentPrompt';
import { supabaseAuth } from '@/lib/supabase';
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';

// ── Types ─────────────────────────────────────────────────────────────────────

interface TripRow {
  id:          string;
  destination: string;
  start_date:  string | null;
  hotel_info:  string | { name?: string; address?: string } | null;
  created_at:  string;
  shared?:     boolean;
}

function hotelInfoText(v: TripRow['hotel_info']): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return v.name || v.address || '';
}

// ── Grain texture ─────────────────────────────────────────────────────────────
const GRAIN = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

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
    // /api/photos is Pexels-backed (cache → live) and covers every city, unlike
    // /api/place-photo which needs a Google key that isn't configured.
    const params = new URLSearchParams({ q: `${destination} skyline`, orientation: 'landscape' });
    fetch(`/api/photos?${params}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) { setPhotoUrl(d.url ?? null); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [destination]);

  return { photoUrl, loading };
}

// ── Trip Card ─────────────────────────────────────────────────────────────────

function TripCard({ trip, index, onDelete }: { trip: TripRow; index: number; onDelete: (trip: TripRow) => void }) {
  const shared = trip.shared === true;
  const { photoUrl } = useTripPhoto(trip.destination);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError,  setImgError]  = useState(false);
  // Guaranteed curated city photo (city → country → rotating fallback) — never an emoji.
  const fallbackPhoto = resolveBackgroundImage(trip.destination, index);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 340, damping: 28 }}
      className="rounded-3xl overflow-hidden flex flex-col group"
      style={{
        background: '#fffdf7',
        border: '1px solid rgba(43,38,34,0.08)',
        boxShadow: '0 4px 16px rgba(43,38,34,0.08)',
      }}
    >
      {/* Photo header */}
      <div className="relative overflow-hidden" style={{ height: 160 }}>
        {/* Base — guaranteed curated city photo (never an emoji) */}
        <img
          src={fallbackPhoto}
          alt={trip.destination}
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Enhancement — live place photo fades in over the base when available */}
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
        {/* Bottom gradient — always present for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/80 to-transparent" />
        {/* Destination overlay */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-3 z-10">
          {shared && (
            <span
              className="inline-block text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5"
              style={{ background: 'rgba(74,123,222,0.35)', border: '1px solid rgba(74,123,222,0.5)', color: '#c8d9ff' }}
            >
              Shared with you
            </span>
          )}
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
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(184,85,46,0.7) 50%, transparent 95%)' }}
        />
      </div>

      {/* Card body */}
      <div className="flex-1 p-4 flex flex-col gap-3">
        {hotelInfoText(trip.hotel_info) && (
          <p className="text-[11px] text-[#6b6358] flex items-center gap-1.5">
            <span>🏨</span>
            <span className="truncate">{hotelInfoText(trip.hotel_info)}</span>
          </p>
        )}
        <p className="text-[10px] text-[#9a8f7e] mt-auto">
          Saved {new Date(trip.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href={`/itinerary/${trip.id}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-[#8f4220] transition-all hover:brightness-105"
            style={{
              background: 'linear-gradient(135deg, rgba(184,85,46,0.18), rgba(240,201,138,0.28))',
              border: '1px solid rgba(184,85,46,0.28)',
            }}
          >
            View Trip →
          </Link>
          {/* Only the owner can remove a trip from their history — a shared/
              collaborator card has no delete action. */}
          {!shared && (
            <button
              type="button"
              onClick={() => onDelete(trip)}
              aria-label="Delete trip"
              title="Delete trip"
              className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-[13px] transition-colors hover:bg-[rgba(184,45,45,0.10)]"
              style={{ border: '1px solid rgba(43,38,34,0.12)', color: '#9a8f7e' }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/** Centered confirm dialog for deleting a trip — portaled to <body> so it's
 *  never clipped by a card's own bounds (same reasoning/pattern as
 *  StopBinder's StatusMenu). Soft-delete only: the trip disappears from view,
 *  the row and all its data stay intact in the database. */
function ConfirmDeleteModal({
  trip, busy, onCancel, onConfirm,
}: {
  trip: TripRow | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!trip) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [trip, onCancel]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {trip && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="fixed inset-0 bg-[#1a130c]/55 backdrop-blur-md" onClick={busy ? undefined : onCancel} />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative z-10 w-full max-w-[340px] p-5 rounded-2xl"
            style={{ background: '#fffdf7', boxShadow: '0 24px 60px -12px rgba(26,19,12,0.55)' }}
          >
            <div className="text-3xl mb-2">🗑️</div>
            <h3 className="text-[15px] font-black text-[#2b2622] mb-1.5">Delete this trip?</h3>
            <p className="text-[12.5px] text-[#6b6358] leading-relaxed mb-4">
              “{trip.destination}” will disappear from your trip history. You can undo this for a few seconds right after.
            </p>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="text-[12.5px] font-semibold px-4 py-2 rounded-xl disabled:opacity-50"
                style={{ color: '#6b6358' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className="text-[12.5px] font-bold px-4 py-2 rounded-xl text-white disabled:opacity-50"
                style={{ background: '#b8552e' }}
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Brief "trip removed" toast with an Undo action — auto-dismisses. */
function UndoToast({ trip, onUndo }: { trip: TripRow | null; onUndo: () => void }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {trip && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          className="fixed bottom-5 inset-x-0 z-[210] flex justify-center px-4"
        >
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl"
            style={{ background: '#1a130c', boxShadow: '0 12px 40px -8px rgba(0,0,0,0.5)' }}
          >
            <span className="text-[12.5px] text-white/90">“{trip.destination}” removed from your trips</span>
            <button
              type="button"
              onClick={onUndo}
              className="text-[12.5px] font-bold px-3 py-1.5 rounded-lg text-white shrink-0"
              style={{ background: 'rgba(255,255,255,0.14)' }}
            >
              Undo
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// ── Dashboard Page ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router              = useRouter();
  const { user, session, loading: authLoading, signOut } = useAuth();
  const [trips,    setTrips]    = useState<TripRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [confirmDeleteTrip, setConfirmDeleteTrip] = useState<TripRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [undoTrip, setUndoTrip] = useState<TripRow | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimerRef.current) clearTimeout(undoTimerRef.current); }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth');
  }, [user, authLoading, router]);

  // Fetch user's saved trips — isolated from auth, full error handling
  const fetchTrips = async (uid: string) => {
    setFetching(true);
    setFetchError('');
    try {
      const { data: owned, error: e1 } = await supabaseAuth
        .from('itineraries')
        .select('id, destination, start_date, hotel_info, created_at')
        .eq('user_id', uid)
        .is('archived_at', null)
        .order('created_at', { ascending: false });

      if (e1) {
        console.error('[dashboard] itineraries query error:', e1.message);
        setFetchError('Could not load trips right now. Tap Retry to try again.');
        setTrips([]);
        return;
      }

      const { data: shareRows, error: e2 } = await supabaseAuth
        .from('itinerary_shares')
        .select('itinerary_id')
        .eq('shared_with_user_id', uid);

      if (e2) {
        console.warn('[dashboard] itinerary_shares query:', e2.message);
      }

      const sharedIds = [...new Set((shareRows ?? []).map((r) => r.itinerary_id as string))].filter(Boolean);
      let borrowed: TripRow[] = [];
      if (sharedIds.length > 0) {
        const { data: b, error: e3 } = await supabaseAuth
          .from('itineraries')
          .select('id, destination, start_date, hotel_info, created_at')
          .in('id', sharedIds)
          .is('archived_at', null);
        if (!e3 && b) {
          borrowed = (b as TripRow[]).map((t) => ({ ...t, shared: true }));
        }
      }

      const ownedRows: TripRow[] = (owned ?? []).map((t) => ({ ...(t as TripRow), shared: false }));
      const ownedIds = new Set(ownedRows.map((t) => t.id));
      const merged = [
        ...ownedRows,
        ...borrowed.filter((t) => !ownedIds.has(t.id)),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTrips(merged);
    } catch (err) {
      console.error('[dashboard] unexpected fetch error:', err instanceof Error ? err.message : err);
      setFetchError('Could not load trips right now. Tap Retry to try again.');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchTrips(user.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Soft delete: sets archived_at, which the fetch query above filters out —
  // the row and every Binder/note/budget table hanging off it stays intact in
  // the database. RLS's owner-only policy on itineraries backs this up
  // server-side regardless of what the client sends.
  async function confirmDelete() {
    if (!confirmDeleteTrip || !user) return;
    const trip = confirmDeleteTrip;
    setDeleting(true);
    const { error } = await supabaseAuth
      .from('itineraries')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', trip.id)
      .eq('user_id', user.id);
    setDeleting(false);
    setConfirmDeleteTrip(null);
    if (error) {
      console.error('[dashboard] archive trip failed:', error.message);
      setFetchError('Could not delete this trip. Please try again.');
      return;
    }
    setTrips((prev) => prev.filter((t) => t.id !== trip.id));
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoTrip(trip);
    undoTimerRef.current = setTimeout(() => setUndoTrip(null), 7000);
  }

  async function undoDelete() {
    if (!undoTrip) return;
    const trip = undoTrip;
    setUndoTrip(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    const { error } = await supabaseAuth.from('itineraries').update({ archived_at: null }).eq('id', trip.id);
    if (error) {
      console.error('[dashboard] restore trip failed:', error.message);
      return;
    }
    setTrips((prev) => [trip, ...prev].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  }

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.push('/');
  };

  if (authLoading || !user) return null;

  return (
    <main
      className="min-h-screen relative"
      style={{ backgroundColor: '#efe3cd' }}
    >

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4 border-b border-[rgba(43,38,34,0.08)]"
        style={{
          background: 'rgba(247,241,231,0.92)',
          backdropFilter: 'blur(16px)',
          // Pad clear of the iOS status bar when installed as a home-screen
          // PWA (viewportFit: cover in layout.tsx lets this bar sit under it).
          paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        }}
      >
        <Link href="/" className="text-lg text-[#2b2622] tracking-tight">
          <BrandWordmark accent="#b8552e" tone="light" className="text-lg" />
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-[#6b6358] truncate max-w-[180px]">
            {user.email}
          </span>
          <Link
            href="/onboarding"
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #b8552e, #cf6a3f)',
              boxShadow: '0 4px 16px -4px rgba(184,85,46,0.40)',
            }}
          >
            + New Trip
          </Link>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-3 py-2 rounded-xl text-xs font-semibold text-[#6b6358] hover:text-[#2b2622] transition-colors"
            style={{ border: '1px solid rgba(43,38,34,0.25)' }}
          >
            {signingOut ? '…' : 'Sign Out'}
          </button>
        </div>
      </header>

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-10">

        <MarketingConsentPrompt accessToken={session?.access_token} />

        {/* Page title */}
        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl font-black text-[#2b2622] tracking-tight mb-1">
            My Trips
          </h1>
          <p className="text-[#6b6358] text-sm">
            {fetching ? 'Loading…' : fetchError ? 'Could not load your trips' : trips.length === 0
              ? 'No saved trips yet — generate your first one!'
              : `${trips.length} trip${trips.length !== 1 ? 's' : ''} saved`}
          </p>
        </div>

        {/* Fetch error state */}
        {!fetching && fetchError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-24"
          >
            <div className="text-5xl mb-5">⚠️</div>
            <h2 className="text-lg font-bold text-[#2b2622] mb-2">Couldn't load your trips</h2>
            <p className="text-[#6b6358] text-sm mb-8 max-w-xs">{fetchError}</p>
            <button
              onClick={() => user && fetchTrips(user.id)}
              className="px-8 py-3 rounded-2xl text-sm font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #b8552e, #cf6a3f)', boxShadow: '0 8px 32px -4px rgba(184,85,46,0.40)' }}
            >
              Retry
            </button>
          </motion.div>
        )}

        {/* Loading skeleton */}
        <AnimatePresence>
          {fetching && (
            <motion.div
              initial={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-3xl overflow-hidden" style={{ background: 'rgba(43,38,34,0.03)', border: '1px solid rgba(43,38,34,0.06)' }}>
                  <div className="h-40 animate-shimmer" style={{ background: 'linear-gradient(90deg,rgba(43,38,34,0.03) 0%,rgba(43,38,34,0.07) 50%,rgba(43,38,34,0.03) 100%)', backgroundSize: '200% 100%' }} />
                  <div className="p-4 space-y-3">
                    <div className="h-4 rounded-full animate-pulse" style={{ background: 'rgba(43,38,34,0.06)', width: '60%' }} />
                    <div className="h-3 rounded-full animate-pulse" style={{ background: 'rgba(43,38,34,0.04)', width: '40%' }} />
                    <div className="h-9 rounded-xl animate-pulse" style={{ background: 'rgba(43,38,34,0.05)' }} />
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!fetching && !fetchError && trips.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-24"
          >
            <div className="text-6xl mb-6">🗺️</div>
            <h2 className="text-xl font-bold text-[#2b2622] mb-2">No trips saved yet</h2>
            <p className="text-[#6b6358] text-sm mb-8 max-w-xs">
              Generate your first AI-crafted itinerary and it will appear here automatically.
            </p>
            <Link
              href="/onboarding"
              className="px-8 py-3.5 rounded-2xl text-sm font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #b8552e, #cf6a3f)',
                boxShadow: '0 8px 32px -4px rgba(184,85,46,0.40)',
              }}
            >
              Plan My First Trip ✈️
            </Link>
          </motion.div>
        )}

        {/* Trips grid */}
        {!fetching && !fetchError && trips.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trips.map((trip, i) => (
              <TripCard key={trip.id} trip={trip} index={i} onDelete={setConfirmDeleteTrip} />
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteModal
        trip={confirmDeleteTrip}
        busy={deleting}
        onCancel={() => setConfirmDeleteTrip(null)}
        onConfirm={confirmDelete}
      />
      <UndoToast trip={undoTrip} onUndo={undoDelete} />
    </main>
  );
}
