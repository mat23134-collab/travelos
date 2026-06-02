// src/lib/destinationFacts.ts
const FACTS: Record<string, [string, string, string]> = {
  'Paris': [
    'The Eiffel Tower was originally planned to be demolished in 1909 — it survived because of its radio antenna.',
    'Paris has more than 450 parks and gardens, covering 3,000 hectares of green space.',
    "The city's metro carries 4.5 million passengers a day across 16 lines and 302 stations.",
  ],
  'Tokyo': [
    'Tokyo has more Michelin-starred restaurants than any other city on Earth.',
    'There are over 13 million vending machines in Japan — roughly one for every 10 people.',
    "Shinjuku station handles over 3.5 million commuters every day — the world's busiest.",
  ],
  'Rome': [
    'Rome sits on 7 hills — the same layout that inspired the founding myths of the city in 753 BC.',
    'The Trevi Fountain collects roughly €3,000 in coins every day, donated to a local charity.',
    'Italy has more UNESCO World Heritage Sites than any other country in the world.',
  ],
  'London': [
    "London's red double-decker buses were standardised after World War II — there are over 8,000 of them.",
    'More than 270 languages are spoken in Greater London — the most linguistically diverse city on Earth.',
    "The London Underground is the world's oldest metro system, opened in January 1863.",
  ],
  'Barcelona': [
    "The Sagrada Família has been under construction since 1882 — it's expected to finish around 2026.",
    'Barcelona has 4.5 km of beaches, all created artificially for the 1992 Olympic Games.',
    'Antoni Gaudí designed 7 buildings in Barcelona, all of which are UNESCO World Heritage Sites.',
  ],
  'Amsterdam': [
    'Amsterdam has more bicycles than residents — roughly 880,000 bikes for 800,000 people.',
    'The city sits on 165 canals spanning 100 km — more than Venice.',
    "The Rijksmuseum houses over 1 million objects, including Rembrandt's Night Watch.",
  ],
  'Lisbon': [
    'Lisbon is one of the oldest capitals in Europe — over 3,000 years old, predating Rome.',
    "The city's yellow trams have been running since 1873; Tram 28 is the most iconic.",
    'Bertrand Bookshop in Lisbon is the oldest operating bookshop in the world, open since 1732.',
  ],
  'New York': [
    'New York City is home to speakers of over 800 languages — the most linguistically diverse city on Earth.',
    'Central Park (341 hectares) is larger than the entire Principality of Monaco.',
    'The subway runs 24 hours a day, 365 days a year — the only major metro in the world to do so.',
  ],
  'Dubai': [
    'Dubai has zero income tax and zero capital gains tax for both residents and businesses.',
    "Roughly 85% of Dubai's population are expatriates from over 200 countries.",
    "The Burj Khalifa at 828m is so tall you can watch the sunset twice — once from ground, once from the top.",
  ],
  'Athens': [
    'Athens is considered the birthplace of democracy — the first known democratic system dates to 507 BC.',
    'The Acropolis has been continuously inhabited for over 5,000 years.',
    'Athens has more theatre stages per capita than any other city in the world.',
  ],
  'Budapest': [
    'Budapest has more thermal springs than any other capital city — over 120 hot springs and 80 geothermal wells.',
    'The Danube River divides the city into two historic halves: hilly Buda and flat Pest.',
    "Budapest's metro Line 1 (1896) is the oldest on the European continent.",
  ],
  'Vienna': [
    'Vienna is considered the birthplace of psychoanalysis — Sigmund Freud worked here from 1891 to 1938.',
    'The city has over 600 traditional coffee houses (Kaffeehäuser), a UNESCO-recognised cultural heritage.',
    "The Vienna Philharmonic New Year's Concert is broadcast to over 90 countries every year.",
  ],
  'Rio de Janeiro': [
    'Rio has over 80 beaches — Ipanema alone stretches 2.7 km along the Atlantic coast.',
    "Rio's Carnival is the world's largest party, attracting over 2 million people per day to the streets.",
    'Rio has two distinct micro-climates: sunny in Ipanema while raining in Santa Teresa, just 20 minutes apart.',
  ],
  'Sydney': [
    'The Sydney Opera House took 14 years to build (1959–1973) and cost 15× its original budget.',
    "Sydney Harbour is the world's largest natural harbour, covering 55 square kilometres.",
    "Sydney's Bondi Beach is home to one of the world's first surf lifesaving clubs — founded in 1907.",
  ],
  'Singapore': [
    'Singapore has four official languages: English, Mandarin, Malay, and Tamil.',
    "Changi Airport's indoor waterfall — the Rain Vortex — is the world's tallest indoor waterfall at 40 metres.",
    "Singapore's green cover has actually increased since independence: today 47% of the island is greenery.",
  ],
  '_default': [
    'Your trip is being geo-clustered around your hotel — every day radiates outward to minimise transit time.',
    'The AI is scanning travel blogs and local guides to surface hidden gems over tourist traps.',
    'Itinerary DNA analysis in progress — activities are being matched to your budget, pace, and interests.',
  ],
};

/**
 * Returns exactly 3 facts for the given destination.
 * Falls back to generic facts if the city is not in the lookup table.
 */
export function getDestinationFacts(destination: string): [string, string, string] {
  const key = destination.trim();
  return FACTS[key] ?? FACTS['_default'];
}
