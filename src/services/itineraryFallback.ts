import { z } from 'zod';
import type { Activity, DiningSpot, Itinerary, TravelerProfile, VibeLabel, HotelRecommendation } from '@/lib/types';
import type { InventoryItem } from '@/services/scoringEngine';
import type { Hotel } from '@/services/accommodation/router';
import { DESTINATIONS } from '@/lib/destinations';
import { COUNTRIES } from '@/lib/countries';

// Look up best-known GPS for the user's destination so fallback map pins land
// in the right city. Returns Paris as a last resort only if nothing matches —
// which previously was hardcoded everywhere and made a Tokyo fallback render as
// a Paris trip on the map.
function destinationCoords(destination: string): { lat: number; lng: number } {
  const needle = destination.trim().toLowerCase();
  if (!needle) return { lat: 0, lng: 0 };
  const direct = DESTINATIONS.find((d) => d.name.toLowerCase() === needle);
  if (direct) return { lat: direct.lat, lng: direct.lng };
  for (const country of COUNTRIES) {
    const city = country.cities.find((c) => c.name.toLowerCase() === needle);
    if (city) return { lat: city.lat, lng: city.lng };
  }
  // Last resort: a tiny offset around 0,0 so it's visibly "unknown" instead of
  // silently impersonating Paris.
  return { lat: 0, lng: 0 };
}

export type GenerationProvider = 'gemini' | 'claude' | 'fallback' | 'assembler';

/** Map a live provider Hotel (Booking / Airbnb / etc.) into a HotelRecommendation card. */
function hotelToRecommendation(h: Hotel): HotelRecommendation {
  const nightly = h.nightlyRate
    ? `${h.nightlyRate.currency ?? ''}${h.nightlyRate.amount}`.trim()
    : null;
  const providerLabel = h.provider.charAt(0).toUpperCase() + h.provider.slice(1);
  return {
    name: h.name,
    neighborhood: h.address ?? '',
    neighborhoodVibe: h.provider === 'airbnb' ? 'apartment stay' : 'central stay',
    whyItFits: 'Matched to your accommodation preference.',
    priceRange: nightly ? `${nightly}/night` : '$$',
    neighborhoodInsight: '',
    websiteUrl: h.bookingUrl ?? null,
    estimatedPriceRangeTripDates: nightly ? `${nightly}/night (indicative — verify live)` : null,
    availabilitySummary: h.available === false
      ? 'May be sold out for your dates — verify live'
      : `Bookable via ${providerLabel} — verify live`,
    fitSummary: `${h.name}${h.address ? ` in ${h.address}` : ''}. Sourced live from ${providerLabel}.`,
    otaPriceCompare: null,
    ratingStars: typeof h.rating === 'number' ? h.rating : null,
    ratingSource: typeof h.rating === 'number' ? `${providerLabel} rating` : null,
    reviewCountHint: null,
    latitude: h.lat ?? null,
    longitude: h.lng ?? null,
    availability: h.available ?? null,
  };
}

// Coordinates are best-effort: Google Places verifies/fills GPS downstream, so a
// venue with a valid name but missing/null/garbage coordinates is still useful.
const coordinateSchema = z.number().finite().nullable().optional().catch(undefined);

const activitySchema = z.object({
  name: z.string().min(1),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
}).passthrough();

const diningSchema = z.object({
  name: z.string().min(1),
  latitude: coordinateSchema,
  longitude: coordinateSchema,
}).passthrough();

// Each day slot is optional AND resilient: a malformed slot (e.g. Gemini emits
// `evening` as a bare string, or a venue with an empty name) is DROPPED via
// `.catch(undefined)` instead of throwing and discarding the entire itinerary.
// Without this, one bad optional field nukes a whole valid trip into the generic
// fallback — the exact Hanoi bug.
const optionalActivity = activitySchema.optional().catch(undefined);
const optionalDining = diningSchema.optional().catch(undefined);

const itinerarySchema = z.object({
  destination: z.string().min(1),
  totalDays: z.number().int().positive(),
  days: z.array(z.object({
    day: z.number().int().positive(),
    breakfast: optionalDining,
    morning: optionalActivity,
    lunch: optionalDining,
    afternoon: optionalActivity,
    dinner: optionalDining,
    evening: optionalActivity,
  }).passthrough()).min(1),
}).passthrough();

