export type GroupType = 'solo' | 'couple' | 'family' | 'group';

// ─── Group Dynamics (sub-segment within each group type) ──────────────────────

export type SoloDynamics   = 'digital-nomad' | 'deep-recharge' | 'adventure';
export type CoupleDynamics = 'romantic' | 'parent-child' | 'reconnecting';
export type FamilyDynamics = 'young-kids' | 'mixed-ages' | 'teens';
export type GroupDynamics  = 'best-friends' | 'mixed-ages' | 'work-crew';

/** Narrow sub-persona collected after the user picks a group type. */
export interface GroupDynamicsPayload {
  subType: SoloDynamics | CoupleDynamics | FamilyDynamics | GroupDynamics;
}

/** Counts of children per age band (only used when groupType is family). */
export type FamilyChildAgeBand = '0-3' | '3-6' | '6-9' | '9-12' | '12-16' | '16+';
export type FamilyKidsByAge = Partial<Record<FamilyChildAgeBand, number>>;

/** UI + narrative language for generated itinerary (place names stay English for maps). */
export type TripLanguage = 'en' | 'he';

/** Indicative OTA row — grounded on HOTEL_SEARCH_DATA when possible; live inventory via link. */
export interface OtaPriceCompareRow {
  source: string;
  indicativeNightly?: string | null;
  note?: string | null;
}

export interface HotelRecommendation {
  name: string;
  neighborhood: string;
  neighborhoodVibe: string;
  whyItFits: string;
  priceRange: string;
  neighborhoodInsight: string;
  /** Official property website — only when confident from HOTEL_SEARCH_DATA URLs */
  websiteUrl?: string | null;
  /** Indicative nightly rate band anchored to the user's trip dates (not a live quote) */
  estimatedPriceRangeTripDates?: string | null;
  /** Qualitative availability / booking pressure note */
  availabilitySummary?: string | null;
  /** 2 sentences: what the property is + why it suits this traveler/trip (broader than whyItFits) */
  fitSummary?: string | null;
  /** Booking.com / Agoda / Airbnb-style comparison (exactly 3 rows when present; UI merges defaults) */
  otaPriceCompare?: OtaPriceCompareRow[] | null;
  /** Aggregate rating when grounded (typically 1–5 scale); omit when unknown */
  ratingStars?: number | null;
  ratingSource?: string | null;
  reviewCountHint?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /**
   * True = confirmed available for the trip dates (hide card when explicitly false).
   * Omitted / null → show the card (backward-compatible default).
   */
  availability?: boolean | null;
}

/** One nearby public-transport anchor from the hotel (names stay English for maps). */
export interface TransitNearHotelLine {
  modeLabel: string;
  lineOrRoute: string;
  walkMinutes?: string;
}

/** Rich “around your pre-booked hotel” intel — only when basecamp.type is booked. */
export interface BookedHotelAround {
  /** One vivid sentence: what it feels like to step outside the hotel */
  areaHeadline?: string;
  /** Short vibe tags (English 2–4 words each is OK for scanability) */
  vibes?: string[];
  /** Things to do within ~10–15 min walk */
  walkableHighlights?: string[];
  transitNearHotel?: TransitNearHotelLine[];
  /** One punchy “unlock” — insider micro-itinerary from the doorstep */
  signatureMove?: string;
}

export interface Basecamp {
  type: 'booked' | 'recommendations';
  booked?: {
    name: string;
    neighborhood: string;
    neighborhoodInsight: string;
    /** Extra neighborhood field guide for travelers who already locked a hotel */
    aroundHotel?: BookedHotelAround;
  };
  recommendations?: HotelRecommendation[];
}

export type BudgetLevel = 'budget' | 'mid-range' | 'luxury';
export type PaceLevel = 'relaxed' | 'moderate' | 'intense';
export type AccommodationType = 'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort';

/** Hotel-specific preferences captured after the user picks an accommodation type. */
export type HotelNightlyBudget = 'budget' | 'mid' | 'comfort' | 'luxury';
export type HotelLocationPref  = 'center' | 'nature' | 'quiet' | 'transit';
export type HotelAmenity =
  | 'breakfast' | 'pool' | 'parking' | 'gym' | 'pets'
  | 'spa' | 'suite' | 'workspace' | 'rooftop';

export type InsightType = 'tip' | 'warning' | 'trend';
export type VibeLabel = 'hidden-gem' | 'local-favorite' | 'viral-trend' | 'classic' | 'luxury-pick' | 'budget-pick';
export type VibeScore = 'hidden-gem' | 'local-favorite' | 'viral-trend' | 'tourist-trap' | 'guided-tour' | 'unknown';

