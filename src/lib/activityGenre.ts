import type { Activity } from '@/lib/types';

export type ActivityGenre = 'sightseeing' | 'food' | 'shopping' | 'nightlife';

/** Same taxonomy as DayCard genre cubes — used for smart-swap prompts. */
export function classifyActivity(activity: Activity): ActivityGenre {
  const t = [
    ...(activity.tags ?? []),
    activity.name ?? '',
    activity.description ?? '',
  ].join(' ').toLowerCase();

  if (/shop|vintage|market|fashion|style|boutique|mall|brand|cloth|accessor/.test(t)) return 'shopping';
  if (/bar|cocktail|beer|sake|nightlife|club|disco|live\s*music|jazz|concert|karaoke|speakeasy|alley|yokocho/.test(t))
    return 'nightlife';
  if (/ramen|sushi|food|restaurant|cafe|coffee|bakery|izakaya|dining|eat/.test(t)) return 'food';
  return 'sightseeing';
}

export const ACTIVITY_GENRE_LABEL_EN: Record<ActivityGenre, string> = {
  sightseeing: 'Sightseeing & culture (museums, landmarks, walks, parks)',
  food: 'Food & dining (cafés, restaurants, food experiences)',
  shopping: 'Shopping & markets (boutiques, vintage, retail)',
  nightlife: 'Nightlife & evening culture (bars, live music, jazz, rooftops)',
};
