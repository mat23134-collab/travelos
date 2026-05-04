import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/place-photo — server-side Google Places photo proxy.
 *
 * Keeps GOOGLE_PLACES_API_KEY server-side and returns a CDN URL
 * (lh3.googleusercontent.com redirect) that is safe to expose to clients.
 *
 * GET ?name={place name}&city={city}
 * Returns: { photoUrl: string | null }
 */

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Module-level in-memory cache (lives for the lifetime of the server process).
// Prevents redundant API calls for the same place within a session.
const cache = new Map<string, string | null>();

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get('name') ?? '').trim().slice(0, 100);
  const city = (req.nextUrl.searchParams.get('city') ?? '').trim().slice(0, 80);

  // Return null immediately when no API key or no name
  if (!PLACES_KEY || !name) {
    return NextResponse.json(
      { photoUrl: null },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
    );
  }

  const cacheKey = `${name}|${city}`.toLowerCase();
  if (cache.has(cacheKey)) {
    return NextResponse.json(
      { photoUrl: cache.get(cacheKey) ?? null },
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } },
    );
  }

  try {
    // ── Step 1: Find place and get photo_reference ─────────────────────────
    const query      = encodeURIComponent(`${name}${city ? ` ${city}` : ''}`);
    const searchUrl  = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos&key=${PLACES_KEY}`;

    const searchRes  = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!searchRes.ok) throw new Error(`Places search HTTP ${searchRes.status}`);

    const searchData = await searchRes.json();
    const photoRef   = searchData.candidates?.[0]?.photos?.[0]?.photo_reference as string | undefined;

    if (!photoRef) {
      cache.set(cacheKey, null);
      return NextResponse.json(
        { photoUrl: null },
        { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
      );
    }

    // ── Step 2: Follow redirect to extract CDN URL (key stays server-side) ─
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${PLACES_KEY}`;
    const photoRes    = await fetch(photoApiUrl, { redirect: 'manual' });
    const cdnUrl      = photoRes.headers.get('location') ?? null;

    cache.set(cacheKey, cdnUrl);
    return NextResponse.json(
      { photoUrl: cdnUrl },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (err) {
    console.warn('[place-photo]', err instanceof Error ? err.message : err);
    cache.set(cacheKey, null);
    return NextResponse.json({ photoUrl: null });
  }
}
