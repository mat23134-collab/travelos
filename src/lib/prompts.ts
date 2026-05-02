import { TravelerProfile, ClassifiedResult, Itinerary, Activity } from './types';

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

TIMING RULES (critical):
- Every activity MUST have startTime/endTime in "HH:MM" 24-hour format
- Sequence activities with realistic transit gaps (15–30 min between activities in same neighborhood)
- Morning slot: typically 08:30–12:00. Afternoon: 13:30–17:30. Evening: 19:00–22:00
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
        "category_emoji": "🏛️"
      },
      "afternoon": { "same fields as morning including latitude, longitude, time_slot, category_emoji — transitFromPrevious: '12 min walk'" },
      "evening":   { "same fields as morning including latitude, longitude, time_slot, category_emoji — transitFromPrevious: '20 min metro'" },
      "lunch":  { "name": "string", "cuisine": "string", "priceRange": "$$", "mustTry": "one dish", "neighborhood": "string" },
      "dinner": { "name": "string", "cuisine": "string", "priceRange": "$$", "mustTry": "one dish", "neighborhood": "string" },
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
    "booked": { "name": "string", "neighborhood": "string", "neighborhoodInsight": "max 20 words" }
  }
}

BASECAMP RULES (critical):
- If HOTEL_BOOKED is provided: set basecamp.type="booked", populate booked{} with name + neighborhood from user input, write a neighborhoodInsight explaining why this neighborhood is strategically ideal for this specific trip
- If no hotel: set basecamp.type="recommendations", omit booked{}, provide exactly 3 hotel recommendations in recommendations[] based on HOTEL_SEARCH_DATA (if available) or expertise. Each must have: name, neighborhood, neighborhoodVibe (2-3 words), whyItFits (tie to traveler interests, max 12 words), priceRange (e.g. "$$"), neighborhoodInsight (max 15 words strategic advantage)

PACE RULES:
- relaxed: morning + evening only; omit afternoon key entirely
- moderate: all 3 slots
- intense: all 3 slots + explicit bonus tip in transportTip

BUDGET RULES:
- budget: ≤ $30 per activity
- mid-range: ≤ $80 per activity
- luxury: no cap`;

// ─── User prompt ──────────────────────────────────────────────────────────────

export function buildUserPrompt(profile: TravelerProfile, searchResults?: ClassifiedResult[], hotelContext?: string, internalPlaces?: string): string {
  const days = profile.duration || calculateDays(profile.startDate, profile.endDate);
  const interestsList = profile.interests.length ? profile.interests.join(', ') : 'general sightseeing';

  const ragBlock = searchResults && searchResults.length > 0
    ? buildRagBlock(searchResults)
    : '\n[No live web data — use expertise. Write "(Source: TravelOS expertise)" in whyThis fields.]\n';

  const vibeDirective = buildVibeDirective(profile);

  const hotelBlock = profile.hotelBooked?.trim()
    ? `\nHOTEL_BOOKED: ${profile.hotelBooked.trim()}\n(Use this for basecamp.type="booked" — extract name and neighborhood from the text above)`
    : hotelContext
      ? `\nHOTEL_SEARCH_DATA (use to generate 3 squad-approved recommendations for basecamp.recommendations[]):\n${hotelContext}`
      : `\nHOTEL_BOOKED: none — generate 3 squad-approved hotel recommendations for basecamp.recommendations[] based on expertise`;

  const internalPlacesBlock = internalPlaces
    ? `\n${internalPlaces}\n`
    : '';

  return `Generate a ${days}-day itinerary for this traveler:

DESTINATION: ${profile.destination}
DATES: ${profile.startDate || 'flexible'} → ${profile.endDate || 'flexible'} (${days} days)
GROUP: ${profile.groupType}, ${profile.groupSize} person(s)
BUDGET: ${profile.budget}
PACE: ${profile.pace}
INTERESTS: ${interestsList}
ACCOMMODATION: ${profile.accommodation}
DIETARY: ${profile.dietaryRestrictions || 'none'}
MUST-HAVES: ${profile.mustHave || 'none specified'}
${hotelBlock}

VIBE TARGETING:
${vibeDirective}
${internalPlacesBlock}${ragBlock}
FINAL INSTRUCTIONS:
- Every activity MUST have startTime, endTime, bestTimeToVisit, and transitFromPrevious
- Every activity MUST have latitude, longitude (accurate GPS, 4 dp), time_slot, and category_emoji
- Cluster all activities within walking distance of each other per day
- webInsights: exactly 1 per day — single most important insight only
- MUST include the "basecamp" field in the JSON output (follow BASECAMP RULES above)`;
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
    return `- PRIORITIZE: local-favorite and classic spots — accessible, kid-friendly, safe
- INCLUDE: at least one classic / must-see landmark (families want that too)
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
    "vibeLabel": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick"
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