export interface TravelerProfile {
  destination: string;
  /** Preferred language for explanations on the itinerary page (beta: Hebrew). Venue names stay English. */
  tripLanguage?: TripLanguage;
  /** Sub-persona within the chosen group type — drives Anchor Logic & scout queries. */
  groupDynamics?: GroupDynamicsPayload | null;
  startDate: string;
  endDate: string;
  duration: number;
  groupType: GroupType;
  /** When groupType is family: number of kids in each age range (years). */
  familyKidsByAge?: FamilyKidsByAge | null;
  groupSize: number;
  budget: BudgetLevel;
  pace: PaceLevel;
  interests: string[];
  accommodation: AccommodationType;
  /** Nightly hotel budget tier (asked after accommodation type) */
  hotelNightlyBudget?: HotelNightlyBudget | null;
  /** Up to 2 preferred hotel location vibes */
  hotelLocationPref?: HotelLocationPref[];
  /** Optional must-have amenities — empty = no preference */
  hotelAmenities?: HotelAmenity[];
  /** True when the user skipped the hotel step — suppress all hotel content. */
  hotelSkipped?: boolean;
  dietaryRestrictions: string;
  mustHave: string;
  hotelBooked?: string;
  hotelAddress?: string;
  hotelLat?: number;
  hotelLng?: number;
  // Time-aware inputs (v1.10.16)
  dailyStartTime?: string;   // e.g. "08:00" — when the traveler starts each day
  arrivalTime?: string;      // e.g. "15:00" — arrival time on day 1 (limits first-day activities)
  departureTime?: string;    // e.g. "11:00" — departure time on last day (limits last-day activities)
  // Derived from arrivalTime by onboardingStore (v1.10.18)
  skipDay1?: boolean;        // true when arrival hour >= 20 — generator omits Day 1 activities entirely
}

export interface Activity {
  name: string;
  description?: string;
  neighborhood?: string;
  duration?: string;
  whyThis?: string;
  estimatedCost?: string;
  tags?: string[];
  isHiddenGem?: boolean;
  // timing
  startTime?: string;
  endTime?: string;
  bestTimeToVisit?: string;
  transitFromPrevious?: string;
  // vibe
  vibeLabel?: VibeLabel;
  // geo — used for day-level map pins
  latitude?: number;
  longitude?: number;
  // UI helpers
  time_slot?: string;       // formatted range e.g. "09:00 – 11:30"
  category_emoji?: string;  // single emoji e.g. "🏛️" matching cube category
  // media & social proof
  videoUrl?: string;
  reviews?: string[];
  // JIT verification (populated by api/generate after Claude call)
  verificationStatus?: 'verified-open' | 'flagged-closed' | 'flagged-renovating' | 'unverified';
  verifiedAt?: string;          // ISO-8601 timestamp from live Exa check
  verificationSignal?: string;  // excerpt that triggered a flag (for debugging)
  // Relational DB (populated after Supabase insert)
  item_id?: string;        // UUID from itinerary_items row — enables targeted row-level swaps
  website_url?: string;    // official website URL (from Claude or Google Places)
  google_place_id?: string; // Google Places id — lets us dedupe/verify/pull photos later
  // Recommendation-engine provenance (optional, additive JSON field)
  inventory_id?: string;
  inventory_source_table?: 'places' | 'restaurants';
  // Time-anchor fields (Smart Toolbar / Auto-Rescheduling)
  isFixed?: boolean;             // when true the scheduler must never move this activity
  lockedTime?: string;           // exact start time the user reserved, e.g. "19:30"
  reservationStatus?: 'none' | 'pending' | 'booked';
  reservationUrl?: string;       // deep-link to the booking confirmation or OTA page
}

export interface DiningSpot {
  name?: string;
  cuisine?: string;
  priceRange?: string;
  mustTry?: string;
  neighborhood?: string;
  /** GPS coordinates — used to place dining spots on the day map */
  latitude?: number;
  longitude?: number;
  // Relational DB (populated after Supabase insert)
  item_id?: string;     // UUID from itinerary_items row
  website_url?: string; // official website URL
  // Recommendation-engine provenance (optional, additive JSON field)
  inventory_id?: string;
  inventory_source_table?: 'places' | 'restaurants';
}

