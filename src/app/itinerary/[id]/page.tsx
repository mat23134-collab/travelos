import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ItineraryClient } from '@/components/ItineraryClient';
import { Itinerary, TravelerProfile } from '@/lib/types';

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

  return (
    <ItineraryClient
      initialItinerary={itinerary}
      initialProfile={_profile ?? null}
      initialViewMode="final"
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
    <div className="min-h-screen bg-[#f8f7f2] flex flex-col items-center justify-center px-6 text-center">
      <div className="text-4xl mb-4">🗺️</div>
      <h2 className="text-xl font-bold text-[#111827] mb-2 tracking-tight">Itinerary not found</h2>
      <p className="text-[#6b7280] mb-6">This link may have expired or the trip no longer exists.</p>
      <Link href="/plan" className="px-6 py-3 rounded-xl bg-[#ff5a5f] text-white font-semibold text-sm hover:bg-[#e04a4f] transition-colors">
        Plan a New Trip ✈️
      </Link>
    </div>
  );
}
