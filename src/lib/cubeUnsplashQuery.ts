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

/**
 * Builds an Unsplash search query for cube hero imagery.
 * Dining uses mood-only keywords (no venue name). Sightseeing leans historic/landmark.
 */
export function buildCubeUnsplashSearchQuery(args: {
  city?: string;
  name: string;
  mealSlot?: 'breakfast' | 'lunch' | 'dinner';
  cubePhotoGenre?: ActivityGenre;
  category?: string;
}): string {
  const city = (args.city ?? '').trim() || 'Europe';

  let genre: ActivityGenre =
    args.cubePhotoGenre ??
    (args.mealSlot ? 'food' : inferGenreFromCategoryHint(args.category) ?? 'sightseeing');

  if (args.mealSlot || genre === 'food') {
    const meal =
      args.mealSlot === 'breakfast'
        ? 'breakfast cafe morning light brunch cozy'
        : args.mealSlot === 'lunch'
          ? 'lunch bistro daylight casual dining'
          : 'evening dinner ambiance mood lighting';
    return `${city} ${meal} restaurant interior atmospheric dining cinematic cozy aesthetic culinary`;
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
