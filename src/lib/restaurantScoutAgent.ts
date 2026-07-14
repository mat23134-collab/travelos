/**
 * restaurantScoutAgent — builds a per-city bank of reservable restaurants.
 *
 * Pipeline (mirrors transportScoutAgent's Exa + Gemini shape, plus a Google
 * Places verification + scoring pass):
 *
 *   1. Exa/Tavily web search  → editorial snippets about bookable restaurants.
 *   2. Gemini                 → structured candidates (name, cuisine, price,
 *                               blurb, neighborhood, booking-platform hint).
 *   3. Google Places          → verify each candidate exists; pull the real
 *                               place_id, website, rating, review count, coords.
 *   4. Scoring algorithm      → rank by rating × popularity × verification ×
 *                               bookability, so the best real options float up.
 *
 * The result is a RestaurantRecommendation[] ready to upsert into
 * `public.restaurant_recommendations`.
 */

import { RestaurantRecommendation, RestaurantLocaleText, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';

/** Human-readable names so the prompt can request each site language explicitly. */
const LANGUAGE_NAMES: Record<SiteLanguage, string> = {
  en: 'English',
  he: 'Hebrew',
};

// ─── Tunables ─────────────────────────────────────────────────────────────────

const GEMINI_FETCH_MS = 45_000;
const PLACES_FETCH_MS = 5_000;
const MAX_CANDIDATES = 12;       // how many names we ask Gemini for
const PLACES_CONCURRENCY = 5;    // parallel Google Places lookups

// ─── JSON parsing (Gemini returns application/json but stay defensive) ─────────

function parseJsonArray(raw: string): unknown[] {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed;
    // Gemini sometimes wraps under a key like { "restaurants": [...] }.
    const firstArray = Object.values(parsed).find(Array.isArray);
    return Array.isArray(firstArray) ? firstArray : [];
  } catch {
    return [];
  }
}

// ─── Step 1: web research ──────────────────────────────────────────────────────

async function gatherRestaurantSnippets(city: string): Promise<string> {
  const queries = [
    `${city} restaurants you must book weeks in advance hard to get reservation`,
    `${city} tasting menu chef's counter Michelin destination dining`,
    `${city} viral famous restaurant TikTok Instagram must try iconic`,
    // Balance the splurge-skewed queries above — without these, budget/mid-range
    // travelers only ever saw fine dining in the book-ahead panel.
    `${city} best affordable local restaurants worth a reservation`,
    `${city} best mid-range restaurants locals recommend book ahead`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => searchWeb(q)));
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // De-dupe by URL and cap the context size.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    lines.push(`- ${h.title}: ${h.snippet}`);
    if (lines.length >= 24) break;
  }
  return lines.join('\n');
}

// ─── Step 2: Gemini candidate synthesis ────────────────────────────────────────

interface GeminiCandidate {
  name?: string;
  priceRange?: string;
  priceLevel?: number;
  neighborhood?: string;
  bookingPlatform?: string;
  /** Localizable text per language code, e.g. { en: {...}, he: {...} }. */
  translations?: Partial<Record<SiteLanguage, RestaurantLocaleText>>;
}

type GeminiGenerateBody = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

/** Build the system prompt, requesting localized text for every site language. */
function candidateSystemPrompt(): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "cuisineStyle": "…", "description": "…", "signatureDish": "…", "bookingUrgency": "…", "bookingLeadTime": "…" }`)
    .join(', ');

  return `You are the head concierge of a travel house, curating a shortlist of restaurants in this city that are genuinely worth reserving ahead — for travelers across EVERY budget, not only those splurging on a luxury trip. These are NOT random everyday spots — each one earns its place by being memorable, well-reviewed, and worth planning around — but "worth reserving ahead" does NOT mean "expensive". A beloved neighborhood spot with a 2-week wait is just as valid a pick as a tasting-menu counter.

Build a SPREAD across price tiers — do not default to fine dining. Aim for roughly:
- 3–4 places at priceLevel 1–2 (affordable/mid — a memorable local favorite, a cult noodle counter, a beloved neighborhood institution with real demand).
- 2–3 places at priceLevel 3 (a nicer dinner-out experience, still not splurge territory).
- 2–3 places at priceLevel 4 (tasting-menu destinations, Michelin-starred kitchens, iconic hard-to-book institutions) — for travelers who DO want to splurge.

Within EACH tier, prioritize places that are genuinely special for their price point:
- High demand relative to size — regulars/locals book ahead, not just tourists.
- A clear point of pride: a signature dish, a beloved chef, a real following (TikTok/Instagram virality counts at any price point, not just fine dining).
- Real reservation culture — a place people plan around, not a walk-in-only counter.