// Generic city-agnostic placeholders. GPS is intentionally null — the real
// destination's coordinates are injected at runtime by normalizeFallbackPool
// so a Tokyo fallback shows Tokyo pins, not Paris pins.
const FALLBACK_INVENTORY: Array<Pick<InventoryItem, 'id' | 'source_table' | 'name' | 'city' | 'category' | 'description' | 'lat' | 'lng' | 'category_emoji' | 'vibe_label'>> = [
  { id: 'fallback-market', source_table: 'places', name: 'Central Market Hall', city: null, category: 'market', description: 'A sensory first stop with local snacks, quick bites, and easy browsing.', lat: null, lng: null, category_emoji: '🛍️', vibe_label: 'local-favorite' },
  { id: 'fallback-museum', source_table: 'places', name: 'City Heritage Museum', city: null, category: 'attraction', description: 'A polished cultural anchor that gives the trip immediate local context.', lat: null, lng: null, category_emoji: '🏛️', vibe_label: 'classic' },
  { id: 'fallback-viewpoint', source_table: 'places', name: 'Old Town Viewpoint', city: null, category: 'attraction', description: 'A scenic pause for golden-hour photos and orientation.', lat: null, lng: null, category_emoji: '🌆', vibe_label: 'classic' },
  { id: 'fallback-bakery', source_table: 'restaurants', name: 'Neighborhood Bakery', city: null, category: 'cafe', description: 'Reliable breakfast with pastries, coffee, and a calm start.', lat: null, lng: null, category_emoji: '☕', vibe_label: 'local-favorite' },
  { id: 'fallback-bistro', source_table: 'restaurants', name: 'Local Bistro', city: null, category: 'restaurant', description: 'A comfortable local lunch or dinner with regional dishes.', lat: null, lng: null, category_emoji: '🍽️', vibe_label: 'local-favorite' },
  { id: 'fallback-winebar', source_table: 'restaurants', name: 'Quiet Wine Bar', city: null, category: 'bar', description: 'Dim, relaxed evening energy with conversation-friendly seating.', lat: null, lng: null, category_emoji: '🍷', vibe_label: 'hidden-gem' },
];

export function validateItineraryOrThrow(value: unknown): Itinerary {
  return itinerarySchema.parse(value) as Itinerary;
}

export function buildFallbackItinerary(
  profile: TravelerProfile,
  inventory: InventoryItem[],
  reason: unknown,
  hotels: Hotel[] = [],
): Itinerary {
  const daysCount = Math.max(1, Math.min(profile.duration || calculateDays(profile.startDate, profile.endDate), 10));
  const pool = normalizeFallbackPool(profile.destination, inventory);
  const restaurants = pool.filter((item) => isDiningCategory(item.category));
  const activities = pool.filter((item) => !isDiningCategory(item.category));

  const days = Array.from({ length: daysCount }, (_, index) => {
    const dayNumber = index + 1;
    const breakfast = toDining(pick(restaurants, index * 3), 'Breakfast');
    const lunch = toDining(pick(restaurants, index * 3 + 1), 'Lunch');
    const dinner = toDining(pick(restaurants, index * 3 + 2), 'Dinner');
    const morning = toActivity(pick(activities, index * 3), 'morning', '09:00', '11:00');
    const afternoon = profile.pace === 'relaxed'
      ? undefined
      : toActivity(pick(activities, index * 3 + 1), 'afternoon', '14:00', '16:30');
    const evening = toActivity(pick([...activities, ...restaurants], index * 3 + 2), 'evening', '19:30', '21:30');

    return {
      day: dayNumber,
      date: buildDayLabel(profile.startDate, index),
      theme: dayNumber === 1 ? 'Local First Look' : `Curated Day ${dayNumber}`,
      breakfast,
      morning,
      lunch,
      ...(afternoon ? { afternoon } : {}),
      dinner,
      evening,
      estimatedDailyCost: estimateDailyCost(profile.budget),
      transportTip: 'Stay clustered and use short walks or transit hops between selected inventory spots.',
      webInsights: [{ text: 'Inventory-backed route, no AI guesses.', type: 'tip' as const, source: 'TravelOS Inventory' }],
    };
  });

  return {
    strategicOverview: `A polished ${profile.destination} route built from verified TravelOS inventory.`,
    destination: profile.destination,
    totalDays: daysCount,
    budgetSummary: {
      dailyAverage: estimateDailyCost(profile.budget),
      totalEstimate: `${estimateDailyCost(profile.budget)} per day, adjusted for ${daysCount} day${daysCount === 1 ? '' : 's'}`,
      includes: 'Meals, sights, local transit',
    },
    days,
    packingTips: [
      'Comfortable walking shoes',
      'Portable charger',
      'Light weather layer',
      'Reservation screenshots',
    ],
    bestLocalTips: [
      'Start early for calmer photos.',
      'Cluster meals near activities.',
      'Book dinner before peak hours.',
      'Keep transit cards ready.',
    ],
    cityTransport: {
      intro: `Use central transit and short walks in ${profile.destination}; keep each day geographically tight.`,
      priceSingle: null,
      priceDayPass: null,
      priceWeekPass: null,
      officialTicketsUrl: null,
      scoutTipPayment: 'Use contactless card or the main local transit app when supported.',
      transportApp: null,
      options: [
        { mode: 'Walking', summary: 'Best for clustered neighborhoods.', typicalPrice: 'Free', dailyAverage: 'Free', tripTotalEstimate: 'Free for clustered days' },
        { mode: 'Public transit', summary: 'Use for cross-town jumps.', typicalPrice: 'Local fare', dailyAverage: 'Low daily spend', tripTotalEstimate: `Low total for ${daysCount} days` },
        { mode: 'Taxi / rideshare', summary: 'Useful late at night.', typicalPrice: 'Variable', dailyAverage: 'Occasional use only', tripTotalEstimate: 'Use sparingly for comfort' },
        { mode: 'Bike / scooter share', summary: 'Good in bike-friendly areas.', typicalPrice: 'Variable', dailyAverage: 'Low to moderate', tripTotalEstimate: 'Optional add-on' },
      ],
      links: [],
    },
    basecamp: profile.hotelBooked?.trim()
      ? {
          type: 'booked',
          booked: {
            name: profile.hotelBooked.trim(),
            neighborhood: profile.hotelAddress || profile.destination,
            neighborhoodInsight: 'Use your hotel as the center of gravity for daily clusters.',
          },
        }
      : {
          type: 'recommendations',
          // Surface live provider results (Booking / Airbnb / Agoda / …) so a
          // fallback itinerary still shows real lodging instead of an empty list.
          recommendations: hotels.slice(0, 6).map(hotelToRecommendation),
        },
    _meta: {
      searchEnabled: false,
      sourcesFound: 0,
      provider: 'fallback',
      jitVerified: 0,
      jitFlagged: 0,
      isFallback: true,
      fallbackReason: reason instanceof Error ? reason.message : String(reason),
    },
  };
}

