import type { BookedHotelAround, HotelRecommendation, TransitNearHotelLine } from '@/lib/types';

function sanitizeHttpsUrl(raw?: string): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  const href = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(href);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch {
    return null;
  }
}

function pickStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function pickNum(obj: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.trim().replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

/** Normalize Claude/GPT drift between camelCase and snake_case when parsing itinerary JSON. */
export function normalizeHotelRecommendation(raw: unknown): HotelRecommendation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const name = pickStr(r, 'name', 'hotelName');
  const neighborhood = pickStr(r, 'neighborhood', 'area');
  const neighborhoodVibe = pickStr(r, 'neighborhoodVibe', 'neighborhood_vibe');
  const whyItFits = pickStr(r, 'whyItFits', 'why_it_fits');
  const priceRange = pickStr(r, 'priceRange', 'price_range');
  const neighborhoodInsight = pickStr(r, 'neighborhoodInsight', 'neighborhood_insight');

  if (!name || !neighborhood || !neighborhoodVibe || !whyItFits || !priceRange || !neighborhoodInsight) {
    return null;
  }

  const websiteUrl = pickStr(r, 'websiteUrl', 'website_url', 'officialWebsiteUrl') ?? null;
  const estimatedPriceRangeTripDates =
    pickStr(r, 'estimatedPriceRangeTripDates', 'estimated_price_range_trip_dates') ?? null;
  const availabilitySummary =
    pickStr(r, 'availabilitySummary', 'availability_summary') ?? null;
  const ratingSource = pickStr(r, 'ratingSource', 'rating_source') ?? null;
  const reviewCountHint = pickStr(r, 'reviewCountHint', 'review_count_hint') ?? null;

  const ratingStars = pickNum(r, 'ratingStars', 'rating_stars');
  const latitude = pickNum(r, 'latitude', 'lat');
  const longitude = pickNum(r, 'longitude', 'lng', 'lon');

  return {
    name,
    neighborhood,
    neighborhoodVibe,
    whyItFits,
    priceRange,
    neighborhoodInsight,
    websiteUrl: sanitizeHttpsUrl(websiteUrl ?? undefined),
    estimatedPriceRangeTripDates,
    availabilitySummary,
    ratingStars: ratingStars ?? null,
    ratingSource,
    reviewCountHint,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
  };
}

function pickStrArr(obj: Record<string, unknown>, ...keys: string[]): string[] | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (!Array.isArray(v)) continue;
    const out = v
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean);
    if (out.length) return out;
  }
  return undefined;
}

function normalizeTransitLine(raw: unknown): TransitNearHotelLine | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const modeLabel = pickStr(o, 'modeLabel', 'mode_label', 'mode');
  const lineOrRoute = pickStr(o, 'lineOrRoute', 'line_or_route', 'line', 'route');
  if (!modeLabel || !lineOrRoute) return null;
  const walkMinutes = pickStr(o, 'walkMinutes', 'walk_minutes', 'walk');
  return { modeLabel, lineOrRoute, walkMinutes };
}

/** Coerce snake_case / loose shapes for booked.aroundHotel */
function normalizeBookedAroundInPlace(booked: Record<string, unknown>): void {
  const raw = booked.aroundHotel ?? booked.around_hotel;
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Record<string, unknown>;

  const areaHeadline = pickStr(r, 'areaHeadline', 'area_headline', 'headline');
  const vibes = pickStrArr(r, 'vibes', 'vibe_tags');
  const walkableHighlights = pickStrArr(r, 'walkableHighlights', 'walkable_highlights', 'highlights', 'nearbyHighlights');
  const sig = pickStr(r, 'signatureMove', 'signature_move', 'localUnlock', 'magneticMove');

  let transitRaw = r.transitNearHotel ?? r.transit_near_hotel ?? r.transit;
  const transitLines: TransitNearHotelLine[] = [];
  if (Array.isArray(transitRaw)) {
    for (const row of transitRaw) {
      const line = normalizeTransitLine(row);
      if (line) transitLines.push(line);
    }
  }

  const out: BookedHotelAround = {};
  if (areaHeadline) out.areaHeadline = areaHeadline;
  if (vibes?.length) out.vibes = vibes.slice(0, 8);
  if (walkableHighlights?.length) out.walkableHighlights = walkableHighlights.slice(0, 8);
  if (transitLines.length) out.transitNearHotel = transitLines.slice(0, 6);
  if (sig) out.signatureMove = sig;

  if (
    out.areaHeadline ||
    (out.vibes && out.vibes.length > 0) ||
    (out.walkableHighlights && out.walkableHighlights.length > 0) ||
    (out.transitNearHotel && out.transitNearHotel.length > 0) ||
    out.signatureMove
  ) {
    booked.aroundHotel = out;
    delete booked.around_hotel;
  }
}

/** Mutates itinerary.basecamp in place — tolerates loose AI JSON. */
export function normalizeBasecampHotels(basecamp: unknown): void {
  if (!basecamp || typeof basecamp !== 'object') return;
  const b = basecamp as { type?: string; recommendations?: unknown[]; booked?: Record<string, unknown> };

  if (b.type === 'booked' && b.booked && typeof b.booked === 'object') {
    normalizeBookedAroundInPlace(b.booked as Record<string, unknown>);
  }

  if (b.type !== 'recommendations' || !Array.isArray(b.recommendations)) return;

  const normalized = b.recommendations
    .map(normalizeHotelRecommendation)
    .filter((h): h is HotelRecommendation => h !== null);

  if (normalized.length > 0) {
    b.recommendations = normalized;
  }
}
