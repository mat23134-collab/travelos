/**
 * Dynamic Neighborhood Profiler & Itinerary Explainer — orchestrator.
 *
 *   1. Spatial: map the day's POIs → dominant Anchor Neighborhood (PostGIS).
 *   2. Ground:  Tavily (facts) + Exa (semantic highlights), in parallel.
 *   3. Synthesize: Gemini → personalized, Hebrew-first guide.
 *
 * Returns null when no anchor neighborhood can be resolved (city not loaded, or
 * no POI inside any polygon) so the caller can hide the feature gracefully.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAnchorNeighborhood, computeMatchPercent } from './spatialProfiler';
import {
  fetchNeighborhoodFacts, fetchNeighborhoodHighlights, fetchCityFacts, fetchCityHighlights,
} from './contextSearch';
import { synthesizeGuide, synthesizeCityGuide } from './geminiOrchestrator';
import type { AnchorNeighborhood, NeighborhoodProfile, ProfilerPoi, ProfilerTripContext } from './types';

export * from './types';
export { resolveAnchorNeighborhood, computeMatchPercent } from './spatialProfiler';

export async function buildNeighborhoodProfile(
  sb: SupabaseClient,
  city: string,
  pois: ProfilerPoi[],
  trip: ProfilerTripContext = {},
): Promise<NeighborhoodProfile | null> {
  // 1. Spatial anchor.
  const neighborhood = await resolveAnchorNeighborhood(sb, city, pois);
  if (!neighborhood) return null;

  const name = neighborhood.nameEnglish;

  // 2. Real-world grounding (both providers in parallel, best-effort).
  const [facts, highlights] = await Promise.all([
    fetchNeighborhoodFacts(name, city).catch(() => ({ metroStations: [], walkabilityNotes: [], safetyNotes: [], sources: [] })),
    fetchNeighborhoodHighlights(name, city).catch(() => ({ localSecrets: [], honestDownsides: [], sources: [] })),
  ]);

  // 3. Synthesize the guide.
  const guide = await synthesizeGuide(neighborhood, pois, trip, facts, highlights);

  return {
    neighborhood,
    matchPercent: computeMatchPercent(neighborhood, pois, trip.interests ?? []),
    guide,
  };
}

/**
 * City-level guide for the results page — no PostGIS / polygon dependency, so it
 * works for EVERY city. Anchored on the city itself; reuses the same
 * Tavily + Exa + Gemini grounding, and the same NeighborhoodProfile shape so the
 * existing guide component renders it unchanged. matchPercent is 0 (no coverage
 * signal at city scope) → the component hides the "% match" badge.
 */
export async function buildCityProfile(
  city: string,
  pois: ProfilerPoi[],
  trip: ProfilerTripContext = {},
): Promise<NeighborhoodProfile | null> {
  const trimmed = city.trim();
  if (!trimmed) return null;

  const [facts, highlights] = await Promise.all([
    fetchCityFacts(trimmed).catch(() => ({ metroStations: [], walkabilityNotes: [], safetyNotes: [], sources: [] })),
    fetchCityHighlights(trimmed).catch(() => ({ localSecrets: [], honestDownsides: [], sources: [] })),
  ]);

  const guide = await synthesizeCityGuide(trimmed, pois, trip, facts, highlights);

  const anchor: AnchorNeighborhood = {
    id: `city:${trimmed.toLowerCase()}`,
    nameEnglish: trimmed,
    nameHebrew: null,
    matched: pois.length,
    total: pois.length,
    centroid: { lat: 0, lng: 0 },
    boundaryGeoJson: null,
  };

  return { neighborhood: anchor, matchPercent: 0, guide };
}
