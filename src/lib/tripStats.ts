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

// ── Detailed lists (for the clickable stat cards) ────────────────────────────

export interface StatListItem {
  name: string;
  /** 1-based day this item belongs to. */
  day: number;
  /** Slot/kind label, e.g. "Morning" or "Dinner". */
  sub?: string;
}

export interface NeighborhoodListItem {
  name: string;
  /** Sorted 1-based day numbers this neighborhood appears on. */
  days: number[];
}

export interface TripStatLists {
  attractions: StatListItem[];
  meals: StatListItem[];
  neighborhoods: NeighborhoodListItem[];
}

/** Full per-item lists with their day, powering the floating stat panels. Pure. */
export function deriveTripStatLists(itinerary: Itinerary): TripStatLists {
  const days = itinerary.days ?? [];
  const attractions: StatListItem[] = [];
  const meals: StatListItem[] = [];
  const neighborhoodMap = new Map<string, { name: string; days: Set<number> }>();

  days.forEach((day, i) => {
    const dayNum = i + 1;

    ([['Morning', day.morning], ['Afternoon', day.afternoon], ['Evening', day.evening]] as const)
      .forEach(([slot, act]) => {
        if (!act) return;
        if (act.name?.trim()) attractions.push({ name: act.name.trim(), day: dayNum, sub: slot });
        const n = act.neighborhood?.trim();
        if (n) {
          const key = n.toLowerCase();
          if (!neighborhoodMap.has(key)) neighborhoodMap.set(key, { name: n, days: new Set() });
          neighborhoodMap.get(key)!.days.add(dayNum);
        }
      });

    ([['Breakfast', day.breakfast], ['Lunch', day.lunch], ['Dinner', day.dinner]] as const)
      .forEach(([kind, meal]) => {
        if (meal?.name?.trim()) meals.push({ name: meal.name.trim(), day: dayNum, sub: kind });
      });
  });

  const neighborhoods = [...neighborhoodMap.values()]
    .map((v) => ({ name: v.name, days: [...v.days].sort((a, b) => a - b) }))
    .sort((a, b) => a.days[0] - b.days[0]);

  return { attractions, meals, neighborhoods };
}
