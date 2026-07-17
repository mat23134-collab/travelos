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
import { RESTAURANT_GENRES, canonicalizeGenre } from '@/lib/restaurantGenre';
import { cityMeanRating, bayesRating, computeCompositeScore, computeValueScore, touristTrapPenalty } from '@/lib/restaurantScoring';
import { normalizeNeighborhoodSlug } from '@/lib/restaurantBank';

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

async function gatherRestaurantSnippets(city: string, maxPriceLevel?: number): Promise<string> {
  // Budget-scoped runs (maxPriceLevel set) skip the splurge-oriented queries
  // entirely — no point spending research budget on Michelin snippets we're
  // about to filter out anyway.
  const queries = maxPriceLevel != null
    ? [
        `${city} best affordable restaurants worth booking ahead locals love`,
        `${city} best mid-range restaurants popular reservation recommended`,
        `${city} casual restaurant with a wait booked out neighborhood favorite`,
        `${city} best value restaurants critics and locals recommend`,
      ]
    : [
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
  /** Canonical cuisine genre key (§5). */
  cuisineGenre?: string;
  /** 0–3 book-ahead necessity (§7). */
  bookAheadLevel?: number;
  /** Typical advance-booking lead time in days (§7). */
  bookAheadDays?: number;
  /** Which meals this place is for, e.g. ["lunch","dinner"]. */
  mealSlots?: string[];
  /** Dietary tokens the place caters to. */
  dietaryTags?: string[];
  /** Graduated kosher: 'certified' | 'kosher-style' | 'none'. */
  kosherStatus?: string;
  /** Scannable dietary badges. */
  vegetarianFriendly?: boolean;
  veganFriendly?: boolean;
  /** Group-fit tokens (couple/family/group/solo). */
  groupSuitability?: string[];
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
function candidateSystemPrompt(maxPriceLevel?: number): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "cuisineStyle": "…", "description": "…", "signatureDish": "…", "bookingUrgency": "…", "bookingLeadTime": "…" }`)
    .join(', ');

  const genreList = RESTAURANT_GENRES.join(', ');
  const outputContract = `Rules:
- Only real, currently-operating restaurants you are confident exist. No invented names.
- "priceRange" MUST be an approximate real cost band PER PERSON for a typical meal, in the LOCAL currency, with numbers — e.g. "€45–70 pp", "¥18,000–25,000 pp", "$120–180 pp". NEVER just symbols like "€€€".
- "priceLevel" is 1 (cheap) to 4 (very expensive).
- "bookingPlatform" is your best guess: "TheFork", "OpenTable", "website", or "phone".
- "name" and "neighborhood" stay in their original/local form (do NOT translate proper place names).
- "cuisineGenre" MUST be exactly one of: ${genreList}. Pick the single best fit.
- "bookAheadLevel" is 0–3: 0 = walk-in / no reservations; 1 = book same week; 2 = book 1–4 weeks out (famous, weekend-impossible); 3 = book 1–3 months out or lottery (tasting menus, hardest tables). Be honest — a great walk-in counter is 0.
- "bookAheadDays" is the typical advance-booking lead time in DAYS as a plain integer (e.g. 3, 14, 60).
- "mealSlots" is an array from ["breakfast","lunch","dinner"] — the meals this place is genuinely for.
- "dietaryTags" is an array (possibly empty) from ["vegetarian-friendly","vegan-friendly","kosher","halal","gluten-free"] — only what the place genuinely accommodates.
- "kosherStatus" is exactly one of "certified" (rabbinate/teudah-certified kosher), "kosher-style" (no pork/shellfish, not certified), or "none". Use "none" unless you are confident.
- "vegetarianFriendly" and "veganFriendly" are booleans — true only if the place genuinely has good options for that diet.
- "groupSuitability" is an array (possibly empty) from ["solo","couple","family","group"] — who the place suits best.

LOCALIZATION — write the following NATIVELY in EACH of these languages: ${langList} (natural, not a literal translation):
  - "highlight": a punchy 2–4 word badge of what makes it special, e.g. "Michelin tasting menu", "Cult carbonara", "Chef's counter", "Viral on TikTok".
  - "cuisineStyle": short, specific genre, e.g. "modern Italian tasting menu", "Roman fine dining".
  - "description": 2–3 evocative sentences on the experience — the food, the room, why it's worth the effort. Michelin-guide voice, vivid but honest.
  - "signatureDish": the one dish a first-timer must order.
  - "bookingUrgency": one short sentence on why booking is critical and how far ahead, e.g. "Books out weeks ahead — reserve the moment your dates are set."
  - "bookingLeadTime": ONLY the concrete typical advance-booking window, as a short phrase — e.g. "2–3 weeks ahead", "1–2 months ahead", "same week is fine". No full sentence.

Return ONLY a JSON array. Each object:
{ "name", "neighborhood", "priceRange", "priceLevel", "bookingPlatform", "cuisineGenre", "bookAheadLevel", "bookAheadDays", "mealSlots", "dietaryTags", "kosherStatus", "vegetarianFriendly", "veganFriendly", "groupSuitability", "translations": { ${translationsShape} } }.`;

  if (maxPriceLevel != null) {
    // Budget-scoped run: a DEDICATED prompt that only ever asks for in-range
    // places, rather than requesting a full spread and discarding the splurge
    // half — every candidate here should be usable.
    return `You are a local food-scene expert curating a shortlist of AFFORDABLE-TO-MID-RANGE restaurants in this city that are genuinely worth reserving ahead — for budget-conscious and mid-range travelers.

STRICT PRICE CEILING: every place MUST be priceLevel 1 or 2 ONLY — roughly up to $30–45 / €25–40 / the equivalent in local currency, per person for a full meal. Do NOT include tasting menus, Michelin-starred kitchens, or fine dining; those travelers are served by a separate list. If you are not confident a place fits this ceiling, LEAVE IT OUT — a shorter accurate list beats a longer one with splurge places sneaking in.

SELECT places that are genuinely worth reserving ahead within that budget:
- High local demand — regulars and locals actually book ahead for it, not just tourists passing through.
- A clear point of pride: a signature dish, a beloved chef/owner, a real following (TikTok/Instagram virality counts just as much here as at fine dining).
- Real reservation culture — people plan around it, not a walk-in-only counter with no wait.
- Favor neighborhood institutions, cult noodle/pasta/street-food counters with a sit-down room, and beloved casual bistros — not chains.

STRICTLY EXCLUDE: chains, ANY fine dining or tasting-menu concept, anything priceLevel 3 or 4, and generic tourist-trap spots with no real local following. Quality over quantity — aim for 8–10 genuinely great affordable/mid-range picks.

${outputContract}`;
  }

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

${outputContract}`;
}