function normalizeFallbackPool(destination: string, inventory: InventoryItem[]) {
  const real = inventory.filter((item) => item.name && item.lat != null && item.lng != null);
  const pool = real.length >= 3 ? real : [...real, ...FALLBACK_INVENTORY.map((item) => ({ ...item, city: item.city ?? destination }))];
  // Anchor on the actual destination's GPS, NOT a hardcoded Paris fallback —
  // otherwise a Tokyo fallback shows every venue pinned in central Paris.
  const { lat: anchorLat, lng: anchorLng } = destinationCoords(destination);
  return pool.map((item, index) => ({
    ...item,
    id: item.id ?? `fallback-${index}`,
    city: item.city ?? destination,
    lat: item.lat ?? anchorLat + index * 0.002,
    lng: item.lng ?? anchorLng + index * 0.002,
    category_emoji: item.category_emoji ?? (isDiningCategory(item.category) ? '🍽️' : '📍'),
    vibe_label: item.vibe_label ?? 'local-favorite',
  }));
}

function toActivity(item: ReturnType<typeof normalizeFallbackPool>[number], slot: string, startTime: string, endTime: string): Activity {
  return {
    name: item.name,
    description: item.description || `A curated ${slot} stop from TravelOS inventory.`,
    neighborhood: item.city || 'Central area',
    startTime,
    endTime,
    time_slot: `${startTime} – ${endTime}`,
    bestTimeToVisit: startTime,
    transitFromPrevious: slot === 'morning' ? undefined : 'Short local transfer',
    duration: '1.5 hours',
    whyThis: 'Selected from TravelOS fallback inventory.',
    estimatedCost: 'Varies',
    tags: ['inventory', item.category || 'local', item.vibe_label || 'classic'].slice(0, 3),
    isHiddenGem: item.vibe_label === 'hidden-gem',
    vibeLabel: normalizeVibeLabel(item.vibe_label),
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    category_emoji: item.category_emoji || '📍',
    website_url: undefined,
    inventory_id: item.id,
    inventory_source_table: item.source_table,
  };
}

function toDining(item: ReturnType<typeof normalizeFallbackPool>[number], meal: string): DiningSpot {
  return {
    name: item.name,
    cuisine: item.category === 'cafe' ? 'Cafe' : 'Local',
    priceRange: '$$',
    mustTry: item.description || `${meal} signature pick`,
    neighborhood: item.city || 'Central area',
    latitude: Number(item.lat),
    longitude: Number(item.lng),
    website_url: undefined,
    inventory_id: item.id,
    inventory_source_table: item.source_table,
  };
}

function pick<T>(items: T[], index: number): T {
  return items[index % Math.max(1, items.length)];
}

function isDiningCategory(category?: string | null): boolean {
  return ['restaurant', 'cafe', 'bar', 'bakery', 'market'].includes((category ?? '').toLowerCase());
}

function normalizeVibeLabel(value?: string | null): VibeLabel {
  const allowed: VibeLabel[] = ['hidden-gem', 'local-favorite', 'viral-trend', 'classic', 'luxury-pick', 'budget-pick'];
  return allowed.includes(value as VibeLabel) ? (value as VibeLabel) : 'local-favorite';
}

function calculateDays(start?: string, end?: string): number {
  if (!start || !end) return 3;
  const delta = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  return Number.isFinite(delta) ? Math.max(1, delta) : 3;
}

function buildDayLabel(startDate: string | undefined, offset: number): string {
  if (!startDate) return `Day ${offset + 1}`;
  const date = new Date(startDate);
  if (!Number.isFinite(date.getTime())) return `Day ${offset + 1}`;
  date.setDate(date.getDate() + offset);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function estimateDailyCost(budget: string): string {
  if (budget === 'budget') return '$60-120/person';
  if (budget === 'luxury') return '$300+/person';
  return '$150-250/person';
}
