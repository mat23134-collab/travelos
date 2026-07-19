/**
 * Single source of truth for featured destinations.
 *
 * Curated for the Israeli traveler — the classics Israelis actually fly to
 * (Italy, France, Central Europe, Greece, Spain, the UK). Add/remove one object
 * here and both surfaces below update automatically.
 *
 * Used by:
 *   - src/app/page.tsx           (postcard cards on the landing page)
 *   - src/app/onboarding/steps/DestinationStep.tsx  (destination picker)
 *
 * To add a new destination: add one object here — both places update automatically.
 */

export interface Destination {
  name:    string;
  flag:    string;
  country: string;
  tagline: string; // short evocative phrase shown on cards
  lat:     number;
  lng:     number;
}

export const DESTINATIONS: Destination[] = [
  { name: 'Rome',      flag: '🇮🇹', country: 'Italy',       tagline: 'La Dolce Vita',           lat: 41.9028, lng: 12.4964 },
  { name: 'Florence',  flag: '🇮🇹', country: 'Italy',       tagline: 'Cradle of the Renaissance', lat: 43.7696, lng: 11.2558 },
  { name: 'Paris',     flag: '🇫🇷', country: 'France',      tagline: 'City of Light',           lat: 48.8566, lng:  2.3522 },
  { name: 'Barcelona', flag: '🇪🇸', country: 'Spain',       tagline: 'Gaudí, Tapas & Sea',      lat: 41.3874, lng:  2.1686 },
  { name: 'London',    flag: '🇬🇧', country: 'UK',          tagline: 'Iconic & Eclectic',       lat: 51.5074, lng: -0.1278 },
  { name: 'Amsterdam', flag: '🇳🇱', country: 'Netherlands', tagline: 'Canals & Contrasts',      lat: 52.3676, lng:  4.9041 },
  { name: 'Prague',    flag: '🇨🇿', country: 'Czechia',     tagline: 'City of a Hundred Spires', lat: 50.0755, lng: 14.4378 },
  { name: 'Budapest',  flag: '🇭🇺', country: 'Hungary',     tagline: 'Paris of the East',       lat: 47.4979, lng: 19.0402 },
  { name: 'Vienna',    flag: '🇦🇹', country: 'Austria',     tagline: 'Imperial & Café Culture',  lat: 48.2082, lng: 16.3738 },
  { name: 'Munich',    flag: '🇩🇪', country: 'Germany',     tagline: 'Bavarian Heart',          lat: 48.1351, lng: 11.5820 },
  { name: 'Athens',    flag: '🇬🇷', country: 'Greece',      tagline: 'Cradle of Civilization',  lat: 37.9838, lng: 23.7275 },
  { name: 'Sicily',    flag: '🇮🇹', country: 'Italy',       tagline: 'Sun, Sea & Ancient Ruins', lat: 37.5999, lng: 14.0154 },
];