async function synthesizeCandidates(city: string, snippets: string, maxPriceLevel?: number): Promise<GeminiCandidate[]> {
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
        systemInstruction: { parts: [{ text: candidateSystemPrompt(maxPriceLevel) }] },
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
      const strArray = (v: unknown): string[] | undefined =>
        Array.isArray(v)
          ? v.map((x) => (typeof x === 'string' ? x.trim().toLowerCase() : '')).filter(Boolean)
          : undefined;

      return {
        name: str(c.name),
        priceRange: str(c.priceRange),
        priceLevel: Number.isFinite(c.priceLevel) ? Math.min(4, Math.max(1, Math.round(c.priceLevel))) : undefined,
        neighborhood: str(c.neighborhood),
        bookingPlatform: str(c.bookingPlatform),
        cuisineGenre: canonicalizeGenre(str(c.cuisineGenre)) ?? undefined,
        bookAheadLevel: Number.isFinite(c.bookAheadLevel)
          ? Math.min(3, Math.max(0, Math.round(c.bookAheadLevel)))
          : undefined,
        bookAheadDays: Number.isFinite(c.bookAheadDays) ? Math.max(0, Math.round(c.bookAheadDays)) : undefined,
        mealSlots: strArray(c.mealSlots),
        dietaryTags: strArray(c.dietaryTags),
        kosherStatus: ['certified', 'kosher-style', 'none'].includes(str(c.kosherStatus) ?? '')
          ? str(c.kosherStatus)
          : undefined,
        vegetarianFriendly: typeof c.vegetarianFriendly === 'boolean' ? c.vegetarianFriendly : undefined,
        veganFriendly: typeof c.veganFriendly === 'boolean' ? c.veganFriendly : undefined,
        groupSuitability: strArray(c.groupSuitability),
        translations,
      };
    })
    .filter((c) => !!c.name)
    .slice(0, MAX_CANDIDATES);
}

