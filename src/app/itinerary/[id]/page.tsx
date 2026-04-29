import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ItineraryClient } from '@/components/ItineraryClient';
import { Itinerary, TravelerProfile } from '@/lib/types';

interface PageProps {
  params: { id: string };
}

export default async function ItineraryByIdPage({ params }: PageProps) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  let data, error;
  try {
    ({ data, error } = await supabase
      .from('itineraries')
      .select('itinerary_json')
      .eq('id', params.id)
      .abortSignal(controller.signal)
      .single());
  } catch {
    return notFound();
  } finally {
    clearTimeout(timeout);
  }

  if (error || !data?.itinerary_json) return notFound();

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
  const { data } = await supabase
    .from('itineraries')
    .select('destination')
    .eq('id', params.id)
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
