import { z } from 'zod';
import type { Activity, DiningSpot, Itinerary, TravelerProfile, VibeLabel } from '@/lib/types';
import type { InventoryItem } from '@/services/scoringEngine';

export type GenerationProvider = 'gemini' | 'claude' | 'fallback';

const coordinateSchema = z.number().finite();

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

const itinerarySchema = z.object({
  destination: z.string().min(1),
  totalDays: z.number().int().positive(),
  days: z.array(z.object({
    day: z.number().int().positive(),
    breakfast: diningSchema.optional(),
    morning: activitySchema.optional(),
    lunch: diningSchema.optional(),
    afternoon: activitySchema.optional(),
    dinner: diningSchema.optional(),
    evening: activitySchema.optional(),
  }).passthrough()).min(1),
}).passthrough();

const FALLBACK_INVENTORY: Array<Pick<InventoryItem, 'id' | 'source_table' | 'name' | 'city' | 'category' | 'description' | 'lat' | 'lng' | 'category_emoji' | 'vibe_label'>> = [
  { id: 'fallback-market', source_table: 'places', name: 'Central Market Hall', city: null, category: 'market', description: 'A sensory first stop with local snacks, quick bites, and easy browsing.', lat: 48.8566, lng: 2.3522, category_emoji: '🛍️', vibe_label: 'local-favorite' },
  { id: 'fallback-museum', source_table: 'places', name: 'City Heritage Museum', city: null, category: 'attraction', description: 'A polished cultural anchor that gives the trip immediate local context.', lat: 48.8606, lng: 2.3376, category_emoji: '🏛️', vibe_label: 'classic' },
  { id: 'fallback-viewpoint', source_table: 'places', name: 'Old Town Viewpoint', city: null, category: 'attraction', description: 'A scenic pause for golden-hour photos and orientation.', lat: 48.8584, lng: 2.2945, category_emoji: '🌆', vibe_label: 'classic' },
  { id: 'fallback-bakery', source_table: 'restaurants', name: 'Neighborhood Bakery', city: null, category: 'cafe', description: 'Reliable breakfast with pastries, coffee, and a calm start.', lat: 48.853, lng: 2.3499, category_emoji: '☕', vibe_label: 'local-favorite' },
  { id: 'fallback-bistro', source_table: 'restaurants', name: 'Local Bistro', city: null, category: 'restaurant', description: 'A comfortable local lunch or dinner with regional dishes.', lat: 48.8546, lng: 2.3477, category_emoji: '🍽️', vibe_label: 'local-favorite' },
  { id: 'fallback-winebar', source_table: 'restaurants', name: 'Quiet Wine Bar', city: null, category: 'bar', description: 'Dim, relaxed evening energy with conversation-friendly seating.', lat: 48.8528, lng: 2.3508, category_emoji: '🍷', vibe_label: 'hidden-gem' },
];

export function validateItineraryOrThrow(value: unknown): Itinerary {
  return itinerarySchema.parse(value) as Itinerary;
}

export function buildFallbackItinerary(
  profile: TravelerProfile,
  inventory: InventoryItem[],
  reason: unknown,
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
          recommendations: [],
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
  return pool.map((item, index) => ({
    ...item,
    id: item.id ?? `fallback-${index}`,
    city: item.city ?? destination,
    lat: item.lat ?? 48.8566 + index * 0.002,
    lng: item.lng ?? 2.3522 + index * 0.002,
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
