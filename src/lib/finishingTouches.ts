export const DIETARY_OPTIONS = [
  { value: 'Vegetarian',  label: 'Vegetarian',  icon: '🥗' },
  { value: 'Vegan',       label: 'Vegan',       icon: '🌱' },
  { value: 'Kosher',      label: 'Kosher',      icon: '✡️' },
  { value: 'Halal',       label: 'Halal',       icon: '☪️' },
  { value: 'Gluten-Free', label: 'Gluten-Free', icon: '🌾' },
  { value: 'Dairy-Free',  label: 'Dairy-Free',  icon: '🥛' },
] as const;

export type PickItem = { icon: string; label: string };
export type PickCategory = {
  key: 'attractions' | 'restaurants' | 'historical' | 'popular';
  title: string;
  items: PickItem[];
};

export const CITY_PICK_GROUPS: Record<string, PickCategory[]> = {
  Rome: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '⛲', label: 'Trevi Fountain' }, { icon: '🗺️', label: 'Roman Forum' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🍝', label: 'Trastevere Pasta Spot' }, { icon: '🍕', label: 'Traditional Roman Pizzeria' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '🏟️', label: 'Colosseum' }, { icon: '🏛️', label: 'Pantheon' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '⛪', label: 'Vatican Museums' }, { icon: '🛍️', label: "Campo de' Fiori Market" }] },
  ],
  Paris: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🏘️', label: 'Montmartre Village' }, { icon: '🚶', label: 'Le Marais Walk' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🥐', label: 'Classic Parisian Bistro' }, { icon: '🧀', label: 'Cheese & Wine Dinner' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '🖼️', label: 'Louvre Museum' }, { icon: '🎨', label: "Musée d'Orsay" }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🗼', label: 'Eiffel Tower' }, { icon: '⛪', label: 'Notre-Dame Cathedral' }] },
  ],
  London: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🌿', label: 'Hyde Park' }, { icon: '🎡', label: 'London Eye' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🍞', label: 'Borough Market Tasting' }, { icon: '🍽️', label: 'Modern British Gastropub' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '🏰', label: 'Tower of London' }, { icon: '🕰️', label: 'Big Ben & Parliament' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🏺', label: 'British Museum' }, { icon: '🚶', label: 'Covent Garden Walk' }] },
  ],
  Athens: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🌄', label: 'Lycabettus Hill View' }, { icon: '🌊', label: 'Cape Sounion Sunset' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🥙', label: 'Central Market Food Tour' }, { icon: '🍢', label: 'Traditional Souvlaki Stop' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '🏛️', label: 'Acropolis' }, { icon: '🏺', label: 'National Archaeology Museum' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🛍️', label: 'Monastiraki Flea Market' }, { icon: '🚶', label: 'Plaka Old Town Walk' }] },
  ],
  Budapest: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🌉', label: 'Chain Bridge Walk' }, { icon: '🛁', label: 'Széchenyi Thermal Baths' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🍲', label: 'Goulash Restaurant' }, { icon: '🥐', label: 'Great Market Hall' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '🏰', label: 'Buda Castle' }, { icon: '🏛️', label: 'Hungarian Parliament' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🍺', label: 'Ruin Bar Night Out' }, { icon: '🚋', label: 'Danube Promenade' }] },
  ],
  Vienna: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🏰', label: 'Schönbrunn Palace' }, { icon: '🎨', label: 'MuseumsQuartier' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '☕', label: 'Classic Viennese Café' }, { icon: '🥨', label: 'Naschmarkt Food Walk' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '⛪', label: "St. Stephen's Cathedral" }, { icon: '🏛️', label: 'Hofburg Palace' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🎡', label: 'Prater Giant Ferris Wheel' }, { icon: '🖼️', label: 'Belvedere Palace' }] },
  ],
  Amsterdam: [
    { key: 'attractions', title: 'Attractions', items: [{ icon: '🛶', label: 'Canal Ring Walk' }, { icon: '🏘️', label: 'Jordaan Streets' }] },
    { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🧇', label: 'Stroopwafel & Markets' }, { icon: '🍛', label: 'Indonesian Rijsttafel Dinner' }] },
    { key: 'historical', title: 'Historical', items: [{ icon: '📔', label: 'Anne Frank House' }, { icon: '🖼️', label: 'Rijksmuseum' }] },
    { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '🎨', label: 'Van Gogh Museum' }, { icon: '📍', label: 'Dam Square & Royal Palace' }] },
  ],
};

export const GENERIC_PICK_GROUPS: PickCategory[] = [
  { key: 'attractions', title: 'Attractions', items: [{ icon: '🌿', label: 'Parks & Nature' }, { icon: '🛍️', label: 'Local Markets' }] },
  { key: 'restaurants', title: 'Restaurants', items: [{ icon: '🍽️', label: 'Food Tours' }, { icon: '🥘', label: 'Local Signature Restaurant' }] },
  { key: 'historical', title: 'Historical', items: [{ icon: '🏛️', label: 'Museums' }, { icon: '🏰', label: 'Historic Sites' }] },
  { key: 'popular', title: 'Most Popular (Touristy Too)', items: [{ icon: '📸', label: 'Most Photographed Spot' }, { icon: '🌃', label: 'Popular Nightlife Area' }] },
];

export function getMustHavePicks(destination: string): PickItem[] {
  const groups = CITY_PICK_GROUPS[destination] ?? GENERIC_PICK_GROUPS;
  return groups.flatMap((g) => g.items);
}

export function formatMustHave(items: string[], other: string): string {
  return [...items, ...(other.trim() ? [other.trim()] : [])].filter(Boolean).join(', ');
}