/**
 * A reservable restaurant surfaced by the restaurant scout pipeline
 * (Exa → Gemini → Google Places → scoring) and stored in
 * `public.restaurant_recommendations`. Shown in the Smart Toolbar so a
 * traveler can lock a booking into a specific day.
 */
/** Site content languages. Restaurant text is generated for every entry here. */
export const SITE_LANGUAGES = ['en', 'he'] as const;
export type SiteLanguage = (typeof SITE_LANGUAGES)[number];

/** Localizable restaurant text fields, produced per site language. */
export interface RestaurantLocaleText {
  description?: string | null;
  cuisineStyle?: string | null;
  signatureDish?: string | null;
  /** Punchy 2–4 word badge of what makes it special, e.g. "Michelin tasting menu". */
  highlight?: string | null;
  /** One sentence on why booking is critical + how far ahead. */
  bookingUrgency?: string | null;
}

export interface RestaurantRecommendation {
  id?: string;                  // DB UUID (absent for freshly-scouted, pre-persist rows)
  city: string;
  name: string;
  /** Editorial blurb — resolved to the requested language (English fallback). */
  description?: string | null;
  /** e.g. "Roman trattoria" — resolved to the requested language. */
  cuisineStyle?: string | null;
  /** The one dish a first-timer must order — resolved to the requested language. */
  signatureDish?: string | null;
  /** Short badge of what makes this an experience — resolved to the language. */
  highlight?: string | null;
  /** Why booking is critical + how far ahead — resolved to the language. */
  bookingUrgency?: string | null;
  /** TikTok/Instagram search link so travelers can see the place's viral buzz. */
  socialUrl?: string | null;
  /** Per-language versions of the localizable fields, keyed by language code. */
  translations?: Partial<Record<SiteLanguage, RestaurantLocaleText>> | null;
  /** Display price band, e.g. "€€€" or "€40–60 pp". */
  priceRange?: string | null;
  /** 1–4 (Google price_level scale) — used for sorting/filtering. */
  priceLevel?: number | null;
  neighborhood?: string | null;
  /** Deep-link to book (official site or OTA like TheFork / OpenTable). */
  reservationUrl?: string | null;
  bookingPlatform?: string | null;
  websiteUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  /** Google Places id — present only when the place was verified. */
  googlePlaceId?: string | null;
  rating?: number | null;       // Google aggregate 1–5
  ratingCount?: number | null;  // Google user_ratings_total
  photoUrl?: string | null;
  source?: 'scout' | 'manual';
  /** Ranking score from the scout's scoring algorithm (higher = better). */
  score?: number;
}

/** Localizable attraction text fields, produced per site language. */
export interface AttractionLocaleText {
  description?: string | null;
  /** Short genre, e.g. "Ancient landmark", "Renaissance museum". */
  category?: string | null;
  /** Punchy 2–4 word badge, e.g. "Skip-the-line essential". */
  highlight?: string | null;
  /** One sentence: why booking ahead is critical + how far ahead. */
  bookingUrgency?: string | null;
  /** One practical insider tip (best time slot, entrance, etc.). */
  insiderTip?: string | null;
}

/**
 * A must-book-ahead attraction (timed-entry landmark, capped-capacity museum,
 * special-access tour) surfaced by the attraction scout and stored in
 * `public.attraction_recommendations`. Shown in the Smart Toolbar.
 */
export interface AttractionRecommendation {
  id?: string;
  city: string;
  name: string;
  description?: string | null;   // resolved to the requested language
  category?: string | null;      // resolved
  highlight?: string | null;     // resolved
  bookingUrgency?: string | null;// resolved
  insiderTip?: string | null;    // resolved
  translations?: Partial<Record<SiteLanguage, AttractionLocaleText>> | null;
  priceRange?: string | null;
  neighborhood?: string | null;
  /** Deep-link to buy tickets (official site or GetYourGuide/Tiqets search). */
  ticketUrl?: string | null;
  bookingPlatform?: string | null;
  websiteUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  googlePlaceId?: string | null;
  rating?: number | null;
  ratingCount?: number | null;
  photoUrl?: string | null;
  source?: 'scout' | 'manual';
  score?: number;
}

/** Localizable event text fields, produced per site language. */
export interface EventLocaleText {
  description?: string | null;
  /** Short genre, e.g. "Music festival", "Open-air food fair". */
  category?: string | null;
  /** Punchy 2–4 word badge, e.g. "Once a year". */
  highlight?: string | null;
}

/**
 * A festival / event happening in the destination that overlaps the traveler's
 * dates. Grounded in web search results (sourceUrl) to avoid hallucinated
 * events. Stored in `public.event_recommendations`.
 */
