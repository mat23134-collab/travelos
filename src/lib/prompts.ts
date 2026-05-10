import { TravelerProfile, ClassifiedResult, Itinerary, Activity } from './types';
import { formatFamilyKidsForPrompt } from './familyKids';

// ─── Friendly domain → blog name map ─────────────────────────────────────────

const KNOWN_BLOGS: Record<string, string> = {
  'nomadicmatt.com': 'Nomadic Matt',
  'theplanetd.com': 'The Planet D',
  'lonelyplanet.com': 'Lonely Planet',
  'tripadvisor.com': 'TripAdvisor',
  'timeout.com': 'Time Out',
  'theguardian.com': 'The Guardian Travel',
  'cntraveler.com': 'Condé Nast Traveler',
  'travelandleisure.com': 'Travel + Leisure',
  'afar.com': 'AFAR',
  'atlasobscura.com': 'Atlas Obscura',
  'ricksteves.com': 'Rick Steves',
  'thepointsguy.com': 'The Points Guy',
  'fodors.com': "Fodor's",
  'frommers.com': "Frommer's",
  'roughguides.com': 'Rough Guides',
  'wanderlust.co.uk': 'Wanderlust',
  'worldnomads.com': 'World Nomads',
  'reddit.com': 'Reddit Travel',
};

const VIBE_LABEL: Record<string, string> = {
  'hidden-gem':    '💎 Hidden Gem',
  'local-favorite': '🏘 Local Favorite',
  'viral-trend':   '🔥 Viral',
  'tourist-trap':  '⚠️ Tourist Trap',
  'guided-tour':   '🚌 Guided Tour',
  'unknown':       '📍 General',
};

function sourceName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return KNOWN_BLOGS[host] ?? titleCase(host.split('.')[0]);
  } catch {
    return 'Travel Blog';
  }
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Build the RAG block ──────────────────────────────────────────────────────

