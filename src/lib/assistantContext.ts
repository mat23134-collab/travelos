// src/lib/assistantContext.ts
import type { Itinerary, TravelerProfile } from './types';
import type { AssistantContext, DaySlotSummary, SlotKey, ActivitySlot, DiningField } from './assistantTypes';

const SLOT_KEYS: SlotKey[] = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];

export function anchorSlotForDining(field: DiningField): ActivitySlot {
  if (field === 'breakfast') return 'morning';
  if (field === 'lunch') return 'afternoon';
  return 'evening';
}

export function buildAssistantContext(
  itinerary: Itinerary,
  profile: TravelerProfile | null,
): AssistantContext {
  const daysSummary: DaySlotSummary[] = (itinerary.days ?? []).map((day, i) => {
    const slots: Partial<Record<SlotKey, string>> = {};
    const dayRec = day as unknown as Record<string, { name?: string } | undefined>;
    for (const key of SLOT_KEYS) {
      const name = dayRec[key]?.name;
      if (name) slots[key] = name;
    }
    return { dayNumber: i + 1, slots };
  });

  const profileSummary = profile
    ? [
        profile.groupType && `group: ${profile.groupType}`,
        profile.budget && `budget: ${profile.budget}`,
        profile.pace && `pace: ${profile.pace}`,
        profile.interests?.length && `interests: ${profile.interests.join(', ')}`,
        profile.dietaryRestrictions && `dietary: ${profile.dietaryRestrictions}`,
      ]
        .filter(Boolean)
        .join(' · ') || 'no profile'
    : 'no profile';

  return {
    itinerary_id: itinerary._id ?? null,
    city: (itinerary.destination ?? '').trim(),
    profileSummary,
    daysSummary,
  };
}
