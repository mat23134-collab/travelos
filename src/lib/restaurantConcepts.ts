/**
 * restaurantConcepts — a request-time "cuisine concept" facet for the book-ahead
 * panel. The 12-genre taxonomy (restaurantGenre.ts) is reservation-oriented and
 * global; travelers think in destination-native CONCEPTS instead — "ramen",
 * "sushi", "omakase", "izakaya" in Japan; "pizza", "pasta", "meat" in Italy.
 *
 * Two rules keep concepts honest:
 *   1. Matching only looks at a restaurant's CUISINE-identifying fields (name,
 *      cuisine style, genre, signature dish, highlight) — never the free-text
 *      description, whose prose ("better than any sushi joint") caused false
 *      positives like a Tuscan trattoria surfacing under "sushi".
 *   2. Region-specific concepts are gated to their country/countries, so an
 *      Italian city never even offers "sushi"/"ramen". The destination country
 *      comes from the rows' country_code (majority), with a city fallback.
 */

import { RestaurantRecommendation, SiteLanguage } from '@/lib/types';
import { normalizeCity } from '@/lib/restaurantBank';

export interface RestaurantConcept {
  key: string;
  label: Record<SiteLanguage, string>;
  /** Lowercased substrings (Latin + native script) that signal this concept. */
  keywords: string[];
  /** ISO-2 countries this concept belongs to; undefined = universal. */
  countries?: string[];
}

// Ordered roughly by how travelers browse (mains before sweets). Keywords are
// matched case-insensitively as substrings, so include native-script forms too.
// Region-bound concepts carry a `countries` allow-list.
export const RESTAURANT_CONCEPTS: RestaurantConcept[] = [
  { key: 'ramen',       label: { en: 'Ramen',        he: 'ראמן' },        keywords: ['ramen', 'ラーメン', 'ראמן'], countries: ['JP'] },
  { key: 'sushi',       label: { en: 'Sushi',        he: 'סושי' },        keywords: ['sushi', 'nigiri', 'sashimi', '寿司', 'סושי'], countries: ['JP'] },
  { key: 'omakase',     label: { en: 'Omakase',      he: 'אומקסה' },      keywords: ['omakase', 'kaiseki', 'kappo', 'sushiya', 'אומקסה'], countries: ['JP'] },
  { key: 'izakaya',     label: { en: 'Izakaya',      he: 'איזקאיה' },     keywords: ['izakaya', 'yakitori', 'robata', 'איזקאיה'], countries: ['JP'] },
  { key: 'tempura',     label: { en: 'Tempura',      he: 'טמפורה' },      keywords: ['tempura', 'טמפורה'], countries: ['JP'] },
  { key: 'udon-soba',   label: { en: 'Udon & Soba',  he: 'אודון וסובה' }, keywords: ['udon', 'soba', 'אודון', 'סובה'], countries: ['JP'] },
  { key: 'pizza',       label: { en: 'Pizza',        he: 'פיצה' },        keywords: ['pizza', 'pizzeria', 'napoletana', 'פיצה'], countries: ['IT'] },
  { key: 'pasta',       label: { en: 'Pasta',        he: 'פסטה' },        keywords: ['pasta', 'trattoria', 'osteria', 'spaghetti', 'carbonara', 'cacio', 'tagliatelle', 'פסטה'], countries: ['IT'] },
  { key: 'tapas',       label: { en: 'Tapas',        he: 'טאפאס' },       keywords: ['tapas', 'pintxos', 'טאפאס'], countries: ['ES'] },
  { key: 'meat-grill',  label: { en: 'Meat & grill', he: 'בשר ועל האש' }, keywords: ['steak', 'grill', 'parrilla', 'yakiniku', 'churrasc', 'asado', 'bistecca', 'bbq', 'barbecue', 'בשר', 'על האש'] },
  { key: 'seafood',     label: { en: 'Seafood',      he: 'פירות ים' },    keywords: ['seafood', 'oyster', 'ceviche', 'raw bar', 'פירות ים'] },
  { key: 'burger',      label: { en: 'Burgers',      he: 'המבורגר' },     keywords: ['burger', 'המבורגר'] },
  { key: 'vegetarian',  label: { en: 'Veg & vegan',  he: 'צמחוני/טבעוני' }, keywords: ['vegetarian', 'vegan', 'plant-based', 'plant based', 'צמחוני', 'טבעוני'] },
  { key: 'dessert',     label: { en: 'Dessert',      he: 'קינוחים' },     keywords: ['dessert', 'gelato', 'patisserie', 'pâtisserie', 'kakigori', 'קינוח', 'גלידה'] },
  { key: 'fine-dining', label: { en: 'Fine dining',  he: 'מסעדת שף' },    keywords: ['michelin', 'tasting menu', 'fine dining', 'gastronomic', 'haute', 'טעימות'] },
];

const CONCEPT_BY_KEY = new Map(RESTAURANT_CONCEPTS.map((c) => [c.key, c]));

