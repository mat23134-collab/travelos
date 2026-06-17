// src/lib/pexels.ts
// Pexels image fetch + Supabase cache, per the TravelOS imagery spec.
import { createClient } from '@supabase/supabase-js';

export type ImageOrientation = 'landscape' | 'portrait' | 'square';

export interface DestinationImage {
  image_url: string;
  photographer: string | null;
  photographer_url: string | null;
}

interface PexelsPhoto {
  src?: {
    landscape?: string;
    portrait?: string;
    original?: string;
    [k: string]: string | undefined;
  };
  photographer?: string;
  photographer_url?: string;
}

/** Pure: map a Pexels photo object to our DestinationImage by orientation. */
export function mapPexelsPhoto(photo: PexelsPhoto, imageOrientation: ImageOrientation): DestinationImage | null {
  const src = photo?.src ?? {};
  const image_url =
    imageOrientation === 'portrait'
      ? (src.portrait ?? src.landscape ?? src.original)
      : (src.landscape ?? src.portrait ?? src.original);
  if (!image_url) return null;
  return {
    image_url,
    photographer: photo.photographer ?? null,
    photographer_url: photo.photographer_url ?? null,
  };
}

const PEXELS_ENDPOINT = 'https://api.pexels.com/v1/search';

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function fetchFromPexels(query: string, imageOrientation: ImageOrientation): Promise<DestinationImage | null> {
  const key = process.env.PEXELS_API_KEY;
  if (!key || key.includes('your_')) return null;

  const params = new URLSearchParams({
    query,
    orientation: imageOrientation,
    per_page: '1',
    size: 'medium',
  });

  try {
    const res = await fetch(`${PEXELS_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: key },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const photo = data?.photos?.[0];
    if (!photo) return null;
    return mapPexelsPhoto(photo, imageOrientation);
  } catch {
    return null;
  }
}

/**
 * Cache-first destination image. Checks the Supabase `destination_images`
 * table by (search_query, orientation); on a miss queries Pexels with the
 * primary `searchQuery` and then `fallbackQuery`, caches the result under the
 * original `searchQuery`, and returns it. Returns null if nothing was found.
 */
export async function getDestinationImage(args: {
  searchQuery: string;
  fallbackQuery?: string;
  imageOrientation?: ImageOrientation;
}): Promise<DestinationImage | null> {
  const searchQuery = args.searchQuery.trim();
  const fallbackQuery = args.fallbackQuery?.trim();
  const imageOrientation: ImageOrientation = args.imageOrientation ?? 'landscape';
  if (!searchQuery) return null;

  const db = dbClient();

  // 1. cache lookup
  try {
    const { data } = await db
      .from('destination_images')
      .select('image_url, photographer, photographer_url')
      .ilike('search_query', searchQuery)
      .eq('orientation', imageOrientation)
      .limit(1);
    const cachedImage = data?.[0];
    if (cachedImage?.image_url) return cachedImage as DestinationImage;
  } catch {
    // cache unavailable — fall through to a live fetch
  }

  // 2. Pexels: primary query, then fallback
  let result = await fetchFromPexels(searchQuery, imageOrientation);
  if (!result && fallbackQuery) {
    result = await fetchFromPexels(fallbackQuery, imageOrientation);
  }
  if (!result) return null;

  // 3. cache insert (best-effort, keyed by the original search query)
  try {
    await db.from('destination_images').insert({
      search_query: searchQuery,
      orientation: imageOrientation,
      image_url: result.image_url,
      photographer: result.photographer,
      photographer_url: result.photographer_url,
      source: 'pexels',
    });
  } catch {
    // duplicate / transient — the image is still returned
  }

  return result;
}
