export type GroupType = 'solo' | 'couple' | 'family' | 'group';

export interface HotelRecommendation {
  name: string;
  neighborhood: string;
  neighborhoodVibe: string;
  whyItFits: string;
  priceRange: string;
  neighborhoodInsight: string;
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
}

export interface DiningSpot {
  name?: string;
  cuisine?: string;
  priceRange?: string;
  mustTry?: string;
  neighborhood?: string;
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
  };
}
