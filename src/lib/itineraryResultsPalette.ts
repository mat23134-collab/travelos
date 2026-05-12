/**
 * Deep teal + luxury gold — itinerary / results surfaces only.
 * Gold accent #C9A84C (cool, deep) with supporting sand tones for text and depth.
 *
 * Layered radial + linear wash — keeps the teal character but adds gentle depth.
 */
export const ITIN_RESULTS_PAGE_BG = [
  'radial-gradient(ellipse 88% 72% at 10% 12%, rgba(56,124,132,0.38) 0%, transparent 58%)',
  'radial-gradient(ellipse 75% 58% at 92% 78%, rgba(10,36,40,0.72) 0%, transparent 52%)',
  'linear-gradient(170deg, #12343b 0%, #1a4d57 28%, #2f6570 50%, #234d56 70%, #163e45 90%, #12343b 100%)',
].join(', ');

/** SVG fractal noise — use at ~2% opacity over the page for film grain / dimension. */
export const ITIN_RESULTS_NOISE_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.82' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E";

export const ITIN_PALETTE = {
  /** Primary luxury gold */
  gold: '#C9A84C',
  /** Softer gold for long copy on dark teal */
  goldSoft: '#d4c8a8',
  sand: '#C9A84C',
  sandShadow: '#a89254',
  sandHover: '#b8a066',
  sandDeep: '#8f7a42',
  night: '#2d545e',
  nightDeep: '#12343b',
  panelNightRgb: '45, 84, 94',
  accentSandRgb: '201, 168, 76',
} as const;
