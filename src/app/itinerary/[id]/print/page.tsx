import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ItineraryPrintView } from '@/components/ItineraryPrintView';
import { Itinerary, TravelerProfile } from '@/lib/types';

interface PageProps {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ItineraryPrintPage({ params }: PageProps) {
  const { id } = await params;

  if (!id || id === 'undefined' || id === 'null' || !UUID_RE.test(id)) {
    return notFound();
  }

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
    console.error('[itinerary/id/print] unexpected fetch error:', err instanceof Error ? err.message : err);
    return notFound();
  }

  if (fetchErrMsg || !itinData?.itinerary_json) {
    console.error('[itinerary/id/print] fetch failed:', fetchErrMsg || 'empty data');
    return notFound();
  }

  const { _profile, ...itinerary } = itinData.itinerary_json as Itinerary & { _profile?: TravelerProfile };
  if (!itinerary._id) itinerary._id = id;

  return <ItineraryPrintView itinerary={itinerary} />;
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
      title: `${destination} Itinerary (Print) — TravelOS`,
    };
  } catch {
    return { title: 'TravelOS' };
  }
}
