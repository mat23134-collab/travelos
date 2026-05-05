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

  // ── JOIN: fetch itinerary blob + items in parallel ─────────────────────────
  const [itinResult, itemsResult] = await Promise.all([
    supabase
      .from('itineraries')
      .select('itinerary_json')
      .eq('id', id)
      .single(),
    supabase
      .from('itinerary_items')
      .select('id, day_number, slot, item_type, item_json')
      .eq('itinerary_id', id)
      .order('day_number', { ascending: true })
      .order('item_order', { ascending: true }),
  ]);

  if (itinResult.error || !itinResult.data?.itinerary_json) {
    console.error('[itinerary/id] fetch failed:', JSON.stringify(itinResult.error));
    return notFound();
  }

  const { _profile, ...itinerary } = itinResult.data.itinerary_json as Itinerary & { _profile?: TravelerProfile };

  // Overlay item rows onto the blob so any post-save swaps (which update rows)
  // are always reflected — even if the blob write lagged.
  const items = itemsResult.data ?? [];
  if (items.length > 0) {
    for (const row of items as { id: string; day_number: number; slot: string; item_type: string; item_json: unknown }[]) {
      const dayIdx = row.day_number - 1;
      if (!itinerary.days || !itinerary.days[dayIdx] || !row.item_json) continue;
      const slot = row.slot as keyof typeof itinerary.days[number];
      // Merge item_id into the activity/dining object for targeted future swaps
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (itinerary.days[dayIdx] as any)[slot] = { ...(row.item_json as object), item_id: row.id };
    }
  }

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
