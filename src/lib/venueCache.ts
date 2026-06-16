/**
 * venueCache.ts — warm-cache writes for the public.places table.
 *
 * After the LLM returns an itinerary (and Google Places verification has
 * filled in photo_url, website_url, google_place_id), every named venue is
 * upserted into `places`. Future trips to the same destination read these
 * rows via getFilteredInventory() in scoringEngine.ts.
 *
 * Shared by both /api/generate and /api/generate-stream to keep the seed
 * shape and dedupe logic identical.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Activity, DiningSpot, TravelerProfile } from '@/lib/types';
import { classifyActivity } from '@/lib/activityGenre';
import { deriveSubcategory, deriveMealSlots, derivePriceTier, defaultOpeningHours } from '@/services/placeClassify';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Activity payload augmented with the fields set by placeVerification.ts. */
export type VerifiedActivity = Activity & {
  photo_url?:       string;
  website_url?:     string | null;
  google_place_id?: string;
  google_rating?:   number;
};

export type VerifiedDining = DiningSpot & {
  photo_url?:       string;
  website_url?:     string | null;
  google_place_id?: string;
  google_rating?:   number;
};

export interface SeedTagContext {
  vibe: string[];
  group_suitability: string[];
  culinary_focus: string[];
}

export interface PlaceSeed {
  city: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  category_emoji: string;
  social_proof_url: string | null;
  vibe_label: string;
  photo_url:       string | null;
  website_url:     string | null;
  google_place_id: string | null;
  google_rating:   number | null;
  vibe:              string[];
  group_suitability: string[];
  culinary_focus:    string[];
  // Assembler columns (ADR-001) — derived free so AI venues are reusable offline.
  subcategory:    string;
  meal_slots:     string[];
  price_tier:     number | null;
  opening_hours:  Record<string, unknown> | null;
}

// ── Seed builders ─────────────────────────────────────────────────────────────