/** Fallback city → ISO-2 for existing rows scouted before country_code existed. */
const CITY_COUNTRY: Record<string, string> = {
  tokyo: 'JP', kyoto: 'JP', osaka: 'JP',
  rome: 'IT', florence: 'IT', venice: 'IT', milan: 'IT', naples: 'IT',
  barcelona: 'ES', madrid: 'ES', seville: 'ES', 'san sebastian': 'ES',
  paris: 'FR', bordeaux: 'FR', lyon: 'FR', nice: 'FR',
  lisbon: 'PT', porto: 'PT',
  amsterdam: 'NL', london: 'GB', 'new york': 'US', dubai: 'AE', 'tel aviv': 'IL',
  berlin: 'DE', vienna: 'AT', athens: 'GR', istanbul: 'TR', bangkok: 'TH', singapore: 'SG',
};

/**
 * Resolve the destination's country: the majority country_code across the rows,
 * else a city-name fallback, else null (→ no region gating, show all matches).
 */
export function resolveCountry(recs: RestaurantRecommendation[], destination?: string): string | null {
  const counts = new Map<string, number>();
  for (const r of recs) {
    if (r.countryCode) counts.set(r.countryCode, (counts.get(r.countryCode) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestN = 0;
  for (const [cc, n] of counts) if (n > bestN) { best = cc; bestN = n; }
  if (best) return best;
  if (destination) return CITY_COUNTRY[normalizeCity(destination)] ?? null;
  return null;
}

/** Cuisine-identifying text only (NOT the free-text description). */
function searchableText(r: RestaurantRecommendation): string {
  const parts: (string | null | undefined)[] = [
    r.name, r.cuisineStyle, r.cuisineGenre, r.signatureDish, r.highlight,
  ];
  if (r.translations) {
    for (const loc of Object.values(r.translations)) {
      if (loc) parts.push(loc.cuisineStyle, loc.signatureDish, loc.highlight);
    }
  }
  return parts.filter(Boolean).join(' · ').toLowerCase();
}

/** True when the concept is allowed for the given country (undefined = any). */
function inRegion(concept: RestaurantConcept, country: string | null): boolean {
  return !concept.countries || country == null || concept.countries.includes(country);
}

/** Public region gate — allowed for a country (undefined countries = any). */
export function conceptInRegion(concept: RestaurantConcept, country: string | null): boolean {
  return inRegion(concept, country);
}

/**
 * Destination city → ISO-2 country (best-effort), for gating concepts without
 * needing scouted rows. Used by the everyday-meal assembler, which only has the
 * destination string.
 */
export function countryForCity(destination?: string | null): string | null {
  if (!destination) return null;
  return CITY_COUNTRY[normalizeCity(destination)] ?? null;
}

/** Does arbitrary cuisine-identifying text match a concept's keywords? */
export function textMatchesConcept(text: string, concept: RestaurantConcept): boolean {
  const t = text.toLowerCase();
  return concept.keywords.some((k) => t.includes(k));
}

/** Does a restaurant match a given concept key? */
export function matchesConcept(r: RestaurantRecommendation, conceptKey: string): boolean {
  const concept = CONCEPT_BY_KEY.get(conceptKey);
  if (!concept) return false;
  const text = searchableText(r);
  return concept.keywords.some((k) => text.includes(k));
}

/**
 * The single category a restaurant is filed under (or null) — first catalog
 * match, region-gated. `matchesConcept` alone let a restaurant satisfy several
 * concepts at once (an izakaya whose cuisineStyle mentions "yakitori" also
 * matches meat-grill), so it could appear under two chips simultaneously. This
 * is what chip filtering/counting should use instead: one restaurant, one home.
 */
export function primaryConcept(r: RestaurantRecommendation, country: string | null): RestaurantConcept | null {
  const text = searchableText(r);
  for (const concept of RESTAURANT_CONCEPTS) {
    if (!inRegion(concept, country)) continue;
    if (concept.keywords.some((k) => text.includes(k))) return concept;
  }
  return null;
}

export function conceptLabel(conceptKey: string, lang: SiteLanguage): string | null {
  const c = CONCEPT_BY_KEY.get(conceptKey);
  return c ? c.label[lang] ?? c.label.en : null;
}

/**
 * The concepts worth offering as chips for a set of results: those (a) allowed
 * for the destination country and (b) with at least `min` restaurants FILED
 * UNDER THEM as their primary concept, in catalog order. So an Italian city
 * offers pizza/pasta/meat/… but never sushi/ramen, counts reflect the same
 * one-restaurant-one-chip assignment the filter itself uses, and a restaurant
 * that would've inflated two categories's counts only inflates one.
 */
export function availableConcepts(
  recs: RestaurantRecommendation[],
  opts: { country?: string | null; min?: number } = {},
): RestaurantConcept[] {
  const { country = null, min = 1 } = opts;
  const counts = new Map<string, number>();
  for (const r of recs) {
    const concept = primaryConcept(r, country);
    if (concept) counts.set(concept.key, (counts.get(concept.key) ?? 0) + 1);
  }
  return RESTAURANT_CONCEPTS.filter((concept) => inRegion(concept, country) && (counts.get(concept.key) ?? 0) >= min);
}
