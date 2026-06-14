import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ItineraryClient } from '@/components/ItineraryClient';
import { Itinerary, TravelerProfile, type CityTransportGuide } from '@/lib/types';
import { fetchTransportGuideForCity, ensureTransportationForCity } from '@/lib/tripTransport';
import { createServiceRoleClient } from '@/lib/supabaseService';

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ItineraryByIdPage({ params }: PageProps) {
  const { id } = await params;
  console.log('[itinerary/id] fetching:', id);

  if (!id || id === 'undefined' || id === 'null' || !UUID_RE.test(id)) {
    console.error('[itinerary/id] invalid id:', id);
    return notFound();
  }

  // ── Primary fetch: itinerary blob ─────────────────────────────────────────
  // NOTE: we intentionally do NOT join itinerary_items here.  The blob already
  // contains the latest data (item_ids embedded, swaps synced back to
  // itinerary_json by the swap route).  Querying itinerary_items server-side
  // risks triggering a PostgREST schema-cache error if the table is missing or
  // has a schema mismatch — which would then cascade and break auth calls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itinData: any = null;
  let fetchErrMsg = '';

  try {
    const result = await supabase
      .from('itineraries')
      .select('itinerary_json')
      .eq('id', id)
      .single();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    itinData    = result.data as any;
    fetchErrMsg = (result.error as { message?: string } | null)?.message ?? '';
  } catch (err) {
    console.error('[itinerary/id] unexpected fetch error:', err instanceof Error ? err.message : err);
    return notFound();
  }

  if (fetchErrMsg || !itinData?.itinerary_json) {
    console.error('[itinerary/id] fetch failed:', fetchErrMsg || 'empty data');
    return notFound();
  }

  const { _profile, ...itinerary } = itinData.itinerary_json as Itinerary & { _profile?: TravelerProfile };
  // _id may be missing from the blob when the background write races the client
  // navigation. Always stamp it from the URL param so SharePanel + swap routes
  // always have a valid itineraryDbId.
  if (!itinerary._id) itinerary._id = id;

  const city = (itinerary.destination ?? '').trim();
  let transportFromDb: CityTransportGuide | null = null;
  let tripSummaryUsername: string | null = null;
  let ownerUserId: string | null = null;
  let ownerUsername: string | null = null;
  let collaborators: { userId: string; username: string }[] = [];

  const tripsClient = createServiceRoleClient() ?? supabase;
  try {
    const { data: tripRow, error: tripErr } = await tripsClient
      .from('trips')
      .select('username')
      .eq('itinerary_id', id)
      .maybeSingle();
    if (tripErr) {
      console.warn('[itinerary/id] trips select:', tripErr.message);
    } else {
      const u = tripRow?.username;
      tripSummaryUsername = typeof u === 'string' && u.trim() ? u.trim() : null;
    }
  } catch (e) {
    console.warn('[itinerary/id] trips fetch skipped:', e instanceof Error ? e.message : e);
  }

  // ── Shared-trip collaborators ──────────────────────────────────────────────
  // Uses the service-role client (bypasses RLS) purely for read-only display
  // of "who's on this trip" — owner + everyone who joined via the share link.
  try {
    const { data: ownerRow, error: ownerErr } = await tripsClient
      .from('itineraries')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (ownerErr) {
      console.warn('[itinerary/id] owner select:', ownerErr.message);
    } else {
      ownerUserId = ownerRow?.user_id ?? null;
    }

    if (ownerUserId) {
      const { data: ownerProfile } = await tripsClient
        .from('profiles')
        .select('username')
        .eq('id', ownerUserId)
        .maybeSingle();
      ownerUsername = ownerProfile?.username ?? null;
    }

    const { data: shareRows, error: shareErr } = await tripsClient
      .from('itinerary_shares')
      .select('shared_with_user_id')
      .eq('itinerary_id', id);
    if (shareErr) {
      console.warn('[itinerary/id] itinerary_shares select:', shareErr.message);
    } else {
      const collaboratorIds = (shareRows ?? [])
        .map((r) => r.shared_with_user_id as string | null)
        .filter((v): v is string => !!v);
      if (collaboratorIds.length > 0) {
        const { data: profileRows } = await tripsClient
          .from('profiles')
          .select('id, username')
          .in('id', collaboratorIds);
        collaborators = (profileRows ?? [])
          .filter((p) => typeof p.username === 'string' && p.username.trim())
          .map((p) => ({ userId: p.id as string, username: p.username as string }));
      }
    }
  } catch (e) {
    console.warn('[itinerary/id] collaborators fetch skipped:', e instanceof Error ? e.message : e);
  }

  if (city) {
    try {
      transportFromDb = await fetchTransportGuideForCity(supabase, city);
    } catch (e) {
      console.warn('[itinerary/id] transportation fetch skipped:', e instanceof Error ? e.message : e);
    }
    if (!transportFromDb) {
      // Scout is missing for this city — fire in the background so the next
      // page load will have the data. Uses service-role client (bypasses RLS).
      const scoutClient = createServiceRoleClient();
      if (scoutClient) {
        void ensureTransportationForCity(scoutClient, city).catch((e) =>
          console.warn('[itinerary/id] background transport scout failed:', e instanceof Error ? e.message : e)
        );
      }
    }
  }

  return (
    <ItineraryClient
      initialItinerary={itinerary}
      initialProfile={_profile ?? null}
      initialViewMode="final"
      initialTransportFromDb={transportFromDb}
      initialTripSummaryUsername={tripSummaryUsername}
      ownerUserId={ownerUserId}
      ownerUsername={ownerUsername}
      collaborators={collaborators}
    />
  );
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  if (!UUID_RE.test(id ?? '')) return { title: 'TravelOS' };

  try {
    const { data } = await supabase
      .from('itineraries')
      .select('destination')
      .eq('id', id)
      .single();

    const destination = data?.destination ?? 'Your Trip';
    return {
      title: `${destination} Itinerary — TravelOS`,
      description: `AI-crafted itinerary for ${destination}, built by TravelOS.`,
    };
  } catch {
    return { title: 'TravelOS' };
  }
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ backgroundColor: '#091f36' }}>
      <div className="text-4xl mb-4">🗺️</div>
      <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Itinerary not found</h2>
      <p className="text-white/50 mb-6">This link may have expired or the trip no longer exists.</p>
      <Link
        href="/onboarding"
        className="px-6 py-3 rounded-xl text-white font-semibold text-sm transition-colors"
        style={{ background: '#9e363a' }}
      >
        Plan a New Trip ✈️
      </Link>
    </div>
  );
}
