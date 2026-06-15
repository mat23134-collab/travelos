// src/lib/assistantTypes.ts
import type { Activity } from './types';

export type SlotKey = 'breakfast' | 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening';
export type ActivitySlot = 'morning' | 'afternoon' | 'evening';
export type DiningField = 'breakfast' | 'lunch' | 'dinner';

/** A row selected from public.places (only the columns we use). */
export interface PlaceRow {
  id: string;
  name: string;
  city: string;
  category: string | null;
  description: string | null;
  lat: number | null;
  lng: number | null;
  category_emoji: string | null;
  vibe: string[] | null;
  group_suitability: string[] | null;
  culinary_focus: string[] | null;
  google_rating: number | null;
  popularity_rank: number | null;
  website_url: string | null;
  vibe_label: string | null;
}

export interface SwapTarget {
  dayIndex: number;
  slot: ActivitySlot;            // anchor slot for the commit
  diningField?: DiningField;     // present when the slot is a meal
}

export interface AssistantRecommendation {
  placeId: string;
  reasoning: string;
  isTopPick: boolean;
}

export interface AssistantPlaceCard {
  placeId: string;
  name: string;
  categoryEmoji: string | null;
  description: string | null;
  googleRating: number | null;
  reasoning: string;
  isTopPick: boolean;
  activity: Activity;            // ready for handleCommitActivitySwap
  target: SwapTarget;
}

export interface DaySlotSummary {
  dayNumber: number;                          // 1-based
  slots: Partial<Record<SlotKey, string>>;    // slot → current place name
}

export interface AssistantContext {
  itinerary_id: string | null;
  city: string;
  profileSummary: string;
  daysSummary: DaySlotSummary[];
}

export interface AssistantChatTurn {
  role: 'user' | 'assistant';
  content: string;
}
