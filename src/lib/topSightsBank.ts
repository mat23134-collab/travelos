/**
 * topSightsBank — data-access helpers for the "Our Picks" curated bank
 * (public.places rows with top_pick_category set). Mirrors restaurantBank.ts.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { TopSightRecord } from '@/lib/topSightsScoutAgent';

/** True when this city already has at least one curated top-sight row. */
export async function cityHasTopSights(sb: SupabaseClient, city: string): Promise<boolean> {
  const cityOnly = city.split(',')[0].trim();
  if (!cityOnly) return false;
  const { data, error } = await sb
    .from('places')
    .select('id')
    .ilike('city', cityOnly)
    .not('top_pick_category', 'is', null)
    .limit(1);
  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/** Upsert a batch of top-sight records via the upsert_top_sight RPC (one call per row). */
export async function upsertTopSights(sb: SupabaseClient, rows: TopSightRecord[]): Promise<number> {
  let ok = 0;
  for (const r of rows) {
    const { error } = await sb.rpc('upsert_top_sight', {
      _name: r.name,
      _city: r.city,
      _category: r.category,
      _top_pick_category: r.topPickCategory,
      _popularity_rank: r.popularityRank,
      _description: r.description,
      _description_he: r.descriptionHe,
      _category_emoji: r.categoryEmoji,
      _vibe_label: r.vibeLabel,
      _lat: r.latitude,
      _lng: r.longitude,
      _photo_url: r.photoUrl,
      _website_url: r.websiteUrl,
      _google_place_id: r.googlePlaceId,
      _google_rating: r.googleRating,
    });
    if (error) console.warn(`[topSightsBank] upsert failed for "${r.name}" (${r.city}):`, error.message);
    else ok++;
  }
  return ok;
}
