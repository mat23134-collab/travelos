// Build social-media search URLs for a place, so travellers can jump straight
// to short-form video/photo content about an attraction or restaurant.

/** Normalise a place + city into a clean search query. */
export function placeSearchQuery(name: string, city?: string | null): string {
  return [name, city].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
}

/** TikTok keyword search for a place. */
export function tiktokSearchUrl(name: string, city?: string | null): string {
  return `https://www.tiktok.com/search?q=${encodeURIComponent(placeSearchQuery(name, city))}`;
}

/** Instagram keyword search for a place. */
export function instagramSearchUrl(name: string, city?: string | null): string {
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(placeSearchQuery(name, city))}`;
}