STRICTLY EXCLUDE: chains, and generic tourist-trap spots near landmarks with no real following. Quality over quantity — 7–10 places spread across the tiers above beats a long generic list, and beats an all-luxury list.

Rules:
- Only real, currently-operating restaurants you are confident exist. No invented names.
- "priceRange" MUST be an approximate real cost band PER PERSON for a typical meal, in the LOCAL currency, with numbers — e.g. "€45–70 pp", "¥18,000–25,000 pp", "$120–180 pp". NEVER just symbols like "€€€".
- "priceLevel" is 1 (cheap) to 4 (very expensive).
- "bookingPlatform" is your best guess: "TheFork", "OpenTable", "website", or "phone".
- "name" and "neighborhood" stay in their original/local form (do NOT translate proper place names).

LOCALIZATION — write the following NATIVELY in EACH of these languages: ${langList} (natural, not a literal translation):
  - "highlight": a punchy 2–4 word badge of what makes it special, e.g. "Michelin tasting menu", "Cult carbonara", "Chef's counter", "Viral on TikTok".
  - "cuisineStyle": short, specific genre, e.g. "modern Italian tasting menu", "Roman fine dining".
  - "description": 2–3 evocative sentences on the experience — the food, the room, why it's worth the effort. Michelin-guide voice, vivid but honest.
  - "signatureDish": the one dish a first-timer must order.
  - "bookingUrgency": one short sentence on why booking is critical and how far ahead, e.g. "Books out weeks ahead — reserve the moment your dates are set."
  - "bookingLeadTime": ONLY the concrete typical advance-booking window, as a short phrase — e.g. "2–3 weeks ahead", "1–2 months ahead", "same week is fine". No full sentence.

Return ONLY a JSON array. Each object:
{ "name", "neighborhood", "priceRange", "priceLevel", "bookingPlatform", "translations": { ${translationsShape} } }.`;
}

async function synthesizeCandidates(city: string, snippets: string): Promise<GeminiCandidate[]> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const userPrompt =
    `City: ${city}\n` +
    `Produce up to ${MAX_CANDIDATES} reservable restaurants as described.\n\n` +
    (snippets ? `WEB SNIPPETS (grounding):\n${snippets}` : 'No web snippets available — use well-known real restaurants.');

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), GEMINI_FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: candidateSystemPrompt() }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.4,
          // Higher ceiling: each restaurant now carries localized text for
          // every site language, so the JSON is larger.
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
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
  if (!raw) return [];

  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined);

  return parseJsonArray(raw)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .filter((c): c is any => !!c && typeof c === 'object')
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .map((c: any): GeminiCandidate => {
      // Collect localized text for every site language we recognize.
      const translations: Partial<Record<SiteLanguage, RestaurantLocaleText>> = {};
      const src = c.translations && typeof c.translations === 'object' ? c.translations : {};
      for (const lang of SITE_LANGUAGES) {
        const loc = src[lang];
        if (loc && typeof loc === 'object') {
          translations[lang] = {
            highlight: str(loc.highlight) ?? null,
            cuisineStyle: str(loc.cuisineStyle) ?? null,
            description: str(loc.description) ?? null,
            signatureDish: str(loc.signatureDish) ?? null,
            bookingUrgency: str(loc.bookingUrgency) ?? null,
            bookingLeadTime: str(loc.bookingLeadTime) ?? null,
          };
        }
      }
      // Back-compat: if the model returned flat fields, treat them as English.
      if (!translations.en && (c.description || c.cuisineStyle || c.signatureDish)) {
        translations.en = {
          highlight: str(c.highlight) ?? null,
          cuisineStyle: str(c.cuisineStyle) ?? null,
          description: str(c.description) ?? null,
          signatureDish: str(c.signatureDish) ?? null,
          bookingUrgency: str(c.bookingUrgency) ?? null,
          bookingLeadTime: str(c.bookingLeadTime) ?? null,
        };
      }
      return {
        name: str(c.name),
        priceRange: str(c.priceRange),
        priceLevel: Number.isFinite(c.priceLevel) ? Math.min(4, Math.max(1, Math.round(c.priceLevel))) : undefined,
        neighborhood: str(c.neighborhood),
        bookingPlatform: str(c.bookingPlatform),
        translations,
      };
    })
    .filter((c) => !!c.name)
    .slice(0, MAX_CANDIDATES);
}

// ─── Step 3 + 4: verify against Google Places, then score ───────────────────────

/**
 * Scoring algorithm. Blends real-world signal (Google rating & review volume)
 * with how actionable the row is (verified + has a booking link). Kept simple
 * and explainable so it's easy to tune later.
 *
 *   base       = rating (0–5), default 3.2 when unknown
 *   popularity = log10(reviewCount) capped at 4  → rewards well-reviewed spots
 *   verified   = +1.5 when Google confirmed the place exists
 *   bookable   = +1.0 when we have a reservation/website URL
 */
function scoreRestaurant(r: RestaurantRecommendation): number {
  const base = (r.rating ?? 3.2);
  const popularity = r.ratingCount && r.ratingCount > 0
    ? Math.min(4, Math.log10(r.ratingCount))
    : 0;
  const verified = r.googlePlaceId ? 1.5 : 0;
  const bookable = r.reservationUrl || r.websiteUrl ? 1.0 : 0;
  return Number((base + popularity + verified + bookable).toFixed(3));
}

/** Run an async mapper over items with a fixed concurrency cap. */
async function mapWithConcurrency<T, R>(
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

// ─── Google Places lookup (restaurant-specific) ────────────────────────────────

interface PlaceLookup {
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Resolve a Google photo_reference to its stable CDN URL via the redirect
 * trick — we hit the photo endpoint with redirect:manual and read the Location
 * header, so the API key never reaches the client. Same approach as
 * placeVerification.resolvePhotoCdnUrl.
 */
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
 * Looks up a restaurant on Google Places. Uses Find Place with ONLY fields that
 * endpoint supports (note: `website` is NOT a Find Place field — that was the
 * bug in the shared verifyPlaceOnGoogle helper), then a follow-up Place Details
 * call to fetch the official website + Maps URL for the booking link.
 *
 * Never throws — any failure returns { found: false }.
 */
async function lookupRestaurantPlace(name: string, city: string): Promise<PlaceLookup> {
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

    // Follow-up Place Details for the official website (Find Place can't return it).
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

function guessReservationUrl(cand: GeminiCandidate, website: string | null, city: string): string | null {
  if (website) return website;
  // Fall back to a TheFork/OpenTable search link when we have no official site.
  const q = encodeURIComponent(`${cand.name} ${city}`);
  if (cand.bookingPlatform === 'OpenTable') return `https://www.opentable.com/s?term=${q}`;
  return `https://www.thefork.com/search?cityName=${encodeURIComponent(city)}&query=${encodeURIComponent(cand.name ?? '')}`;
}

