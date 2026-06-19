import type { Itinerary } from './types';

export interface TripStats {
  days: number;
  attractions: number;
  neighborhoods: number;
  meals: number;
}

/** Derive headline trip counts from an itinerary. Pure — no side effects. */
export function deriveTripStats(itinerary: Itinerary): TripStats {
  const days = itinerary.days ?? [];
  let attractions = 0;
  let meals = 0;
  const neighborhoods = new Set<string>();

  for (const day of days) {
    for (const slot of [day.morning, day.afternoon, day.evening]) {
      if (!slot) continue;
      attractions += 1;
      const n = slot.neighborhood?.trim().toLowerCase();
      if (n) neighborhoods.add(n);
    }
    for (const meal of [day.breakfast, day.lunch, day.dinner]) {
      if (meal) meals += 1;
    }
  }

  return {
    days: itinerary.totalDays || days.length,
    attractions,
    neighborhoods: neighborhoods.size,
    meals,
  };
}
