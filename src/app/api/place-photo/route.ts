import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/place-photo — server-side Google Places photo + website proxy.
 *
 * Keeps GOOGLE_PLACES_API_KEY server-side and returns:
 *   photoUrl — CDN URL (lh3.googleusercontent.com) or null
 *   website  — official website URL from Google Places or null
 *
 * GET ?name={place name}&city={city}
 * Returns: { photoUrl: string | null, website: string | null }
 */

const PLACES_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Module-level in-memory cache (lives for the lifetime of the server process).
// Prevents redundant API calls for the same place within a session.
interface CachedEntry { photoUrl: string | null; website: string | null }
const cache = new Map<string, CachedEntry>();

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get('name') ?? '').trim().slice(0, 100);
  const city = (req.nextUrl.searchParams.get('city') ?? '').trim().slice(0, 80);

  // Return null immediately when no API key or no name
  if (!PLACES_KEY || !name) {
    return NextResponse.json(
      { photoUrl: null, website: null },
      { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
    );
  }

  const cacheKey = `${name}|${city}`.toLowerCase();
  if (cache.has(cacheKey)) {
    return NextResponse.json(
      cache.get(cacheKey)!,
      { headers: { 'Cache-Control': 'public, s-maxage=86400' } },
    );
  }

  try {
    // ── Step 1: Find place and get photo_reference + website ───────────────
    const query     = encodeURIComponent(`${name}${city ? ` ${city}` : ''}`);
    const searchUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=photos,website&key=${PLACES_KEY}`;

    const searchRes  = await fetch(searchUrl, { next: { revalidate: 86400 } });
    if (!searchRes.ok) throw new Error(`Places search HTTP ${searchRes.status}`);

    const searchData = await searchRes.json();
    const candidate  = searchData.candidates?.[0];
    const photoRef   = candidate?.photos?.[0]?.photo_reference as string | undefined;
    const website    = (candidate?.website as string | undefined) ?? null;

    if (!photoRef) {
      const entry: CachedEntry = { photoUrl: null, website };
      cache.set(cacheKey, entry);
      return NextResponse.json(
        entry,
        { headers: { 'Cache-Control': 'public, s-maxage=3600' } },
      );
    }

    // ── Step 2: Follow redirect to extract CDN URL (key stays server-side) ─
    const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${PLACES_KEY}`;
    const photoRes    = await fetch(photoApiUrl, { redirect: 'manual' });
    const cdnUrl      = photoRes.headers.get('location') ?? null;

    const entry: CachedEntry = { photoUrl: cdnUrl, website };
    cache.set(cacheKey, entry);
    return NextResponse.json(
      entry,
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
    );
  } catch (err) {
    console.warn('[place-photo]', err instanceof Error ? err.message : err);
    const entry: CachedEntry = { photoUrl: null, website: null };
    cache.set(cacheKey, entry);
    return NextResponse.json(entry);
  }
}
