/**
 * restaurantGenre — the small, travel-meaningful cuisine taxonomy (§5).
 *
 * Twelve canonical genres. The scout's Gemini step maps a restaurant's free-text
 * cuisine onto ONE key; the UI shows the localized pretty label. Each genre also
 * carries a "book-ahead prior" — a default reservation-necessity level used to
 * sanity-check (never override) the model's per-restaurant book_ahead_level.
 */

import { SiteLanguage } from '@/lib/types';

export const RESTAURANT_GENRES = [
  'fine-dining',
  'local-institution',
  'omakase-counter',
  'steak-grill',
  'seafood',
  'trattoria-bistro',
  'izakaya-tapas',
  'street-casual',
  'cafe-brunch',
  'rooftop-view',
  'vegetarian-vegan',
  'dessert-specialty',
] as const;

export type RestaurantGenre = (typeof RESTAURANT_GENRES)[number];

const GENRE_SET = new Set<string>(RESTAURANT_GENRES);

/** True book-ahead necessity default per genre (0..3) — the §5 "prior". */
export const GENRE_BOOK_AHEAD_PRIOR: Record<RestaurantGenre, number> = {
  'fine-dining': 3,
  'omakase-counter': 3,
  'local-institution': 2,
  'rooftop-view': 2,
  'steak-grill': 2,
  'seafood': 2,
  'trattoria-bistro': 1,
  'izakaya-tapas': 1,
  'vegetarian-vegan': 1,
  'cafe-brunch': 1,
  'dessert-specialty': 0,
  'street-casual': 0,
};

/** Localized display labels. */
const GENRE_LABELS: Record<RestaurantGenre, Record<SiteLanguage, string>> = {
  'fine-dining':      { en: 'Fine dining',        he: 'מסעדת שף' },
  'local-institution':{ en: 'Local institution',  he: 'מוסד מקומי' },
  'omakase-counter':  { en: 'Omakase counter',    he: 'דלפק אומקסה' },
  'steak-grill':      { en: 'Steak & grill',      he: 'סטייק ועל האש' },
  'seafood':          { en: 'Seafood',            he: 'פירות ים' },
  'trattoria-bistro': { en: 'Trattoria / bistro', he: 'טרטוריה / ביסטרו' },
  'izakaya-tapas':    { en: 'Izakaya / tapas',    he: 'איזקאיה / טפאס' },
  'street-casual':    { en: 'Street & casual',    he: 'אוכל רחוב' },
  'cafe-brunch':      { en: 'Café & brunch',      he: 'קפה ובראנץ′' },
  'rooftop-view':     { en: 'Rooftop & views',    he: 'גג ונוף' },
  'vegetarian-vegan': { en: 'Vegetarian / vegan', he: 'צמחוני / טבעוני' },
  'dessert-specialty':{ en: 'Dessert specialty',  he: 'קינוחים' },
};

export function genreLabel(genre: string | null | undefined, lang: SiteLanguage): string | null {
  if (!genre || !GENRE_SET.has(genre)) return null;
  return GENRE_LABELS[genre as RestaurantGenre][lang] ?? GENRE_LABELS[genre as RestaurantGenre].en;
}

export function isRestaurantGenre(v: string | null | undefined): v is RestaurantGenre {
  return !!v && GENRE_SET.has(v);
}

/**
 * Best-effort mapping of a free-text cuisine string onto a canonical genre —
 * a fallback for rows the model didn't tag (older scouts) so they still slot
 * into the diversity/geo logic. Keyword-based, deliberately conservative:
 * returns null rather than guess wrong.
 */
const GENRE_KEYWORDS: Array<[RestaurantGenre, string[]]> = [
  ['omakase-counter',  ['omakase', 'sushi', 'kappo', 'sushiya', 'nigiri', 'edomae']],
  ['fine-dining',      ['tasting menu', 'michelin', 'fine dining', 'chef’s counter', "chef's table", 'gastronomic', 'haute']],
  ['steak-grill',      ['steak', 'steakhouse', 'parrilla', 'yakiniku', 'grill', 'churrascaria', 'asado', 'bbq', 'barbecue']],
  ['seafood',          ['seafood', 'oyster', 'fish market', 'raw bar', 'shellfish', 'ceviche']],
  ['izakaya-tapas',    ['izakaya', 'tapas', 'small plates', 'pintxos', 'yakitori', 'wine bar']],
  ['cafe-brunch',      ['brunch', 'breakfast', 'cafe', 'café', 'coffee', 'bakery-cafe']],
  ['dessert-specialty',['dessert', 'patisserie', 'pâtisserie', 'gelato', 'kakigori', 'ice cream', 'pastry', 'chocolat']],
  ['rooftop-view',     ['rooftop', 'sky bar', 'skybar', 'view', 'panoramic', 'terrace']],
  ['vegetarian-vegan', ['vegetarian', 'vegan', 'plant-based', 'plant based']],
  ['street-casual',    ['street food', 'stall', 'hawker', 'food court', 'counter-only', 'noodle stall', 'kiosk']],
  ['trattoria-bistro', ['trattoria', 'bistro', 'osteria', 'brasserie', 'ristorante', 'tavern']],
  ['local-institution',['institution', 'legendary', 'iconic', 'old-school', 'historic', 'landmark restaurant']],
];

export function canonicalizeGenre(freeText: string | null | undefined): RestaurantGenre | null {
  if (!freeText) return null;
  const s = freeText.toLowerCase();
  if (GENRE_SET.has(s)) return s as RestaurantGenre;
  for (const [genre, kws] of GENRE_KEYWORDS) {
    if (kws.some((k) => s.includes(k))) return genre;
  }
  return null;
}

/**
 * GenreFit (§5): Jaccard overlap between the traveler's culinary interests and
 * a restaurant's genre + culinary tags → 0..1. When the trip states no culinary
 * preference we return a neutral 0.5 so taste never becomes a silent penalty.
 */
export function genreFit(tripCulinaryTags: string[], restaurantTags: string[]): number {
  const want = new Set(tripCulinaryTags.map((t) => t.toLowerCase().trim()).filter(Boolean));
  const have = new Set(restaurantTags.map((t) => t.toLowerCase().trim()).filter(Boolean));
  if (want.size === 0 || have.size === 0) return 0.5;
  let inter = 0;
  for (const w of want) if (have.has(w)) inter++;
  const union = want.size + have.size - inter;
  return union === 0 ? 0.5 : inter / union;
}
