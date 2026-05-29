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
  // Recommendation-engine provenance (optional, additive JSON field)
  inventory_id?: string;
  inventory_source_table?: 'places' | 'restaurants';
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
