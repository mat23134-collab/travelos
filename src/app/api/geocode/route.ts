/**
 * GET /api/geocode?q=<query>[&near=<city>][&limit=<n>]
 *
 * Server-side proxy for Nominatim (OpenStreetMap geocoding).
 * Keeps Nominatim off the client so:
 *   - CORS headers are never an issue
 *   - The User-Agent requirement is met server-side (Nominatim requires it)
 *   - Rate-limit surface is our server IP, not each visitor's browser
 *
 * When `near` (the trip city) is supplied, results are constrained to that
 * city's bounding box (`viewbox` + `bounded=1`) so a search like "hotel omega"
 * on an Amsterdam trip can't return a match in Brooklyn. Falls back to an
 * unbounded "<q>, <near>" search if the bounded pass finds nothing.
 */

import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT     = 'Sarto-Travel-App/1.0 (contact@sarto.app)';

type NominatimRow = {
  display_name: string;
  lat: string;
  lon: string;
  /** [lat_min, lat_max, lon_min, lon_max] as strings */
  boundingbox?: [string, string, string, string];
};

async function nominatim(params: string): Promise<NominatimRow[]> {
  const res = await fetch(`${NOMINATIM_BASE}?${params}`, {
    headers: {
      'User-Agent':      USER_AGENT,
      'Accept-Language': 'en',
      'Accept':          'application/json',
    },
    next: { revalidate: 3600 }, // cache identical queries for 1 hour
  });
  if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as NominatimRow[]) : [];
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  const near = req.nextUrl.searchParams.get('near')?.trim();
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') ?? '1', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 1, 1), 8);

  if (!q) {
    return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 });
  }

  try {
    // Resolve the trip city to a bounding box so we can scope the search to it.
    let viewbox: string | null = null;
    if (near) {
      const cityRows = await nominatim(`format=json&limit=1&q=${encodeURIComponent(near)}`);
      const bb = cityRows[0]?.boundingbox;
      if (bb && bb.length === 4) {
        const [latMin, latMax, lonMin, lonMax] = bb.map(Number);
        if ([latMin, latMax, lonMin, lonMax].every(Number.isFinite)) {
          // Nominatim viewbox order: lon_min,lat_min,lon_max,lat_max
          viewbox = `${lonMin},${latMin},${lonMax},${latMax}`;
        }
      }
    }

    const base = `format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(q)}`;
    let rows = await nominatim(viewbox ? `${base}&viewbox=${viewbox}&bounded=1` : base);

    // Bounded search came back empty (e.g. the property name isn't in OSM) —
    // retry unbounded but with the city appended so ranking still favors it.
    if (rows.length === 0 && near) {
      rows = await nominatim(
        `format=json&addressdetails=1&limit=${limit}&q=${encodeURIComponent(`${q}, ${near}`)}`,
      );
    }

    return NextResponse.json(rows, {
      headers: { 'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    console.error('[geocode] upstream error:', err);
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 503 });
  }
}
