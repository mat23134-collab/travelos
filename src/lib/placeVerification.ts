/**
 * placeVerification.ts — post-LLM Google Places Text Search verification.
 *
 * Purpose: after the LLM produces an itinerary, every named venue is run
 * through Google Places "Find Place From Text" to:
 *
 *   1. Confirm the place exists on Google Maps (not a hallucinated name).
 *   2. Replace AI-guessed GPS coordinates with the verified ones.
 *   3. Surface a real photo CDN URL (lh3.googleusercontent.com).
 *   4. Surface the official website when AI didn't provide one.
 *   5. Surface a rating + place_id for cache enrichment.
 *
 * Required env var: GOOGLE_PLACES_API_KEY
 *
 * Strategy: when the key is missing or the call fails, we silently return
 * { found: false } — the AI's coordinates remain in place. This is a
 * best-effort enrichment layer, not a hard gate.
 */

type FindPlaceResponse = {
  status?: string;
  candidates?: Array<{
    place_id?: string;
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    photos?: Array<{ photo_reference?: string }>;
    rating?: number;
    user_ratings_total?: number;
  }>;
};

export interface PlaceVerificationResult {
  /** True iff Google returned a candidate for the (name, city) pair. */
  found: boolean;
  /** Canonical name from Google Maps (may differ slightly from input). */
  name?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  /** Direct CDN URL (lh3.googleusercontent.com) — null when no photo. */
  photoUrl?: string | null;
  /** Official website URL — null when Google doesn't have one. */
  website?: string | null;
  rating?: number | null;
  userRatingsTotal?: number | null;
  googlePlaceId?: string | null;
}

const EMPTY_RESULT: PlaceVerificationResult = { found: false };

const VERIFY_TIMEOUT_MS = 4_000;
const PHOTO_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const tid = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => { clearTimeout(tid); resolve(v); },
      (e) => { clearTimeout(tid); reject(e); },
    );
  });
}

/**
 * Fetch a place's official website via Place Details. `website` is NOT a valid
 * field on the Find Place endpoint (requesting it there returns INVALID_REQUEST
 * and zero candidates — that was the bug that silently disabled all
 * verification), so it must come from a follow-up Details call. Best-effort.
 */
async function fetchPlaceWebsite(placeId: string, apiKey: string): Promise<string | null> {
  try {
    const detailsUrl =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
      `&fields=website&key=${apiKey}`;
    const res = await withTimeout(fetch(detailsUrl, { cache: 'no-store' }), VERIFY_TIMEOUT_MS, 'place details website');
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: { website?: string } };
    return data.result?.website ?? null;
  } catch {
    return null;
  }
}

/** Resolve a photo_reference to its CDN URL via the redirect trick (key stays server-side). */
async function resolvePhotoCdnUrl(photoRef: string, apiKey: string): Promise<string | null> {
  try {
    const photoApiUrl =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
    const photoRes = await withTimeout(
      fetch(photoApiUrl, { redirect: 'manual' }),
      PHOTO_TIMEOUT_MS,
      'place photo redirect',
    );
    return photoRes.headers.get('location') ?? null;
  } catch {
    return null;
  }
}

