/**
 * countries.ts — curated list of popular travel destinations.
 *
 * Used by the onboarding DestinationSection to power:
 *   - Country selection grid
 *   - City quick-picks after country is chosen
 *   - Geocoordinates for the 3D compass anchor
 */

export interface TravelCity {
  name: string;
  lat:  number;
  lng:  number;
}

export interface Country {
  name:    string;
  flag:    string;   // emoji flag
  code:    string;   // ISO-2 for uniqueness
  region:  'Europe' | 'Americas' | 'Asia' | 'Middle East' | 'Africa & Oceania';
  cities:  TravelCity[];
}

export const COUNTRIES: Country[] = [
  // ── Europe ────────────────────────────────────────────────────────────────
  {
    name: 'Italy', flag: '🇮🇹', code: 'IT', region: 'Europe',
    cities: [
      { name: 'Rome',      lat:  41.9028, lng:  12.4964 },
      { name: 'Florence',  lat:  43.7696, lng:  11.2558 },
      { name: 'Venice',    lat:  45.4408, lng:  12.3155 },
      { name: 'Milan',     lat:  45.4642, lng:   9.1900 },
      { name: 'Amalfi',   lat:  40.6341, lng:  14.6024 },
      { name: 'Sicily',   lat:  38.1157, lng:  13.3615 },
    ],
  },
  {
    name: 'France', flag: '🇫🇷', code: 'FR', region: 'Europe',
    cities: [
      { name: 'Paris',      lat:  48.8566, lng:   2.3522 },
      { name: 'Nice',       lat:  43.7102, lng:   7.2620 },
      { name: 'Lyon',       lat:  45.7640, lng:   4.8357 },
      { name: 'Bordeaux',   lat:  44.8378, lng:  -0.5792 },
      { name: 'Marseille',  lat:  43.2965, lng:   5.3698 },
    ],
  },
  {
    name: 'Spain', flag: '🇪🇸', code: 'ES', region: 'Europe',
    cities: [
      { name: 'Barcelona', lat:  41.3851, lng:   2.1734 },
      { name: 'Madrid',    lat:  40.4168, lng:  -3.7038 },
      { name: 'Seville',   lat:  37.3891, lng:  -5.9845 },
      { name: 'Granada',   lat:  37.1773, lng:  -3.5986 },
      { name: 'Mallorca',  lat:  39.6953, lng:   3.0176 },
    ],
  },
  {
    name: 'Greece', flag: '🇬🇷', code: 'GR', region: 'Europe',
    cities: [
      { name: 'Athens',        lat:  37.9838, lng:  23.7275 },
      { name: 'Santorini',     lat:  36.3932, lng:  25.4615 },
      { name: 'Mykonos',       lat:  37.4467, lng:  25.3289 },
      { name: 'Thessaloniki',  lat:  40.6401, lng:  22.9444 },
      { name: 'Crete',         lat:  35.3387, lng:  25.1442 },
    ],
  },
  {
    name: 'United Kingdom', flag: '🇬🇧', code: 'GB', region: 'Europe',
    cities: [
      { name: 'London',    lat:  51.5074, lng:  -0.1278 },
      { name: 'Edinburgh', lat:  55.9533, lng:  -3.1883 },
      { name: 'Bath',      lat:  51.3811, lng:  -2.3590 },
      { name: 'Oxford',    lat:  51.7520, lng:  -1.2577 },
      { name: 'Liverpool', lat:  53.4084, lng:  -2.9916 },
    ],
  },
  {
    name: 'Portugal', flag: '🇵🇹', code: 'PT', region: 'Europe',
    cities: [
      { name: 'Lisbon',   lat:  38.7223, lng:  -9.1393 },
      { name: 'Porto',    lat:  41.1579, lng:  -8.6291 },
      { name: 'Algarve',  lat:  37.0179, lng:  -7.9307 },
      { name: 'Sintra',   lat:  38.7979, lng:  -9.3881 },
    ],
  },
  {
    name: 'Germany', flag: '🇩🇪', code: 'DE', region: 'Europe',
    cities: [
      { name: 'Berlin',    lat:  52.5200, lng:  13.4050 },
      { name: 'Munich',    lat:  48.1351, lng:  11.5820 },
      { name: 'Hamburg',   lat:  53.5511, lng:   9.9937 },
      { name: 'Cologne',   lat:  50.9333, lng:   6.9500 },
      { name: 'Heidelberg',lat:  49.3988, lng:   8.6724 },
    ],
  },
  {
    name: 'Netherlands', flag: '🇳🇱', code: 'NL', region: 'Europe',
    cities: [
      { name: 'Amsterdam', lat:  52.3676, lng:   4.9041 },
      { name: 'Rotterdam', lat:  51.9244, lng:   4.4777 },
      { name: 'The Hague', lat:  52.0705, lng:   4.3007 },
      { name: 'Haarlem',   lat:  52.3874, lng:   4.6462 },
    ],
  },
  {
    name: 'Austria', flag: '🇦🇹', code: 'AT', region: 'Europe',
    cities: [
      { name: 'Vienna',    lat:  48.2082, lng:  16.3738 },
      { name: 'Salzburg',  lat:  47.8095, lng:  13.0550 },
      { name: 'Innsbruck', lat:  47.2692, lng:  11.4041 },
      { name: 'Hallstatt', lat:  47.5622, lng:  13.6493 },
    ],
  },
  {
    name: 'Croatia', flag: '🇭🇷', code: 'HR', region: 'Europe',
    cities: [
      { name: 'Dubrovnik', lat:  42.6507, lng:  18.0944 },
      { name: 'Split',     lat:  43.5147, lng:  16.4435 },
      { name: 'Hvar',      lat:  43.1726, lng:  16.6413 },
      { name: 'Zagreb',    lat:  45.8150, lng:  15.9819 },
    ],
  },
  {
    name: 'Czech Republic', flag: '🇨🇿', code: 'CZ', region: 'Europe',
    cities: [
      { name: 'Prague',          lat:  50.0755, lng:  14.4378 },
      { name: 'Český Krumlov',  lat:  48.8127, lng:  14.3175 },
      { name: 'Brno',            lat:  49.1951, lng:  16.6068 },
    ],
  },
  {
    name: 'Hungary', flag: '🇭🇺', code: 'HU', region: 'Europe',
    cities: [
      { name: 'Budapest',     lat:  47.4979, lng:  19.0402 },
      { name: 'Lake Balaton', lat:  46.8300, lng:  17.7000 },
      { name: 'Eger',         lat:  47.9003, lng:  20.3800 },
    ],
  },
  {
    name: 'Iceland', flag: '🇮🇸', code: 'IS', region: 'Europe',
    cities: [
      { name: 'Reykjavik',  lat:  64.1466, lng: -21.9426 },
      { name: 'Akureyri',   lat:  65.6835, lng: -18.0878 },
      { name: 'Blue Lagoon',lat:  63.8807, lng: -22.4495 },
    ],
  },
  {
    name: 'Switzerland', flag: '🇨🇭', code: 'CH', region: 'Europe',
    cities: [
      { name: 'Zurich',     lat:  47.3769, lng:   8.5417 },
      { name: 'Geneva',     lat:  46.2044, lng:   6.1432 },
      { name: 'Interlaken', lat:  46.6863, lng:   7.8632 },
      { name: 'Zermatt',    lat:  46.0207, lng:   7.7491 },
    ],
  },
  // ── Middle East ───────────────────────────────────────────────────────────
  {
    name: 'Turkey', flag: '🇹🇷', code: 'TR', region: 'Middle East',
    cities: [
      { name: 'Istanbul',    lat:  41.0082, lng:  28.9784 },
      { name: 'Cappadocia',  lat:  38.6431, lng:  34.8289 },
      { name: 'Antalya',     lat:  36.8969, lng:  30.7133 },
      { name: 'Bodrum',      lat:  37.0345, lng:  27.4305 },
    ],
  },
  {
    name: 'UAE', flag: '🇦🇪', code: 'AE', region: 'Middle East',
    cities: [
      { name: 'Dubai',      lat:  25.2048, lng:  55.2708 },
      { name: 'Abu Dhabi',  lat:  24.4539, lng:  54.3773 },
    ],
  },
  {
    name: 'Jordan', flag: '🇯🇴', code: 'JO', region: 'Middle East',
    cities: [
      { name: 'Petra',   lat:  30.3285, lng:  35.4444 },
      { name: 'Amman',   lat:  31.9454, lng:  35.9284 },
      { name: 'Wadi Rum',lat:  29.5756, lng:  35.4203 },
    ],
  },
  // ── Asia ─────────────────────────────────────────────────────────────────
  {
    name: 'Japan', flag: '🇯🇵', code: 'JP', region: 'Asia',
    cities: [
      { name: 'Tokyo',     lat:  35.6762, lng: 139.6503 },
      { name: 'Kyoto',     lat:  35.0116, lng: 135.7681 },
      { name: 'Osaka',     lat:  34.6937, lng: 135.5023 },
      { name: 'Hiroshima', lat:  34.3853, lng: 132.4553 },
      { name: 'Nara',      lat:  34.6851, lng: 135.8048 },
    ],
  },
  {
    name: 'Thailand', flag: '🇹🇭', code: 'TH', region: 'Asia',
    cities: [
      { name: 'Bangkok',    lat:  13.7563, lng: 100.5018 },
      { name: 'Chiang Mai', lat:  18.7883, lng:  98.9853 },
      { name: 'Phuket',     lat:   7.9519, lng:  98.3381 },
      { name: 'Koh Samui',  lat:   9.5347, lng: 100.0607 },
    ],
  },
  {
    name: 'Vietnam', flag: '🇻🇳', code: 'VN', region: 'Asia',
    cities: [
      { name: 'Hanoi',           lat:  21.0278, lng: 105.8342 },
      { name: 'Ho Chi Minh City',lat:  10.8231, lng: 106.6297 },
      { name: 'Hoi An',          lat:  15.8794, lng: 108.3350 },
      { name: 'Ha Long Bay',     lat:  20.9101, lng: 107.1839 },
    ],
  },
  {
    name: 'Taiwan', flag: '🇹🇼', code: 'TW', region: 'Asia',
    cities: [
      { name: 'Taipei',        lat:  25.0330, lng: 121.5654 },
      { name: 'Taichung',      lat:  24.1477, lng: 120.6736 },
      { name: 'Tainan',        lat:  22.9997, lng: 120.2270 },
      { name: 'Kaohsiung',     lat:  22.6273, lng: 120.3014 },
      { name: 'Hualien',       lat:  23.9871, lng: 121.6015 },
      { name: 'Sun Moon Lake', lat:  23.8569, lng: 120.9155 },
    ],
  },
  // ── Americas ──────────────────────────────────────────────────────────────
  {
    name: 'USA', flag: '🇺🇸', code: 'US', region: 'Americas',
    cities: [
      { name: 'New York',      lat:  40.7128, lng:  -74.0060 },
      { name: 'Los Angeles',   lat:  34.0522, lng: -118.2437 },
      { name: 'San Francisco', lat:  37.7749, lng: -122.4194 },
      { name: 'New Orleans',   lat:  29.9511, lng:  -90.0715 },
      { name: 'Chicago',       lat:  41.8781, lng:  -87.6298 },
      { name: 'Hawaii',        lat:  21.3069, lng: -157.8583 },
    ],
  },
  {
    name: 'Mexico', flag: '🇲🇽', code: 'MX', region: 'Americas',
    cities: [
      { name: 'Mexico City', lat:  19.4326, lng:  -99.1332 },
      { name: 'Cancún',      lat:  21.1619, lng:  -86.8515 },
      { name: 'Oaxaca',      lat:  17.0600, lng:  -96.7200 },
      { name: 'Tulum',       lat:  20.2108, lng:  -87.4654 },
    ],
  },
  {
    name: 'Peru', flag: '🇵🇪', code: 'PE', region: 'Americas',
    cities: [
      { name: 'Lima',          lat: -12.0464, lng:  -77.0428 },
      { name: 'Cusco',         lat: -13.5319, lng:  -71.9675 },
      { name: 'Machu Picchu',  lat: -13.1631, lng:  -72.5450 },
      { name: 'Arequipa',      lat: -16.4090, lng:  -71.5375 },
    ],
  },
  {
    name: 'Brazil', flag: '🇧🇷', code: 'BR', region: 'Americas',
    cities: [
      { name: 'Rio de Janeiro',  lat: -22.9068, lng: -43.1729 },
      { name: 'São Paulo',       lat: -23.5505, lng: -46.6333 },
      { name: 'Salvador',        lat: -12.9714, lng: -38.5014 },
      { name: 'Florianópolis',   lat: -27.5954, lng: -48.5480 },
    ],
  },
  // ── Africa & Oceania ──────────────────────────────────────────────────────
  {
    name: 'Morocco', flag: '🇲🇦', code: 'MA', region: 'Africa & Oceania',
    cities: [
      { name: 'Marrakech',    lat:  31.6295, lng:  -7.9811 },
      { name: 'Fes',          lat:  34.0181, lng:  -5.0078 },
      { name: 'Chefchaouen', lat:  35.1714, lng:  -5.2697 },
      { name: 'Casablanca',   lat:  33.5731, lng:  -7.5898 },
    ],
  },
  {
    name: 'Australia', flag: '🇦🇺', code: 'AU', region: 'Africa & Oceania',
    cities: [
      { name: 'Sydney',     lat: -33.8688, lng: 151.2093 },
      { name: 'Melbourne',  lat: -37.8136, lng: 144.9631 },
      { name: 'Brisbane',   lat: -27.4698, lng: 153.0251 },
      { name: 'Perth',      lat: -31.9505, lng: 115.8605 },
    ],
  },
];

/** Lookup by code */
export function getCountry(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

/** All unique regions in display order */
export const REGIONS = [
  'Europe',
  'Americas',
  'Asia',
  'Middle East',
  'Africa & Oceania',
] as const;
