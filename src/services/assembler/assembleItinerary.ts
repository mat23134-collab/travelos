/**
 * assembleItinerary.ts — the deterministic, zero-LLM trip builder (ADR-001).
 *
 * Pipeline:  filter → score → cluster by geography → fill day slots
 *            (variety + pacing + opening-hours + evening drinks) → hotel anchor
 *            → render.
 *
 * Returns the standard `Itinerary` shape the app already consumes, or null when
 * the city lacks enough inventory (the caller then falls back to the LLM).
 */

import type { Itinerary, DayPlan, Activity, DiningSpot } from '../../lib/types';
import { haversineKm, walkingMinutes, centroid, nearestNeighbourOrder, type LatLng } from './geo';
import {
  GROUP_TAGS,
  BUDGET_TIERS,
  PACE_PLAN,
  SLOT_WINDOW,
  MEAL_SLOT_TOKENS,
  priceRangeLabel,
  openStatus,
  type GroupType,
  type BudgetLevel,
  type PaceLevel,
  type OpeningHours,
} from './taxonomy';

// ── Inputs ────────────────────────────────────────────────────────────────────

export interface AssemblerPlace {
  id: string;
  name: string;
  city: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  category_emoji: string | null;
  price_tier: number | null;
  meal_slots: string[];
  group_suitability: string[];
  vibe: string[];
  culinary_focus: string[];
  vibe_label: string | null;
  top_pick_category: string | null;
  popularity_rank: number | null;
  google_rating: number | null;
  opening_hours: OpeningHours | null;
  website_url: string | null;
  photo_url: string | null;
  status?: string | null;   // janitor verification status (e.g. flagged-closed)
}

export interface AssemblerProfile {
  destination: string;
  duration: number;
  groupType: GroupType;
  budget: BudgetLevel;
  pace: PaceLevel;
  interests?: string[];
  startDate?: string;       // YYYY-MM-DD
  hotelLat?: number;
  hotelLng?: number;
}

export interface AssemblerResult {
  itinerary: Itinerary | null;
  reason?: string;
  meta?: { activitiesAvailable: number; foodAvailable: number; defaultHoursUsed: number };
}

// ── Small helpers ───────────────────────────────────────────────────────────

const lc = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();
/** A real meal venue — has at least one meal slot (restaurant, cafe, …). */
const isMealVenue = (p: AssemblerPlace) => Array.isArray(p.meal_slots) && p.meal_slots.length > 0;
/** A drinks venue — bar / nightlife. Never a meal; eligible for the evening slot. */
const isBar = (p: AssemblerPlace) => ['bar', 'nightlife'].includes(lc(p.category)) && !isMealVenue(p);
const hasGeo = (p: AssemblerPlace): p is AssemblerPlace & { lat: number; lng: number } =>
  typeof p.lat === 'number' && typeof p.lng === 'number';
const ll = (p: { lat: number; lng: number }): LatLng => ({ lat: p.lat, lng: p.lng });

