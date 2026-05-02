/**
 * places.ts — shared Place type and Supabase query helpers.
 * Used by:
 *   • scripts/scout-agent.ts  (write path — service-role key)
 *   • src/app/api/generate/route.ts  (read path — anon key, public data only)
 */

import { supabase } from './supabase';

// ── Place shape (mirrors the Supabase `places` table) ────────────────────────

export interface Place {
  id?: string;
  city: string;
  name: string;
  category: string;           // restaurant | bar | cafe | attraction | market | …
  description: string;        // the "Secret Sauce" — why locals love it
  lat: number;
  lng: number;
  category_emoji: string;     // single emoji
  social_proof_url: string | null; // TikTok / Instagram URL if known
  vibe_label: string;         // hidden-gem | local-favorite | viral-trend | …
  created_at?: string;
}

// ── Read: pull pre-scouted places for a city ─────────────────────────────────

export async function queryPlacesForCity(
  city: string,
  limit = 15,
): Promise<Place[]> {
  if (!city?.trim()) return [];

  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .ilike('city', city.trim())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[places] query error:', error.message);
      return [];
    }
    return (data ?? []) as Place[];
  } catch (err) {
    console.warn('[places] unexpected error:', err);
    return [];
  }
}

// ── Format: render places as a prompt block ───────────────────────────────────

export function formatPlacesForPrompt(places: Place[]): string {
  if (places.length === 0) return '';

  // Group by category for readability
  const grouped: Record<string, Place[]> = {};
  for (const p of places) {
    const cat = p.category ?? 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  }

  const sections = Object.entries(grouped).map(([cat, items]) => {
    const lines = items.map(
      (p) =>
        `  • ${p.category_emoji} ${p.name} [${p.vibe_label}]` +
        `\n    Secret Sauce: ${p.description}` +
        (p.social_proof_url ? `\n    Social proof: ${p.social_proof_url}` : '') +
        `\n    GPS: ${p.lat}, ${p.lng}`,
    );
    return `${cat.toUpperCase()}:\n${lines.join('\n\n')}`;
  });

  const city = places[0]?.city ?? '';

  return `
════════════════════════════════════════════════════════
VERIFIED INTERNAL DATA — TravelOS Scout intelligence for ${city}
${places.length} pre-researched, GPS-verified, vibe-classified places
════════════════════════════════════════════════════════

${sections.join('\n\n')}

INTERNAL DATA RULES:
1. PRIORITIZE these scouted places over generic knowledge — they are verified
2. hidden-gem / local-favorite entries get top billing in the itinerary
3. viral-trend entries fit well in evening or social slots
4. Use the "Secret Sauce" description in the whyThis field (cite as "TravelOS Scout")
5. Latitude/longitude from this block are pre-verified — copy them directly into the activity
════════════════════════════════════════════════════════`;
}