// ─── Public entrypoint ──────────────────────────────────────────────────────────

export async function runRestaurantScoutAgent(city: string): Promise<RestaurantRecommendation[]> {
  const c = city.trim();
  if (!c) return [];

  // 1. Research
  const snippets = await gatherRestaurantSnippets(c).catch(() => '');

  // 2. Candidates
  const candidates = await synthesizeCandidates(c, snippets);
  if (candidates.length === 0) return [];

  // 3. Verify each candidate against Google Places (parallel, capped).
  //    lookupRestaurantPlace never throws — misses come back as { found: false }.
  const verified = await mapWithConcurrency(candidates, PLACES_CONCURRENCY, async (cand) => {
    const v = await lookupRestaurantPlace(cand.name!, c);
    const website = v.website ?? null;

    // Scalar fields hold the English text as a fallback; per-language text
    // lives in `translations` and is resolved at read time.
    const enText = cand.translations?.en ?? Object.values(cand.translations ?? {})[0] ?? {};
    const displayName = v.found && v.name ? v.name : cand.name!;
    // A TikTok search link always resolves to real, current videos of the
    // place — reliable social proof without risking a hallucinated handle.
    const socialUrl = `https://www.tiktok.com/search?q=${encodeURIComponent(`${displayName} ${c}`)}`;
    const rec: RestaurantRecommendation = {
      city: c,
      name: displayName,
      description: enText.description ?? null,
      cuisineStyle: enText.cuisineStyle ?? null,
      signatureDish: enText.signatureDish ?? null,
      highlight: enText.highlight ?? null,
      bookingUrgency: enText.bookingUrgency ?? null,
      socialUrl,
      translations: cand.translations ?? null,
      priceRange: cand.priceRange ?? null,
      // Prefer Google's real price_level; fall back to Gemini's guess.
      priceLevel: v.priceLevel ?? cand.priceLevel ?? null,
      neighborhood: cand.neighborhood ?? null,
      websiteUrl: website,
      reservationUrl: guessReservationUrl(cand, website, c),
      bookingPlatform: cand.bookingPlatform ?? (website ? 'website' : 'TheFork'),
      latitude: v.latitude ?? null,
      longitude: v.longitude ?? null,
      googlePlaceId: v.placeId ?? null,
      rating: v.rating ?? null,
      ratingCount: v.ratingCount ?? null,
      photoUrl: v.photoUrl ?? null,
      source: 'scout',
      score: 0,
    };
    rec.score = scoreRestaurant(rec);
    return rec;
  });

  // 4. Rank best-first. Even when few places verify, we still return the AI
  //    shortlist (unverified rows score lower but keep the UI from being empty).
  return verified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
