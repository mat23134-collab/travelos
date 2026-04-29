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

  if (!id || id === 'undefined' || id === 'null' || !UUID_RE.test(id)) {
    console.error('[itinerary/id] Invalid or missing id param:', id);
    return notFound();
  }

  const { data, error } = await supabase
    .from('itineraries')
    .select('itinerary_json, status, destination')
    .eq('id', id)
    .single();

  // Log but don't 404 on column-missing errors — the status column may not
  // exist yet if the migration hasn't been run. Fall back to checking itinerary_json.
  if (error) {
    console.error('[itinerary/id] Supabase select error:', JSON.stringify(error));

    // Try a narrower select that only needs the original columns
    const { data: fallback, error: fallbackErr } = await supabase
      .from('itineraries')
      .select('itinerary_json, destination')
      .eq('id', id)
      .single();

    if (fallbackErr || !fallback) {
      console.error('[itinerary/id] Fallback select also failed:', JSON.stringify(fallbackErr));
      return notFound();
    }

    if (!fallback.itinerary_json) {
      // Row exists but no data yet — treat as generating
      return (
        <ItineraryClient
          initialItinerary={null}
          initialProfile={null}
          initialViewMode="final"
          itineraryId={id}
          isGenerating={true}
          generatingDestination={fallback.destination ?? ''}
        />
      );
    }

    const { _profile: _p2, ...itin2 } = fallback.itinerary_json as Itinerary & { _profile?: TravelerProfile };
    return (
      <ItineraryClient
        initialItinerary={itin2}
        initialProfile={_p2 ?? null}
        initialViewMode="final"
      />
    );
  }

  if (!data) {
    console.error('[itinerary/id] Row not found for id:', id);
    return notFound();
  }

  // Still generating — render polling UI; worker will be fired from the client
  if (!data.itinerary_json || data.status === 'generating') {
    console.log('[itinerary/id] Status is generating — rendering polling UI');
    return (
      <ItineraryClient
        initialItinerary={null}
        initialProfile={null}
        initialViewMode="final"
        itineraryId={id}
        isGenerating={true}
        generatingDestination={data.destination ?? ''}
      />
    );
  }

  // Generation previously failed
  if (data.status === 'failed') {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-[#111827] mb-2">Generation failed</h2>
        <p className="text-[#6b7280] mb-6">Something went wrong building your itinerary. Please try again.</p>
        <Link href="/plan" className="px-6 py-3 rounded-xl bg-[#ff5a5f] text-white font-semibold text-sm hover:bg-[#e04a4f] transition-colors">
          Plan a New Trip ✈️
        </Link>
      </div>
    );
  }

  // Done — render normally
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
