import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') ?? 'travel landscape';
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

  // Picsum fallback — deterministic from query so same query = same image
  const seed = q.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 32);
  return NextResponse.json(
    {
      url: `https://picsum.photos/seed/${seed}/1200/500`,
      thumb: `https://picsum.photos/seed/${seed}/400/200`,
      credit: null,
      creditUrl: null,
      source: 'picsum',
    },
    { headers: { 'Cache-Control': 'public, s-maxage=86400' } }
  );
}
