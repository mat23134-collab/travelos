import type { ActivityGenre } from '@/lib/activityGenre';

/** Infer genre from Scout/explore category labels when cubePhotoGenre is unset. */
export function inferGenreFromCategoryHint(category?: string): ActivityGenre | undefined {
  if (!category) return undefined;
  const c = category.toLowerCase();
  if (/food|restaurant|cafe|coffee|bar|dining|bakery|brunch|brew/.test(c)) return 'food';
  if (/shop|market|fashion|boutique|mall|retail/.test(c)) return 'shopping';
  if (/night|club|music|jazz|bar|crawl/.test(c)) return 'nightlife';
  return undefined;
}

/** Itinerary activity slots stored in `category` — not a cuisine label. */
const SLOT_CATEGORY = /^(morning|afternoon|evening)$/i;

function normalizeCuisineCategory(category?: string): string | undefined {
  const c = category?.trim();
  if (!c || SLOT_CATEGORY.test(c)) return undefined;
  return c;
}

/** Dish-forward keywords per cuisine (avoid empty dining rooms / chairs). */
const CUISINE_FOOD_KEYWORDS: { test: RegExp; q: string }[] = [
  { test: /italian|italy|pasta|pizza|trattoria|risotto|tiramisu|gelato|carbonara/i, q: 'italian pasta pizza rustic tomato basil olive oil plated overhead colorful mediterranean' },
  { test: /french|france|bistro|brasserie|croissant|coq au vin|ratatouille/i, q: 'french cuisine pastry butter crust plated gourmet herbs colorful classical' },
  { test: /spanish|spain|tapas|paella|iberian/i, q: 'spanish tapas paella colorful peppers chorizo plated sharing overhead' },
  { test: /greek|greece|taverna|mezze|feta|souvlaki/i, q: 'greek mediterranean feta olives fresh herbs colorful mezze platter overhead' },
  { test: /turkish|istanbul|kebab|meze/i, q: 'turkish meze colorful spices grilled plated feast overhead' },
  { test: /mediterranean|levant/i, q: 'mediterranean colorful fresh herbs hummus grilled vegetables platter overhead' },
  { test: /mexican|taco|tacos|tex-mex|enchilada|quesadilla/i, q: 'mexican tacos colorful salsa lime cilantro peppers plated overhead vibrant' },
  { test: /thai|bangkok|pad thai|tom yum/i, q: 'thai food colorful chili lime herbs curry plated spicy vibrant overhead' },
  { test: /vietnamese|pho|banh mi/i, q: 'vietnamese pho fresh herbs colorful bowls lime basil vibrant overhead' },
  { test: /japanese|japan|sushi|sashimi|ramen|izakaya|tempura|udon|kaiseki/i, q: 'japanese sushi ramen colorful fresh fish bento plated minimalist vibrant' },
  { test: /korean|kimchi|bibimbap|bbq|seoul/i, q: 'korean colorful banchan kimchi bbq grilled plated overhead vibrant' },
  { test: /chinese|dim sum|szechuan|sichuan|cantonese|peking/i, q: 'chinese dim sum dumplings colorful steam ginger scallion plated feast' },
  { test: /indian|curry|masala|tandoor|biryani|naan/i, q: 'indian curry colorful spices turmeric cilantro naan thali platter overhead' },
  { test: /middle eastern|lebanese|israeli|falafel|shawarma|hummus/i, q: 'middle eastern colorful hummus falafel tahini herbs tahini platter overhead' },
  { test: /ethiopian|injera/i, q: 'ethiopian injera colorful stew platter spices vibrant overhead' },
  { test: /seafood|fish|oyster|crab|lobster|ceviche/i, q: 'seafood platter colorful lemon herbs ice fresh oysters vibrant overhead' },
  { test: /steak|grill|bbq|barbecue|smoked meat/i, q: 'grilled steak colorful vegetables charred herbs butter plated rustic overhead' },
  { test: /vegan|vegetarian|plant.based/i, q: 'colorful vegan bowl fresh vegetables grains herbs vibrant salad plated overhead' },
  { test: /american|burger|diner/i, q: 'american comfort food colorful burger fries pickles plated overhead appetizing' },
  { test: /breakfast|brunch|bakery|pastry|croissant/i, q: 'colorful brunch pastries berries syrup butter plated overhead bright' },
];

