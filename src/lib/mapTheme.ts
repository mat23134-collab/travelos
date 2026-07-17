/**
 * Shared map theming — single source of truth for the itinerary maps.
 *
 * Both `ItineraryMap` and `InteractiveMap` read from here so the basemap and
 * the day-coded pins can never drift apart.
 */

/**
 * Per-day pin/legend colours, cycled by day index.
 *
 * Every value is drawn from the `@theme` palette in `src/app/globals.css`
 * (the warm terracotta / sunrise / crimson family), ordered so adjacent days
 * stay visually distinct and each colour clears contrast on the dark basemap.
 */
export const DAY_COLORS = [
  '#b8552e', // --color-terracotta
  '#e0a44b', // --color-sunrise
  '#9e363a', // --color-brand
  '#f0c98a', // --color-sunrise-soft
  '#8f4220', // --color-terracotta-deep
  '#b5404a', // --color-brand-hover
  '#b8772e', // --color-sunrise-deep
  '#7d2b2f', // --color-brand-dark
] as const;

export function dayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

/**
 * Basemap style. Defaults to a custom, brand-tinted Studio style via env;
 * falls back to stock dark-v11 until that style is authored.
 */
export const MAP_STYLE_URL =
  process.env.NEXT_PUBLIC_MAPBOX_STYLE_URL ?? 'mapbox://styles/mapbox/dark-v11';