function addDays(iso: string | undefined, days: number): Date | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + 'T00:00:00Z');
  if (isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function intersects(a: string[], b: string[]): boolean {
  const set = new Set(a.map((x) => x.toLowerCase()));
  return b.some((x) => set.has(x.toLowerCase()));
}

const SUBCAT_THEME: Record<string, string> = {
  museum: 'Museums & art', gallery: 'Art & galleries', religious: 'Sacred sites',
  historic_site: 'Ancient history', palace: 'Palaces & grandeur', park: 'Parks & green space',
  square: 'Piazzas & people-watching', bridge: 'Riverside & bridges', viewpoint: 'Views & vistas',
  landmark: 'Icons & landmarks', market: 'Markets & local life', beach: 'Sea & sand',
  nature: 'Nature & outdoors', district: 'Neighbourhood wandering', entertainment: 'Shows & fun',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Day theme from a venue's subcategory, falling back to its top-pick category. */
function themeOf(p: AssemblerPlace): string {
  return SUBCAT_THEME[lc(p.subcategory)] ?? (p.top_pick_category ? cap(p.top_pick_category) : 'City highlights');
}

// ── Scoring ────────────────────────────────────────────────────────────────

function scorePlace(p: AssemblerPlace, interests: string[]): number {
  let s = 0;
  if (typeof p.popularity_rank === 'number') s += Math.max(0, 100 - p.popularity_rank) / 100;
  if (p.top_pick_category) s += 0.5;
  if (typeof p.google_rating === 'number') s += p.google_rating / 5;
  if (interests.length) {
    const tagPool = [
      ...(p.vibe ?? []), ...(p.culinary_focus ?? []),
      lc(p.category), lc(p.subcategory), lc(p.top_pick_category),
    ].map(lc);
    const matches = interests.filter((i) => tagPool.includes(lc(i))).length;
    s += matches * 0.3;
  }
  return s;
}

// ── Main ─────────────────────────────────────────────────────────────────────

export function assembleItinerary(
  profile: AssemblerProfile,
  places: AssemblerPlace[],
  opts: { minActivitiesFactor?: number } = {},
): AssemblerResult {
  const interests = (profile.interests ?? []).map(lc);
  const pace = PACE_PLAN[profile.pace] ?? PACE_PLAN.moderate;
  const groupTokens = GROUP_TAGS[profile.groupType] ?? [];
  const allowedTiers = BUDGET_TIERS[profile.budget] ?? [1, 2, 3, 4];

  const passesProfile = (p: AssemblerPlace) => {
    if (!hasGeo(p)) return false;
    if (lc(p.category) === 'hotel') return false;
    // Skip venues the janitor flagged as closed/renovating during re-verification.
    if (['flagged-closed', 'flagged-renovating'].includes(lc(p.status))) return false;
    if (p.group_suitability?.length && !intersects(p.group_suitability, groupTokens)) return false;
    if (p.price_tier != null && !allowedTiers.includes(p.price_tier)) return false;
    return true;
  };

  const pool = places.filter(passesProfile);
  const byScore = (a: AssemblerPlace, b: AssemblerPlace) => scorePlace(b, interests) - scorePlace(a, interests);
  // Three pools: sightseeing activities, meal venues, and bars (evening drinks).
  const sights = pool.filter((p) => !isMealVenue(p) && !isBar(p)).sort(byScore);
  const food = pool.filter(isMealVenue).sort(byScore);
  const bars = pool.filter(isBar).sort(byScore);
  // Bars are an adults-only flourish (no kids in the group).
  const adultGroup = profile.groupType !== 'family';

  const perDayActivities = pace.activities.length;
  const factor = opts.minActivitiesFactor ?? 1;
  const needSights = Math.ceil(profile.duration * perDayActivities * factor);
  // Enough distinct food venues to fill every meal slot without repeating.
  const needFood = profile.duration * pace.meals.length;
  const defaultHoursUsed = pool.filter((p) => p.opening_hours?.source === 'default').length;

  // Gate: not enough inventory → signal LLM fallback.
  if (sights.length < needSights || food.length < needFood) {
    return {
      itinerary: null,
      reason: `insufficient inventory (sights ${sights.length}/${needSights}, food ${food.length}/${needFood})`,
      meta: { activitiesAvailable: sights.length, foodAvailable: food.length, defaultHoursUsed },
    };
  }

  const usedAct = new Set<string>();
  const usedFood = new Set<string>();
  const usedBar = new Set<string>();
  const usedThemes = new Set<string>();
  const days: DayPlan[] = [];

  for (let d = 0; d < profile.duration; d++) {
    const date = addDays(profile.startDate, d);
    const weekday = date ? date.getUTCDay() : -1;

    // 1) Anchor — best unused sight whose theme hasn't been used yet (so days
    //    don't all collapse to the same theme); fall back to best unused.
    const anchor =
      sights.find((p) => !usedAct.has(p.id) && !usedThemes.has(themeOf(p))) ??
      sights.find((p) => !usedAct.has(p.id));
    if (!anchor) break;
    const theme = themeOf(anchor);
    usedThemes.add(theme);
    usedAct.add(anchor.id);

    // Reserve the evening for a bar (drinks) when it's an adult group and we
    // have a bar to offer; otherwise the evening is another sight.
    const eveningIsBar = adultGroup && pace.activities.includes('evening') && bars.some((b) => !usedBar.has(b.id));
    const sightSlots = pace.activities.filter((s) => !(eveningIsBar && s === 'evening'));

    const dayActs: AssemblerPlace[] = [anchor];
    const daySubcats = new Set<string>([lc(anchor.subcategory)]);

    // 2) Fill the remaining SIGHT slots with nearby, varied, open venues.
    while (dayActs.length < sightSlots.length) {
      const slot = sightSlots[dayActs.length];
      const candidates = sights
        .filter((p) => !usedAct.has(p.id))
        .filter((p) => weekday < 0 || openStatus(p.opening_hours, weekday, slot) !== 'closed')
        .map((p) => {
          const dist = haversineKm(ll(anchor as LatLng & AssemblerPlace), ll(p as LatLng & AssemblerPlace));
          const varietyOK = !daySubcats.has(lc(p.subcategory));
          const rank = dist + (varietyOK ? 0 : 3) - scorePlace(p, interests) * 0.4;
          return { p, rank, varietyOK };
        })
        .sort((a, b) => a.rank - b.rank);
      const pick = candidates.find((c) => c.varietyOK) ?? candidates[0];
      if (!pick) break;
      usedAct.add(pick.p.id);
      dayActs.push(pick.p);
      daySubcats.add(lc(pick.p.subcategory));
    }

    // 3) Sequence the sights (from hotel if known, else cluster centroid).
    const anchorPts = dayActs.map((p) => ll(p as LatLng & AssemblerPlace));
    const start: LatLng =
      typeof profile.hotelLat === 'number' && typeof profile.hotelLng === 'number'
        ? { lat: profile.hotelLat, lng: profile.hotelLng }
        : centroid(anchorPts) ?? anchorPts[0];
    const order = nearestNeighbourOrder(start, anchorPts);
    const orderedSights = order.map((i) => dayActs[i]);
    const dayCentroid = centroid(anchorPts) ?? start;

    // 4) Meals near the day's centroid — must actually serve that meal slot.
    const meals: Record<string, DiningSpot | undefined> = {};
    for (const meal of pace.meals) {
      const tokens = MEAL_SLOT_TOKENS[meal];
      const cand = food
        .filter((p) => !usedFood.has(p.id))
        .filter((p) => intersects(p.meal_slots, tokens))
        .filter((p) => weekday < 0 || openStatus(p.opening_hours, weekday, meal) !== 'closed')
        .map((p) => ({ p, dist: haversineKm(dayCentroid, ll(p as LatLng & AssemblerPlace)) - scorePlace(p, interests) * 0.3 }))
        .sort((a, b) => a.dist - b.dist);
      if (cand[0]) {
        usedFood.add(cand[0].p.id);
        meals[meal] = toDiningSpot(cand[0].p);
      }
    }

    // 5) Render sights into their slots, with walking transitions.
    const dayPlan: DayPlan = {
      day: d + 1,
      date: date ? date.toISOString().slice(0, 10) : undefined,
      theme,
    };
    orderedSights.forEach((p, i) => {
      const slot = sightSlots[i];
      if (!slot) return;
      const prev = i > 0 ? orderedSights[i - 1] : null;
      const transit = prev
        ? `${walkingMinutes(haversineKm(ll(prev as LatLng & AssemblerPlace), ll(p as LatLng & AssemblerPlace)))}-min walk`
        : undefined;
      dayPlan[slot] = toActivity(p, slot, transit);
    });

    // 6) Evening drinks: nearest unused bar to the day's centroid.
    if (eveningIsBar) {
      const barPick = bars
        .filter((b) => !usedBar.has(b.id))
        .filter((b) => weekday < 0 || openStatus(b.opening_hours, weekday, 'evening') !== 'closed')
        .map((b) => ({ b, dist: haversineKm(dayCentroid, ll(b as LatLng & AssemblerPlace)) }))
        .sort((a, b) => a.dist - b.dist)[0];
      if (barPick) {
        usedBar.add(barPick.b.id);
        const last = orderedSights[orderedSights.length - 1];
        const transit = last
          ? `${walkingMinutes(haversineKm(ll(last as LatLng & AssemblerPlace), ll(barPick.b as LatLng & AssemblerPlace)))}-min walk`
          : undefined;
        dayPlan.evening = toActivity(barPick.b, 'evening', transit, true);
      }
    }

    const slotActs = [dayPlan.morning, dayPlan.afternoon, dayPlan.evening].filter(Boolean) as Activity[];
    dayPlan.breakfast = meals.breakfast;
    dayPlan.lunch = meals.lunch;
    dayPlan.dinner = meals.dinner;
    dayPlan.daySummary = buildDaySummary(d + 1, slotActs, meals);
    dayPlan.estimatedDailyCost = estimateDailyCost([...dayActs], meals);

    days.push(dayPlan);
  }

  const itinerary: Itinerary = {
    destination: profile.destination,
    totalDays: days.length,
    strategicOverview: buildOverview(profile, days.length),
    days,
    _meta: { searchEnabled: false, sourcesFound: 0 } as Itinerary['_meta'],
  };

  return {
    itinerary,
    meta: { activitiesAvailable: sights.length, foodAvailable: food.length, defaultHoursUsed },
  };
}

// ── Renderers ─────────────────────────────────────────────────────────────────

function toActivity(p: AssemblerPlace, slot: string, transit?: string, isBarSlot = false): Activity {
  const [open, close] = SLOT_WINDOW[slot] ?? ['', ''];
  const why = isBarSlot
    ? `An evening drinks spot to wind down in ${p.city}.`
    : p.top_pick_category
      ? `A standout for ${p.top_pick_category} in ${p.city}.`
      : undefined;
  return {
    name: p.name,
    description: p.description ?? undefined,
    whyThis: why,
    duration: isBarSlot ? '~1-2 hours' : '~2 hours',
    startTime: open || undefined,
    endTime: close || undefined,
    time_slot: open && close ? `${open} - ${close}` : undefined,
    transitFromPrevious: transit,
    bestTimeToVisit: slot,
    vibeLabel: (p.vibe_label as Activity['vibeLabel']) ?? undefined,
    latitude: p.lat ?? undefined,
    longitude: p.lng ?? undefined,
    category_emoji: p.category_emoji ?? undefined,
    estimatedCost: priceRangeLabel(p.price_tier),
    tags: p.vibe?.length ? p.vibe : undefined,
    website_url: p.website_url ?? undefined,
    inventory_id: p.id,
    inventory_source_table: 'places',
  };
}

function toDiningSpot(p: AssemblerPlace): DiningSpot {
  return {
    name: p.name,
    cuisine: p.culinary_focus?.[0] ?? p.category ?? undefined,
    priceRange: priceRangeLabel(p.price_tier),
    neighborhood: undefined,
    latitude: p.lat ?? undefined,
    longitude: p.lng ?? undefined,
    website_url: p.website_url ?? undefined,
    inventory_id: p.id,
    inventory_source_table: 'places',
  };
}

function buildDaySummary(
  n: number,
  acts: { name?: string }[],
  meals: Record<string, DiningSpot | undefined>,
): string {
  const names = acts.map((a) => a.name).filter(Boolean) as string[];
  const lead = names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : names[0] ?? 'a relaxed day';
  const dinner = meals.dinner?.name ? ` Cap the day with dinner at ${meals.dinner.name}.` : '';
  return `Day ${n} takes you through ${lead}.${dinner}`;
}

function estimateDailyCost(
  acts: AssemblerPlace[],
  meals: Record<string, DiningSpot | undefined>,
): string {
  const tiers = [
    ...acts.map((a) => a.price_tier ?? 2),
    ...Object.values(meals).filter(Boolean).map(() => 2),
  ];
  const avg = tiers.length ? tiers.reduce((a, b) => a + b, 0) / tiers.length : 2;
  return avg >= 3.5 ? '$$$$' : avg >= 2.5 ? '$$$' : avg >= 1.5 ? '$$' : '$';
}

function buildOverview(profile: AssemblerProfile, days: number): string {
  return `A ${days}-day ${profile.pace} ${profile.groupType} itinerary for ${profile.destination}, ` +
    `built around ${profile.budget} picks and your interests, with each day grouped by neighbourhood to minimise travel.`;
}
