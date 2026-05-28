import type { AccommodationType, BudgetLevel, HotelNightlyBudget, TravelerProfile } from '@/lib/types';
import { searchExaOnly } from '@/lib/rag';

export type AccommodationProviderId = 'booking' | 'priceline' | 'expedia' | 'airbnb';
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
  | 'RAPIDAPI_EXPEDIA_KEY'
  | 'RAPIDAPI_EXPEDIA_HOST'
  | 'RAPIDAPI_EXPEDIA_SEARCH_PATH'
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
  expedia: {
    id: 'expedia',
    hostEnv: 'RAPIDAPI_EXPEDIA_HOST',
    keyEnv: 'RAPIDAPI_EXPEDIA_KEY',
    pathEnv: 'RAPIDAPI_EXPEDIA_SEARCH_PATH',
    defaultPath: '/hotels/search',
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

  if (airbnbIntent) return ['airbnb', 'priceline', 'expedia', 'booking'];
  return ['booking', 'priceline', 'expedia', 'airbnb'];
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
    if (res.status === 429) throw new Error('booking quota exceeded (429)');
    if (!res.ok) throw new Error(`booking request failed (${res.status})`);
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

function normalizeBookingHotel(raw: unknown, nights: number): Hotel | null {
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
    id: `booking-${rawId ?? name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    provider: 'booking',
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

async function bookingComSearch(
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  const host = cleanHost(options.env.RAPIDAPI_BOOKING_HOST) || 'booking-com.p.rapidapi.com';
  const key = options.env.RAPIDAPI_BOOKING_KEY || options.env.RAPIDAPI_KEY;
  if (!key) throw new Error('booking RapidAPI key missing');

  const locale = 'en-gb';
  const currency = input.budget === 'luxury' ? 'USD' : 'USD';

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
  if (destId == null) throw new Error(`booking: no dest_id for "${input.destination}"`);

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
    .map((r) => normalizeBookingHotel(r, nights))
    .filter((h): h is Hotel => h !== null);
  if (hotels.length === 0) throw new Error('booking returned empty results');
  return hotels;
}

async function fetchProvider(
  provider: AccommodationProviderId,
  input: AccommodationSearchInput,
  options: Required<Pick<SearchOptions, 'env' | 'fetchImpl' | 'timeoutMs'>>,
): Promise<Hotel[]> {
  // Provider-specific drivers (real API contracts) take precedence.
  if (provider === 'booking') {
    return bookingComSearch(input, options);
  }

  const config = PROVIDERS[provider];
  const url = buildProviderUrl(config, input, options.env);
  const key = options.env[config.keyEnv] || options.env.RAPIDAPI_KEY;
  if (!url || !key) throw new Error(`${provider} RapidAPI configuration missing`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);
  try {
    const response = await options.fetchImpl(url, {
      headers: {
        'x-rapidapi-key': key,
        'x-rapidapi-host': url.host,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 429) throw new Error(`${provider} quota exceeded (429)`);
    if (!response.ok) throw new Error(`${provider} request failed (${response.status})`);

    const payload = await response.json();
    const hotels = extractRawHotels(payload)
      .map((item) => normalizeAccommodationHotel(item, provider))
      .filter((hotel): hotel is Hotel => hotel !== null);
    if (hotels.length === 0) throw new Error(`${provider} returned empty results`);
    return hotels;
  } finally {
    clearTimeout(timer);
  }
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
