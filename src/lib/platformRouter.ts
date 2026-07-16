/**
 * platformRouter — route each pick to the reservation platform that actually
 * covers its market (§9). No booking-API integration: we deep-link out, exactly
 * as the existing `reservation_url` field already does.
 *
 * Order of preference:
 *   1. A direct reservation_url the scout already found (always wins).
 *   2. The regional primary OTA (OpenTable / TheFork / Tabelog / Ontopo / Chope),
 *      with a genre nudge (tasting menus → Tock, trendy US urban → Resy).
 *   3. Google Reserve via the stored google_place_id — free coverage anywhere.
 *   4. The restaurant's own website.
 *
 * Pure function, no I/O — trivially unit-testable.
 */

import { SiteLanguage } from '@/lib/types';

export interface ResolvedPlatform {
  name: string;
  url: string;
  ctaLabel: string;
}

interface PlatformDef {
  name: string;
  /** Build a search/deep-link URL from the restaurant name + city. */
  search: (name: string, city: string) => string;
}

const q = (s: string) => encodeURIComponent(s);

const OPENTABLE: PlatformDef = {
  name: 'OpenTable',
  search: (n, c) => `https://www.opentable.com/s?term=${q(`${n} ${c}`)}`,
};
const RESY: PlatformDef = {
  name: 'Resy',
  search: (n, c) => `https://resy.com/cities/search?query=${q(`${n} ${c}`)}`,
};
const TOCK: PlatformDef = {
  name: 'Tock',
  search: (n) => `https://www.exploretock.com/search?query=${q(n)}`,
};
const THEFORK: PlatformDef = {
  name: 'TheFork',
  search: (n, c) => `https://www.thefork.com/search?cityName=${q(c)}&query=${q(n)}`,
};
const TABELOG: PlatformDef = {
  name: 'Tabelog',
  search: (n, c) => `https://tabelog.com/en/rstLst/?sw=${q(`${n} ${c}`)}`,
};
const ONTOPO: PlatformDef = {
  name: 'Ontopo',
  search: (n, c) => `https://ontopo.com/en/il/search?q=${q(`${n} ${c}`)}`,
};
const CHOPE: PlatformDef = {
  name: 'Chope',
  search: (n) => `https://www.chope.co/search?q=${q(n)}`,
};

const EUROPE = new Set([
  'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT', 'SE', 'DK', 'NO', 'FI',
  'IE', 'PL', 'CZ', 'GR', 'HR', 'HU', 'RO',
]);
const OPENTABLE_EUROPE = new Set(['GB', 'UK', 'DE']); // UK/Germany skew OpenTable
const SE_ASIA = new Set(['SG', 'TH', 'MY', 'ID', 'VN', 'PH', 'HK']);

/** Pick the regional primary platform, with a small genre nudge in the US. */
function primaryFor(countryCode: string | null | undefined, genre: string | null | undefined): PlatformDef {
  const cc = (countryCode ?? '').toUpperCase();

  if (cc === 'US' || cc === 'CA') {
    if (genre === 'fine-dining' || genre === 'omakase-counter') return TOCK; // tasting-menu home
    if (genre === 'izakaya-tapas' || genre === 'rooftop-view') return RESY;  // trendy urban
    return OPENTABLE;
  }
  if (cc === 'JP') return TABELOG;
  if (cc === 'IL') return ONTOPO;
  if (SE_ASIA.has(cc)) return CHOPE;
  if (OPENTABLE_EUROPE.has(cc)) return OPENTABLE;
  if (EUROPE.has(cc)) return THEFORK;
  return THEFORK; // reasonable global default OTA
}

const CTA: Record<SiteLanguage, (platform: string) => string> = {
  en: (p) => `Reserve on ${p}`,
  he: (p) => `הזמינו ב-${p}`,
};
const CTA_DIRECT: Record<SiteLanguage, string> = { en: 'Reserve', he: 'הזמינו מקום' };
const CTA_GOOGLE: Record<SiteLanguage, string> = { en: 'Reserve via Google', he: 'הזמינו דרך גוגל' };
const CTA_WEBSITE: Record<SiteLanguage, string> = { en: 'Visit website', he: 'לאתר המסעדה' };

export interface PlatformRouteInput {
  name: string;
  city: string;
  countryCode?: string | null;
  cuisineGenre?: string | null;
  reservationUrl?: string | null;
  websiteUrl?: string | null;
  googlePlaceId?: string | null;
  bookingPlatform?: string | null;
}

/**
 * Resolve the best reservation link + CTA for a restaurant in a given market.
 * Never returns null — worst case it points at the regional OTA search.
 */
export function routeReservation(input: PlatformRouteInput, lang: SiteLanguage = 'en'): ResolvedPlatform {
  const { name, city, countryCode, cuisineGenre, reservationUrl, websiteUrl, googlePlaceId } = input;

  // 1. A direct reservation link the scout already found always wins. Try to
  //    name it from the stored bookingPlatform hint; fall back to a generic CTA.
  if (reservationUrl && !isOtaSearchLink(reservationUrl)) {
    const named = input.bookingPlatform && input.bookingPlatform !== 'website' ? input.bookingPlatform : null;
    return {
      name: named ?? 'Reservation',
      url: reservationUrl,
      ctaLabel: named ? CTA[lang](named) : CTA_DIRECT[lang],
    };
  }

  // 2. Regional primary OTA.
  const primary = primaryFor(countryCode, cuisineGenre);

  // 3. Google Reserve fallback when we have no country signal but do have a
  //    verified place_id — free coverage that beats a blind OTA search.
  if (!countryCode && googlePlaceId) {
    return {
      name: 'Google',
      url: `https://www.google.com/maps/reserve/v/dine/c/${googlePlaceId}`,
      ctaLabel: CTA_GOOGLE[lang],
    };
  }

  // Prefer the regional OTA; if we truly have nothing but a website, use it.
  if (!countryCode && !googlePlaceId && websiteUrl) {
    return { name: 'Website', url: websiteUrl, ctaLabel: CTA_WEBSITE[lang] };
  }

  return {
    name: primary.name,
    url: primary.search(name, city),
    ctaLabel: CTA[lang](primary.name),
  };
}

/** A stored reservation_url that's itself just an OTA search (from the old
 *  guessReservationUrl fallback) should NOT short-circuit routing — re-route it. */
function isOtaSearchLink(url: string): boolean {
  return /thefork\.com\/search|opentable\.com\/s\?/.test(url);
}
