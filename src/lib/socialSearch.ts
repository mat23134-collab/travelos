// Build social-media search URLs for a place, so travellers can jump straight
// to short-form video/photo content about an attraction or restaurant.
//
// Desktop keeps the rich keyword-search URLs (they open the web search results).
// On mobile those same URLs are hijacked by the installed Instagram/TikTok app
// via universal links, which drops the query and dumps the user on an empty
// search screen. So on mobile we link to a hashtag/tag page instead — the apps
// route those straight to a populated feed about the place.

export type SocialSearchOpts = { mobile?: boolean };

/** Normalise a place + city into a clean search query. */
export function placeSearchQuery(name: string, city?: string | null): string {
  return [name, city].map((s) => (s ?? '').trim()).filter(Boolean).join(' ');
}

/** Place name → bare hashtag (alphanumerics only) for app deep-links. */
function toHashtag(name: string): string {
  return (name ?? '').normalize('NFKD').replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
}

/** TikTok search for a place (desktop) / tag feed (mobile app). */
export function tiktokSearchUrl(name: string, city?: string | null, opts?: SocialSearchOpts): string {
  if (opts?.mobile) {
    const tag = toHashtag(name);
    if (tag) return `https://www.tiktok.com/tag/${tag}`;
  }
  return `https://www.tiktok.com/search?q=${encodeURIComponent(placeSearchQuery(name, city))}`;
}

/** Instagram search for a place (desktop) / tag feed (mobile app). */
export function instagramSearchUrl(name: string, city?: string | null, opts?: SocialSearchOpts): string {
  if (opts?.mobile) {
    const tag = toHashtag(name);
    if (tag) return `https://www.instagram.com/explore/tags/${tag}/`;
  }
  return `https://www.instagram.com/explore/search/keyword/?q=${encodeURIComponent(placeSearchQuery(name, city))}`;
}
