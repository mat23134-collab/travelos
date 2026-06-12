import { Salad, Sprout, BadgeCheck, WheatOff, Milk } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const DIETARY_OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'Vegetarian',  label: 'Vegetarian',  icon: Salad },
  { value: 'Vegan',       label: 'Vegan',       icon: Sprout },
  { value: 'Kosher',      label: 'Kosher',      icon: BadgeCheck },
  { value: 'Halal',       label: 'Halal',       icon: BadgeCheck },
  { value: 'Gluten-Free', label: 'Gluten-Free', icon: WheatOff },
  { value: 'Dairy-Free',  label: 'Dairy-Free',  icon: Milk },
];

export type PickItem = {
  icon: string;
  label: string;
  area?: string;
  note?: string;
};
export type PickCategory = {
  key: 'attractions' | 'restaurants' | 'historical' | 'popular';
  title: string;
  items: PickItem[];
};

export const CITY_PICK_GROUPS: Record<string, PickCategory[]> = {
  Rome: [
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '⛲', label: 'Trevi Fountain', area: 'Centro Storico', note: 'Classic photo stop' },
      { icon: '🗺️', label: 'Roman Forum', area: 'Ancient Rome', note: 'Best with Colosseum' },
      { icon: '🌳', label: 'Villa Borghese', area: 'Pinciano', note: 'Slow afternoon walk' },
      { icon: '🌉', label: 'Trastevere lanes', area: 'Trastevere', note: 'Evening atmosphere' },
    ] },
    { key: 'restaurants', title: 'Restaurants', items: [
      { icon: '🍝', label: 'Felice a Testaccio', area: 'Testaccio', note: 'Cacio e pepe institution' },
      { icon: '🍕', label: 'Emma Pizzeria', area: 'Centro Storico', note: 'Roman-style pizza' },
      { icon: '🍷', label: 'Roscioli', area: 'Regola', note: 'Deli, wine, pasta' },
      { icon: '🍨', label: 'Gelateria del Teatro', area: 'Navona', note: 'Great gelato stop' },
    ] },
    { key: 'historical', title: 'Historical', items: [
      { icon: '🏟️', label: 'Colosseum', area: 'Ancient Rome', note: 'Iconic must-see' },
      { icon: '🏛️', label: 'Pantheon', area: 'Centro Storico', note: 'Short, unforgettable visit' },
      { icon: '⛪', label: 'St. Peter’s Basilica', area: 'Vatican', note: 'Go early' },
      { icon: '🖼️', label: 'Vatican Museums', area: 'Vatican', note: 'Book ahead' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '🪜', label: 'Spanish Steps', area: 'Spagna', note: 'Quick classic stop' },
      { icon: '🛍️', label: "Campo de' Fiori Market", area: 'Regola', note: 'Morning market' },
      { icon: '🌅', label: 'Gianicolo viewpoint', area: 'Monteverde', note: 'Sunset view' },
      { icon: '🍸', label: 'Jerry Thomas Speakeasy', area: 'Centro', note: 'Cocktail night' },
    ] },
  ],
  Paris: [
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '🏘️', label: 'Montmartre Village', area: '18th', note: 'Village feel' },
      { icon: '🚶', label: 'Le Marais Walk', area: '3rd/4th', note: 'Boutiques and cafés' },
      { icon: '🌿', label: 'Luxembourg Gardens', area: '6th', note: 'Slow Paris moment' },
      { icon: '🚤', label: 'Seine river cruise', area: 'Central Paris', note: 'Night view' },
    ] },
    { key: 'restaurants', title: 'Restaurants', items: [
      { icon: '🥐', label: 'Du Pain et des Idées', area: 'Canal Saint-Martin', note: 'Bakery classic' },
      { icon: '🍽️', label: 'Bouillon Chartier', area: 'Grands Boulevards', note: 'Historic brasserie' },
      { icon: '🧀', label: 'Le Relais de l’Entrecôte', area: 'Saint-Germain', note: 'Steak frites icon' },
      { icon: '🍫', label: 'Angelina', area: 'Rivoli', note: 'Hot chocolate stop' },
    ] },
    { key: 'historical', title: 'Museums & History', items: [
      { icon: '🖼️', label: 'Louvre Museum', area: '1st', note: 'Book timed entry' },
      { icon: '🎨', label: "Musée d'Orsay", area: '7th', note: 'Impressionists' },
      { icon: '⛪', label: 'Sainte-Chapelle', area: 'Île de la Cité', note: 'Stained glass' },
      { icon: '🪦', label: 'Père Lachaise', area: '20th', note: 'Atmospheric walk' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '🗼', label: 'Eiffel Tower', area: '7th', note: 'Classic view' },
      { icon: '⛪', label: 'Notre-Dame Cathedral', area: 'Île de la Cité', note: 'Essential stop' },
      { icon: '🌉', label: 'Pont Alexandre III', area: '8th', note: 'Photo bridge' },
      { icon: '🌃', label: 'Arc de Triomphe rooftop', area: 'Étoile', note: 'Best city grid view' },
    ] },
  ],
  London: [
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '🎡', label: 'London Eye', area: 'South Bank', note: 'Skyline view' },
      { icon: '🌉', label: 'Tower Bridge', area: 'Tower Hill', note: 'Walk the bridge' },
      { icon: '🌿', label: 'Hyde Park', area: 'Westminster', note: 'Open-air break' },
      { icon: '🌆', label: 'Sky Garden', area: 'City of London', note: 'Free view, book ahead' },
    ] },
    { key: 'restaurants', title: 'Restaurants & Food', items: [
      { icon: '🍛', label: 'Dishoom Covent Garden', area: 'Covent Garden', note: 'Most-loved Indian' },
      { icon: '🍞', label: 'Borough Market', area: 'London Bridge', note: 'Food market classic' },
      { icon: '🥩', label: 'Hawksmoor Seven Dials', area: 'Covent Garden', note: 'Steakhouse staple' },
      { icon: '🍜', label: 'Padella', area: 'Borough', note: 'Fresh pasta queue' },
    ] },
    { key: 'historical', title: 'Icons & History', items: [
      { icon: '🕰️', label: 'Big Ben & Parliament', area: 'Westminster', note: 'London icon' },
      { icon: '🏰', label: 'Tower of London', area: 'Tower Hill', note: 'Crown Jewels' },
      { icon: '⛪', label: 'Westminster Abbey', area: 'Westminster', note: 'Royal history' },
      { icon: '🏛️', label: 'St. Paul’s Cathedral', area: 'City', note: 'Dome climb' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '🏺', label: 'British Museum', area: 'Bloomsbury', note: 'Free museum' },
      { icon: '🚶', label: 'Covent Garden', area: 'West End', note: 'Street performers' },
      { icon: '🎭', label: 'West End Show', area: 'Theatreland', note: 'Evening plan' },
      { icon: '🛍️', label: 'Camden Market', area: 'Camden', note: 'Alternative market' },
    ] },
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
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '🛶', label: 'Canal Ring Walk', area: 'Centrum', note: 'Classic Amsterdam' },
      { icon: '🏘️', label: 'Jordaan Streets', area: 'Jordaan', note: 'Cafés and canals' },
      { icon: '🌳', label: 'Vondelpark', area: 'Oud-Zuid', note: 'Local park break' },
      { icon: '🚲', label: 'NDSM Wharf', area: 'Amsterdam Noord', note: 'Creative waterfront' },
    ] },
    { key: 'restaurants', title: 'Restaurants & Food', items: [
      { icon: '🧇', label: 'Original Stroopwafels', area: 'Albert Cuyp', note: 'Market snack' },
      { icon: '🍛', label: 'Restaurant Blauw', area: 'Oud-Zuid', note: 'Indonesian rijsttafel' },
      { icon: '🥞', label: 'The Pancake Bakery', area: 'Jordaan', note: 'Dutch pancakes' },
      { icon: '🍟', label: 'Vleminckx Fries', area: 'Centrum', note: 'Fries institution' },
    ] },
    { key: 'historical', title: 'Museums & History', items: [
      { icon: '📔', label: 'Anne Frank House', area: 'Jordaan', note: 'Book far ahead' },
      { icon: '🖼️', label: 'Rijksmuseum', area: 'Museumplein', note: 'Dutch masters' },
      { icon: '🎨', label: 'Van Gogh Museum', area: 'Museumplein', note: 'Timed entry' },
      { icon: '🏠', label: 'Museum Van Loon', area: 'Canal Ring', note: 'Canal house' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '📍', label: 'Dam Square & Royal Palace', area: 'Centrum', note: 'Quick stop' },
      { icon: '🌷', label: 'Bloemenmarkt', area: 'Singel', note: 'Flower market' },
      { icon: '🍺', label: 'Brouwerij ’t IJ', area: 'Oost', note: 'Windmill brewery' },
      { icon: '🌃', label: 'A’DAM Lookout', area: 'Noord', note: 'High view' },
    ] },
  ],
  'The Hague': [
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '🌊', label: 'Scheveningen Pier', area: 'Scheveningen', note: 'Beach and sea air' },
      { icon: '🖼️', label: 'Escher in The Palace', area: 'City Center', note: 'Playful museum' },
      { icon: '🏙️', label: 'The Hague Tower view', area: 'HS Quarter', note: 'City panorama' },
      { icon: '🌳', label: 'Westbroekpark', area: 'Scheveningen', note: 'Rose garden walk' },
    ] },
    { key: 'restaurants', title: 'Restaurants & Food', items: [
      { icon: '🐟', label: 'Simonis aan de Haven', area: 'Scheveningen Harbor', note: 'Seafood institution' },
      { icon: '🍽️', label: 'Dekxels', area: 'City Center', note: 'Modern shared plates' },
      { icon: '🥂', label: 'Bleyenberg Rooftop', area: 'Grote Markt', note: 'Drinks and view' },
      { icon: '⭐', label: "Restaurant Calla's", area: 'Zeeheldenkwartier', note: 'Fine dining' },
    ] },
    { key: 'historical', title: 'Icons & History', items: [
      { icon: '🏛️', label: 'Binnenhof', area: 'City Center', note: 'Dutch politics' },
      { icon: '🕊️', label: 'Peace Palace', area: 'Zorgvliet', note: 'International law icon' },
      { icon: '🖼️', label: 'Mauritshuis', area: 'City Center', note: 'Girl with a Pearl Earring' },
      { icon: '🏰', label: 'Noordeinde Palace', area: 'Noordeinde', note: 'Royal palace exterior' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '🏖️', label: 'Scheveningen Beach', area: 'Scheveningen', note: 'Classic beach stop' },
      { icon: '🌍', label: 'Madurodam', area: 'Scheveningen', note: 'Miniature Netherlands' },
      { icon: '🛍️', label: 'Haagse Markt', area: 'Transvaal', note: 'Huge local market' },
      { icon: '🎭', label: 'Grote Markt', area: 'City Center', note: 'Bars and nightlife' },
    ] },
  ],
  Tokyo: [
    { key: 'attractions', title: 'Attractions', items: [
      { icon: '🌳', label: 'Meiji Jingu', area: 'Harajuku', note: 'Shrine forest' },
      { icon: '🚦', label: 'Shibuya Crossing', area: 'Shibuya', note: 'Classic Tokyo energy' },
      { icon: '🌃', label: 'Tokyo Skytree', area: 'Sumida', note: 'City view' },
      { icon: '🎨', label: 'teamLab Borderless', area: 'Azabudai', note: 'Immersive art' },
    ] },
    { key: 'restaurants', title: 'Restaurants & Food', items: [
      { icon: '🍜', label: 'Afuri Ramen Harajuku', area: 'Harajuku', note: 'Yuzu ramen' },
      { icon: '🍣', label: 'Sushi no Midori', area: 'Shibuya', note: 'Great value sushi' },
      { icon: '🍙', label: 'Onigiri Bongo', area: 'Otsuka', note: 'Famous onigiri' },
      { icon: '🍢', label: 'Omoide Yokocho stalls', area: 'Shinjuku', note: 'Yakitori alley' },
    ] },
    { key: 'historical', title: 'Culture & History', items: [
      { icon: '🏮', label: 'Senso-ji Temple', area: 'Asakusa', note: 'Old Tokyo classic' },
      { icon: '🏘️', label: 'Yanaka Ginza', area: 'Yanaka', note: 'Old town streets' },
      { icon: '🏯', label: 'Imperial Palace East Gardens', area: 'Chiyoda', note: 'Calm history' },
      { icon: '🖼️', label: 'Nezu Museum', area: 'Aoyama', note: 'Art and garden' },
    ] },
    { key: 'popular', title: 'Most Popular', items: [
      { icon: '🛍️', label: 'Ura-Harajuku / Cat Street', area: 'Harajuku', note: 'Style walk' },
      { icon: '🎵', label: 'Shimokitazawa record shops', area: 'Shimokitazawa', note: 'Vinyl and vintage' },
      { icon: '🍸', label: 'Nonbei Yokocho', area: 'Shibuya', note: 'Tiny bars' },
      { icon: '🌊', label: 'Nakameguro canal', area: 'Nakameguro', note: 'Evening stroll' },
    ] },
  ],
};

