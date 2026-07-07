/**
 * scoutShared — helpers common to the Smart Toolbar scout pipelines
 * (restaurants / attractions / events): a Gemini JSON call, a Google Places
 * lookup with photo resolution, bounded-concurrency mapping and defensive
 * JSON-array parsing. Mirrors the battle-tested implementations in
 * restaurantScoutAgent (kept there untouched to avoid regressions).
 */

// ─── Timeouts ─────────────────────────────────────────────────────────────────

export const GEMINI_FETCH_MS = 45_000;
export const PLACES_FETCH_MS = 5_000;

export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Run an async mapper over items with a fixed concurrency cap. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      out[i] = await mapper(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ─── JSON parsing (Gemini returns application/json but stay defensive) ─────────

export function parseJsonArray(raw: string): unknown[] {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
    // Gemini sometimes wraps under a key like { "items": [...] }.
    const firstArray = Object.values(parsed).find(Array.isArray);
    return Array.isArray(firstArray) ? firstArray : [];
  } catch {
    return [];
  }
}

export const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

// ─── Gemini JSON call ──────────────────────────────────────────────────────────

type GeminiGenerateBody = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

/**
 * Calls Gemini with responseMimeType JSON and returns the raw text. Throws on
 * missing key, HTTP errors, blocks or empty responses — callers decide how to
 * degrade.
 */
export async function callGeminiJson(
  systemPrompt: string,
  userPrompt: string,
  opts: { temperature?: number; maxOutputTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), GEMINI_FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: opts.temperature ?? 0.4,
          maxOutputTokens: opts.maxOutputTokens ?? 8192,
          responseMimeType: 'application/json',
          // gemini-2.5-* thinking tokens count against maxOutputTokens; disable
          // so the JSON isn't truncated.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } finally {
    clearTimeout(tid);
  }

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 300)}`);
  }

  const data = (await res.json()) as GeminiGenerateBody;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);

  const cand = data.candidates?.[0];
  const raw = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!raw) throw new Error('Gemini returned empty text');
  return raw;
}

// ─── Google Places lookup ──────────────────────────────────────────────────────

export interface PlaceLookup {
  found: boolean;
  placeId?: string | null;
  name?: string;
  latitude?: number | null;
  longitude?: number | null;
  rating?: number | null;
  ratingCount?: number | null;
  priceLevel?: number | null;   // Google 0–4
  website?: string | null;
  mapsUrl?: string | null;
  photoUrl?: string | null;
}

const EMPTY_LOOKUP: PlaceLookup = { found: false };

/** Resolve a photo_reference to its stable CDN URL (key stays server-side). */
async function resolvePhotoUrl(photoRef: string, apiKey: string): Promise<string | null> {
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800` +
      `&photoreference=${encodeURIComponent(photoRef)}&key=${apiKey}`;
    const res = await withTimeout(fetch(url, { redirect: 'manual' }), PLACES_FETCH_MS);
    return res.headers.get('location') ?? null;
  } catch {
    return null;
  }
}

/**
 * Look a place up on Google Places. Find Place with ONLY fields that endpoint
 * supports (`website` is NOT one — requesting it breaks the whole call), then a
 * Place Details follow-up for the official website. Never throws.
 */
export async function lookupPlaceOnGoogle(name: string, city: string): Promise<PlaceLookup> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return EMPTY_LOOKUP;

  const query = encodeURIComponent(`${name} ${city}`);
  const findFields = 'place_id,name,geometry,rating,user_ratings_total,price_level,photos';
  const findUrl =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${query}&inputtype=textquery&fields=${findFields}&key=${apiKey}`;

  try {
    const res = await withTimeout(fetch(findUrl, { cache: 'no-store' }), PLACES_FETCH_MS);
    if (!res.ok) return EMPTY_LOOKUP;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const data = (await res.json()) as any;
    const cand = data.candidates?.[0];
    if (!cand) return EMPTY_LOOKUP;

    const photoRef = cand.photos?.[0]?.photo_reference as string | undefined;
    const lookup: PlaceLookup = {
      found: true,
      placeId: cand.place_id ?? null,
      name: cand.name,
      latitude: cand.geometry?.location?.lat ?? null,
      longitude: cand.geometry?.location?.lng ?? null,
      rating: typeof cand.rating === 'number' ? cand.rating : null,
      ratingCount: typeof cand.user_ratings_total === 'number' ? cand.user_ratings_total : null,
      priceLevel: typeof cand.price_level === 'number' ? cand.price_level : null,
      website: null,
      mapsUrl: cand.place_id ? `https://www.google.com/maps/place/?q=place_id:${cand.place_id}` : null,
      photoUrl: photoRef ? await resolvePhotoUrl(photoRef, apiKey) : null,
    };

    if (cand.place_id) {
      try {
        const detUrl =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${cand.place_id}&fields=website,url&key=${apiKey}`;
        const detRes = await withTimeout(fetch(detUrl, { cache: 'no-store' }), PLACES_FETCH_MS);
        if (detRes.ok) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const det = (await detRes.json()) as any;
          lookup.website = det.result?.website ?? null;
          if (det.result?.url) lookup.mapsUrl = det.result.url;
        }
      } catch { /* website is optional */ }
    }

    return lookup;
  } catch {
    return EMPTY_LOOKUP;
  }
}
