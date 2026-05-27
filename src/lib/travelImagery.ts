import { STEP_BACKGROUNDS } from './stepBackgrounds';

/** Normalize country names from countries.ts → STEP_BACKGROUNDS labels */
const COUNTRY_ALIASES: Record<string, string> = {
  'Czech Republic': 'Czechia',
  'United Kingdom': 'United Kingdom',
  'United States': 'USA',
};

/** Extra hero photos for countries not yet in STEP_BACKGROUNDS */
const EXTRA_COUNTRY_HERO: Record<string, string> = {
  Croatia:
    'https://images.unsplash.com/photo-1555990793-da0b9237432d?auto=format&fit=crop&w=1800&q=80',
  Switzerland:
    'https://images.unsplash.com/photo-1530122037263-a5f1f91dab3d?auto=format&fit=crop&w=1800&q=80',
  Iceland:
    'https://images.unsplash.com/photo-1504829857797-ddff29c27927?auto=format&fit=crop&w=1800&q=80',
  Thailand:
    'https://images.unsplash.com/photo-1552465011-b21e7a7a6598?auto=format&fit=crop&w=1800&q=80',
  Vietnam:
    'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1800&q=80',
  Jordan:
    'https://images.unsplash.com/photo-1579606032821-4e68a8265a44?auto=format&fit=crop&w=1800&q=80',
  'South Korea':
    'https://images.unsplash.com/photo-1517154421773-0529f29ea771?auto=format&fit=crop&w=1800&q=80',
  Mexico:
    'https://images.unsplash.com/photo-1518638150340-f706f99b669e?auto=format&fit=crop&w=1800&q=80',
  'Costa Rica':
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1800&q=80',
};

const DEFAULT_HERO =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1800&q=80';

/** Aerial coastline — Pexels (free to use, hotlink OK) */
export const HERO_OPENING_VIDEO =
  'https://videos.pexels.com/video-files/2992155/2992155-hd_1920_1080_25fps.mp4';

/** Cinematic stills for hero fallback / crossfade under video */
export const HERO_SLIDE_IMAGES = [
  'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1800&q=80', // Santorini
  'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1800&q=80', // Tokyo
  'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1800&q=80', // Rio
  'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1800&q=80', // Marrakech
  'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1800&q=80', // Machu Picchu
];

export function getCountryImage(countryName: string): string {
  const key = COUNTRY_ALIASES[countryName] ?? countryName;
  const fromLibrary = STEP_BACKGROUNDS.find(
    (b) => b.country.toLowerCase() === key.toLowerCase(),
  );
  if (fromLibrary) return fromLibrary.imageUrl;
  if (EXTRA_COUNTRY_HERO[key]) return EXTRA_COUNTRY_HERO[key];
  return DEFAULT_HERO;
}

export function getCityImage(cityName: string, countryName?: string): string {
  const city = cityName.trim();
  const country = countryName?.trim() ?? '';
  const countryKey = COUNTRY_ALIASES[country] ?? country;

  const exactCity = STEP_BACKGROUNDS.find(
    (b) =>
      b.city.toLowerCase() === city.toLowerCase() &&
      (!countryKey || b.country.toLowerCase() === countryKey.toLowerCase()),
  );
  if (exactCity) return exactCity.imageUrl;

  const cityOnly = STEP_BACKGROUNDS.find(
    (b) => b.city.toLowerCase() === city.toLowerCase(),
  );
  if (cityOnly) return cityOnly.imageUrl;

  if (countryKey) return getCountryImage(countryKey);
  return DEFAULT_HERO;
}
