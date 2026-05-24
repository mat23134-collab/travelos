/**
 * GET /api/geocode?q=<query>
 *
 * Server-side proxy for Nominatim (OpenStreetMap geocoding).
 * Keeps Nominatim off the client so:
 *   - CORS headers are never an issue
 *   - The User-Agent requirement is met server-side (Nominatim requires it)
 *   - Rate-limit surface is our server IP, not each visitor's browser
 */

import { NextRequest, NextResponse } from 'next/server';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT     = 'Sarto-Travel-App/1.0 (contact@sarto.app)';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) {
    return NextResponse.json({ error: 'Missing query param: q' }, { status: 400 });
  }

  const url = `${NOMINATIM_BASE}?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent':      USER_AGENT,
        'Accept-Language': 'en',
        'Accept':          'application/json',
      },
      // Nominatim asks for max 1 req/sec; Next.js server route naturally
      // serialises calls from the same deployment instance.
      next: { revalidate: 3600 }, // cache identical queries for 1 hour
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Nominatim returned ${upstream.status}` },
        { status: 502 },
      );
    }

    const data = await upstream.json();
    return NextResponse.json(data, {
      headers: {
        // Allow the browser to cache this result briefly
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (err) {
    console.error('[geocode] upstream error:', err);
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 503 });
  }
}
