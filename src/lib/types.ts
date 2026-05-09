export type GroupType = 'solo' | 'couple' | 'family' | 'group';

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
  /** Aggregate rating when grounded (typically 1–5 scale); omit when unknown */
  ratingStars?: number | null;
  ratingSource?: string | null;
  reviewCountHint?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Basecamp {
  type: 'booked' | 'recommendations';
  booked?: {
    name: string;
    neighborhood: string;
    neighborhoodInsight: string;
  };
  recommendations?: HotelRecommendation[];
}

export type BudgetLevel = 'budget' | 'mid-range' | 'luxury';
export type PaceLevel = 'relaxed' | 'moderate' | 'intense';
export type AccommodationType = 'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort';
export type InsightType = 'tip' | 'warning' | 'trend';
export type VibeLabel = 'hidden-gem' | 'local-favorite' | 'viral-trend' | 'classic' | 'luxury-pick' | 'budget-pick';
export type VibeScore = 'hidden-gem' | 'local-favorite' | 'viral-trend' | 'tourist-trap' | 'guided-tour' | 'unknown';

export interface TravelerProfile {
  destination: string;
  startDate: string;
  endDate: string;
  duration: number;
  groupType: GroupType;
  groupSize: number;
  budget: BudgetLevel;
  pace: PaceLevel;
  interests: string[];
  accommodation: AccommodationType;
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
  days: DayPlan[];
  packingTips?: string[];
  bestLocalTips?: string[];
  _meta?: {
    searchEnabled: boolean;
    sourcesFound: number;
    hiddenGems?: number;
    trapsFiltered?: number;
    contradictionsFound?: number;
    provider?: string;      // 'gemini' | 'claude' — written by generate route
    jitVerified?: number;   // activities checked by JIT Shield
    jitFlagged?: number;    // activities with closure/renovation signals
  };
}
