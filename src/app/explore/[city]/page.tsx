import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Place } from '@/lib/places';
import { PlaceCardData } from '@/components/PlaceCard';
import { ExploreClient } from './ExploreClient';

interface PageProps {
  params: Promise<{ city: string }>;
}

// ── Vibe → section config ────────────────────────────────────────────────────
// Controls display label, icon, and neon accent colour per section.

const VIBE_SECTION: Record<string, { label: string; icon: string; accent: string; order: number }> = {
  'hidden-gem':     { label: 'Hidden Gems',    icon: '💎', accent: '#22c55e', order: 1 },
  'local-favorite': { label: 'Local Favorites', icon: '🏘️', accent: '#f97316', order: 2 },
  'viral-trend':    { label: 'Going Viral',     icon: '🔥', accent: '#a855f7', order: 3 },
  'classic':        { label: 'Timeless Picks',  icon: '🏛️', accent: '#3b82f6', order: 4 },
  'luxury-pick':    { label: 'Luxury Picks',    icon: '✨', accent: '#eab308', order: 5 },
  'budget-pick':    { label: 'Budget Gems',     icon: '💰', accent: '#06b6d4', order: 6 },
};

const DEFAULT_SECTION = { label: 'Scout Picks', icon: '📍', accent: '#ffffff', order: 99 };

// ── Map Place → PlaceCardData ─────────────────────────────────────────────────

function toCardData(place: Place): PlaceCardData {
  return {
    id: place.id ?? `${place.name}__${place.city}`.replace(/\s+/g, '-').toLowerCase(),
    name: place.name,
    emoji: place.category_emoji,
    vibeLabel: place.vibe_label,
    description: place.description,
    lat: place.lat,
    lng: place.lng,
    socialProofUrl: place.social_proof_url,
    neighborhood: place.city,     // places from Scout Agent use city as location
    category: place.category,
    // status-aware verification fields
    verificationStatus:
      place.status === 'closed'      ? 'flagged-closed' :
      place.status === 'renovating'  ? 'flagged-renovating' :
      place.last_verified_at         ? 'verified-open' :
                                       undefined,
    verifiedAt: place.last_verified_at ?? undefined,
  };
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ExploreCityPage({ params }: PageProps) {
  const { city } = await params;

  // URL-decode and title-case the city (e.g. "new-york" → "New York")
  const cityDecoded = decodeURIComponent(city)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const { data, error } = await supabase
    .from('places')
    .select('*')
    .ilike('city', cityDecoded)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[explore/city] Supabase error:', error.message);
    return notFound();
  }

  const places = (data ?? []) as Place[];

  // Group by vibe_label, sorted by defined section order
  const grouped: Record<string, Place[]> = {};
  for (const place of places) {
    const key = place.vibe_label ?? 'other';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(place);
  }

  const sections = Object.entries(grouped)
    .map(([key, items]) => {
      const cfg = VIBE_SECTION[key] ?? { ...DEFAULT_SECTION, label: key };
      return {
        key,
        label: cfg.label,
        icon: cfg.icon,
        accentColor: cfg.accent,
        places: items.map(toCardData),
        order: cfg.order,
      };
    })
    .sort((a, b) => a.order - b.order);

  return (
    <ExploreClient
      city={cityDecoded}
      sections={sections}
      totalPlaces={places.length}
    />
  );
}

// ── Metadata ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps) {
  const { city } = await params;
  const cityDecoded = decodeURIComponent(city)
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return {
    title: `${cityDecoded} — Scout Picks · TravelOS`,
    description: `Hidden gems, viral spots & local favorites in ${cityDecoded}, verified by TravelOS Scout intelligence.`,
  };
}
