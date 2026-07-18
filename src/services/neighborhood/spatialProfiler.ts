/**
 * spatialProfiler — maps the day's generated POIs onto neighborhood polygons and
 * returns the dominant "Anchor Neighborhood" (PostGIS point-in-polygon via the
 * `dominant_neighborhood` RPC, which uses the GiST index on `boundary`).
 *
 * Returns null when the city has no neighborhoods loaded or no POI falls inside
 * one — the profiler degrades gracefully rather than inventing a neighborhood.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnchorNeighborhood, ProfilerPoi } from './types';

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function resolveAnchorNeighborhood(
  sb: SupabaseClient,
  city: string,
  pois: ProfilerPoi[],
): Promise<AnchorNeighborhood | null> {
  const points = pois
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({ lat: p.lat, lng: p.lng }));
  if (points.length === 0) return null;

  const { data, error } = await sb.rpc('dominant_neighborhood', {
    _city_normalized: normalizeCity(city),
    _points: points,
  });
  if (error) {
    console.warn('[neighborhood] dominant_neighborhood RPC failed:', error.message);
    return null;
  }
  const row = (data as any[] | null)?.[0];
  if (!row) return null;

  return {
    id: row.id,
    nameEnglish: row.name_english,
    nameHebrew: row.name_hebrew ?? null,
    matched: row.matched ?? 0,
    total: row.total ?? points.length,
    centroid: { lat: row.centroid_lat, lng: row.centroid_lng },
    boundaryGeoJson: row.boundary_geojson ?? null,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * "Match to your vibe" — a coherence + interest heuristic, 0–100. How tightly
 * the day clusters in one neighborhood (coverage) blended with how many of the
 * traveler's interests the POI categories touch. Deterministic + explainable.
 */
export function computeMatchPercent(
  neighborhood: AnchorNeighborhood,
  pois: ProfilerPoi[],
  interests: string[] = [],
): number {
  const coverage = neighborhood.total > 0 ? neighborhood.matched / neighborhood.total : 0;
  const wants = new Set(interests.map((i) => i.toLowerCase().trim()).filter(Boolean));
  const cats = pois.map((p) => (p.category ?? '').toLowerCase().trim()).filter(Boolean);
  const interestHit = wants.size === 0 || cats.length === 0
    ? 0.5
    : cats.filter((c) => [...wants].some((w) => c.includes(w) || w.includes(c))).length / cats.length;
  const raw = 0.7 * coverage + 0.3 * interestHit; // 0..1
  return Math.max(70, Math.min(99, Math.round(60 + 40 * raw)));
}
