export interface StepBackground {
  city: string;
  country: string;
  imageUrl: string;
}

export const STEP_BACKGROUNDS: StepBackground[] = [
  { city: 'Rome', country: 'Italy', imageUrl: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Paris', country: 'France', imageUrl: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1800&q=80' },
  { city: 'London', country: 'United Kingdom', imageUrl: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Athens', country: 'Greece', imageUrl: 'https://images.unsplash.com/photo-1555993539-1732b0258235?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Budapest', country: 'Hungary', imageUrl: 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Tokyo', country: 'Japan', imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Kyoto', country: 'Japan', imageUrl: 'https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1800&q=80' },
  { city: 'New York', country: 'USA', imageUrl: 'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Barcelona', country: 'Spain', imageUrl: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Dubai', country: 'UAE', imageUrl: 'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Istanbul', country: 'Turkey', imageUrl: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Amsterdam', country: 'Netherlands', imageUrl: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Prague', country: 'Czechia', imageUrl: 'https://images.unsplash.com/photo-1519677100203-a0e668c92439?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Vienna', country: 'Austria', imageUrl: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Lisbon', country: 'Portugal', imageUrl: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Copenhagen', country: 'Denmark', imageUrl: 'https://images.unsplash.com/photo-1513622470522-26c3c8a854bc?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Berlin', country: 'Germany', imageUrl: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Santorini', country: 'Greece', imageUrl: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Marrakech', country: 'Morocco', imageUrl: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Cape Town', country: 'South Africa', imageUrl: 'https://images.unsplash.com/photo-1576485290814-1c72aa4bbb8e?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Rio de Janeiro', country: 'Brazil', imageUrl: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Sydney', country: 'Australia', imageUrl: 'https://images.unsplash.com/photo-1523428096881-5bd79d043006?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Singapore', country: 'Singapore', imageUrl: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1800&q=80' },
  { city: 'Machu Picchu', country: 'Peru', imageUrl: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?auto=format&fit=crop&w=1800&q=80' },
];

export function getStepBackground(step: number, phaseOffset = 0): StepBackground {
  const idx = (Math.max(step, 0) + phaseOffset) % STEP_BACKGROUNDS.length;
  return STEP_BACKGROUNDS[idx];
}

/** Match onboarding: prefer the chosen city, then country, then rotate fallback. */
export function resolveBackgroundImage(
  destination: string,
  fallbackStep = 0,
  country?: string,
): string {
  const dest = destination.trim();
  if (dest) {
    const cityMatch = STEP_BACKGROUNDS.find(
      (b) => b.city.toLowerCase() === dest.toLowerCase(),
    );
    if (cityMatch) return cityMatch.imageUrl;
  }
  const countryName = (country ?? '').trim();
  if (countryName) {
    const countryMatch = STEP_BACKGROUNDS.find(
      (b) => b.country.toLowerCase() === countryName.toLowerCase(),
    );
    if (countryMatch) return countryMatch.imageUrl;
  }
  return getStepBackground(fallbackStep, 3).imageUrl;
}