export interface EventRecommendation {
  id?: string;
  city: string;
  name: string;
  description?: string | null;   // resolved to the requested language
  category?: string | null;      // resolved
  highlight?: string | null;     // resolved
  translations?: Partial<Record<SiteLanguage, EventLocaleText>> | null;
  venue?: string | null;
  /** ISO dates (YYYY-MM-DD). Single-day events may have endDate = startDate. */
  startDate?: string | null;
  endDate?: string | null;
  priceRange?: string | null;
  ticketUrl?: string | null;
  websiteUrl?: string | null;
  /** The web page that grounded this event (from Exa/Tavily). */
  sourceUrl?: string | null;
  source?: 'scout' | 'manual';
  score?: number;
}

export interface WebInsight {
  text: string;
  type: InsightType;
  source: string;
}

export interface DayPlan {
  day: number;
  date?: string;
  theme?: string;
  morning?: Activity;
  afternoon?: Activity;
  evening?: Activity;
  breakfast?: DiningSpot;   // optional — populated from morning food activities or future prompt support
  lunch?: DiningSpot;
  dinner?: DiningSpot;
  estimatedDailyCost?: string;
  transportTip?: string;
  webInsights?: WebInsight[];
  daySummary?: string;   // AI-written "daily story" paragraph (new itineraries only); falls back to summarizeDay() when absent
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface ClassifiedResult extends SearchResult {
  vibeScore: VibeScore;
  priority: number;         // 0–10; higher = more relevant to the profile
  contradictionNote?: string; // set when this result conflicts with another
}

/** Official or well-known ticket / info links for getting around the destination city. */
export interface CityTransportLink {
  label: string;
  url: string;
  description?: string | null;
}

/** One transport mode (metro, bus, train, bike share, taxi norms, etc.). */
export interface CityTransportOption {
  mode: string;
  summary: string;
  /** Legacy combined band — keep for older itineraries; prefer dailyAverage + tripTotalEstimate. */
  typicalPrice: string;
  /** Typical spend per calendar day using this mode (local currency). */
  dailyAverage?: string | null;
  /** Rough total for the whole trip length if relying mainly on this mode (same currency as dailyAverage). */
  tripTotalEstimate?: string | null;
  /** Optional official pass / operator link for this mode (https only). */
  optionUrl?: string | null;
  optionLinkLabel?: string | null;
  tip?: string | null;
}

/** Official mobility app for the city (from operator / city pages). */
export interface CityTransportApp {
  name: string;
  iosUrl?: string | null;
  androidUrl?: string | null;
}

/** City-level mobility guide — shown between map and day cards on the itinerary. */
export interface CityTransportGuide {
  /** 1–2 sentences: how visitors usually move in this city */
  intro?: string | null;
  /** Typical single-ride fare (display string, e.g. "€3.40"). */
  priceSingle?: string | null;
  /** 24h / day pass band (display string). */
  priceDayPass?: string | null;
  /** 7-day pass band (display string). */
  priceWeekPass?: string | null;
  /** Primary official tickets / operator page for "Search tickets". */
  officialTicketsUrl?: string | null;
  /** Short tip: easiest way to pay (contactless, app, IC card…). */
  scoutTipPayment?: string | null;
  transportApp?: CityTransportApp | null;
  options: CityTransportOption[];
  links: CityTransportLink[];
}

export interface Itinerary {
  /** DB UUID from itineraries table — embedded post-save for targeted row-level swaps */
  _id?: string;
  strategicOverview?: string;
  destination: string;
  totalDays: number;
  basecamp?: Basecamp;
  budgetSummary?: {
    dailyAverage?: string;
    totalEstimate?: string;
    includes?: string;
  };
  /** Tips, typical prices, and ticket / transit links for the destination (AI-generated when supported). */
  cityTransport?: CityTransportGuide | null;
  days: DayPlan[];
  packingTips?: string[];
  bestLocalTips?: string[];
  _meta?: {
    searchEnabled: boolean;
    sourcesFound: number;
    hiddenGems?: number;
    trapsFiltered?: number;
    contradictionsFound?: number;
    provider?: string;      // 'gemini' | 'claude' | 'fallback' — written by generate route
    jitVerified?: number;   // activities checked by JIT Shield
    jitFlagged?: number;    // activities with closure/renovation signals
    isFallback?: boolean;   // true when itinerary was built without AI due to parse/validation failure
    fallbackReason?: string;
  };
}
