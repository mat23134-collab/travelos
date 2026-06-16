/**
 * taxonomy.ts — mappings + small rules the assembler relies on.
 *
 * Centralises the vocabulary translations and tunable knobs so they are easy to
 * adjust without touching the algorithm. Tolerant by design: the places table
 * mixes scout tags with the rules-backfill, so each app-level value maps onto a
 * SET of accepted DB tokens.
 */

export type GroupType = 'solo' | 'couple' | 'family' | 'group';
export type BudgetLevel = 'budget' | 'mid-range' | 'luxury';
export type PaceLevel = 'relaxed' | 'moderate' | 'intense';

/** App groupType → accepted group_suitability tokens (covers mixed vocab). */
export const GROUP_TAGS: Record<GroupType, string[]> = {
  solo: ['solo', 'remote-work'],
  couple: ['couple', 'couples', 'romantic-couple'],
  family: ['family', 'families', 'kids', 'parent-child', 'mixed-ages'],
  group: ['group', 'groups', 'friends', 'mixed-ages'],
};

/** Budget → acceptable price_tier values. NULL price_tier is always allowed. */
export const BUDGET_TIERS: Record<BudgetLevel, number[]> = {
  budget: [1, 2],
  'mid-range': [1, 2, 3],
  luxury: [2, 3, 4],
};

/** $ … $$$$ display string from a 1–4 tier. */
export function priceRangeLabel(tier: number | null | undefined): string {
  if (!tier || tier < 1) return '$$';
  return '$'.repeat(Math.min(4, tier));
}

/** How many activity + meal slots to fill per day, by pace. */
export interface PacePlan {
  activities: ('morning' | 'afternoon' | 'evening')[];
  meals: ('breakfast' | 'lunch' | 'dinner')[];
}
export const PACE_PLAN: Record<PaceLevel, PacePlan> = {
  relaxed: { activities: ['morning', 'afternoon'], meals: ['lunch', 'dinner'] },
  moderate: { activities: ['morning', 'afternoon', 'evening'], meals: ['lunch', 'dinner'] },
  intense: { activities: ['morning', 'afternoon', 'evening'], meals: ['breakfast', 'lunch', 'dinner'] },
};

/** Default clock window per slot — used for open-checks and time_slot display. */
export const SLOT_WINDOW: Record<string, [string, string]> = {
  breakfast: ['08:00', '09:30'],
  morning: ['09:30', '12:30'],
  lunch: ['12:30', '14:00'],
  afternoon: ['14:00', '17:30'],
  evening: ['18:00', '21:00'],
  dinner: ['19:30', '21:30'],
};

/** Which meal slot a food venue prefers, for matching against meal_slots. */
export const MEAL_SLOT_TOKENS: Record<string, string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch', 'brunch'],
  dinner: ['dinner'],
};

export const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface OpeningHours {
  // each weekday key maps to an array of [open, close] "HH:MM" intervals; [] = closed
  [day: string]: unknown;
  source?: string;
}

export type OpenStatus = 'open' | 'closed' | 'unknown';

/**
 * Is a venue open during `slot` on the given JS weekday index (0=Sun)?
 * - Real hours ("source" != "default"): hard answer open/closed.
 * - Default placeholder hours: returns 'unknown' so the caller can treat softly.
 * - Missing hours: 'unknown'.
 */
export function openStatus(
  hours: OpeningHours | null | undefined,
  weekdayIndex: number,
  slot: keyof typeof SLOT_WINDOW,
): OpenStatus {
  if (!hours) return 'unknown';
  const isDefault = hours.source === 'default';
  const key = WEEKDAYS[weekdayIndex];
  const intervals = hours[key];
  if (!Array.isArray(intervals)) return 'unknown';
  if (isDefault) return 'unknown'; // soft: placeholders never hard-exclude
  if (intervals.length === 0) return 'closed';

  const [, slotClose] = SLOT_WINDOW[slot];
  const [slotOpen] = SLOT_WINDOW[slot];
  // Open if any interval overlaps the slot window.
  for (const iv of intervals as [string, string][]) {
    const [o, c] = iv;
    const close = c === '24:00' ? '23:59' : c;
    if (o <= slotClose && close >= slotOpen) return 'open';
  }
  return 'closed';
}