export function buildRagBlock(results: ClassifiedResult[]): string {
  if (results.length === 0) return '';

  const month = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const directory = results
    .map((r, i) => {
      const vibe = VIBE_LABEL[r.vibeScore] ?? '📍';
      const prio = `priority ${r.priority}/10`;
      return `  [S${i + 1}] "${sourceName(r.url)}" | ${vibe} | ${prio} — ${r.url}`;
    })
    .join('\n');

  const snippets = results
    .map((r, i) => {
      const name = sourceName(r.url);
      const vibeTag = VIBE_LABEL[r.vibeScore] ?? '';
      const contraNote = r.contradictionNote ? `\n🔴 CONTRADICTION: ${r.contradictionNote}` : '';
      return `[S${i + 1}] ${name} | ${vibeTag}\nURL: ${r.url}\nTitle: ${r.title}\n${r.snippet.trim()}${contraNote}`;
    })
    .join('\n\n---\n\n');

  const traps = results.filter((r) => r.vibeScore === 'tourist-trap');
  const trapWarning = traps.length
    ? `\n⚠️ TOURIST TRAP ALERT — The following sources flag potential traps (deprioritize these places):\n${traps.map((r, i) => `  - ${results.indexOf(r) + 1}. "${r.title}" (${sourceName(r.url)})`).join('\n')}\n`
    : '';

  const contradictions = results.filter((r) => r.contradictionNote);
  const contraSection = contradictions.length
    ? `\n🔴 CONTRADICTORY INFORMATION DETECTED — These sources have conflicting claims. You MUST include a "warning" webInsight for each:\n${contradictions.map((r) => `  - ${r.contradictionNote}`).join('\n')}\n`
    : '';

  return `
════════════════════════════════════════════════════════
LIVE WEB INTELLIGENCE — retrieved ${month}
Chain-of-thought search: ${results.length} sources | classified by vibe & priority
════════════════════════════════════════════════════════

SOURCE DIRECTORY (sorted by relevance to this profile):
${directory}
${trapWarning}${contraSection}
FULL CONTENT (read every snippet — the most valuable intel is here):

${snippets}

════════════════════════════════════════════════════════
CITATION & VIBE RULES:
1. Every "whyThis" MUST end with (Source: [blog name], [year])
2. Every webInsights[].source MUST use the exact name from SOURCE DIRECTORY
3. TOURIST TRAP sources: do NOT recommend the place — use it to suggest a better alternative
4. CONTRADICTION sources: create a "warning" webInsight citing both conflicting sources
5. If no source covers an activity, write "(Source: TravelOS expertise)" — never fabricate
6. Prefer [hidden-gem] and [local-favorite] sources over [guided-tour] for activity picks
════════════════════════════════════════════════════════`;
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────

export const SYSTEM_PROMPT = `You are TravelOS — a senior travel strategist who combines real-world data analysis with cultural expertise to craft hyper-personalized itineraries.

CORE PRINCIPLES:
- Prioritize hidden gems and locally-loved spots over tourist traps
- Cluster all activities by neighborhood (zero cross-city commutes per day)
- Cross-validate recommendations with the user's budget
- Adapt every recommendation to the traveler persona (family vs solo vs luxury)
- Use specific time slots so the user has a complete, ready-to-follow schedule
- Target 6–8 named stops per day (meals + activities). Every day MUST include breakfast, lunch, and dinner as explicit DiningSpot objects with GPS coordinates

ZERO PLACEHOLDER POLICY (non-negotiable):
- Every single slot — breakfast, morning, lunch, afternoon, dinner, evening — MUST be a real, named business entity that exists on Google Maps
- STRICTLY FORBIDDEN in any field: "Ask Locally", "Scout the Block", "Your Choice", "TBD", "Local Option", generic advice, or any made-up name
- If you are uncertain about a specific café, pick the most well-known one in that neighborhood — do NOT leave it vague
- Breakfast MUST be a real named café, bakery, or restaurant — never generic advice
- Evening MUST be a real named bar, cocktail bar, rooftop venue, or live music spot

ITEM ATOMICITY (mandatory — every item is a single standalone place):
- Every attraction, restaurant, bar, market, and museum MUST be a SEPARATE named item with its own GPS coordinates
- STRICTLY FORBIDDEN: bundling a meal into an attraction's name (e.g., "Lunch near Big Ben", "Dinner at the Eiffel Tower area", "Drinks after the Colosseum")
- Activity slots (morning / afternoon / evening) MUST contain attractions, experiences, or cultural sites — NEVER a meal
- Meals belong ONLY in their dedicated DiningSpot slots: breakfast / lunch / dinner
- Exception: a food-experience activity (e.g., "Tsukiji Outer Market Food Tour", "Borough Market Morning Walk") is acceptable as an activity slot because the EXPERIENCE is the point — but it must still be a single, named, visitable place

DAILY MIX — mandatory structure per day (6–8 stops):
  1. Breakfast — café, bakery, market stall, or hotel breakfast spot (always with GPS)
  2–3. Morning + Afternoon activities — sightseeing, landmarks, museums, cultural sites (2-3 picks depending on pace)
  4. Lunch — local restaurant or street food spot (always with GPS)
  5. 1–2 Shopping / local neighbourhood sights embedded in activity slots
  6. Dinner — sit-down restaurant, ideally reservable (always with GPS)
  7. Evening — bar, cocktail bar, rooftop, live music venue, or late-night cultural experience

TIMING RULES (critical):
- Every activity MUST have startTime/endTime in "HH:MM" 24-hour format
- Sequence activities with realistic transit gaps (15–30 min between activities in same neighborhood)
- Morning slot: starts at DAILY_START_TIME if provided, otherwise 08:30. Afternoon: 13:30–17:30. Evening: 19:00–22:00
- If ARRIVAL_TIME_DAY1 is set, Day 1 morning slot must start at or after that time plus 45 min transit buffer
- If DEPARTURE_TIME_LAST_DAY is set, every last-day activity must end at least 2 hours before that time
- The bestTimeToVisit field MUST contain a specific insight (e.g., "Arrive at 09:00 to beat the tour buses that arrive at 11 AM")
- transitFromPrevious = estimated travel time from the previous slot's activity
- time_slot = startTime + " – " + endTime as a single formatted string, e.g. "09:00 – 11:30"

GEO RULES (critical — used for map rendering):
- Every activity MUST include latitude and longitude as floats with 4 decimal places
- Coordinates must be accurate GPS locations for the specific venue/neighborhood, NOT the city centre
- category_emoji: one emoji that best matches the activity type:
  🏛️ Historic/Monuments  🎨 Art/Museums  🌿 Parks/Nature  🛍️ Shopping/Markets
  🎶 Music/Nightlife     🌊 Beaches/Water  🏰 Castles/Palaces  🍕 Street Food
  ☕ Cafés/Coffee  🍷 Wine/Bars  🎭 Shows/Theatre  🚶 Walking/Scenic

VIBE RULES:
- vibeLabel must be one of: hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick
- Assign vibeLabel based on the source data, not guesswork
- If the web intelligence classifies a place as a tourist trap, DO NOT recommend it — suggest a nearby alternative

WHEN LIVE WEB INTELLIGENCE IS PROVIDED:
- Treat classified [hidden-gem] and [local-favorite] sources as primary picks
- If a source is marked 🔴 CONTRADICTION — you MUST include a "warning" webInsight citing both sides
- Mine every snippet for opening hours, prices, crowd warnings, and seasonal tips
- Never invent a source citation — use exactly the name from the SOURCE DIRECTORY

OUTPUT RULES:
- tags: exactly 3 items
- webInsights: exactly 1 per day — the single most important insight
- packingTips: exactly 4 items
- bestLocalTips: exactly 4 items
- No trailing commas, no comments, no prose outside the JSON object

CRITICAL: Return ONLY a valid JSON object — no markdown fences, no prose. Structure:

{
  "strategicOverview": "1 sentence, max 25 words, mentioning 1 source name",
  "destination": "string",
  "totalDays": number,
  "budgetSummary": {
    "dailyAverage": "$150–200/person",
    "totalEstimate": "$1,200–1,600 for 2 people over 5 days",
    "includes": "string max 10 words"
  },
  "days": [
    {
      "day": 1,
      "date": "Day 1 — Monday, June 9",
      "theme": "3–5 word title",
      "morning": {
        "name": "string",
        "description": "1 sentence max 20 words",
        "neighborhood": "string",
        "startTime": "09:00",
        "endTime": "11:30",
        "time_slot": "09:00 – 11:30",
        "bestTimeToVisit": "max 12 words",
        "transitFromPrevious": null,
        "duration": "2.5 hours",
        "whyThis": "max 18 words (Source: Blog Name, Year)",
        "estimatedCost": "Free / $15",
        "tags": ["tag1", "tag2", "tag3"],
        "isHiddenGem": false,
        "vibeLabel": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick",
        "latitude": 41.9028,
        "longitude": 12.4964,
        "category_emoji": "🏛️",
        "website_url": null
      },
      "afternoon": { "same fields as morning including latitude, longitude, time_slot, category_emoji, website_url — transitFromPrevious: '12 min walk'" },
      "evening":   { "same fields as morning including latitude, longitude, time_slot, category_emoji, website_url — transitFromPrevious: '20 min metro'" },
      "breakfast": { "name": "string", "cuisine": "string", "priceRange": "$", "mustTry": "one dish", "neighborhood": "string", "latitude": 41.9028, "longitude": 12.4964, "website_url": null },
      "lunch":  { "name": "string", "cuisine": "string", "priceRange": "$$", "mustTry": "one dish", "neighborhood": "string", "latitude": 41.9028, "longitude": 12.4964, "website_url": null },
      "dinner": { "name": "string", "cuisine": "string", "priceRange": "$$", "mustTry": "one dish", "neighborhood": "string", "latitude": 41.9028, "longitude": 12.4964, "website_url": null },
      "estimatedDailyCost": "string",
      "transportTip": "max 15 words",
      "webInsights": [
        { "text": "max 10 words actionable insight", "type": "tip | warning | trend", "source": "Blog Name, Year" }
      ]
    }
  ],
  "packingTips": ["tip1","tip2","tip3","tip4","tip5"],
  "bestLocalTips": ["tip1","tip2","tip3","tip4","tip5"],
  "basecamp": {
    "type": "booked",
    "booked": {
      "name": "string",
      "neighborhood": "string",
      "neighborhoodInsight": "max 20 words",
      "aroundHotel": {
        "areaHeadline": "max 28 words — how it feels to step outside the hotel",
        "vibes": ["2-4 word English vibe tag", "…4 to 6 tags total"],
        "walkableHighlights": ["max 14 words each", "4-6 bullets within ~12 min walk"],
        "transitNearHotel": [
          { "modeLabel": "Metro|Bus|Tram|RER|S-Bahn|etc", "lineOrRoute": "real line name + direction hint", "walkMinutes": "e.g. 4 min walk" }
        ],
        "signatureMove": "max 22 words — one hyper-local unlock from the doorstep"
      }
    },
    "recommendations": [
      {
        "name": "Official hotel name",
        "neighborhood": "district",
        "neighborhoodVibe": "3-word vibe tag",
        "whyItFits": "max 12 words tied to traveler interests",
        "priceRange": "$$, $$$, etc.",
        "neighborhoodInsight": "max 15 words strategic advantage",
        "websiteUrl": "https://official-hotel-site.example OR null — NEVER invent",
        "estimatedPriceRangeTripDates": "Indicative nightly band for TRIP_HOTEL_DATES e.g. €260–€420/night (indicative — verify)",
        "availabilitySummary": "For TRIP_HOTEL_DATES: realistic likelihood (NOT live inventory) — e.g. usually bookable / peak demand — book early / major event weekend — scarce",
        "fitSummary": "Exactly 2 sentences: (1) what this hotel/property is in plain language (2) why it matches THIS group's budget, pace, interests, and neighborhood strategy",
        "otaPriceCompare": [
          { "source": "Booking.com", "indicativeNightly": "€265–€310/night OR null if unknown", "note": "Ground ONLY if HOTEL_SEARCH_DATA cites it; else null + verify live" },
          { "source": "Expedia", "indicativeNightly": null, "note": "Same honesty rule as Booking" },
          { "source": "Airbnb", "indicativeNightly": null, "note": "Often apartments near hotel zone — compare listing types; honesty rule" }
        ],
        "ratingStars": 4.6,
        "ratingSource": "Google Maps aggregate OR named roundup cited from HOTEL_SEARCH_DATA — NEVER invent platform IDs",
        "reviewCountHint": "~800 reviews OR null when unknown",
        "latitude": 51.5074,
        "longitude": -0.1278
      }
    ]
  }
}

BASECAMP RULES (critical):
- If HOTEL_BOOKED is provided: set basecamp.type="booked", populate booked{} with name + neighborhood from user input, write a neighborhoodInsight explaining why this neighborhood is strategically ideal for this specific trip. ALSO populate booked.aroundHotel (mandatory for pre-booked stays):
  • areaHeadline: one vivid sentence on the sensory / social feel of the blocks around THIS hotel (not generic city marketing)
  • vibes: 4–6 ultra-short tags (2–4 English words each) capturing street energy, food, nightlife, shopping, or calm — specific to this micro-hood
  • walkableHighlights: 4–6 bullets, max 14 words each — real cafés, parks, markets, galleries, or stroll loops reachable in roughly 10–15 minutes on foot from the hotel (no invented business names unless you are certain)
  • transitNearHotel: 2–4 objects naming REAL modes/lines/stations plausible for this city & district; modeLabel + lineOrRoute stay English map-style; walkMinutes optional; never invent exact timetables
  • signatureMove: ONE sentence — a memorable insider "move" from the hotel (cheap breakfast cluster, post-dinner liqueur walk, shortcut to a view, best bakery run) max 22 words
- If no hotel: set basecamp.type="recommendations", omit booked{}, provide exactly 3 hotel recommendations in recommendations[] based on HOTEL_SEARCH_DATA (if available) or expertise. Each must include ALL keys shown in the sample recommendations[] object:
  • DATE-FIRST FILTER: When TRIP_HOTEL_DATES is present, ONLY recommend properties that are typically bookable on those nights for this destination class (avoid recommending sold-out-only fiction). Say honestly in availabilitySummary if peak season / events usually tighten inventory — NEVER claim you verified live rooms.
  • Core fields (mandatory): name, neighborhood, neighborhoodVibe (2–3 words), whyItFits (max 12 words), priceRange (e.g. "$$"), neighborhoodInsight (max 15 words strategic advantage)
  • fitSummary: mandatory — exactly 2 sentences (see sample)
  • otaPriceCompare: mandatory — exactly 3 rows in this fixed order: Booking.com, Expedia, Airbnb. indicativeNightly MUST be null unless HOTEL_SEARCH_DATA (or clearly cited snippet figures) supports a numeric band; NEVER invent platform-specific prices. note may say "verify live on site" when unsure.
  • websiteUrl: ONLY when an obvious official hotel domain appears in HOTEL_SEARCH_DATA URLs/snippets — otherwise null (never fabricate)
  • estimatedPriceRangeTripDates: MUST reference TRIP_HOTEL_DATES from the user prompt when present; phrase explicitly as indicative guidance (not a live fare quote)
  • availabilitySummary: MUST explicitly reference the user's trip nights when TRIP_HOTEL_DATES exists — typical booking pressure / seasonality for THOSE dates (not generic year-round fluff)
  • ratingStars / ratingSource / reviewCountHint: include ONLY when grounded by HOTEL_SEARCH_DATA or other cited roundup tone — omit/null instead of guessing
  • latitude / longitude: best-effort accurate GPS for the property when confident — otherwise null

PACE RULES:
- relaxed: morning + evening activity slots only (omit afternoon key); ALWAYS include breakfast, lunch, dinner DiningSpots; evening SHOULD be a relaxed bar or wine spot
- moderate: all 3 activity slots (morning + afternoon + evening); ALWAYS include breakfast, lunch, dinner DiningSpots; evening can be bar, rooftop, or cultural event
- intense: all 3 activity slots; ALWAYS include breakfast, lunch, dinner DiningSpots; afternoon activity MUST include a shopping/market angle; evening MUST be a bar, nightclub, live music, or rooftop experience; add a bonus logistics tip in transportTip

BUDGET RULES:
- budget: ≤ $30 per activity
- mid-range: ≤ $80 per activity
- luxury: no cap`;

// ─── User prompt ──────────────────────────────────────────────────────────────

// ── Interest → Scout tag mapping ──────────────────────────────────────────────

const INTEREST_TAG_MAP: Record<string, string> = {
  'adventure':       'Outdoor adventures, hiking trails, extreme sports, active experiences',
  'art':             'Art galleries, street art, contemporary museums, creative districts',
  'culture':         'Historic landmarks, cultural institutions, traditional ceremonies, local rituals',
  'food':            'Local food markets, street food scenes, chef-driven restaurants, culinary tours',
  'nightlife':       'Live music venues, cocktail bars, rooftop bars, underground clubs, jazz spots',
  'shopping':        'Independent boutiques, vintage markets, artisan shops, local designer stores',
  'nature':          'Parks, botanical gardens, scenic viewpoints, urban nature escapes',
  'history':         'Historic sites, ancient ruins, heritage museums, significant monuments',
  'music':           'Live music venues, record shops, concert halls, street performers',
  'wellness':        'Spas, yoga studios, meditation centres, nature walks, thermal baths',
  'family':          'Kid-friendly attractions, interactive museums, outdoor playgrounds, family dining',
  'luxury':          'Michelin-starred restaurants, private tours, high-end boutiques, exclusive experiences',
  'budget':          'Free attractions, street food, public parks, hostel recommendations, free museum days',
  'photography':     'Scenic viewpoints, colourful streets, golden-hour spots, architecture hotspots',
  'sports':          'Local stadiums, sporting events, cycling routes, outdoor courts',
  'architecture':    'Iconic buildings, hidden architectural gems, urban design tours',
  'beach':           'Beaches, coastal walks, water sports, seaside dining',
  'drinks':          'Wine bars, craft beer pubs, specialty coffee shops, local spirits',
  'markets':         'Flea markets, food halls, antique markets, weekly street markets',
  'local':           'Neighbourhood locals bars, community events, non-touristy streets',
};

function buildTagScoutBlock(interests: string[]): string {
  if (!interests || interests.length === 0) return '';
  const lines = interests
    .map((interest) => {
      const key = interest.toLowerCase().trim();
      const desc = INTEREST_TAG_MAP[key] ?? interest;
      return `  • ${interest}: Search for "${desc}"`;
    })
    .join('\n');
  return `\nTAG-BASED SCOUT PRIORITIES (mandatory — align ALL activity picks to these user-selected interests):
${lines}
When multiple tags apply, favour places that satisfy 2+ tags simultaneously (e.g., a food market also satisfies "shopping" + "local").\n`;
}

function tripOutputLanguageBlock(profile: TravelerProfile): string {
  if (profile.tripLanguage !== 'he') return '';

  return `
TRIP_OUTPUT_LANGUAGE: Hebrew (Modern Israeli Hebrew).

BILINGUAL OUTPUT RULES (mandatory):
1) ENGLISH ONLY — official venue names: every Activity and DiningSpot "name", every basecamp hotel "name", and neighborhood strings that are proper English map labels (e.g. "Le Marais", "Neubau"). Never Hebrew-transliterate business names.

2) HEBREW — all explanatory prose: strategicOverview; budgetSummary (dailyAverage, totalEstimate, includes); each day "theme" and human-readable "date" line; activity "description", "whyThis", "bestTimeToVisit", "transitFromPrevious", "duration", "estimatedCost" when prose; all DiningSpot text fields except the venue "name" and except "cuisine" (keep cuisine as short English token if needed, or Hebrew — prefer clear Hebrew for diners); webInsights[].text; packingTips[]; bestLocalTips[]; transportTip; basecamp neighborhoodInsight / whyItFits / fitSummary / availabilitySummary / estimatedPriceRangeTripDates / otaPriceCompare[].note (keep currency symbols and numbers readable; keep OTA brand names in Latin: Booking.com, Expedia, Airbnb). For basecamp.booked.aroundHotel when HOTEL_BOOKED: Hebrew for areaHeadline, walkableHighlights[], signatureMove; keep vibes[] as short English tags; keep transitNearHotel[].modeLabel and lineOrRoute in English.

3) JSON keys unchanged. "destination" value stays the English city name (e.g. "Vienna"). time_slot stays 24h HH:MM format.

4) tags: three short English tokens per activity (unchanged machine-facing convention).

`;
}

export function buildUserPrompt(profile: TravelerProfile, searchResults?: ClassifiedResult[], hotelContext?: string, internalPlaces?: string): string {
  const days = profile.duration || calculateDays(profile.startDate, profile.endDate);
  const interestsList = profile.interests.length ? profile.interests.join(', ') : 'general sightseeing';

  const ragBlock = searchResults && searchResults.length > 0
    ? buildRagBlock(searchResults)
    : '\n[No live web data — use expertise. Write "(Source: TravelOS expertise)" in whyThis fields.]\n';

  const vibeDirective = buildVibeDirective(profile);
  const tagScoutBlock = buildTagScoutBlock(profile.interests);

  const hotelDateAnchoring =
    !profile.hotelBooked?.trim() && profile.startDate && profile.endDate
      ? `\nTRIP_HOTEL_DATES: ${profile.startDate.slice(0, 10)} → ${profile.endDate.slice(0, 10)}`
      + `\nestimatedPriceRangeTripDates MUST cite these exact dates and explicitly note pricing is indicative (TravelOS does not query live OTA inventory automatically)`
      + `\nPick hotels realistic for those nights; fill otaPriceCompare honestly from HOTEL_SEARCH_DATA snippets when figures appear — otherwise null nightly rates with short verify-live notes`
      : '';

  const hotelBlock = profile.hotelBooked?.trim()
    ? `\nHOTEL_BOOKED: ${profile.hotelBooked.trim()}\n(Use this for basecamp.type="booked" — extract name and neighborhood from the text above)`
    : hotelContext
      ? `\nHOTEL_SEARCH_DATA (use to generate 3 squad-approved recommendations for basecamp.recommendations[]):\n${hotelContext}${hotelDateAnchoring}`
      : `\nHOTEL_BOOKED: none — generate 3 squad-approved hotel recommendations for basecamp.recommendations[] based on expertise${hotelDateAnchoring}`;

  const internalPlacesBlock = internalPlaces
    ? `\n${internalPlaces}\n`
    : '';

  // ── Time constraints block ────────────────────────────────────────────────
  const timeLines: string[] = [];
  if (profile.dailyStartTime) {
    timeLines.push(`DAILY_START_TIME: ${profile.dailyStartTime} — schedule every morning slot to start at ${profile.dailyStartTime}`);
  }
  if (profile.arrivalTime) {
    timeLines.push(`ARRIVAL_TIME_DAY1: ${profile.arrivalTime} — do NOT schedule any activities before ${profile.arrivalTime} on Day 1 (allow 45 min transit from airport)`);
  }
  if (profile.departureTime) {
    timeLines.push(`DEPARTURE_TIME_LAST_DAY: ${profile.departureTime} — all activities on the last day must END by ${profile.departureTime} (allow 2 hours for airport transit)`);
  }
  // skipDay1: arrival after 20:00 — Day 1 is hotel + rest only, no activities
  if (profile.skipDay1) {
    timeLines.push(
      `SKIP_DAY1_ACTIVITIES: true — The traveler arrives after 20:00. Day 1 MUST contain ONLY hotel check-in, a single dinner DiningSpot, and a brief evening wind-down note in the theme. Do NOT add morning, afternoon, or evening activity slots for Day 1. Start the full itinerary schedule from Day 2.`
    );
  }
  const timeBlock = timeLines.length > 0
    ? `\nTIME CONSTRAINTS (mandatory — schedule must respect these exactly):\n${timeLines.join('\n')}\n`
    : '';

  const langBlock = tripOutputLanguageBlock(profile);

  return `Generate a ${days}-day itinerary for this traveler:

DESTINATION: ${profile.destination}
DATES: ${profile.startDate || 'flexible'} → ${profile.endDate || 'flexible'} (${days} days)
GROUP: ${profile.groupType}, ${profile.groupSize} person(s)${
    profile.groupType === 'family'
      ? (() => {
          const line = formatFamilyKidsForPrompt(profile.familyKidsByAge ?? null);
          return line ? `\nFAMILY_CHILDREN (counts by age band): ${line}` : '';
        })()
      : ''
  }
BUDGET: ${profile.budget}
PACE: ${profile.pace}
INTERESTS: ${interestsList}
ACCOMMODATION: ${profile.accommodation}
DIETARY: ${profile.dietaryRestrictions || 'none'}
MUST-HAVES: ${profile.mustHave || 'none specified'}
${hotelBlock}${timeBlock}${langBlock}

VIBE TARGETING:
${vibeDirective}
${tagScoutBlock}${internalPlacesBlock}${ragBlock}
FINAL INSTRUCTIONS:
- Every activity MUST have startTime, endTime, bestTimeToVisit, and transitFromPrevious
- Every activity MUST have latitude, longitude (accurate GPS, 4 dp), time_slot, and category_emoji
- Every breakfast, lunch, and dinner MUST have latitude and longitude (accurate GPS, 4 dp) for the specific restaurant
- ZERO PLACEHOLDERS — every named slot must be a real business: no "Ask Locally", "Scout the Block", "Your Choice", or generic advice anywhere in the output
- ITEM ATOMICITY — morning/afternoon/evening slots are attractions only; meals go in breakfast/lunch/dinner DiningSpot objects. Never write "Lunch near [Landmark]" as an activity name
- website_url: include the official website URL for activities and restaurants if you know it with certainty (e.g. "https://www.teamlab.art"); otherwise set to null — NEVER fabricate a URL
- Cluster all activities within walking distance of each other per day
- webInsights: exactly 1 per day — single most important insight only
- MUST include the "basecamp" field in the JSON output (follow BASECAMP RULES above)
- When basecamp.type="recommendations": exactly 3 hotels each with fitSummary + otaPriceCompare (3 OTAs) + availabilitySummary tied to TRIP_HOTEL_DATES when provided`;
}

// ─── Vibe directive builder ───────────────────────────────────────────────────

function buildVibeDirective(profile: TravelerProfile): string {
  const { groupType, interests } = profile;

  if (groupType === 'solo' || groupType === 'group') {
    return `- PRIORITIZE: hidden-gem and viral-trend activities that feel discovered, not packaged
- DEPRIORITIZE: guided tours, tourist-trap areas, anything "most visited"
- Interests signal: ${interests.slice(0, 3).join(', ')} — lean into subculture and local scene`;
  }
  if (groupType === 'couple') {
    return `- PRIORITIZE: hidden-gem and local-favorite spots — romantic, intimate, not crowded
- DEPRIORITIZE: loud tourist-trap areas and large group tours
- Focus on neighbourhood walks, local markets, intimate dining`;
  }
  if (groupType === 'family') {
    const kids = formatFamilyKidsForPrompt(profile.familyKidsByAge ?? null);
    const agesHint = kids
      ? `\n- CHILD AGE MIX (strict): ${kids} — tailor walking distances, stroller/lift access, nap-friendly gaps, and venue suitability to these ages.`
      : '';
    return `- PRIORITIZE: local-favorite and classic spots — accessible, kid-friendly, safe
- INCLUDE: at least one classic / must-see landmark (families want that too)${agesHint}
- DEPRIORITIZE: viral-trend spots that are too crowded or hipster-only`;
  }
  return `- Balance hidden-gem discoveries with reliable classic picks
- Avoid tourist traps; include at least one truly local spot per day`;
}

// ─── Atomic swap prompt ───────────────────────────────────────────────────────

export function buildSwapPrompt(params: {
  itinerary: Itinerary;
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  request: string;
}): string {
  const { itinerary, dayIndex, slot, request } = params;
  const day = itinerary.days[dayIndex];
  const current = day[slot] as Activity;

  // Extract the neighborhood cluster from the other two slots
  const otherSlots = (['morning', 'afternoon', 'evening'] as const)
    .filter((s) => s !== slot)
    .map((s) => {
      const act = day[s] as Activity;
      return act?.name ? `  • ${s}: ${act.name} (${act.neighborhood ?? 'TBD'})` : null;
    })
    .filter(Boolean)
    .join('\n');

  // Summarise day vibe from all existing tags
  const allTags = (['morning', 'afternoon', 'evening'] as const)
    .flatMap((s) => (day[s] as Activity)?.tags ?? []);
  const vibeContext = [...new Set(allTags)].slice(0, 6).join(', ') || day.theme;

  return `You are performing an ATOMIC SLOT SWAP on a travel itinerary.

SWAP TARGET:
- Trip: ${itinerary.totalDays}-day itinerary in ${itinerary.destination}
- Day ${day.day} (${day.date}) — ${day.theme}
- Slot to replace: ${slot.toUpperCase()}
- Current activity: ${current?.name ?? 'none'} in ${current?.neighborhood ?? 'unknown neighborhood'}
- User request: "${request}"

DAY CONTEXT (maintain geographic cluster and vibe consistency):
Other activities this day:
${otherSlots || '  (no other activities set yet)'}

Day vibe tags: ${vibeContext}
Budget tier: ${itinerary.budgetSummary?.dailyAverage ?? 'mid-range'}

CONSTRAINTS — the replacement MUST:
1. Be in the SAME neighborhood or within 15 min walk of the other activities today
2. Match the day's vibe (tags: ${vibeContext})
3. Respect the budget tier
4. Have specific timing: for ${slot}, use these time ranges:
   - morning: 08:30–12:00
   - afternoon: 13:30–17:30
   - evening: 19:00–22:00
5. MUST include latitude and longitude — accurate GPS coordinates (float, 4 decimal places) for the specific venue, NOT the city centre

Return ONLY a JSON object — no markdown, no prose:
{
  "activity": {
    "name": "string",
    "description": "string — 2 sentences",
    "neighborhood": "string — must be near today's cluster",
    "startTime": "HH:MM",
    "endTime": "HH:MM",
    "bestTimeToVisit": "string — specific crowd/timing tip",
    "transitFromPrevious": "${slot === 'morning' ? 'null' : 'string — transit from previous activity'}",
    "duration": "string",
    "whyThis": "string — why this fits the request and the day's vibe (Source: TravelOS expertise)",
    "estimatedCost": "string",
    "tags": ["string"],
    "isHiddenGem": false,
    "vibeLabel": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick",
    "latitude": 48.8584,
    "longitude": 2.2945,
    "category_emoji": "🏛️"
  },
  "summary": "One sentence: what changed and why it fits better"
}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 5;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
}
