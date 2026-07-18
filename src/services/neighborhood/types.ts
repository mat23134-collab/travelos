/**
 * Types for the Dynamic Neighborhood Profiler & Itinerary Explainer.
 * Shared across the spatial service, the Tavily/Exa/Gemini orchestrator, the API
 * route, and the React guide component.
 */

/** A generated point-of-interest from the day (attraction or restaurant). */
export interface ProfilerPoi {
  name: string;
  lat: number;
  lng: number;
  category?: string | null;
}

/** The compact trip context used to personalize the explanation. */
export interface ProfilerTripContext {
  interests?: string[];
  groupType?: string | null;
  budget?: string | null;
  pace?: string | null;
  /** 1-based day number, for the "why today" framing. */
  dayNumber?: number | null;
}

/** The day's dominant neighborhood, resolved by the PostGIS containment query. */
export interface AnchorNeighborhood {
  id: string;
  nameEnglish: string;
  nameHebrew: string | null;
  /** How many of the day's POIs fell inside this polygon. */
  matched: number;
  /** Total POIs considered. */
  total: number;
  centroid: { lat: number; lng: number };
  /** Polygon as a GeoJSON string, for the map to draw. */
  boundaryGeoJson: string | null;
}

/** Structured facts from Tavily (factual browser). */
export interface NeighborhoodFacts {
  metroStations: string[];
  walkabilityNotes: string[];
  safetyNotes: string[];
  sources: string[];
}

/** Semantic highlights from Exa's two targeted queries. */
export interface NeighborhoodHighlights {
  localSecrets: string[];
  honestDownsides: string[];
  sources: string[];
}

/** The Gemini-synthesized guide (Hebrew-first, per the product brief). */
export interface NeighborhoodGuideContent {
  name_hebrew: string;
  name_english: string;
  the_hook_hebrew: string;
  personal_relevance_hebrew: string;
  local_secrets_hebrew: string[];
  honest_downsides_hebrew: string[];
  commute_and_safety_hebrew: string;
}

/** The full API payload the frontend renders. */
export interface NeighborhoodProfile {
  neighborhood: AnchorNeighborhood;
  /** 0–100 "match to your vibe", from coverage + interest overlap. */
  matchPercent: number;
  guide: NeighborhoodGuideContent;
}
