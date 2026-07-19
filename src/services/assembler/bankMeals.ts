/**
 * bankMeals — bridge the book-ahead restaurant AGENT into the everyday itinerary.
 *
 * The scout's `restaurant_recommendations` bank is curated, Israeli-calibrated
 * (Bayesian rating, value-for-money, tourist-trap penalty) and concept-aware
 * (cuisine_genre). This maps those rows into `AssemblerPlace` meal candidates so
 * the deterministic day-meal picker draws from the SAME smart inventory as the
 * book-ahead panel — not just the generic `places` table.
 *
 * Only rows WITH coordinates qualify (the meal ranker is proximity-anchored).
 * meal_slots defaults to lunch+dinner — the bank is reservation-style lunch/dinner
 * inventory — so breakfast stays sourced from `places` cafés.
 *
 * Pure and dependency-free, like the rest of the assembler.
 */

import type { RestaurantRecommendation } from '@/lib/types';
import type { AssemblerPlace } from './assembleItinerary';

export function bankRecsToAssemblerPlaces(recs: RestaurantRecommendation[]): AssemblerPlace[] {
  const out: AssemblerPlace[] = [];
  const seen = new Set<string>();
  for (const r of recs) {
    if (typeof r.latitude !== 'number' || typeof r.longitude !== 'number') continue;
    const nameKey = (r.name ?? '').trim().toLowerCase();
    if (!nameKey || seen.has(nameKey)) continue;
    seen.add(nameKey);

    const slots = Array.isArray(r.mealSlots) && r.mealSlots.length ? r.mealSlots : ['lunch', 'dinner'];
    out.push({
      id: `bank:${r.id}`,
      name: r.name,
      city: r.city,
      category: 'restaurant',
      subcategory: r.cuisineGenre ?? r.cuisineStyle ?? null,
      description: r.description ?? null,
      lat: r.latitude,
      lng: r.longitude,
      category_emoji: '🍽️',
      price_tier: r.priceLevel ?? null,
      meal_slots: slots,
      group_suitability: Array.isArray(r.groupSuitability) ? r.groupSuitability : [],
      vibe: [],
      culinary_focus: [r.cuisineGenre, r.cuisineStyle].filter((s): s is string => !!s),
      vibe_label: r.cuisineStyle ?? null,
      top_pick_category: null,
      popularity_rank: null,
      google_rating: r.rating ?? null,
      rating_count: r.ratingCount ?? null,
      opening_hours: null,
      website_url: r.websiteUrl ?? null,
      photo_url: r.photoUrl ?? null,
      status: null,
    });
  }
  return out;
}
