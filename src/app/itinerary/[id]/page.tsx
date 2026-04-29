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
  console.log('[itinerary/id] Fetching id:', id);

  if (!id || !UUID_RE.test(id)) {
    console.error('[itinerary/id] Invalid or missing id param:', id);
    return notFound();
  }

  const { data, error } = await supabase
    .from('itineraries')
    .select('itinerary_json')
    .eq('id', id)
    .single();

  if (error) {
    console.error('[itinerary/id] Supabase select error:', JSON.stringify(error));
    return notFound();
  }

  if (!data?.itinerary_json) {
    console.error('[itinerary/id] Row found but itinerary_json is empty. data:', JSON.stringify(data));
    return notFound();
  }

  // Profile was embedded under _profile when the row was inserted
  const { _profile, ...itinerary } = data.itinerary_json as Itinerary & { _profile?: TravelerProfile };

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

export function NotFound() {
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