export const GENERIC_PICK_GROUPS: PickCategory[] = [
  { key: 'attractions', title: 'Attractions', items: [
    { icon: '🌿', label: 'Signature park or nature stop', note: 'Give the trip breathing room' },
    { icon: '🛍️', label: 'Central local market', note: 'Food, people, atmosphere' },
    { icon: '🌆', label: 'Best city viewpoint', note: 'Anchor a golden-hour moment' },
    { icon: '🚶', label: 'Walkable old town route', note: 'Easy first-day orientation' },
  ] },
  { key: 'restaurants', title: 'Restaurants & Food', items: [
    { icon: '🍽️', label: 'Famous local restaurant', note: 'Known, reliable, destination-specific' },
    { icon: '🥘', label: 'Local signature dish', note: 'Must-try food experience' },
    { icon: '☕', label: 'Iconic café or bakery', note: 'Morning or afternoon stop' },
    { icon: '🍸', label: 'Great drinks spot', note: 'Evening option' },
  ] },
  { key: 'historical', title: 'Icons & History', items: [
    { icon: '🏛️', label: 'Most important museum', note: 'Culture anchor' },
    { icon: '🏰', label: 'Historic landmark', note: 'Classic must-see' },
    { icon: '⛪', label: 'Religious or civic icon', note: 'Architecture and story' },
    { icon: '🖼️', label: 'Major gallery or collection', note: 'Art-focused stop' },
  ] },
  { key: 'popular', title: 'Most Popular', items: [
    { icon: '📸', label: 'Most photographed spot', note: 'Touristy but iconic' },
    { icon: '🌃', label: 'Popular nightlife area', note: 'Late-night energy' },
    { icon: '🎭', label: 'Show or performance district', note: 'Evening plan' },
    { icon: '💎', label: 'Hidden gem nearby', note: 'Balance the classics' },
  ] },
];

export function getMustHaveGroups(destination: string): PickCategory[] {
  return CITY_PICK_GROUPS[destination] ?? GENERIC_PICK_GROUPS;
}

export function getMustHavePicks(destination: string): PickItem[] {
  return getMustHaveGroups(destination).flatMap((g) => g.items);
}

export function formatMustHave(items: string[], other: string): string {
  return [...items, ...(other.trim() ? [other.trim()] : [])].filter(Boolean).join(', ');
}
