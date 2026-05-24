/**
 * Single source of truth for featured destinations.
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
  { name: 'Rome',      flag: '🇮🇹', country: 'Italy',       tagline: 'La Dolce Vita',            lat:  41.9028, lng:  12.4964 },
  { name: 'Paris',     flag: '🇫🇷', country: 'France',      tagline: 'City of Light',             lat:  48.8566, lng:   2.3522 },
  { name: 'London',    flag: '🇬🇧', country: 'UK',          tagline: 'Iconic & Eclectic',         lat:  51.5074, lng:  -0.1278 },
  { name: 'Athens',    flag: '🇬🇷', country: 'Greece',      tagline: 'Cradle of Civilization',    lat:  37.9838, lng:  23.7275 },
  { name: 'Budapest',  flag: '🇭🇺', country: 'Hungary',     tagline: 'Paris of the East',         lat:  47.4979, lng:  19.0402 },
  { name: 'Vienna',    flag: '🇦🇹', country: 'Austria',     tagline: 'Imperial & Café Culture',   lat:  48.2082, lng:  16.3738 },
  { name: 'Amsterdam', flag: '🇳🇱', country: 'Netherlands', tagline: 'Canals & Contrasts',        lat:  52.3676, lng:   4.9041 },
  { name: 'Sicily',    flag: '🇮🇹', country: 'Italy',       tagline: 'Sun, Sea & Ancient Ruins',  lat:  37.5999, lng:  14.0154 },
  { name: 'Lima',      flag: '🇵🇪', country: 'Peru',        tagline: 'Gastronomic Capital',       lat: -12.0464, lng: -77.0428 },
];
