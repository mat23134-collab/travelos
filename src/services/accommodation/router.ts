import type { AccommodationType, BudgetLevel, HotelNightlyBudget, TravelerProfile } from '@/lib/types';
import { searchExaOnly } from '@/lib/rag';

export type AccommodationProviderId = 'booking' | 'priceline' | 'agoda' | 'airbnb';
/** Includes the synthetic 'exa' web-fallback provider used when no live API returned hotels. */
export type AccommodationProviderIdOrExa = AccommodationProviderId | 'exa';

export type AccommodationEnv = Partial<Record<
  | 'RAPIDAPI_KEY'
  | 'RAPIDAPI_BOOKING_KEY'
  | 'RAPIDAPI_BOOKING_HOST'
  | 'RAPIDAPI_BOOKING_SEARCH_PATH'
  | 'RAPIDAPI_PRICELINE_KEY'
  | 'RAPIDAPI_PRICELINE_HOST'
  | 'RAPIDAPI_PRICELINE_SEARCH_PATH'
  | 'RAPIDAPI_AGODA_KEY'
  | 'RAPIDAPI_AGODA_HOST'
  | 'RAPIDAPI_AGODA_SEARCH_PATH'
  | 'RAPIDAPI_AIRBNB_KEY'
  | 'RAPIDAPI_AIRBNB_HOST'
  | 'RAPIDAPI_AIRBNB_SEARCH_PATH',
  string | undefined
>>;

export interface Hotel {
  id: string;
  provider: AccommodationProviderId;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  nightlyRate?: { amount: number; currency?: string | null } | null;
  rating?: number | null;
  bookingUrl?: string | null;
  imageUrl?: string | null;
  available?: boolean | null;
  raw?: unknown;
}

export interface AccommodationSearchInput {
  destination: string;
  lat?: number | null;
  lng?: number | null;
  radiusKm?: number;
  startDate?: string;
  endDate?: string;
  adults?: number;
  accommodation?: AccommodationType | string | null;
  budget?: BudgetLevel | string | null;
  hotelNightlyBudget?: HotelNightlyBudget | string | null;
}

export interface AccommodationSearchResult {
  /** Wins-the-race provider id, including the synthetic 'exa' web fallback. null = nothing succeeded. */
  provider: AccommodationProviderIdOrExa | null;
  /** Structured hotel rows from a RapidAPI provider. Empty when only the Exa web fallback ran. */
  hotels: Hotel[];
  /**
   * Plain-text hotel research snippets (Exa fallback) that the LLM can mine to invent
   * named recommendations when no live inventory is available. Populated only when
   * provider === 'exa'.
   */
  webContext?: string;
  attempts: Array<{ provider: AccommodationProviderIdOrExa; ok: boolean; reason?: string }>;
  fallback: boolean;
}

type ProviderConfig = {
  id: AccommodationProviderId;
  hostEnv: keyof AccommodationEnv;
  keyEnv: keyof AccommodationEnv;
  pathEnv: keyof AccommodationEnv;
  defaultPath: string;
};

const PROVIDERS: Record<AccommodationProviderId, ProviderConfig> = {
  booking: {
    id: 'booking',
    hostEnv: 'RAPIDAPI_BOOKING_HOST',
    keyEnv: 'RAPIDAPI_BOOKING_KEY',
    pathEnv: 'RAPIDAPI_BOOKING_SEARCH_PATH',
    defaultPath: '/v1/hotels/search-by-coordinates',
  },
  priceline: {
    id: 'priceline',
    hostEnv: 'RAPIDAPI_PRICELINE_HOST',
    keyEnv: 'RAPIDAPI_PRICELINE_KEY',
    pathEnv: 'RAPIDAPI_PRICELINE_SEARCH_PATH',
    defaultPath: '/v1/hotels/search-by-coordinates',
  },
  agoda: {
    id: 'agoda',
    hostEnv: 'RAPIDAPI_AGODA_HOST',
    keyEnv: 'RAPIDAPI_AGODA_KEY',
    pathEnv: 'RAPIDAPI_AGODA_SEARCH_PATH',
    defaultPath: '/hotels/search-overnight',
  },
  airbnb: {
    id: 'airbnb',
    hostEnv: 'RAPIDAPI_AIRBNB_HOST',
    keyEnv: 'RAPIDAPI_AIRBNB_KEY',
    pathEnv: 'RAPIDAPI_AIRBNB_SEARCH_PATH',
    defaultPath: '/search',
  },
};

