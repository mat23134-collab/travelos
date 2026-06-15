// src/lib/placesQuery.ts
import { createClient } from '@supabase/supabase-js';
import type { Activity } from './types';
import type { SlotKey, PlaceRow } from './assistantTypes';

const SLOT_CATEGORIES: Record<SlotKey, string[]> = {
  breakfast: ['cafe', 'restaurant'],
  lunch:     ['restaurant', 'cafe', 'bar'],
  dinner:    ['restaurant', 'cafe', 'bar'],
  morning:   ['attraction', 'tourism_site', 'nature', 'market'],
  afternoon: ['attraction', 'tourism_site', 'nature', 'market'],
  evening:   ['attraction', 'tourism_site', 'bar', 'nightlife'],
};

export function categoriesForSlot(slot: SlotKey): string[] {
  return SLOT_CATEGORIES[slot] ?? [];
}

export function placeRowToActivity(row: PlaceRow): Activity {
  return {
    name: row.name,
    description: row.description ?? undefined,
    latitude: row.lat ?? undefined,
    longitude: row.lng ?? undefined,
    website_url: row.website_url ?? undefined,
    category_emoji: row.category_emoji ?? undefined,
    tags: Array.isArray(row.vibe) ? row.vibe : [],
    inventory_id: row.id,
    inventory_source_table: 'places',
  };
}

const PLACE_COLS =
  'id, name, city, category, description, lat, lng, category_emoji, vibe, group_suitability, culinary_focus, google_rating, popularity_rank, website_url, vibe_label';

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Real candidate places for a slot, ranked by popularity then rating. */
export async function findAlternativePlaces(args: {
  city: string;
  slot: SlotKey;
  excludeName?: string;
  limit?: number;
}): Promise<PlaceRow[]> {
  const { city, slot, excludeName, limit = 6 } = args;
  const cats = categoriesForSlot(slot);
  if (!city.trim() || cats.length === 0) return [];

  const db = dbClient();
  let q = db
    .from('places')
    .select(PLACE_COLS)
    .ilike('city', city.trim())
    .in('category', cats)
    .eq('status', 'active')
    .order('popularity_rank', { ascending: true, nullsFirst: false })
    .order('google_rating', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (excludeName?.trim()) q = q.neq('name', excludeName.trim());

  const { data, error } = await q;
  if (error) {
    console.warn('[placesQuery] findAlternativePlaces failed:', error.message);
    return [];
  }
  return (data ?? []) as PlaceRow[];
}