function cuisineKeywordsFromText(text: string): string | null {
  const t = text.trim();
  if (t.length < 3) return null;
  for (const { test, q } of CUISINE_FOOD_KEYWORDS) {
    if (test.test(t)) return q;
  }
  return null;
}

function inferCuisineFromBlob(blob: string): string | null {
  const compact = blob.replace(/\s+/g, ' ').trim();
  if (compact.length < 8) return null;
  return cuisineKeywordsFromText(compact);
}

/** Stronger color pop when copy hints at vivid spots. */
function vibrantBoost(description?: string, highlights?: string[]): string {
  const blob = [description, ...(highlights ?? [])].join(' ').toLowerCase();
  if (/colorful|colourful|vibrant|bright|rainbow|neon|fusion|market|street food|spice|tropical/i.test(blob)) {
    return 'vivid saturated colors bold garnishes stunning instagram worthy';
  }
  return 'vivid colorful garnishes stunning appetizing';
}

function buildFoodUnsplashQuery(args: {
  city: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';
  category?: string;
  description?: string;
  highlights?: string[];
  /** Venue name — only used as weak hint when genre is food but no cuisine detected (never alone). */
  name?: string;
}): string {
  const { city, mealSlot, category, description, highlights, name } = args;

  const cuisineFromCategory = normalizeCuisineCategory(category);
  let dishCue =
    (cuisineFromCategory && cuisineKeywordsFromText(cuisineFromCategory)) ??
    inferCuisineFromBlob([cuisineFromCategory, description, ...(highlights ?? []), name].filter(Boolean).join(' '));

  if (!dishCue && cuisineFromCategory) {
    dishCue = `${cuisineFromCategory} cuisine traditional dish plated overhead colorful vibrant`;
  }

  const meal =
    mealSlot === 'breakfast'
      ? 'breakfast spread pastries fruit coffee bright morning'
      : mealSlot === 'lunch'
        ? 'lunch daylight fresh herbs colorful plate'
        : 'dinner feast herbs glossy sauce colorful evening';

  const vivid = vibrantBoost(description, highlights);

  const base =
    'food photography overhead flat lay close-up dish gourmet plating fresh ingredients sharp vibrant';

  const parts = [city, meal, dishCue, vivid, base].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 420);
}

/**
 * Builds an Unsplash search query for cube hero imagery.
 * Dining uses dish-focused, colorful food queries (no venue name as primary).
 */
export function buildCubeUnsplashSearchQuery(args: {
  city?: string;
  name: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';
  cubePhotoGenre?: ActivityGenre;
  category?: string;
  description?: string;
  highlights?: string[];
}): string {
  const city = (args.city ?? '').trim() || 'Europe';

  const genre: ActivityGenre =
    args.cubePhotoGenre ??
    (args.mealSlot ? 'food' : inferGenreFromCategoryHint(args.category) ?? 'sightseeing');

  if (args.mealSlot || genre === 'food') {
    return buildFoodUnsplashQuery({
      city,
      mealSlot: args.mealSlot,
      category: args.category,
      description: args.description,
      highlights: args.highlights,
      name: args.name,
    });
  }

  if (genre === 'shopping') {
    return `${city} shopping street boutique fashion district vintage market lifestyle atmospheric`;
  }

  if (genre === 'nightlife') {
    return `${city} nightlife jazz bar neon rooftop evening lights cinematic mood atmospheric`;
  }

  const venue = (args.name ?? '').trim();
  return `${venue} ${city} historic landmark heritage architecture monument tourism museum ancient`;
}
