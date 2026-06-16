/**
 * geo.ts — pure geometry helpers for the deterministic assembler.
 * No external APIs: distance is haversine over stored lat/lng.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in kilometres between two points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Rough walking time in minutes for a distance, assuming ~4.8 km/h. */
export function walkingMinutes(km: number): number {
  return Math.round((km / 4.8) * 60);
}

/** Centroid (mean lat/lng) of a set of points; null if empty. */
export function centroid(points: LatLng[]): LatLng | null {
  if (points.length === 0) return null;
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}

/**
 * Order a list of points into a short nearest-neighbour path starting from
 * `start`. Used to sequence a day's stops so the walk doesn't zig-zag.
 * Returns indices into `points` in visiting order.
 */
export function nearestNeighbourOrder(start: LatLng, points: LatLng[]): number[] {
  const remaining = points.map((_, i) => i);
  const order: number[] = [];
  let cursor = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let k = 0; k < remaining.length; k++) {
      const d = haversineKm(cursor, points[remaining[k]]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = k;
      }
    }
    const chosen = remaining.splice(bestIdx, 1)[0];
    order.push(chosen);
    cursor = points[chosen];
  }
  return order;
}
