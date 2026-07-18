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
import { fetchNeighborhoodFacts, fetchNeighborhoodHighlights } from './contextSearch';
import { synthesizeGuide } from './geminiOrchestrator';
import type { NeighborhoodProfile, ProfilerPoi, ProfilerTripContext } from './types';

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