// ─── Step 3 + 4: verify against Google Places, then score ───────────────────────
//
// Scoring now lives in restaurantScoring.ts (Bayesian-adjusted composite, §6) —
// computed in a batch pass at the end of runRestaurantScoutAgent so the city
// mean is available. The old naive scoreRestaurant() was removed with it.

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
  countryCode?: string | null;  // ISO-2, from Place Details address components
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

    // Follow-up Place Details for the official website + country (Find Place
    // can't return either). Country drives reservation-platform routing (§9).
    if (cand.place_id) {
      try {
        const detUrl =
          `https://maps.googleapis.com/maps/api/place/details/json` +
          `?place_id=${cand.place_id}&fields=website,url,address_components&key=${apiKey}`;
        const detRes = await withTimeout(fetch(detUrl, { cache: 'no-store' }), PLACES_FETCH_MS);
        if (detRes.ok) {
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const det = (await detRes.json()) as any;
          lookup.website = det.result?.website ?? null;
          if (det.result?.url) lookup.mapsUrl = det.result.url;
          /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
          const components = (det.result?.address_components ?? []) as any[];
          const country = components.find((c) => Array.isArray(c.types) && c.types.includes('country'));
          lookup.countryCode = country?.short_name ?? null;
        }
      } catch { /* website + country are optional */ }
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

export interface RestaurantScoutOptions {
  /**
   * When set, scouts ONLY within this price ceiling — Google's 1 (cheap) to
   * 4 (very expensive) scale, matching MAX_PRICE_LEVEL_BY_BUDGET in
   * restaurantBank.ts. Uses a dedicated affordable/mid-range prompt (rather
   * than the default full-spread prompt) so every candidate is usable, and
   * candidates are dropped post-verification if Google's REAL price_level
   * confirms they're over the ceiling — even if Gemini proposed them.
   */
  maxPriceLevel?: number;
}

export async function runRestaurantScoutAgent(
  city: string,
  opts: RestaurantScoutOptions = {},
): Promise<RestaurantRecommendation[]> {
  const c = city.trim();
  if (!c) return [];
  const { maxPriceLevel } = opts;

  // 1. Research
  const snippets = await gatherRestaurantSnippets(c, maxPriceLevel).catch(() => '');

  // 2. Candidates
  const candidates = await synthesizeCandidates(c, snippets, maxPriceLevel);
  if (candidates.length === 0) return [];

  // 3. Verify each candidate against Google Places (parallel, capped).
  //    lookupRestaurantPlace never throws — misses come back as { found: false }.
  //    We keep Google's raw price_level alongside the built record so the
  //    budget filter below can trust it over Gemini's guess.
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
      // ── Book-Ahead engine fields ──────────────────────────────────────────
      cuisineGenre: cand.cuisineGenre ?? canonicalizeGenre(enText.cuisineStyle) ?? null,
      mealSlots: cand.mealSlots ?? null,
      bookAheadLevel: cand.bookAheadLevel ?? null,
      bookAheadDays: cand.bookAheadDays ?? null,
      dietaryTags: cand.dietaryTags ?? null,
      kosherStatus: cand.kosherStatus ?? null,
      vegetarianFriendly: cand.vegetarianFriendly ?? null,
      veganFriendly: cand.veganFriendly ?? null,
      groupSuitability: cand.groupSuitability ?? null,
      neighborhoodSlug: normalizeNeighborhoodSlug(cand.neighborhood),
      countryCode: v.countryCode ?? null,
      // A Hebrew Google search always resolves to real, current Israeli-audience
      // coverage (blogs, forums, reviews) without risking a hallucinated link.
      hebrewSocialUrl: `https://www.google.com/search?hl=iw&q=${encodeURIComponent(`${displayName} ${c} ביקורת`)}`,
      lastVerifiedAt: v.found ? new Date().toISOString() : null,
    };
    return { rec, googlePriceLevel: v.priceLevel ?? null };
  });

  // Budget mode: drop anything Google's REAL price_level confirms is over the
  // ceiling, even if Gemini proposed it within range. A candidate Google
  // couldn't verify a price for is kept — we have no real data saying it's
  // over budget, and Gemini was already instructed to stay in range.
  const filtered = maxPriceLevel == null
    ? verified
    : verified.filter(({ googlePriceLevel }) => googlePriceLevel == null || googlePriceLevel <= maxPriceLevel);

  const recs = filtered.map(({ rec }) => rec);

  // 4. Composite scoring (§6). The Bayesian city-mean prior is computed across
  //    this batch, then each rec gets a stored bayes_rating + composite_score.
  //    `score` mirrors composite_score so the existing order-by-score read path
  //    (and older callers) keep a sensible best-first ordering; the request-time
  //    ranker re-orders by composite + personal fit.
  const cityMean = cityMeanRating(recs);
  for (const rec of recs) {
    rec.bayesRating = Number(bayesRating(rec.rating, rec.ratingCount, cityMean).toFixed(3));
    rec.valueScore = computeValueScore(rec, cityMean);
    rec.touristTrapPenalty = touristTrapPenalty(rec, cityMean);
    rec.compositeScore = computeCompositeScore(rec, cityMean);
    rec.score = rec.compositeScore;
  }

  // Even when few places verify, we still return the AI shortlist (unverified
  // rows score lower but keep the UI from being empty).
  return recs.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