function cleanHost(raw?: string): string {
  return (raw ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function ensurePath(raw?: string): string {
  const path = (raw ?? '').trim();
  if (!path) return '';
  return path.startsWith('/') ? path : `/${path}`;
}

function toNum(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value.trim().replace(',', '.'));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function readPath(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const segment of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

function pickNestedString(obj: Record<string, unknown>, paths: string[][]): string | null {
  for (const path of paths) {
    const value = readPath(obj, path);
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return null;
}

function pickNestedNum(obj: Record<string, unknown>, paths: string[][]): number | null {
  for (const path of paths) {
    const value = readPath(obj, path);
    const n = toNum(value);
    if (n != null) return n;
  }
  return null;
}

function extractRawHotels(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Record<string, unknown>;
  // Airbnb RapidAPI variants put listings under results/searchResults; hotels
  // under hotels/properties. Check the common shapes top-level and one deep.
  for (const key of ['hotels', 'results', 'searchResults', 'data', 'properties', 'listings', 'items', 'list']) {
    const value = obj[key];
    if (Array.isArray(value)) return value;
  }
  const nested =
    readPath(obj, ['data', 'hotels']) ??
    readPath(obj, ['data', 'results']) ??
    readPath(obj, ['data', 'properties']) ??
    readPath(obj, ['data', 'list']) ??
    readPath(obj, ['data', 'dtssearchresults']);
  return Array.isArray(nested) ? nested : [];
}

export function normalizeAccommodationHotel(raw: unknown, provider: AccommodationProviderId): Hotel | null {
  if (!raw || typeof raw !== 'object') return null;
  const top = raw as Record<string, unknown>;
  // Airbnb-style payloads nest the venue under `listing` and pricing as a
  // sibling. Merge the listing fields up so the field-pickers below find the
  // name/coords, while top-level pricing keys still win.
  const listing = top.listing && typeof top.listing === 'object' ? (top.listing as Record<string, unknown>) : null;
  const obj: Record<string, unknown> = listing ? { ...listing, ...top } : top;

  const rawId = pickString(obj, [
    'id', 'hotel_id', 'hotelId', 'propertyId', 'property_id', 'listingId', 'listing_id',
  ]);
  const name = pickString(obj, [
    'name', 'hotel_name', 'hotelName', 'propertyName', 'property_name', 'title',
  ]);
  if (!name) return null;

  const lat = pickNestedNum(obj, [
    ['location', 'latitude'], ['location', 'lat'], ['coordinates', 'latitude'], ['coordinates', 'lat'], ['geo', 'lat'], ['latitude'], ['lat'],
  ]);
  const lng = pickNestedNum(obj, [
    ['location', 'longitude'], ['location', 'lng'], ['coordinates', 'longitude'], ['coordinates', 'lng'], ['geo', 'lng'], ['longitude'], ['lng'], ['lon'],
  ]);
  const amount = pickNestedNum(obj, [
    ['priceBreakdown', 'grossPrice', 'value'], ['priceBreakdown', 'price', 'value'],
    ['rate', 'amount'], ['nightlyRate', 'amount'], ['price', 'amount'], ['price'],
    // Airbnb pricing shapes
    ['pricingQuote', 'rate', 'amount'], ['pricing_quote', 'rate', 'amount'],
    ['pricingQuote', 'price', 'total', 'amount'], ['price', 'rate', 'amount'],
    ['structuredDisplayPrice', 'primaryLine', 'price'],
  ]);
  const currency = pickNestedString(obj, [
    ['priceBreakdown', 'grossPrice', 'currency'], ['priceBreakdown', 'price', 'currency'],
    ['rate', 'currency'], ['nightlyRate', 'currency'], ['currency'],
    ['pricingQuote', 'rate', 'currency'], ['pricing_quote', 'rate', 'currency'],
  ]);

  const rawAvailable =
    obj.available ?? obj.isAvailable ?? obj.availability ?? obj.hasAvailability ?? obj.is_available;
  const available = typeof rawAvailable === 'boolean'
    ? rawAvailable
    : typeof rawAvailable === 'string'
      ? !['false', 'sold out', 'sold-out', 'unavailable', 'no availability'].includes(rawAvailable.trim().toLowerCase())
      : null;

  return {
    id: `${provider}-${rawId ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    provider,
    name,
    address:
      pickNestedString(obj, [['address', 'addressLine1'], ['address', 'line1'], ['address', 'street']]) ??
      pickString(obj, ['address', 'address_line', 'neighborhood', 'cityName', 'city']),
    lat,
    lng,
    nightlyRate: amount != null ? { amount, currency } : null,
    rating: pickNestedNum(obj, [['reviewScore'], ['review_score'], ['rating'], ['stars'], ['score']]),
    bookingUrl: pickString(obj, ['url', 'bookingUrl', 'booking_url', 'deepLink', 'deeplink', 'propertyUrl', 'webUrl']),
    imageUrl:
      pickNestedString(obj, [['photo', 'url'], ['image', 'url'], ['thumbnail', 'url']]) ??
      pickString(obj, ['imageUrl', 'image_url', 'photoUrl', 'photo_url', 'thumbnailUrl']),
    available,
    raw,
  };
}

export function buildAccommodationProviderOrder(input: Pick<AccommodationSearchInput, 'accommodation' | 'budget'>): AccommodationProviderId[] {
  const accommodation = String(input.accommodation ?? '').toLowerCase();
  const airbnbIntent =
    accommodation.includes('airbnb') ||
    accommodation.includes('apartment') ||
    accommodation.includes('villa') ||
    accommodation.includes('local') ||
    accommodation.includes('unique');

  if (airbnbIntent) return ['airbnb', 'priceline', 'agoda', 'booking'];
  return ['booking', 'priceline', 'agoda', 'airbnb'];
}

function buildProviderUrl(config: ProviderConfig, input: AccommodationSearchInput, env: AccommodationEnv): URL | null {
  const host = cleanHost(env[config.hostEnv]);
  if (!host) return null;
  const path = ensurePath(env[config.pathEnv]) || config.defaultPath;
  const url = new URL(`https://${host}${path}`);

  url.searchParams.set('destination', input.destination);
  if (input.lat != null) url.searchParams.set('lat', String(input.lat));
  if (input.lng != null) url.searchParams.set('lng', String(input.lng));
  if (input.radiusKm != null) url.searchParams.set('radius', String(input.radiusKm));
  if (input.startDate) {
    url.searchParams.set('checkin', input.startDate.slice(0, 10));
    url.searchParams.set('checkIn', input.startDate.slice(0, 10));
    url.searchParams.set('startDate', input.startDate.slice(0, 10));
  }
  if (input.endDate) {
    url.searchParams.set('checkout', input.endDate.slice(0, 10));
    url.searchParams.set('checkOut', input.endDate.slice(0, 10));
    url.searchParams.set('endDate', input.endDate.slice(0, 10));
  }
  url.searchParams.set('adults', String(input.adults && input.adults > 0 ? input.adults : 2));
  url.searchParams.set('rooms', '1');
  return url;
}

// ─── Booking.com driver (host: booking-com.p.rapidapi.com, by Tipsters) ──────
// Real 2-step contract: resolve a dest_id from the city name, then search
// hotels by that id + dates. Replaces the generic 1-shot path for booking.

type Json = Record<string, unknown>;

async function fetchRapidJson(
  url: URL,
  key: string,
  host: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.status === 429) throw new Error(`quota exceeded (429) from ${url.host}`);
    if (!res.ok) throw new Error(`request failed (${res.status}) from ${url.host}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Default to a near-future 2-night window when the traveler skipped dates. */
function resolveStayDates(start?: string, end?: string): { checkin: string; checkout: string } {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const ci = start?.slice(0, 10);
  const co = end?.slice(0, 10);
  if (ci && co && ci < co) return { checkin: ci, checkout: co };
  const base = new Date();
  base.setDate(base.getDate() + 30);
  const out = new Date(base);
  out.setDate(out.getDate() + 2);
  return { checkin: fmt(base), checkout: fmt(out) };
}

function nightsBetween(checkin: string, checkout: string): number {
  const a = new Date(checkin).getTime();
  const b = new Date(checkout).getTime();
  const n = Math.round((b - a) / 86_400_000);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function normalizeTipstersHotel(raw: unknown, nights: number, provider: AccommodationProviderId): Hotel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Json;
  const name = pickString(r, ['hotel_name', 'hotel_name_trans', 'name']);
  if (!name) return null;

  const perNight = pickNestedNum(r, [
    ['composite_price_breakdown', 'gross_amount_per_night', 'value'],
  ]);
  const total = pickNestedNum(r, [
    ['min_total_price'],
    ['composite_price_breakdown', 'gross_amount', 'value'],
    ['composite_price_breakdown', 'all_inclusive_amount', 'value'],
    ['price_breakdown', 'gross_price'],
  ]);
  const amount = perNight ?? (total != null ? Math.round(total / nights) : null);
  const currency = pickNestedString(r, [
    ['composite_price_breakdown', 'gross_amount', 'currency'],
    ['composite_price_breakdown', 'gross_amount_per_night', 'currency'],
    ['currencycode'], ['currency_code'], ['currency'],
  ]);

  const rawId = pickString(r, ['hotel_id', 'id']);
  return {
    id: `${provider}-${rawId ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    provider,
    name,
    address:
      pickString(r, ['address', 'address_trans', 'district', 'city_trans', 'city', 'city_name_en']) ?? null,
    lat: pickNestedNum(r, [['latitude'], ['lat']]),
    lng: pickNestedNum(r, [['longitude'], ['lng'], ['lon']]),
    nightlyRate: amount != null ? { amount, currency } : null,
    rating: pickNestedNum(r, [['review_score'], ['rating']]),
    bookingUrl: pickString(r, ['url', 'hotel_url']),
    imageUrl: pickString(r, ['main_photo_url', 'max_photo_url', 'max_1440_photo_url']),
    available: true,
    raw,
  };
}

/**
 * Shared 2-step driver for Tipsters CO hotel APIs (Booking + Priceline) — they
 * expose the identical /v1/hotels/locations → /v1/hotels/search contract.
 */
async function tipstersHotelSearch(
  provider: 'booking' | 'priceline',
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  const hostEnv = provider === 'booking' ? options.env.RAPIDAPI_BOOKING_HOST : options.env.RAPIDAPI_PRICELINE_HOST;
  const keyEnv = provider === 'booking' ? options.env.RAPIDAPI_BOOKING_KEY : options.env.RAPIDAPI_PRICELINE_KEY;
  const defaultHost = provider === 'booking' ? 'booking-com.p.rapidapi.com' : 'priceline-com-provider.p.rapidapi.com';
  const host = cleanHost(hostEnv) || defaultHost;
  const key = keyEnv || options.env.RAPIDAPI_KEY;
  if (!key) throw new Error(`${provider} RapidAPI key missing`);

  const locale = 'en-gb';
  const currency = 'USD';

  // Step 1 — resolve dest_id from the destination name.
  const locUrl = new URL(`https://${host}/v1/hotels/locations`);
  locUrl.searchParams.set('name', input.destination);
  locUrl.searchParams.set('locale', locale);
  const locRaw = await fetchRapidJson(locUrl, key, host, options.fetchImpl, options.timeoutMs);
  const locArr = Array.isArray(locRaw) ? (locRaw as Json[]) : [];
  const cityLoc =
    locArr.find((l) => String(l?.dest_type) === 'city') ??
    locArr.find((l) => l?.dest_id != null) ??
    null;
  const destId = cityLoc?.dest_id;
  if (destId == null) throw new Error(`${provider}: no dest_id for "${input.destination}"`);

  // Step 2 — hotel search by dest_id + dates.
  const { checkin, checkout } = resolveStayDates(input.startDate, input.endDate);
  const nights = nightsBetween(checkin, checkout);
  const searchUrl = new URL(`https://${host}/v1/hotels/search`);
  searchUrl.searchParams.set('dest_id', String(destId));
  searchUrl.searchParams.set('dest_type', String(cityLoc?.dest_type ?? 'city'));
  searchUrl.searchParams.set('checkin_date', checkin);
  searchUrl.searchParams.set('checkout_date', checkout);
  searchUrl.searchParams.set('adults_number', String(input.adults && input.adults > 0 ? input.adults : 2));
  searchUrl.searchParams.set('room_number', '1');
  searchUrl.searchParams.set('order_by', 'popularity');
  searchUrl.searchParams.set('filter_by_currency', currency);
  searchUrl.searchParams.set('locale', locale);
  searchUrl.searchParams.set('units', 'metric');
  searchUrl.searchParams.set('page_number', '0');

  const dataRaw = await fetchRapidJson(searchUrl, key, host, options.fetchImpl, options.timeoutMs);
  const data = (dataRaw ?? {}) as Json;
  const results = Array.isArray(data.result) ? (data.result as unknown[]) : [];
  const hotels = results
    .map((r) => normalizeTipstersHotel(r, nights, provider))
    .filter((h): h is Hotel => h !== null);
  if (hotels.length === 0) throw new Error(`${provider} returned empty results`);
  return hotels;
}

// ─── Agoda driver (host: agoda-com.p.rapidapi.com) ────────────────────────────
// Real 2-step contract: resolve a location objectId from the city name via
// /hotels/search-location, then call /hotels/search-overnight with that id.

function extractAgodaHotels(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const obj = payload as Json;
  // Try the known Agoda nested shapes, deepest first.
  const nested =
    readPath(obj, ['data', 'body', 'searchResult', 'properties']) ??
    readPath(obj, ['data', 'searchResult', 'properties']) ??
    readPath(obj, ['data', 'hotels']) ??
    readPath(obj, ['result', 'hotels']) ??
    readPath(obj, ['data', 'results']) ??
    readPath(obj, ['hotels']) ??
    readPath(obj, ['data']);
  return Array.isArray(nested) ? nested : [];
}

function normalizeAgodaHotel(raw: unknown, nights: number): Hotel | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Json;

  // Deep nesting: content.informationSummary.{localeName|name}
  const content = r.content && typeof r.content === 'object' ? (r.content as Json) : null;
  const infoSummary = content?.informationSummary && typeof content.informationSummary === 'object'
    ? (content.informationSummary as Json) : null;
  const geo = content?.localizedGeography && typeof content.localizedGeography === 'object'
    ? (content.localizedGeography as Json) : null;

  const name =
    (infoSummary ? pickString(infoSummary, ['localeName', 'name', 'hotelName']) : null) ??
    pickString(r, ['name', 'hotelName', 'hotel_name', 'propertyName', 'title']);
  if (!name) return null;

  const rawId = pickString(r, ['propertyId', 'id', 'hotelId', 'hotel_id']);

  // Coordinates from deep geo object or flat fields.
  const lat = (geo ? toNum(geo.latitude ?? geo.lat) : null)
    ?? pickNestedNum(r, [['latitude'], ['lat']]);
  const lng = (geo ? toNum(geo.longitude ?? geo.lon ?? geo.lng) : null)
    ?? pickNestedNum(r, [['longitude'], ['lng'], ['lon']]);

  // Pricing: try the Agoda offers array first (complex), then simple fields.
  let amount: number | null = null;
  let currency: string | null = null;

  const pricing = r.pricing && typeof r.pricing === 'object' ? (r.pricing as Json) : null;
  if (pricing) {
    const offers = Array.isArray(pricing.offers) ? (pricing.offers as Json[]) : [];
    const firstOffer = offers[0] && typeof offers[0] === 'object' ? (offers[0] as Json) : null;
    if (firstOffer) {
      const roomOffers = Array.isArray(firstOffer.roomOffers) ? (firstOffer.roomOffers as Json[]) : [];
      const firstRoom = roomOffers[0] && typeof roomOffers[0] === 'object'
        ? ((roomOffers[0] as Json).room as Json) : null;
      if (firstRoom && typeof firstRoom === 'object') {
        const rp = firstRoom.pricing as Json | undefined;
        if (rp) {
          amount = pickNestedNum(rp as Record<string, unknown>, [
            ['price', 'perRoomPerNight', 'exclusive', 'display'],
            ['price', 'perRoomPerNight', 'inclusive', 'display'],
            ['price', 'perNight', 'value'],
          ]);
          currency = pickString(rp as Record<string, unknown>, ['currency', 'currencyCode']) ?? null;
        }
      }
    }
    // Simpler pricing sub-shapes
    if (amount == null) {
      amount = pickNestedNum(pricing as Record<string, unknown>, [
        ['displayPrice', 'perNight', 'value'],
        ['displayPrice', 'value'],
        ['price'],
      ]);
      currency = currency ?? pickString(pricing as Record<string, unknown>, ['currency', 'currencyCode']) ?? null;
    }
  }

  // Top-level simple fields
  if (amount == null) {
    amount = pickNestedNum(r, [['price'], ['rate', 'amount'], ['nightlyRate', 'amount']]);
    currency = currency ?? pickString(r, ['currency', 'currencyCode']) ?? null;
  }

  // Total price → divide by nights
  if (amount == null) {
    const total = pickNestedNum(r, [['totalPrice'], ['total'], ['totalRate']]);
    if (total != null && nights > 0) {
      amount = Math.round(total / nights);
    }
  }

  const rating = pickNestedNum(r, [
    ['reviewScore'], ['review_score'], ['rating'], ['score'],
    ['content', 'propertyEngagement', 'score'],
    ['reviewInfo', 'score'],
  ]);

  return {
    id: `agoda-${rawId ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    provider: 'agoda',
    name,
    address:
      pickNestedString(r, [
        ['content', 'informationSummary', 'address', 'city', 'name'],
        ['content', 'informationSummary', 'address', 'fullAddress'],
        ['address', 'cityName'],
        ['address', 'city', 'name'],
      ]) ??
      pickString(r, ['address', 'cityName', 'city', 'neighborhood', 'district']) ?? null,
    lat,
    lng,
    nightlyRate: amount != null ? { amount, currency } : null,
    rating,
    bookingUrl: pickString(r, ['deepLink', 'deeplink', 'url', 'propertyUrl', 'hotelUrl', 'booking_url']) ?? null,
    imageUrl:
      pickNestedString(r, [['content', 'images', 'hotelImages', '0', 'url']]) ??
      pickString(r, ['imageUrl', 'image_url', 'photoUrl', 'thumbnail']) ?? null,
    available: true,
    raw,
  };
}

/**
 * Agoda 2-step driver:
 *   1. GET /hotels/search-location?query=<city>  → resolve objectId
 *   2. GET /hotels/search-overnight?id=<objectId>&checkIn=…&checkOut=…
 */
async function agodaHotelSearch(
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  const host = cleanHost(options.env.RAPIDAPI_AGODA_HOST) || 'agoda-com.p.rapidapi.com';
  const key = options.env.RAPIDAPI_AGODA_KEY || options.env.RAPIDAPI_KEY;
  if (!key) throw new Error('agoda RapidAPI key missing');

  const { checkin, checkout } = resolveStayDates(input.startDate, input.endDate);
  const nights = nightsBetween(checkin, checkout);
  const adults = input.adults && input.adults > 0 ? input.adults : 2;

  // Step 1 — resolve Agoda location objectId from the city name.
  const locUrl = new URL(`https://${host}/hotels/search-location`);
  locUrl.searchParams.set('query', input.destination);
  locUrl.searchParams.set('language', 'en-us');

  const locRaw = await fetchRapidJson(locUrl, key, host, options.fetchImpl, options.timeoutMs);

  // Response may be an array or { data: [...] }
  const locArr: Json[] = Array.isArray(locRaw)
    ? (locRaw as Json[])
    : Array.isArray((locRaw as Json)?.data)
      ? ((locRaw as Json).data as Json[])
      : [];

  const cityLoc =
    locArr.find((l) => String(l?.type ?? '').toLowerCase().includes('city')) ??
    locArr[0] ??
    null;

  const locationId = cityLoc
    ? pickString(cityLoc as Record<string, unknown>, ['objectId', 'id', 'cityId', 'locationId'])
    : null;
  if (!locationId) throw new Error(`agoda: no location ID for "${input.destination}"`);

  // Step 2 — hotel search by location ID + dates.
  const searchUrl = new URL(`https://${host}/hotels/search-overnight`);
  searchUrl.searchParams.set('id', locationId);
  searchUrl.searchParams.set('checkIn', checkin);
  searchUrl.searchParams.set('checkOut', checkout);
  searchUrl.searchParams.set('adults', String(adults));
  searchUrl.searchParams.set('rooms', '1');
  searchUrl.searchParams.set('currency', 'USD');
  searchUrl.searchParams.set('language', 'en-us');

  const dataRaw = await fetchRapidJson(searchUrl, key, host, options.fetchImpl, options.timeoutMs);
  const rawHotels = extractAgodaHotels(dataRaw);

  const hotels = rawHotels
    .map((r) => normalizeAgodaHotel(r, nights))
    .filter((h): h is Hotel => h !== null);

  if (hotels.length === 0) throw new Error('agoda returned empty results');
  return hotels;
}

// ─── Airbnb driver (host: homes-experiences-services-data.p.rapidapi.com) ─────
// 1-step search: POST city name directly as `query` — no location lookup needed.
// The generic normalizeAccommodationHotel already handles the Airbnb
// listing{} + pricingQuote merge, so we reuse it here.

async function airbnbHotelSearch(
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  const host = cleanHost(options.env.RAPIDAPI_AIRBNB_HOST) || 'homes-experiences-services-data.p.rapidapi.com';
  const key = options.env.RAPIDAPI_AIRBNB_KEY || options.env.RAPIDAPI_KEY;
  if (!key) throw new Error('airbnb RapidAPI key missing');

  const searchPath = ensurePath(options.env.RAPIDAPI_AIRBNB_SEARCH_PATH) || '/homes/search-by-query';
  const { checkin, checkout } = resolveStayDates(input.startDate, input.endDate);
  const adults = input.adults && input.adults > 0 ? input.adults : 2;

  const url = new URL(`https://${host}${searchPath}`);
  url.searchParams.set('query', input.destination);
  url.searchParams.set('checkin', checkin);
  url.searchParams.set('checkout', checkout);
  url.searchParams.set('adults', String(adults));
  url.searchParams.set('currency', 'USD');
  url.searchParams.set('locale', 'en');
  url.searchParams.set('page', '1');

  const dataRaw = await fetchRapidJson(url, key, host, options.fetchImpl, options.timeoutMs);

  // extractRawHotels covers searchResults / listings / results / data arrays.
  // normalizeAccommodationHotel merges listing{} up and picks pricingQuote.rate.amount.
  const hotels = extractRawHotels(dataRaw)
    .map((item) => normalizeAccommodationHotel(item, 'airbnb'))
    .filter((h): h is Hotel => h !== null);

  if (hotels.length === 0) throw new Error('airbnb returned empty results');
  return hotels;
}

async function fetchProvider(
  provider: AccommodationProviderId,
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  if (provider === 'booking' || provider === 'priceline') {
    return tipstersHotelSearch(provider, input, options);
  }
  if (provider === 'agoda') {
    return agodaHotelSearch(input, options);
  }
  if (provider === 'airbnb') {
    return airbnbHotelSearch(input, options);
  }
  // Unreachable — all AccommodationProviderId values are handled above.
  throw new Error(`unknown provider: ${provider as string}`);
}

type SearchOptions = {
  env?: AccommodationEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  providerOrder?: AccommodationProviderId[];
  /** Skip the Exa web fallback after all RapidAPI providers fail (used in tests). */
  skipExaFallback?: boolean;
};

export async function searchAccommodations(
  input: AccommodationSearchInput,
  options: SearchOptions = {},
): Promise<AccommodationSearchResult> {
  const env: AccommodationEnv = options.env ?? (process.env as AccommodationEnv);
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 8000;
  const order = options.providerOrder ?? buildAccommodationProviderOrder(input);
  const attempts: AccommodationSearchResult['attempts'] = [];

  for (const provider of order) {
    try {
      const hotels = await fetchProvider(provider, input, { env, fetchImpl, timeoutMs });
      attempts.push({ provider, ok: true });
      return { provider, hotels, attempts, fallback: attempts.length > 1 };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempts.push({ provider, ok: false, reason });
      console.warn(`[accommodation] ${provider} failed, trying next provider: ${reason}`);
    }
  }

  // ── Exa web fallback ────────────────────────────────────────────────────────
  // All RapidAPI providers exhausted (or unconfigured). Mine Exa for hotel
  // research snippets so the LLM can still invent grounded recommendations.
  if (!options.skipExaFallback) {
    try {
      const webContext = await searchHotelsViaExa(input);
      if (webContext && webContext.trim().length > 0) {
        attempts.push({ provider: 'exa', ok: true });
        console.log('[accommodation] Exa web fallback returned hotel research snippets');
        return { provider: 'exa', hotels: [], webContext, attempts, fallback: true };
      }
      attempts.push({ provider: 'exa', ok: false, reason: 'no snippets returned' });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      attempts.push({ provider: 'exa', ok: false, reason });
      console.warn(`[accommodation] Exa fallback failed: ${reason}`);
    }
  }

  return { provider: null, hotels: [], attempts, fallback: true };
}

// ─── Exa web fallback for hotel research ──────────────────────────────────────

/**
 * When live hotel APIs are unavailable, mine Exa for editorial / blog roundups
 * of hotels in the destination. The output is a plain-text block ready to be
 * passed to the LLM as HOTEL_SEARCH_DATA — the existing prompt already knows
 * how to extract names, neighborhoods, and indicative price bands from it.
 *
 * Exa "neural" search is well suited to this: it surfaces editorial sources
 * like CN Traveler, Time Out, Lonely Planet, and Booking.com curated roundups.
 */
export async function searchHotelsViaExa(input: AccommodationSearchInput): Promise<string> {
  const dest = input.destination?.trim();
  if (!dest) return '';

  const accommodation = String(input.accommodation ?? '').replace(/-/g, ' ').trim() || 'boutique hotel';
  const dates =
    input.startDate?.slice(0, 10) && input.endDate?.slice(0, 10)
      ? `${input.startDate.slice(0, 10)} to ${input.endDate.slice(0, 10)}`
      : '';
  const budgetWord =
    input.hotelNightlyBudget === 'luxury' ? 'luxury' :
    input.hotelNightlyBudget === 'comfort' ? 'upscale' :
    input.hotelNightlyBudget === 'mid'     ? 'mid-range' :
    input.hotelNightlyBudget === 'budget'  ? 'budget' :
    input.budget === 'luxury' ? 'luxury' :
    input.budget === 'budget' ? 'budget' : '';

  const baseQuery = [
    'best', budgetWord, accommodation, 'in', dest,
    dates ? `for ${dates}` : '',
    'editorial review neighborhood guide 2026',
  ].filter(Boolean).join(' ');

  const results = await searchExaOnly(baseQuery, 6);
  if (results.length === 0) return '';

  const lines = results.map((r, i) => {
    const snippet = r.snippet?.slice(0, 420).replace(/\s+/g, ' ').trim() ?? '';
    return `[H${i + 1}] ${r.title} (${r.url})\n${snippet}`;
  });

  return [
    `# Hotel research snippets (Exa web fallback — live inventory APIs unavailable)`,
    `# Destination: ${dest}${dates ? ` · Dates: ${dates}` : ''}${budgetWord ? ` · Tier: ${budgetWord}` : ''}`,
    `# Mine these editorial sources to surface named, real hotels with neighborhood`,
    `# context. Set otaPriceCompare nightly rates to null with "verify live" note —`,
    `# we did NOT query live OTA inventory for these snippets.`,
    '',
    lines.join('\n\n'),
  ].join('\n');
}

export function buildAccommodationContext(hotels: Hotel[]): string {
  return hotels.slice(0, 8).map((hotel) => {
    const price = hotel.nightlyRate
      ? `${hotel.nightlyRate.currency ?? ''}${hotel.nightlyRate.amount}/night`.trim()
      : 'rate unknown';
    const coords = hotel.lat != null && hotel.lng != null ? `GPS ${hotel.lat},${hotel.lng}` : 'GPS unknown';
    const availability = hotel.available === false ? 'SOLD OUT' : 'availability/rate returned by provider';
    return [
      `- ${hotel.name}`,
      `provider=${hotel.provider}`,
      hotel.address ? `area=${hotel.address}` : null,
      price,
      availability,
      coords,
      hotel.bookingUrl ? `url=${hotel.bookingUrl}` : null,
    ].filter(Boolean).join(' | ');
  }).join('\n');
}

export function travelerProfileToAccommodationInput(profile: TravelerProfile): AccommodationSearchInput {
  return {
    destination: profile.destination,
    lat: profile.hotelLat ?? null,
    lng: profile.hotelLng ?? null,
    radiusKm: 25,
    startDate: profile.startDate,
    endDate: profile.endDate,
    adults: profile.groupSize,
    accommodation: profile.accommodation,
    budget: profile.budget,
    hotelNightlyBudget: profile.hotelNightlyBudget ?? null,
  };
}