/** Single-place verification. Never throws — failures become { found: false }. */
export async function verifyPlaceOnGoogle(
  name: string,
  city: string,
  options: { apiKey?: string } = {},
): Promise<PlaceVerificationResult> {
  const apiKey = options.apiKey ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return EMPTY_RESULT;
  const cleanName = (name ?? '').trim().slice(0, 120);
  if (!cleanName) return EMPTY_RESULT;

  const query = encodeURIComponent(`${cleanName}${city ? ` ${city}` : ''}`);
  // NOTE: `website` is intentionally absent — it is NOT a supported Find Place
  // field and requesting it makes Google return INVALID_REQUEST with zero
  // candidates. It's fetched via a Place Details follow-up below instead.
  const fields = 'place_id,name,formatted_address,geometry,photos,rating,user_ratings_total';
  const searchUrl =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${query}&inputtype=textquery&fields=${fields}&key=${apiKey}`;

  let data: FindPlaceResponse;
  try {
    const res = await withTimeout(fetch(searchUrl, { cache: 'no-store' }), VERIFY_TIMEOUT_MS, 'place verify');
    if (!res.ok) return EMPTY_RESULT;
    data = (await res.json()) as FindPlaceResponse;
  } catch {
    return EMPTY_RESULT;
  }

  const candidate = data.candidates?.[0];
  if (!candidate) return EMPTY_RESULT;

  const lat = candidate.geometry?.location?.lat;
  const lng = candidate.geometry?.location?.lng;
  const photoRef = candidate.photos?.[0]?.photo_reference;
  const placeId = candidate.place_id ?? null;

  // Photo (from Find Place) and website (needs a Details call) run in parallel.
  const [photoUrl, website] = await Promise.all([
    photoRef ? resolvePhotoCdnUrl(photoRef, apiKey) : Promise.resolve(null),
    placeId ? fetchPlaceWebsite(placeId, apiKey) : Promise.resolve(null),
  ]);

  return {
    found: true,
    name: candidate.name ?? cleanName,
    formattedAddress: candidate.formatted_address,
    latitude: typeof lat === 'number' && Number.isFinite(lat) ? lat : undefined,
    longitude: typeof lng === 'number' && Number.isFinite(lng) ? lng : undefined,
    photoUrl,
    website,
    rating: typeof candidate.rating === 'number' ? candidate.rating : null,
    userRatingsTotal: typeof candidate.user_ratings_total === 'number' ? candidate.user_ratings_total : null,
    googlePlaceId: placeId,
  };
}

// ── Batch with bounded concurrency ────────────────────────────────────────────

export interface BatchVerifyInput {
  /** Unique cache key (typically `${name}|${city}`.toLowerCase()). */
  key: string;
  name: string;
  city: string;
}

/**
 * Batch verify a list of (name, city) pairs in parallel, capped at a
 * concurrency limit. De-duplicates by `key`. Returns a Map keyed by `key`.
 *
 * Designed to be called once per /api/generate run, after the LLM returns
 * the itinerary JSON. Wall-clock budget is roughly: ceil(n/concurrency)
 * × (VERIFY_TIMEOUT_MS + PHOTO_TIMEOUT_MS) at the absolute worst.
 */
export async function batchVerifyPlacesOnGoogle(
  inputs: BatchVerifyInput[],
  options: { concurrency?: number; apiKey?: string } = {},
): Promise<Map<string, PlaceVerificationResult>> {
  const concurrency = Math.max(1, options.concurrency ?? 6);
  const apiKey = options.apiKey ?? process.env.GOOGLE_PLACES_API_KEY;
  const results = new Map<string, PlaceVerificationResult>();

  if (!apiKey) return results;

  // Deduplicate inputs by key
  const seen = new Set<string>();
  const queue: BatchVerifyInput[] = [];
  for (const item of inputs) {
    if (!item.key || seen.has(item.key)) continue;
    seen.add(item.key);
    queue.push(item);
  }

  let cursor = 0;
  async function worker() {
    while (cursor < queue.length) {
      const idx = cursor++;
      const item = queue[idx];
      const result = await verifyPlaceOnGoogle(item.name, item.city, { apiKey });
      results.set(item.key, result);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Itinerary walker — collect every venue that needs verification ────────────

export interface VenueSlot {
  /** Path used to update the JSON: e.g. ['days', 0, 'morning']. */
  path: Array<string | number>;
  name: string;
  /** AI-provided GPS, when present — used to detect "needs replacement". */
  aiLat?: number | null;
  aiLng?: number | null;
}

/**
 * Walk the itinerary JSON and emit one VenueSlot per (named) activity or
 * dining spot found across days. Caller uses the paths to write verified
 * coordinates + photoUrl back into the JSON.
 */
export function collectVenueSlots(itinerary: unknown): VenueSlot[] {
  const slots: VenueSlot[] = [];
  if (!itinerary || typeof itinerary !== 'object') return slots;

  const days = (itinerary as Record<string, unknown>).days;
  if (!Array.isArray(days)) return slots;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (!day || typeof day !== 'object') continue;
    const d = day as Record<string, unknown>;

    for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
      const entry = d[slot];
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === 'string' ? e.name.trim() : '';
      if (!name) continue;

      slots.push({
        path: ['days', i, slot],
        name,
        aiLat: typeof e.latitude === 'number' ? e.latitude : null,
        aiLng: typeof e.longitude === 'number' ? e.longitude : null,
      });
    }
  }

  return slots;
}

/**
 * Apply a batch of verification results back into the itinerary JSON.
 * Mutates the input object in place. Only overrides GPS when the
 * Google-verified position is meaningfully different (>200m) from the AI's,
 * and always sets photo_url + website_url when present and missing.
 *
 * Returns counts for telemetry.
 */
export function applyVerificationToItinerary(
  itinerary: unknown,
  slots: VenueSlot[],
  results: Map<string, PlaceVerificationResult>,
  keyFor: (slot: VenueSlot) => string,
): { verified: number; gpsCorrected: number; photosFilled: number; websitesFilled: number } {
  let verified = 0;
  let gpsCorrected = 0;
  let photosFilled = 0;
  let websitesFilled = 0;

  for (const slot of slots) {
    const result = results.get(keyFor(slot));
    if (!result?.found) continue;
    verified++;

    const target = getByPath(itinerary, slot.path);
    if (!target || typeof target !== 'object') continue;
    const t = target as Record<string, unknown>;

    // GPS — replace if Google is sufficiently far from the AI's guess.
    if (
      typeof result.latitude === 'number' &&
      typeof result.longitude === 'number'
    ) {
      const aiLat = typeof t.latitude === 'number' ? t.latitude : null;
      const aiLng = typeof t.longitude === 'number' ? t.longitude : null;
      const drift =
        aiLat != null && aiLng != null
          ? haversineMeters(aiLat, aiLng, result.latitude, result.longitude)
          : Infinity;
      if (drift > 200) {
        t.latitude = result.latitude;
        t.longitude = result.longitude;
        gpsCorrected++;
      }
    }

    // Photo URL — only set if missing.
    if (result.photoUrl && !t.photo_url) {
      t.photo_url = result.photoUrl;
      photosFilled++;
    }

    // Website — only set if missing or null.
    if (result.website && (!t.website_url || t.website_url === null)) {
      t.website_url = result.website;
      websitesFilled++;
    }

    // Google place_id for cache enrichment downstream
    if (result.googlePlaceId && !t.google_place_id) {
      t.google_place_id = result.googlePlaceId;
    }
    if (typeof result.rating === 'number' && !t.google_rating) {
      t.google_rating = result.rating;
    }
  }

  return { verified, gpsCorrected, photosFilled, websitesFilled };
}

function getByPath(root: unknown, path: Array<string | number>): unknown {
  let cur: unknown = root;
  for (const seg of path) {
    if (cur && typeof cur === 'object') {
      cur = (cur as Record<string | number, unknown>)[seg as never];
    } else {
      return undefined;
    }
  }
  return cur;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
