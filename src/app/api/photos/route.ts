import { NextRequest, NextResponse } from 'next/server';
import { pickMoodUnsplashPair } from '@/lib/moodImageFallback';
import { getDestinationImage, type ImageOrientation } from '@/lib/pexels';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? 'travel landscape';
  const orientationParam = req.nextUrl.searchParams.get('orientation');
  const imageOrientation: ImageOrientation =
    orientationParam === 'portrait' || orientationParam === 'square' ? orientationParam : 'landscape';

  // ── Pexels first (cache → Pexels), per the TravelOS imagery spec ──────────
  try {
    const pexels = await getDestinationImage({ searchQuery: q, imageOrientation });
    if (pexels?.image_url) {
      return NextResponse.json(
        {
          url: pexels.image_url,
          thumb: pexels.image_url,
          credit: pexels.photographer,
          creditUrl: pexels.photographer_url,
          source: 'pexels',
        },
        { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } },
      );
    }
  } catch { /* fall through to Unsplash */ }

  const query = encodeURIComponent(q);
  const key = process.env.UNSPLASH_ACCESS_KEY;

  if (key && !key.includes('your_')) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${query}&per_page=1&orientation=landscape`,
        {
          headers: { Authorization: `Client-ID ${key}` },
          next: { revalidate: 3600 },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const photo = data.results?.[0];
        if (photo) {
          return NextResponse.json(
            {
              url: `${photo.urls.raw}&w=1200&h=500&fit=crop&auto=format&q=80`,
              thumb: `${photo.urls.raw}&w=400&h=200&fit=crop&auto=format&q=60`,
              credit: photo.user.name,
              creditUrl: `${photo.user.links.html}?utm_source=travelos&utm_medium=referral`,
              source: 'unsplash',
            },
            { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } }
          );
        }
      }
    } catch { /* fall through */ }
  }

  const seed = q.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 48) || 'travel';
  const { thumb, url } = pickMoodUnsplashPair(seed);
  return NextResponse.json(
    {
      url,
      thumb,
      credit: 'Unsplash',
      creditUrl: 'https://unsplash.com/?utm_source=travelos&utm_medium=referral',
      source: 'unsplash',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } }
  );
}