export function activityToPlaceSeed(
  city: string,
  activity: VerifiedActivity,
  slot: 'morning' | 'afternoon' | 'evening',
  tags: SeedTagContext,
): PlaceSeed | null {
  const name = typeof activity.name === 'string' ? activity.name.trim() : '';
  const lat = Number(activity.latitude);
  const lng = Number(activity.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const genre = classifyActivity(activity);
  const category =
    genre === 'food'      ? 'restaurant' :
    genre === 'shopping'  ? 'market' :
    genre === 'nightlife' ? 'bar' :
                            'attraction';

  const desc =
    (typeof activity.description === 'string' && activity.description) ||
    (typeof activity.whyThis === 'string' && activity.whyThis) ||
    `Suggested ${slot} ${category} in ${city}`;

  return {
    city,
    name,
    category,
    description: desc.slice(0, 500),
    lat,
    lng,
    category_emoji: typeof activity.category_emoji === 'string' ? activity.category_emoji : '📍',
    social_proof_url: null,
    vibe_label: typeof activity.vibeLabel === 'string' ? activity.vibeLabel : 'local-favorite',
    photo_url:       activity.photo_url ?? null,
    website_url:     activity.website_url ?? null,
    google_place_id: activity.google_place_id ?? null,
    google_rating:   typeof activity.google_rating === 'number' ? activity.google_rating : null,
    vibe:              tags.vibe,
    group_suitability: tags.group_suitability,
    culinary_focus:    tags.culinary_focus,
    subcategory:       deriveSubcategory(name, category),
    meal_slots:        deriveMealSlots(category),
    price_tier:        derivePriceTier(category, `${name} ${desc} ${typeof activity.vibeLabel === 'string' ? activity.vibeLabel : ''}`),
    opening_hours:     defaultOpeningHours(category),
  };
}

export function diningToPlaceSeed(
  city: string,
  spot: VerifiedDining,
  meal: 'breakfast' | 'lunch' | 'dinner',
  tags: SeedTagContext,
): PlaceSeed | null {
  const name = typeof spot.name === 'string' ? spot.name.trim() : '';
  const lat = Number(spot.latitude);
  const lng = Number(spot.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cuisine = typeof spot.cuisine === 'string' ? spot.cuisine.trim() : '';
  const mustTry = typeof spot.mustTry === 'string' ? spot.mustTry.trim() : '';
  const description =
    [mustTry && `Must try: ${mustTry}`, cuisine && `Cuisine: ${cuisine}`]
      .filter(Boolean)
      .join(' · ') || `Recommended ${meal} spot in ${city}`;

  const culinary = cuisine
    ? Array.from(new Set([...tags.culinary_focus, cuisine.toLowerCase()]))
    : tags.culinary_focus;

  return {
    city,
    name,
    category: meal === 'breakfast' ? 'cafe' : 'restaurant',
    description: description.slice(0, 500),
    lat,
    lng,
    category_emoji: meal === 'breakfast' ? '☕' : meal === 'lunch' ? '🍽️' : '🌙',
    social_proof_url: null,
    vibe_label: 'local-favorite',
    photo_url:       spot.photo_url ?? null,
    website_url:     spot.website_url ?? null,
    google_place_id: spot.google_place_id ?? null,
    google_rating:   typeof spot.google_rating === 'number' ? spot.google_rating : null,
    vibe:              tags.vibe,
    group_suitability: tags.group_suitability,
    culinary_focus:    culinary,
    subcategory:       meal === 'breakfast' ? 'cafe' : 'restaurant',
    meal_slots:        meal === 'breakfast' ? ['breakfast', 'brunch', 'lunch'] : ['lunch', 'dinner'],
    price_tier:        derivePriceTier(meal === 'breakfast' ? 'cafe' : 'restaurant', `${name} ${description} ${cuisine}`),
    opening_hours:     defaultOpeningHours(meal === 'breakfast' ? 'cafe' : 'restaurant'),
  };
}

// ── Itinerary walker ──────────────────────────────────────────────────────────

export function collectPlaceSeeds(
  itineraryObj: Record<string, unknown>,
  city: string,
  tags: SeedTagContext,
): PlaceSeed[] {
  const days = Array.isArray(itineraryObj.days) ? itineraryObj.days : [];
  const seeds: PlaceSeed[] = [];

  for (const d of days) {
    const day = (d ?? {}) as Record<string, unknown>;
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const act = day[slot];
      if (act && typeof act === 'object') {
        const seed = activityToPlaceSeed(city, act as VerifiedActivity, slot, tags);
        if (seed) seeds.push(seed);
      }
    }
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const spot = day[meal];
      if (spot && typeof spot === 'object') {
        const seed = diningToPlaceSeed(city, spot as VerifiedDining, meal, tags);
        if (seed) seeds.push(seed);
      }
    }
  }

  const seen = new Set<string>();
  return seeds.filter((s) => {
    const key = `${s.city.toLowerCase()}__${s.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Upsert ────────────────────────────────────────────────────────────────────

/**
 * Batch upsert the seeds. Uses ON CONFLICT (lower(name), lower(city)) so a
 * second trip to the same destination enriches existing rows rather than
 * creating duplicates. Falls back to per-row insert when the conflict-target
 * expression isn't supported by older PostgREST versions.
 */
export async function upsertPlaceSeeds(
  client: SupabaseClient,
  seeds: PlaceSeed[],
  label: 'generate' | 'generate-stream' = 'generate',
): Promise<void> {
  if (seeds.length === 0) return;

  // Use a server-side RPC that executes
  //   INSERT ... ON CONFLICT (lower(name), lower(city)) DO UPDATE
  // PostgREST does not support expression-based onConflict targets, so the
  // previous client-side upsert always failed with "column lower does not exist".
  const { error: rpcErr } = await client.rpc('bulk_upsert_places', { rows: seeds });

  if (!rpcErr) {
    console.log(`[${label}] places sync (rpc bulk_upsert_places): ${seeds.length} rows`);
    return;
  }

  // RPC unavailable (schema lag) — fall back to per-row INSERT, skip duplicates
  console.warn(`[${label}] bulk_upsert_places rpc failed (${rpcErr.message}) — falling back to per-row insert`);
  let inserted = 0, skipped = 0;
  for (const seed of seeds) {
    const { error: insErr } = await client.from('places').insert(seed);
    if (insErr) {
      if (insErr.code === '23505') skipped++;
      else console.warn(`[${label}] places insert skipped for "${seed.name}":`, insErr.message);
      continue;
    }
    inserted++;
  }
  console.log(`[${label}] places sync (fallback per-row): inserted ${inserted}, skipped ${skipped}`);
}

// ── Profile → tag context ─────────────────────────────────────────────────────
// Kept in sync with src/services/scoringEngine.ts DYNAMICS_TAGS so newly
// cached rows match the shape future filtered-inventory queries look for.

const DYNAMICS_TAGS: Record<string, { v?: string[]; g?: string[]; c?: string[] }> = {
  'digital-nomad': { v: ['quiet', 'work-friendly', 'calm'], g: ['solo', 'remote-work'], c: ['coffee', 'casual-dining'] },
  'deep-recharge': { v: ['quiet-luxury', 'calm', 'low-key'], g: ['solo'] },
  'adventure':     { v: ['energetic', 'outdoorsy', 'active'], g: ['solo'] },
  'romantic':      { v: ['quiet-luxury', 'dim-lit', 'intimate'], g: ['romantic-couple'], c: ['fine-dining', 'tasting-menu'] },
  'parent-child':  { v: ['easygoing', 'playful'], g: ['families', 'kids', 'parent-child'] },
  'reconnecting':  { v: ['quiet-luxury', 'intimate', 'scenic'], g: ['romantic-couple'], c: ['fine-dining'] },
  'best-friends':  { v: ['energetic', 'trendy', 'social'], g: ['groups', 'friends'] },
  'mixed-ages':    { v: ['balanced', 'easygoing'], g: ['groups', 'families', 'mixed-ages'] },
  'work-crew':     { v: ['polished', 'conversation-worthy', 'trendy'], g: ['co-founders', 'groups', 'work-crew'], c: ['fine-dining', 'cocktails'] },
};

export function buildSeedTagContext(profile: TravelerProfile): SeedTagContext {
  const groupType = String(profile.groupType ?? '').toLowerCase();
  const dyn = profile.groupDynamics?.subType;

  const vibe = new Set<string>();
  const group_suitability = new Set<string>();
  const culinary_focus = new Set<string>();

  // Group base tags
  if (groupType === 'solo')   group_suitability.add('solo');
  if (groupType === 'couple') group_suitability.add('romantic-couple');
  if (groupType === 'family') { group_suitability.add('families'); group_suitability.add('kids'); group_suitability.add('family-friendly'); }
  if (groupType === 'group')  group_suitability.add('groups');

  // Dynamics
  if (dyn && DYNAMICS_TAGS[dyn]) {
    DYNAMICS_TAGS[dyn].v?.forEach((t) => vibe.add(t));
    DYNAMICS_TAGS[dyn].g?.forEach((t) => group_suitability.add(t));
    DYNAMICS_TAGS[dyn].c?.forEach((t) => culinary_focus.add(t));
  }

  // Pace
  if (profile.pace === 'relaxed')  ['quiet', 'calm', 'low-key'].forEach((t) => vibe.add(t));
  if (profile.pace === 'moderate') ['balanced', 'easygoing'].forEach((t) => vibe.add(t));
  if (profile.pace === 'intense')  ['energetic', 'trendy'].forEach((t) => vibe.add(t));

  // Budget
  if (profile.budget === 'luxury') {
    ['quiet-luxury', 'polished'].forEach((t) => vibe.add(t));
    ['fine-dining', 'tasting-menu'].forEach((t) => culinary_focus.add(t));
  }
  if (profile.budget === 'budget') {
    ['street-food', 'casual-dining'].forEach((t) => culinary_focus.add(t));
  }

  // Interests
  for (const i of profile.interests ?? []) {
    const k = i.toLowerCase();
    if (k === 'food')      ['street-food', 'fine-dining', 'local-specialty'].forEach((t) => culinary_focus.add(t));
    if (k === 'nightlife') ['energetic', 'dim-lit', 'trendy'].forEach((t) => vibe.add(t));
    if (k === 'luxury')    ['quiet-luxury', 'polished'].forEach((t) => vibe.add(t));
    if (k === 'family')    ['families', 'kids'].forEach((t) => group_suitability.add(t));
    if (k === 'culture')   ['classic', 'thoughtful'].forEach((t) => vibe.add(t));
  }

  return {
    vibe: Array.from(vibe),
    group_suitability: Array.from(group_suitability),
    culinary_focus: Array.from(culinary_focus),
  };
}

// ── Convenience orchestrator ─────────────────────────────────────────────────

export async function persistVenuesToCache(
  client: SupabaseClient,
  itineraryObj: Record<string, unknown>,
  city: string,
  profile: TravelerProfile,
  label: 'generate' | 'generate-stream' = 'generate',
): Promise<void> {
  const cleanCity = city.trim();
  if (!cleanCity) return;
  const tags = buildSeedTagContext(profile);
  const seeds = collectPlaceSeeds(itineraryObj, cleanCity, tags);
  await upsertPlaceSeeds(client, seeds, label);

  // Auto-tag new places as top picks for Step 7 onboarding.
  // Runs after the upsert so newly inserted rows are immediately eligible.
  // Fire-and-forget — never blocks the generate response.
  client.rpc('auto_tag_top_picks', { p_city: cleanCity }).then(({ data, error }) => {
    if (error) console.warn(`[${label}] auto_tag_top_picks failed (non-critical):`, error.message);
    else if (data > 0) console.log(`[${label}] auto_tag_top_picks: ${data} new top picks tagged for ${cleanCity}`);
  });
}

// ── Link user_place_events → places (FK back-fill) ───────────────────────────
//
// After persistVenuesToCache upserts places and user_place_events rows are
// already written (from itinerary_items audit trail), this function runs a
// single UPDATE to stamp place_id on every event row whose place_name matches
// a row in public.places for the same city — closing the FK loop.
//
// Safe to call multiple times (WHERE place_id IS NULL guard).
//
export async function linkPlacesToUserEvents(
  client: SupabaseClient,
  itineraryId: string,
  city: string,
  label: 'generate' | 'generate-stream' = 'generate',
): Promise<void> {
  if (!itineraryId || !city.trim()) return;

  const { error } = await client.rpc('link_user_place_events_to_places', {
    p_itinerary_id: itineraryId,
    p_city: city.trim().toLowerCase(),
  });

  if (error) {
    // Non-critical: the RPC may not exist on older schemas — log and continue.
    console.warn(`[${label}] linkPlacesToUserEvents failed (non-critical):`, error.message);
  } else {
    console.log(`[${label}] user_place_events.place_id back-filled for itinerary:`, itineraryId);
  }
}
