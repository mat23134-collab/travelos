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
  family: ['family', 'families', 'kids', 'parent-child', 'mixed-ages', 'family-friendly', 'stroller-friendly', 'teens'],
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

/** Counts of children per age band — mirrors FamilyChildAgeBand/FamilyKidsByAge
 *  in src/lib/types.ts. Redeclared locally so this decoupled assembler layer
 *  doesn't need to import the app-level types module (matches how GroupType/
 *  BudgetLevel/PaceLevel above are also redeclared rather than imported). */
export type FamilyChildAgeBand = '0-3' | '3-6' | '6-9' | '9-12' | '12-16' | '16+';
export type FamilyKidsByAge = Partial<Record<FamilyChildAgeBand, number>>;

/**
 * Overrides the selected pace when young kids (under 6) are along — mirrors
 * the LLM-prompt path's "PACING ENGINE — YOUNG KIDS" rule (prompts.ts): max
 * 2 activities before lunch, evening ends early, no late-night slot. Without
 * this, the deterministic (zero-LLM) assembler ignored family ages entirely
 * and would happily schedule a moderate/intense-pace evening activity for a
 * toddler regardless of the pace the user picked.
 *
 * School-age-only and teens-only families keep their selected pace as-is
 * (matches the prompt path, which only caps pace for under-6s) — returns
 * null so the caller falls back to the normal PACE_PLAN[pace] lookup.
 */
export function familyPaceOverride(
  groupType: GroupType,
  familyKidsByAge?: FamilyKidsByAge | null,
): PacePlan | null {
  if (groupType !== 'family' || !familyKidsByAge) return null;
  const hasYoungKids = (familyKidsByAge['0-3'] ?? 0) > 0 || (familyKidsByAge['3-6'] ?? 0) > 0;
  if (!hasYoungKids) return null;
  return { activities: ['morning', 'afternoon'], meals: ['lunch', 'dinner'] };
}

/** Age band → group_suitability tokens that genuinely fit it. Mirrors
 *  FAMILY_BAND_TAGS in scoringEngine.ts and the KID_APPEAL vocabulary the
 *  scout now writes per-venue (placeClassify.ts groupSuitabilityWithKidAppeal). */
const FAMILY_BAND_FIT_TAGS: Record<FamilyChildAgeBand, string[]> = {
  '0-3': ['stroller-friendly', 'kids'],
  '3-6': ['stroller-friendly', 'kids'],
  '6-9': ['family-friendly', 'kids'],
  '9-12': ['family-friendly', 'kids'],
  '12-16': ['teens'],
  '16+': ['teens'],
};

/**
 * The union of group_suitability tokens that fit THIS family's actual kids'
 * ages — every band present, not just one. Used to boost (not filter — a
 * family-eligible venue without a specific age match still ranks, just
 * lower) venues that are a real match for the ages along, e.g. so a science
 * museum outranks a generic "family-friendly" landmark for a family with a
 * school-age kid, and a stroller-friendly park outranks both for a family
 * with a toddler.
 */
export function familyAgeFitTags(familyKidsByAge?: FamilyKidsByAge | null): string[] {
  if (!familyKidsByAge) return [];
  const out = new Set<string>();
  for (const [band, count] of Object.entries(familyKidsByAge) as [FamilyChildAgeBand, number | undefined][]) {
    if (!count || count <= 0) continue;
    for (const t of FAMILY_BAND_FIT_TAGS[band] ?? []) out.add(t);
  }
  return [...out];
}

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
