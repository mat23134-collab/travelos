/**
 * restaurantConcepts — a request-time "cuisine concept" facet for the book-ahead
 * panel. The 12-genre taxonomy (restaurantGenre.ts) is reservation-oriented and
 * global; travelers think in destination-native CONCEPTS instead — "ramen",
 * "sushi", "omakase", "izakaya" in Japan; "pizza", "pasta", "meat" in Italy.
 *
 * This is deliberately data-driven and schema-free: a concept "matches" a
 * restaurant when its keywords appear anywhere in the place's text (name,
 * cuisine, genre, description, signature dish, localized copy). The panel then
 * only shows the concept chips that actually have matches in that city's
 * results — so the filter is always relevant to what's on screen, and Tokyo vs.
 * Rome light up different chips automatically without a country map.
 */

import { RestaurantRecommendation, SiteLanguage } from '@/lib/types';

export interface RestaurantConcept {
  key: string;
  label: Record<SiteLanguage, string>;
  /** Lowercased substrings (Latin + native script) that signal this concept. */
  keywords: string[];
}

// Ordered roughly by how travelers browse (mains before sweets). Keywords are
// matched case-insensitively as substrings, so include native-script forms too.
export const RESTAURANT_CONCEPTS: RestaurantConcept[] = [
  { key: 'ramen',       label: { en: 'Ramen',        he: 'ראמן' },        keywords: ['ramen', 'ラーメン', 'ראמן'] },
  { key: 'sushi',       label: { en: 'Sushi',        he: 'סושי' },        keywords: ['sushi', 'nigiri', 'maki', '寿司', 'סושי'] },
  { key: 'omakase',     label: { en: 'Omakase',      he: 'אומקסה' },      keywords: ['omakase', 'kaiseki', 'kappo', 'sushiya', 'אומקסה'] },
  { key: 'izakaya',     label: { en: 'Izakaya',      he: 'איזקאיה' },     keywords: ['izakaya', 'yakitori', 'robata', 'איזקאיה'] },
  { key: 'tempura',     label: { en: 'Tempura',      he: 'טמפורה' },      keywords: ['tempura', 'טמפורה'] },
  { key: 'udon-soba',   label: { en: 'Udon & Soba',  he: 'אודון וסובה' }, keywords: ['udon', 'soba', 'אודון', 'סובה'] },
  { key: 'pizza',       label: { en: 'Pizza',        he: 'פיצה' },        keywords: ['pizza', 'pizzeria', 'napoletana', 'פיצה'] },
  { key: 'pasta',       label: { en: 'Pasta',        he: 'פסטה' },        keywords: ['pasta', 'trattoria', 'osteria', 'spaghetti', 'carbonara', 'cacio', 'tagliatelle', 'פסטה'] },
  { key: 'meat-grill',  label: { en: 'Meat & grill', he: 'בשר ועל האש' }, keywords: ['steak', 'grill', 'parrilla', 'yakiniku', 'churrasc', 'asado', 'bistecca', 'bbq', 'barbecue', 'meat', 'בשר', 'על האש'] },
  { key: 'seafood',     label: { en: 'Seafood',      he: 'פירות ים' },    keywords: ['seafood', 'oyster', 'fish', 'ceviche', 'raw bar', 'פירות ים', 'דגים'] },
  { key: 'tapas',       label: { en: 'Tapas',        he: 'טאפאס' },       keywords: ['tapas', 'pintxos', 'טאפאס'] },
  { key: 'burger',      label: { en: 'Burgers',      he: 'המבורגר' },     keywords: ['burger', 'המבורגר'] },
  { key: 'vegetarian',  label: { en: 'Veg & vegan',  he: 'צמחוני/טבעוני' }, keywords: ['vegetarian', 'vegan', 'plant-based', 'plant based', 'צמחוני', 'טבעוני'] },
  { key: 'dessert',     label: { en: 'Dessert',      he: 'קינוחים' },     keywords: ['dessert', 'gelato', 'patisserie', 'pâtisserie', 'bakery', 'ice cream', 'kakigori', 'קינוח', 'גלידה'] },
  { key: 'fine-dining', label: { en: 'Fine dining',  he: 'מסעדת שף' },    keywords: ['michelin', 'tasting menu', 'fine dining', 'gastronomic', 'haute', 'שף', 'טעימות'] },
];

const CONCEPT_BY_KEY = new Map(RESTAURANT_CONCEPTS.map((c) => [c.key, c]));

/** All the searchable text for a restaurant, lowercased and concatenated. */
function searchableText(r: RestaurantRecommendation): string {
  const parts: (string | null | undefined)[] = [
    r.name, r.cuisineStyle, r.cuisineGenre, r.description, r.signatureDish, r.highlight, r.neighborhood,
  ];
  if (r.translations) {
    for (const loc of Object.values(r.translations)) {
      if (loc) parts.push(loc.cuisineStyle, loc.description, loc.signatureDish, loc.highlight);
    }
  }
  return parts.filter(Boolean).join(' · ').toLowerCase();
}

/** Does a restaurant match a given concept key? */
export function matchesConcept(r: RestaurantRecommendation, conceptKey: string): boolean {
  const concept = CONCEPT_BY_KEY.get(conceptKey);
  if (!concept) return false;
  const text = searchableText(r);
  return concept.keywords.some((k) => text.includes(k));
}

export function conceptLabel(conceptKey: string, lang: SiteLanguage): string | null {
  const c = CONCEPT_BY_KEY.get(conceptKey);
  return c ? c.label[lang] ?? c.label.en : null;
}

/**
 * The concepts worth offering as chips for a set of results: those with at least
 * `min` matching restaurants, in catalog order. Keeps the filter relevant to
 * what's actually on screen (no empty "Sushi" chip for a Rome bank).
 */
export function availableConcepts(recs: RestaurantRecommendation[], min = 1): RestaurantConcept[] {
  return RESTAURANT_CONCEPTS.filter(
    (concept) => recs.filter((r) => concept.keywords.some((k) => searchableText(r).includes(k))).length >= min,
  );
}
