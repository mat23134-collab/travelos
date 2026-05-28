/**
 * TravelOS Scout Agent — v4 (Gemini-powered extraction + Exa/Janitor mode)
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone CLI script — runs outside the Next.js app.
 * Uses Google Gemini for AI extraction (no Claude tokens consumed).
 *
 * SCOUT MODE (default): discover & insert new places for a city
 *   npx tsx scripts/scout-agent.ts <city>            # Tavily primary (Exa fallback)
 *   npx tsx scripts/scout-agent.ts <city> --mock     # force mock (offline)
 *   npx tsx scripts/scout-agent.ts <city> --exa      # force the legacy Exa engine
 *   npx tsx scripts/scout-agent.ts <city> --verbose  # print raw content
 *   npx tsx scripts/scout-agent.ts <city> --live-only # never use mock fallback (real web only)
 *   npx tsx scripts/scout-agent.ts <city> --categories bars
 *   npx tsx scripts/scout-agent.ts <city> --categories tourism_sites,restaurants
 *
 * JANITOR MODE: re-verify stale places (last_verified_at > 30 days or NULL)
 *   npx tsx scripts/scout-agent.ts --janitor             # all stale places
 *   npx tsx scripts/scout-agent.ts --janitor --city Rome # stale places for one city
 *   npx tsx scripts/scout-agent.ts --janitor --dry-run   # preview without writing
 *
 * Required env vars (in .env.local):
 *   GEMINI_API_KEY              — Google Gemini API key (replaces Claude for the agent)
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service-role key (bypasses Row-Level Security)
 *
 * Optional:
 *   EXA_API_KEY                 — Exa neural search (required for janitor mode)
 *   TAVILY_API_KEY              — Tavily web search (fallback engine)
 *   GEMINI_MODEL                — override Gemini model (default: gemini-3-flash-preview)
 *   YOUTUBE_API_KEY             — YouTube Data API v3 (optional youtube_video_id when a matching short clip exists)
 *
 * Scout CLI:
 *   --skip-youtube             — Do not call YouTube (faster; column left null on insert)
 *   --categories <list>        — Comma-separated scout buckets (default: all four). Tokens:
 *                                tourism_sites (aliases: tourism, heritage), restaurants (food, dining),
 *                                attractions (attraction), bars (bar)
 *
 * Supabase migration (run once before janitor mode):
 *   ALTER TABLE places ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
 *   ALTER TABLE places ADD COLUMN IF NOT EXISTS status text DEFAULT 'unverified';
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Env loader (reads .env.local before any client is created) ────────────────

function loadDotEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on system env
  }
}

// ── Place schema ──────────────────────────────────────────────────────────────

interface Place {
  city: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  category_emoji: string;
  social_proof_url: string | null;
  vibe_label: string;
  quality_score?: number;
}

const TARGET_PLACES_PER_RUN = 50;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// ── Exa API types ─────────────────────────────────────────────────────────────

interface ExaResult {
  id: string;
  url: string;
  title: string;
  publishedDate?: string;
  author?: string;
  score?: number;
  text?: string;
  highlights?: string[];
  summary?: string;
}

interface ExaSearchResponse {
  requestId: string;
  resolvedSearchType: string;
  results: ExaResult[];
}

interface ExaContentsResponse {
  results?: Array<{
    id?: string;
    url?: string;
    text?: string;
  }>;
}

/** Scout search buckets — Gemini query-plan keys must match these names. */
const SCOUT_QUERY_CATEGORY_KEYS = [
  'tourism_sites',
  'restaurants',
  'attractions',
  'bars',
] as const;

type ScoutQueryCategoryKey = (typeof SCOUT_QUERY_CATEGORY_KEYS)[number];

interface QueryPlanResponse {
  categories?: Partial<Record<ScoutQueryCategoryKey, string[]>>;
}

const QUERIES_PER_SCOUT_CATEGORY = 2;

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

/** DB `places.category` value for each scout query bucket. */
function scoutQueryKeyToPlaceCategory(key: ScoutQueryCategoryKey): string {
  const map: Record<ScoutQueryCategoryKey, string> = {
    tourism_sites: 'tourism_site',
    restaurants: 'restaurant',
    attractions: 'attraction',
    bars: 'bar',
  };
  return map[key];
}

function fallbackCategoryQueries(city: string, keys: ScoutQueryCategoryKey[]): string[] {
  const c = city.trim();
  const byKey: Record<ScoutQueryCategoryKey, string[]> = {
    tourism_sites: [
      `Must-see heritage monuments and UNESCO-caliber historic sites in ${c} with authoritative visitor guidance`,
      `Best archaeology parks and landmark civic museums in ${c} worth a dedicated half-day`,
    ],
    restaurants: [
      `Standout chef-led restaurants and tasting menus in ${c} praised by critics and locals`,
      `Neighborhood restaurants in ${c} known for distinctive cuisine and consistent quality`,
    ],
    attractions: [
      `Major ticketed attractions and memorable experiences in ${c}: viewpoints, tours, and iconic activities`,
      `Family-friendly and standout experiential attractions in ${c} beyond basic sightseeing`,
    ],
    bars: [
      `Award-caliber cocktail bars and mixed drinks culture in ${c}`,
      `Wine bars late-night bars and convivial drinking spots in ${c} that locals return to`,
    ],
  };
  return keys.flatMap((k) => byKey[k]);
}

/** Gemini-planned search strings for Exa/Tavily — two queries per selected scout category. */
async function generateScoutCategoryQueries(
  city: string,
  categoryKeys: ScoutQueryCategoryKey[],
): Promise<string[]> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const apiKey = process.env.GEMINI_API_KEY ?? '';
  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GEMINI_API_KEY is not set for query generation');
  }

  const keys = categoryKeys.length ? categoryKeys : [...SCOUT_QUERY_CATEGORY_KEYS];
  const totalQueries = keys.length * QUERIES_PER_SCOUT_CATEGORY;
  const keysJson = keys.map((k) => `"${k}":["q1","q2"]`).join(',');

  const categoryLegend = `Categories (meanings):
- tourism_sites: heritage monuments, archaeology, UNESCO-caliber historic sites, landmark civic museums, iconic squares/churches users visit as sights.
- restaurants: dining rooms, chef-led spots, neighborhood institutions (include serious cafes only if food-led).
- attractions: ticketed venues, tours, viewpoints, cable cars, boats, observatories, parks/experiences marketed as attractions (not pure heritage monuments — use tourism_sites for those).
- bars: cocktail bars, wine bars, standing-room bodegas, nightlife drinking venues.`;

  const prompt = `You are generating premium web-research queries for city scouting (TravelOS).

CITY: ${city}

ACTIVE CATEGORIES FOR THIS RUN (generate queries ONLY for these — omit any others): ${keys.join(', ')}

Rules:
1) Avoid hollow buzzwords: do NOT use "hidden gem", "secret", "locals only", or similar cliches.
2) Output exactly ${QUERIES_PER_SCOUT_CATEGORY} queries per ACTIVE category (${totalQueries} total). Natural-language, high-signal, written like a discerning editor commissioning research.
3) Each query must be clearly about ONE category only (no blending).
4) Prefer specific venue types, critics, official sites, and concrete angles.

${categoryLegend}

Return ONLY minified JSON with this exact shape (include ONLY the active category keys, each with two string queries):
{"categories":{${keysJson}}}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2200,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`Gemini query-plan API ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!raw) throw new Error('Gemini query-plan returned empty content');

  let parsed: QueryPlanResponse | null = null;
  try {
    parsed = JSON.parse(raw) as QueryPlanResponse;
  } catch {
    // keep null; fallback below
  }

  const planned = uniqueStrings(keys.flatMap((key) => parsed?.categories?.[key] ?? []));

  if (planned.length >= totalQueries) return planned.slice(0, totalQueries);

  const fb = fallbackCategoryQueries(city, keys);
  const merged = uniqueStrings([...planned, ...fb]);
  return merged.slice(0, totalQueries);
}

function exaHighlightsQueryForCategories(city: string, keys: ScoutQueryCategoryKey[]): string {
  const parts = [city];
  if (keys.includes('tourism_sites')) {
    parts.push('monuments museums heritage archaeology historic sites UNESCO');
  }
  if (keys.includes('restaurants')) parts.push('restaurants dining cuisine chefs');
  if (keys.includes('attractions')) parts.push('attractions tours viewpoints experiences tickets');
  if (keys.includes('bars')) parts.push('bars cocktails wine nightlife');
  return parts.join(' ');
}

function categorySearchLabel(keys: ScoutQueryCategoryKey[]): string {
  if (keys.length === SCOUT_QUERY_CATEGORY_KEYS.length) return 'tourism · restaurants · attractions · bars';
  return keys.join(' · ');
}

async function fetchExaFullContentsByIds(apiKey: string, ids: string[]): Promise<Map<string, string>> {
  const idChunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 25) idChunks.push(ids.slice(i, i + 25));

  const textById = new Map<string, string>();
  for (const chunk of idChunks) {
    const res = await fetch('https://api.exa.ai/contents', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        ids: chunk,
        text: {
          maxCharacters: 12000,
        },
      }),
    });
    if (!res.ok) continue;
    const data = (await res.json()) as ExaContentsResponse;
    for (const item of data.results ?? []) {
      if (item.id && typeof item.text === 'string' && item.text.trim()) {
        textById.set(item.id, item.text);
      }
    }
  }
  return textById;
}

// ── Exa search — strategic category batching + full article fetch ─────────────

async function searchExa(city: string, categoryKeys: ScoutQueryCategoryKey[]): Promise<string> {
  const apiKey = process.env.EXA_API_KEY ?? '';

  const keys =
    categoryKeys.length > 0 ? categoryKeys : [...SCOUT_QUERY_CATEGORY_KEYS];
  const queryStrings = await generateScoutCategoryQueries(city, keys);
  const queries = queryStrings.map((query) => ({
    query,
    type: 'neural' as const,
    use_autoprompt: true,
    num_results: 25,
  }));

  const hl = exaHighlightsQueryForCategories(city, keys);
  console.log(
    `  → Exa category search (${queries.length} queries: ${categorySearchLabel(keys)})…`,
  );

  const settled = await Promise.allSettled(
    queries.map(async ({ query, type, use_autoprompt, num_results }) => {
      const body: Record<string, unknown> = {
        query,
        num_results,
        type,
        use_autoprompt,
        contents: {
          text: { maxCharacters: 1200 },
          highlights: {
            query: hl,
            numSentences: 3,
            highlightsPerUrl: 2,
          },
          summary: { query: `What makes this place special in ${city}?` },
        },
      };

      const res = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Exa ${res.status} on query "${query.slice(0, 60)}…": ${errText}`);
      }

      return (await res.json()) as ExaSearchResponse;
    }),
  );

  const chunks: string[] = [];
  const socialUrls: string[] = [];
  const allIds: string[] = [];
  const allResults: ExaResult[] = [];

  for (const result of settled) {
    if (result.status === 'rejected') {
      console.warn(`  ⚠️  Exa query failed: ${result.reason}`);
      continue;
    }
    for (const r of result.value.results) {
      allResults.push(r);
      if (r.id) allIds.push(r.id);
      if (
        r.url.includes('twitter.com') ||
        r.url.includes('x.com') ||
        r.url.includes('instagram.com') ||
        r.url.includes('tiktok.com')
      ) {
        socialUrls.push(r.url);
      }
    }
  }

  if (allResults.length === 0) throw new Error('Exa returned no results');

  // Pull full article text for deeper downstream extraction.
  let fullTextById = new Map<string, string>();
  try {
    fullTextById = await fetchExaFullContentsByIds(apiKey, uniqueStrings(allIds));
    if (fullTextById.size > 0) {
      console.log(`  → Exa full contents fetched for ${fullTextById.size} results`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Exa full content fetch failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  for (const r of allResults) {
    const parts: string[] = [];
    parts.push(`[${r.title ?? 'Untitled'}] (${r.url})`);
    if (r.summary) parts.push(`Summary: ${r.summary}`);
    if (r.highlights?.length) parts.push(`Highlights: ${r.highlights.join(' | ')}`);
    const full = r.id ? fullTextById.get(r.id) : undefined;
    if (full) {
      parts.push(`FullContent:\n${full.slice(0, 10000)}`);
    } else if (r.text) {
      parts.push(`Snippet:\n${r.text.slice(0, 1200)}`);
    }
    chunks.push(parts.join('\n'));
  }

  const deduped = [...new Set(socialUrls)];
  const socialBlock = deduped.length
    ? `\n\nSOCIAL PROOF URLS FOUND (use as social_proof_url if the place matches):\n${deduped.map((u) => `  - ${u}`).join('\n')}`
    : '';

  return chunks.join('\n\n━━━━━━━━━━\n\n') + socialBlock;
}

// ── Tavily fallback search ────────────────────────────────────────────────────

async function searchTavily(query: string): Promise<string> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      include_answer: true,
      max_results: 8,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}: ${await res.text()}`);
  const data = await res.json() as {
    answer?: string;
    results?: { title: string; url: string; content: string }[];
  };
  return [
    data.answer ?? '',
    ...(data.results ?? []).map(
      (r) => `[${r.title}] (${r.url})\n${r.content?.slice(0, 600) ?? ''}`,
    ),
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function gatherViaTavily(city: string, categoryKeys: ScoutQueryCategoryKey[]): Promise<string> {
  const keys =
    categoryKeys.length > 0 ? categoryKeys : [...SCOUT_QUERY_CATEGORY_KEYS];
  const queries = await generateScoutCategoryQueries(city, keys);

  console.log(
    `  → Tavily category search (${queries.length} queries: ${categorySearchLabel(keys)})…`,
  );
  const settled = await Promise.allSettled(queries.map(searchTavily));

  const chunks = settled.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );
  if (chunks.length === 0) throw new Error('Tavily returned no results');
  return chunks.join('\n\n━━━━━━━━━━\n\n');
}

// ── Mock content (rich enough for offline extraction tests) ───────────────────

const MOCK_CONTENT: Record<string, string> = {
  rome: `
    TikTok viral: Supplì Roma at Via San Francesco a Ripa — best supplì in Rome, queues out the door,
    locals-only spot #roma #streetfood https://www.tiktok.com/@supplìroma. Il Sorpasso bar in Prati —
    aperitivo terrace views, massive on Instagram @ilsorpassoroma https://www.instagram.com/ilsorpassoroma,
    locals love the spritz hour. Pizzarium Bonci — pizza al taglio going viral worldwide for unconventional
    toppings, Michelin-mentioned. Testaccio market — where Romans actually shop for fresh produce, zero
    tourists, authentic neighbourhood. Tram Depot cafe Testaccio — converted tram depot turned neighbourhood
    bar, local favourite. Vineria Il Chianti — secret wine bar in alley off Campo de' Fiori, not in any
    guidebook. Quarticciolo street art district — hidden gem, Rome's answer to Shoreditch, locals only
    https://www.tiktok.com/@romestreetart. Ponte Sisto sunset spot — romantic lesser-known bridge,
    breathtaking views, viral on Pinterest.
  `,
  paris: `
    TikTok famous: Rosa Bonheur sur Seine — floating bar on the Seine, #paris trending, @rosabonheur
    https://www.instagram.com/rosabonheur. Le Perchoir Ménilmontant rooftop — hidden gem locals adore,
    stunning panorama. Le Train Bleu brasserie inside Gare de Lyon — Belle Époque masterpiece, tourists
    walk past it daily. Chez Janou bistro in Le Marais — 79 types of pastis, locals favourite, no
    tourists. Marché d'Aligre — most authentic Paris market, hidden from guidebooks, local shopping.
    Les Papilles wine bistro — hidden gem, prix fixe menu, locals queue outside every weekend. Septime
    restaurant — world-famous natural wine bistro, Parisian foodies obsessed. Ob-La-Di café Marais —
    viral brunch spot https://www.instagram.com/obladicafe.
  `,
  london: `
    Going viral on TikTok: Dishoom Covent Garden — legendary Indian breakfast, queue worthy
    https://www.instagram.com/dishoom. Maltby Street Market south London — hidden foodie gem, locals only
    Saturday mornings. Netil360 rooftop Hackney — trending on Instagram for Hackney skyline views
    https://www.instagram.com/netil360. Brockwell Park Lido — local south London secret, open-air
    swimming. HIDE restaurant Piccadilly — viral for stunning tree interior https://www.instagram.com/hiderestaurant.
    Leake Street Tunnel Waterloo — legal graffiti tunnel hidden under station. Bermondsey Beer Mile —
    craft beer corridor, local favourite. The Marksman gastropub Hackney — locals swear by it, unknown
    to tourists.
  `,
  tokyo: `
    TikTok viral: Omoide Yokocho (Memory Lane) Shinjuku — smoky yakitori alley, underground gem, locals
    and expats https://www.tiktok.com/@tokyofood. Golden Gai — six narrow alleys with 200 tiny bars,
    each fits 5 people, hidden gem https://www.instagram.com/goldengai_tokyo. Shimokitazawa — vinyl
    records, indie cafes, vintage shops, local artists' neighbourhood. Yanaka Ginza — old Tokyo feeling,
    traditional craft shops, no tourists, hidden gem. Koenji — underground music bars, alternative scene,
    locals only. Nakameguro at cherry blossom — riverside path, candlelit trees, viral on every platform.
    Tsukiji Outer Market — still the real deal for fresh seafood breakfast, locals tip: arrive 6am.
    Harmonica Yokocho Kichijoji — tiny bar alley, local favourite late-night spot.
  `,
  barcelona: `
    TikTok trending: Bar La Plata Barri Gòtic — standing-only bodega, 4 items on menu, locals only since
    1945 https://www.tiktok.com/@barcelonafood. El Xampanyet cava bar El Born — legendary, locals pack it
    every evening https://www.instagram.com/elxampanyet. Mercat de l'Abaceria Gràcia — locals' market vs
    touristy Boqueria, hidden gem. Bunkers del Carmel — best 360° Barcelona view, locals' sunset spot,
    viral on Instagram. El Salón cocktail bar — secret underground bar in Gothic Quarter, no sign on door.
    La Barceloneta beach chiringuitos — beach bars locals use, not tourist traps. Poblenou neighbourhood —
    Barcelona's creative district, local art scene, no tourists. Bar Marsella — oldest bar in Barcelona,
    absinthe specialist, atmospheric hidden gem.
  `,
  athens: `
    Viral: The Clumsies bar — World's 50 Best Bars, Athens locals and expats obsessed
    https://www.instagram.com/theclumsies. Strefi Hill — locals-only sunset spot, panoramic views over
    Athens, zero tourists, hidden gem. Stavros Niarchos Foundation rooftop park — trending on IG for
    Athens views https://www.instagram.com/snfcc. Exarchia neighbourhood — authentic Athens, artists,
    anarchists, real local cafes. Birdman cocktail bar — hidden gem, not in Lonely Planet, local
    favourite. Varvakios market — authentic Athens central market, where locals shop. Psyrri neighbourhood
    — vibrant, where Athenians go out. Little Tree Books and Coffee — viral neighbourhood cafe
    https://www.instagram.com/littletreebooks.
  `,
  budapest: `
    TikTok sensation: Szimpla Kert ruin bar — must-visit, #budapest viral
    https://www.instagram.com/szimplakert. Instant-Fogas massive ruin bar complex — huge on social media.
    Gerbeaud Confectionery — historic café viral for luxury pastries https://www.instagram.com/gerbeaud.
    New York Café — most Instagram-worthy interior in Budapest. Gellért Hill hidden viewpoint — local
    secret, panoramic views, zero tourists midweek. Holdudvar market hall — locals food market, artisan
    produce, unknown to tourists. Fekete espresso bar — best specialty coffee locals swear by. Kazinczy
    Street ruin bar area — authentic Budapest nightlife hidden in Jewish Quarter.
  `,
};

function getMockContent(city: string): string {
  const key = city.toLowerCase();
  return (
    MOCK_CONTENT[key] ??
    `Trending spots in ${city}: vibrant local market scene, hidden rooftop bars with city views,
    authentic neighbourhood restaurants locals love, viral photo spots shared on TikTok and Instagram,
    and secret cafes that only residents know about. The city has a thriving food scene with hidden gems
    in residential areas, away from the tourist trail.`
  );
}

// ── Engine selector ───────────────────────────────────────────────────────────

type Engine = 'exa' | 'tavily' | 'mock';

async function gatherRawContent(
  city: string,
  forceMock: boolean,
  forceExa: boolean,
  liveOnly: boolean,
  categoryKeys: ScoutQueryCategoryKey[],
): Promise<{ content: string; engine: Engine }> {
  if (forceMock) {
    console.log('  → Mode: MOCK (forced)');
    return { content: getMockContent(city), engine: 'mock' };
  }

  const hasExa    = !!process.env.EXA_API_KEY    && !process.env.EXA_API_KEY.includes('your_');
  const hasTavily = !!process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_');

  if (liveOnly && !hasExa && !hasTavily) {
    throw new Error(
      'Live-only mode requires TAVILY_API_KEY or EXA_API_KEY (mock fallback disabled).',
    );
  }

  // Tavily — PRIMARY engine (unless --exa forces the legacy Exa path)
  if (hasTavily && !forceExa) {
    try {
      const content = await gatherViaTavily(city, categoryKeys);
      return { content, engine: 'tavily' };
    } catch (err) {
      console.warn(`  ⚠️  Tavily failed: ${err instanceof Error ? err.message : err}`);
      if (liveOnly && !hasExa) {
        throw new Error(
          'Tavily failed and no Exa key for fallback (live-only mode; refusing mock data).',
        );
      }
      console.log('  → Falling back to Exa…');
    }
  }

  // Exa — fallback (or primary when --exa is passed)
  if (hasExa) {
    try {
      const content = await searchExa(city, categoryKeys);
      return { content, engine: 'exa' };
    } catch (err) {
      console.warn(`  ⚠️  Exa failed: ${err instanceof Error ? err.message : err}`);
      if (liveOnly) {
        throw new Error(
          'All live search engines failed (live-only mode; refusing mock data).',
        );
      }
      console.log('  → Falling back to mock data…');
    }
  }

  if (liveOnly) {
    const msg =
      forceExa && !hasExa
        ? '--exa requires EXA_API_KEY when using --live-only.'
        : 'No live search content available (live-only mode; refusing mock).';
    throw new Error(msg);
  }

  // Mock — final fallback
  if (!hasExa && !hasTavily) {
    console.log('  → No API keys set (TAVILY_API_KEY / EXA_API_KEY) — using mock data');
  } else {
    console.log('  → All live engines failed — using mock data');
  }
  return { content: getMockContent(city), engine: 'mock' };
}

// ── Gemini extraction (no Claude tokens consumed) ────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message: string; code: number };
}

function parseGeminiPlaces(raw: string): unknown[] {
  const text = raw.trim();
  const candidates: string[] = [];

  // Preferred: strict array from first [ to last ]
  const arrayStart = text.indexOf('[');
  const arrayEnd = text.lastIndexOf(']');
  if (arrayStart !== -1 && arrayEnd !== -1 && arrayEnd > arrayStart) {
    candidates.push(text.slice(arrayStart, arrayEnd + 1));
  }

  // Fallback: full payload might already be plain JSON object or array
  if (text.startsWith('{') || text.startsWith('[')) {
    candidates.push(text);
  }

  let lastErr: unknown;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (Array.isArray(parsed)) return parsed;
      if (parsed && typeof parsed === 'object') return [parsed];
    } catch (err) {
      lastErr = err;
    }
  }

  // Final fallback for truncated output: recover complete objects that already closed.
  const recovered = recoverClosedObjectsFromTruncatedArray(text);
  if (recovered.length > 0) {
    console.warn(`  ⚠️  Gemini returned truncated JSON — recovered ${recovered.length} complete object(s)`);
    return recovered;
  }

  throw new Error(
    `Gemini did not return parseable JSON (${lastErr instanceof Error ? lastErr.message : 'unknown parse error'}). Preview:\n${text.slice(0, 400)}`,
  );
}

function recoverClosedObjectsFromTruncatedArray(text: string): unknown[] {
  const start = text.indexOf('[');
  if (start === -1) return [];

  const objects: unknown[] = [];
  let inString = false;
  let escaped = false;
  let depthArray = 0;
  let depthObject = 0;
  let objectStart = -1;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === '[') {
      depthArray++;
      continue;
    }

    if (ch === ']') {
      depthArray = Math.max(0, depthArray - 1);
      continue;
    }

    if (ch === '{') {
      if (depthArray > 0 && depthObject === 0) {
        objectStart = i;
      }
      depthObject++;
      continue;
    }

    if (ch === '}') {
      depthObject = Math.max(0, depthObject - 1);
      if (depthArray > 0 && depthObject === 0 && objectStart !== -1) {
        const candidate = text.slice(objectStart, i + 1);
        try {
          objects.push(JSON.parse(candidate) as unknown);
        } catch {
          // Ignore malformed fragment; keep scanning for later valid objects.
        }
        objectStart = -1;
      }
    }
  }

  return objects;
}

function filterPlacesByScoutKeys(
  places: Place[],
  keys: ScoutQueryCategoryKey[],
): Place[] {
  if (keys.length === 0) return places;
  const allowed = new Set(keys.map(scoutQueryKeyToPlaceCategory));
  return places.filter((p) => allowed.has(p.category));
}

function normalizeParsedPlaces(parsed: unknown[], city: string): Place[] {
  const flatParsed = parsed.flatMap((item) => (Array.isArray(item) ? item : [item]));
  return flatParsed.flatMap((p): Place[] => {
    if (typeof p !== 'object' || p === null) return [];
    const place = p as Record<string, unknown>;
    const name = typeof place.name === 'string' ? place.name.trim() : '';
    const lat = toNumber(place.lat);
    const lng = toNumber(place.lng);
    const qualityScore = toNumber(place.quality_score);

    if (!name || lat === null || lng === null || lat === 0 || lng === 0) return [];

    return [{
      city: typeof place.city === 'string' && place.city.trim() ? place.city.trim() : city,
      name,
      category: typeof place.category === 'string' ? place.category.trim() : 'attraction',
      description: typeof place.description === 'string' ? place.description.trim() : '',
      lat,
      lng,
      category_emoji: typeof place.category_emoji === 'string' ? place.category_emoji.trim() : '📍',
      social_proof_url:
        typeof place.social_proof_url === 'string' && place.social_proof_url.trim()
          ? place.social_proof_url.trim()
          : null,
      vibe_label: typeof place.vibe_label === 'string' ? place.vibe_label.trim() : 'hidden-gem',
      quality_score: qualityScore ?? undefined,
    }];
  });
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes('Gemini API 429') || msg.toLowerCase().includes('quota');
}

async function extractPlacesWithGemini(
  city: string,
  rawContent: string,
  scoutCategoryKeys: ScoutQueryCategoryKey[],
): Promise<Place[]> {
  const model  = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const apiKey = process.env.GEMINI_API_KEY ?? '';

  if (!apiKey || apiKey.includes('your_')) {
    throw new Error('GEMINI_API_KEY is not set in .env.local');
  }

  // Strategic one-shot extraction: maximize context to keep Gemini at one call.
  const maxInputChars = 120000;
  const normalizedRawContent = rawContent.length > maxInputChars
    ? rawContent.slice(0, maxInputChars)
    : rawContent;

  if (rawContent.length > maxInputChars) {
    console.log(`  → Truncated research payload: ${rawContent.length.toLocaleString()} → ${maxInputChars.toLocaleString()} chars`);
  }

  console.log(`  → Gemini model: ${model}`);

  const keysEffective =
    scoutCategoryKeys.length > 0 ? scoutCategoryKeys : [...SCOUT_QUERY_CATEGORY_KEYS];
  const allFour =
    keysEffective.length === SCOUT_QUERY_CATEGORY_KEYS.length &&
    SCOUT_QUERY_CATEGORY_KEYS.every((k) => keysEffective.includes(k));
  const dbCatsAllowlist = uniqueStrings(
    keysEffective.map(scoutQueryKeyToPlaceCategory),
  ).join(' | ');

  const scoutScopeBlock = allFour
    ? `SCOUT BALANCE (strict — raw research was gathered in four buckets):
- Roughly equal counts across: tourism sites (heritage/monuments/museums-as-sights), attractions (experiences/tours/viewpoints/ticketed venues), restaurants, bars.
- Assign category (below) to match the venue type; do not label a bar as a restaurant or a monument as an attraction if it is purely a heritage sight.`
    : `FOCUS (strict): Research was scoped ONLY to: ${keysEffective.join(', ')}.
- Extract ONLY venues that belong to these types.
- Every object's "category" MUST be one of: ${dbCatsAllowlist}
- Ignore mentions of other venue types; do not pad with unrelated venues to reach the target count.`;

  const exampleCategoryLiteral = scoutQueryKeyToPlaceCategory(keysEffective[0]);

  const prompt = `You are a strategic travel data extraction agent for TravelOS.

CITY: ${city}

RAW RESEARCH CONTENT (web search results, blog posts, social media signals):
${normalizedRawContent}

Your task: return EXACTLY ${TARGET_PLACES_PER_RUN} high-quality places from the raw data, optimized for database ingestion.

${scoutScopeBlock}

QUALITY FILTER (strict):
- Prefer iconic, critically praised, or standout venues with evidence in the raw text
- Reject generic chains, vague neighborhoods, and non-specific venues
- Prefer entries with strong evidence from sources

VIBE LABEL GUIDE:
- "luxury-pick"    → premium/high-end/luxury/fine dining
- "hidden-gem"     → locals-only/secret/underground
- "local-favorite" → neighborhood staple with authentic local traction
- "classic"        → iconic and still relevant
- "viral-trend"    → social buzz
- "budget-pick"    → strong value spot

For each place output an object with EXACTLY these fields:
{
  "city": "${city}",
  "name": "Official venue name",
  "category": "${exampleCategoryLiteral}",
  "description": "Concise vibe summary (max 28 words). Mention why it qualifies under quality filter.",
  "lat": 0.0000,
  "lng": 0.0000,
  "category_emoji": "🍕",
  "social_proof_url": "https://... or null",
  "vibe_label": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick",
  "quality_score": 0
}

STRICT RULES:
1) Return EXACTLY ${TARGET_PLACES_PER_RUN} objects.
2) All names must be unique.
3) Coordinates must be specific to venue, not city center.
4) quality_score is integer 1-10.
5) Minimum quality_score allowed: 7.
6) Do NOT invent social_proof_url; if unavailable return null.
7) Each "category" must be exactly one of: ${dbCatsAllowlist}.
8) Return ONLY valid minified JSON array in one line.
9) No markdown, no comments, no prose.`;

  const runGemini = async (requestPrompt: string, maxOutputTokens: number): Promise<string> => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: requestPrompt }] }],
        generationConfig: {
          temperature:      0.1,
          maxOutputTokens,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await res.json()) as GeminiResponse;
    if (data.error) {
      throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);
    }

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
    if (!raw) throw new Error('Gemini returned an empty response.');
    return raw;
  };

  let normalizedPlaces: Place[] = [];
  try {
    const raw = await runGemini(prompt, 12288);
    const parsed = parseGeminiPlaces(raw);
    normalizedPlaces = filterPlacesByScoutKeys(
      normalizeParsedPlaces(parsed, city),
      keysEffective,
    );
  } catch (err) {
    if (isQuotaError(err)) {
      throw new Error('Gemini quota exceeded (429). Increase quota/billing and retry.');
    }
    console.warn(`  ⚠️  Primary 50-pack extraction failed: ${err instanceof Error ? err.message : String(err)}`);
    console.warn('  → Continuing with strict top-up mode from Exa evidence only…');
  }

  const dedupe = (places: Place[]): Place[] => {
    const seen = new Set<string>();
    const unique: Place[] = [];
    for (const p of places) {
      const key = `${p.city.toLowerCase()}|${p.name.toLowerCase()}|${p.lat.toFixed(4)}|${p.lng.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(p);
    }
    return unique;
  };

  normalizedPlaces = dedupe(normalizedPlaces);

  if (normalizedPlaces.length < TARGET_PLACES_PER_RUN) {
    console.log(`  → Top-up extraction: ${normalizedPlaces.length}/${TARGET_PLACES_PER_RUN} places`);
    const chunkSize = 10000;
    const maxBatches = 20;
    const maxPerBatch = 5;

    for (let batch = 0; batch < maxBatches; batch++) {
      if (normalizedPlaces.length >= TARGET_PLACES_PER_RUN) break;
      const offset = (batch * chunkSize) % Math.max(rawContent.length, 1);
      const chunk = rawContent.slice(offset, offset + chunkSize);
      if (!chunk) break;

      const remaining = TARGET_PLACES_PER_RUN - normalizedPlaces.length;
      const takeCount = Math.min(remaining, maxPerBatch);
      const excludedNames = normalizedPlaces.map((p) => p.name).slice(0, 80).join(' | ');

      const topUpPrompt = `You are filling missing records for a travel database.

CITY: ${city}
RAW EVIDENCE CHUNK:
${chunk}

Return EXACTLY ${takeCount} places from THIS CHUNK ONLY as minified JSON array in one line.
Critical anti-hallucination rules:
1) Include only venues explicitly named in RAW EVIDENCE CHUNK text.
2) If you cannot find enough explicit venues, return fewer objects rather than inventing.
3) Do not include any of these already selected names: ${excludedNames || 'NONE'}.
4) Keep high-quality venues; category must be one of: ${dbCatsAllowlist}.
5) social_proof_url must come from evidence; otherwise null.

Schema per object:
city,name,category (${dbCatsAllowlist}),description,lat,lng,category_emoji,social_proof_url,vibe_label,quality_score

No markdown. No prose. JSON only.`;

      try {
        const rawTopUp = await runGemini(topUpPrompt, 1800);
        const parsedTopUp = parseGeminiPlaces(rawTopUp);
        const normalizedTopUp = filterPlacesByScoutKeys(
          normalizeParsedPlaces(parsedTopUp, city),
          keysEffective,
        );
        if (normalizedTopUp.length === 0) continue;
        normalizedPlaces = dedupe([...normalizedPlaces, ...normalizedTopUp]);
      } catch (err) {
        if (isQuotaError(err)) {
          console.warn('  ⚠️  Gemini quota reached during top-up; stopping with current valid places.');
          break;
        }
        // Continue best-effort with next chunk.
      }
    }
  }

  if (normalizedPlaces.length < TARGET_PLACES_PER_RUN) {
    console.warn(`  ⚠️  Final result: ${normalizedPlaces.length}/${TARGET_PLACES_PER_RUN} places (best effort, no hallucination mode).`);
  }

  normalizedPlaces = filterPlacesByScoutKeys(normalizedPlaces, keysEffective);
  return normalizedPlaces.slice(0, TARGET_PLACES_PER_RUN);
}

// ── YouTube Data API v3 (short / vibe clip — only when clearly about this place) ─

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Parse ISO-8601 duration from videos.contentDetails (e.g. PT1M45S). */
function iso8601DurationToSeconds(iso: string): number {
  if (!iso || !iso.startsWith('PT')) return NaN;
  let sec = 0;
  const h = iso.match(/(\d+)H/);
  const m = iso.match(/(\d+)M/);
  const s = iso.match(/(\d+)S/);
  if (h) sec += parseInt(h[1], 10) * 3600;
  if (m) sec += parseInt(m[1], 10) * 60;
  if (s) sec += parseInt(s[1], 10);
  return sec;
}

/** Max length for Short-style / vibe clips (reject long vlogs even if "short" tier). */
const YT_MAX_CLIP_SECONDS = 90;

const YT_GENERIC_TOKENS = new Set([
  'the', 'and', 'for', 'with', 'from', 'your', 'best', 'top', 'visit', 'travel', 'guide', 'tour', 'walking',
  'city', 'food', 'restaurant', 'cafe', 'bar', 'hotel', 'day', 'night', 'vlog', 'video', 'official',
  'short', 'shorts', 'cinematic', 'vibe', 'tiktok', 'reels', 'viral', 'must', 'see', 'beautiful',
]);

function normalizeMatchBlob(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05FF\s]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Require city in title/description plus strong place-name signal — avoids unrelated uploads.
 */
function youtubeSnippetMatchesPlace(
  title: string,
  description: string,
  placeName: string,
  cityName: string,
): boolean {
  const blob = normalizeMatchBlob(`${title}\n${description}`);
  const city = normalizeMatchBlob(cityName);
  const place = normalizeMatchBlob(placeName);

  if (!blob || city.length < 2 || place.length < 2) return false;
  if (!blob.includes(city)) return false;

  if (place.length >= 5 && blob.includes(place)) return true;

  const tokens = place.split(/\s+/).filter((w) => w.length > 2 && !YT_GENERIC_TOKENS.has(w));
  if (tokens.length === 0) {
    return place.length >= 5 && blob.includes(place);
  }
  if (tokens.length === 1) {
    return tokens[0].length >= 5 && blob.includes(tokens[0]);
  }
  const hits = tokens.filter((t) => blob.includes(t)).length;
  return hits >= Math.min(2, tokens.length);
}

interface YtSearchResponse {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; description?: string };
  }>;
  error?: { message?: string };
}

interface YtSearchCandidate {
  videoId: string;
  title: string;
  description: string;
}

interface YtVideosResponse {
  items?: Array<{ id: string; contentDetails?: { duration?: string } }>;
  error?: { message?: string };
}

async function youtubeSearchCandidates(placeName: string, cityName: string, apiKey: string): Promise<YtSearchCandidate[]> {
  const q = `${placeName.trim()} ${cityName.trim()} travel cinematic short vibes`
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
  if (!q) return [];

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '10',
    q,
    key: apiKey,
    videoDuration: 'short',
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  const data = (await res.json()) as YtSearchResponse;
  if (!res.ok) {
    console.warn(`   ⚠️  YouTube search HTTP ${res.status}: ${data.error?.message ?? res.statusText}`);
    return [];
  }
  if (data.error?.message) {
    console.warn(`   ⚠️  YouTube search: ${data.error.message}`);
    return [];
  }

  const out: YtSearchCandidate[] = [];
  for (const it of data.items ?? []) {
    const vid = it.id?.videoId;
    const sn = it.snippet;
    if (!vid) continue;
    out.push({
      videoId: vid,
      title: sn?.title ?? '',
      description: sn?.description ?? '',
    });
  }
  return out;
}

async function youtubeFetchDurations(videoIds: string[], apiKey: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const chunk = videoIds.slice(0, 50);
  if (chunk.length === 0) return map;
  const params = new URLSearchParams({
    part: 'contentDetails',
    id: chunk.join(','),
    key: apiKey,
  });
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  const data = (await res.json()) as YtVideosResponse;
  if (!res.ok || data.error?.message) return map;
  for (const it of data.items ?? []) {
    const raw = it.contentDetails?.duration;
    if (raw) {
      const sec = iso8601DurationToSeconds(raw);
      if (Number.isFinite(sec)) map.set(it.id, sec);
    }
  }
  return map;
}

/**
 * Returns a videoId only when: duration known, clip short enough, and title/description match place+city.
 * Otherwise null (leave Supabase column empty).
 */
async function resolveYoutubeVideoId(placeName: string, cityName: string, apiKey: string): Promise<string | null> {
  const candidates = await youtubeSearchCandidates(placeName, cityName, apiKey);
  if (candidates.length === 0) return null;

  const durations = await youtubeFetchDurations(
    candidates.map((c) => c.videoId),
    apiKey,
  );

  for (const c of candidates) {
    if (!youtubeSnippetMatchesPlace(c.title, c.description, placeName, cityName)) continue;

    const sec = durations.get(c.videoId);
    if (sec == null || !Number.isFinite(sec) || sec <= 0 || sec > YT_MAX_CLIP_SECONDS) continue;

    return c.videoId;
  }

  return null;
}

// ── Top-Picks bucketing (drives the Step 7 onboarding card) ──────────────────
// Maps the agent's DB category to the curated Top Sights category, then
// ranks by quality_score within each (city, top_pick_category) bucket.
// Bar venues are intentionally skipped — Top Sights has only three buckets.

type TopPickCategory = 'sightseeing' | 'history' | 'food';

function placeCategoryToTopPick(category: string): TopPickCategory | null {
  switch (category.toLowerCase()) {
    case 'attraction':    return 'sightseeing';
    case 'tourism_site':  return 'history';
    case 'restaurant':
    case 'cafe':
    case 'market':        return 'food';
    case 'bar':           return null;
    default:              return null;
  }
}

const TOP_PICKS_PER_CATEGORY = 15;

/**
 * Assigns popularity_rank to each place within its (city, top_pick_category)
 * bucket, capped at TOP_PICKS_PER_CATEGORY. Mutates the array in place and
 * returns a count summary for logging.
 */
function assignTopPickRanks(places: Place[]): { sightseeing: number; history: number; food: number } {
  const buckets: Record<TopPickCategory, Place[]> = { sightseeing: [], history: [], food: [] };
  for (const p of places) {
    const top = placeCategoryToTopPick(p.category);
    if (!top) continue;
    buckets[top].push(p);
  }
  const counts = { sightseeing: 0, history: 0, food: 0 };
  for (const key of ['sightseeing', 'history', 'food'] as const) {
    // Higher quality_score first; null scores sink to the bottom.
    buckets[key].sort((a, b) => (b.quality_score ?? 0) - (a.quality_score ?? 0));
    buckets[key].slice(0, TOP_PICKS_PER_CATEGORY).forEach((p, idx) => {
      (p as Place & { _top_pick_category?: TopPickCategory; _popularity_rank?: number })._top_pick_category = key;
      (p as Place & { _top_pick_category?: TopPickCategory; _popularity_rank?: number })._popularity_rank   = idx + 1;
      counts[key]++;
    });
  }
  return counts;
}

// ── Supabase upsert (service-role key bypasses RLS) ───────────────────────────

async function upsertPlaces(
  places: Place[],
): Promise<{ inserted: number; skipped: number; errors: number; youtubeTagged: number; topPicks: { sightseeing: number; history: number; food: number } }> {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let inserted = 0;
  let skipped  = 0;
  let errors   = 0;
  let youtubeTagged = 0;

  const skipYoutube = process.argv.includes('--skip-youtube');
  const ytKey       = (process.env.YOUTUBE_API_KEY ?? process.env.YOUTUBE_DATA_API_KEY ?? '').trim();

  if (!skipYoutube && !ytKey) {
    console.log('   ℹ️  YOUTUBE_API_KEY not set — youtube_video_id will be null on new rows');
  }

  // Compute Top Picks ranks across this batch BEFORE inserts so we can write
  // them in the same round trip as the rest of the columns.
  const topPicks = assignTopPickRanks(places);

  for (const place of places) {
    const meta = place as Place & { _top_pick_category?: TopPickCategory; _popularity_rank?: number };
    // Duplicate check: same name + city (case-insensitive)
    const { data: existing, error: selectErr } = await supabase
      .from('places')
      .select('id')
      .ilike('name', place.name.trim())
      .ilike('city', place.city.trim())
      .maybeSingle();

    if (selectErr) {
      console.error(`  ✗ SELECT error for "${place.name}": ${selectErr.message}`);
      errors++;
      continue;
    }

    if (existing) {
      // Row already in DB — refresh its Top Picks fields when this run
      // ranked it. Otherwise leave it untouched.
      if (meta._top_pick_category && meta._popularity_rank) {
        const { error: updErr } = await supabase
          .from('places')
          .update({
            top_pick_category: meta._top_pick_category,
            popularity_rank:   meta._popularity_rank,
          })
          .eq('id', (existing as { id: string }).id);
        if (updErr) {
          console.warn(`  ⚠️  Top-pick update skipped for "${place.name}": ${updErr.message}`);
        } else {
          console.log(`  ✏️  REFRESH  ${place.category_emoji} ${place.name.padEnd(36)} [${meta._top_pick_category} #${meta._popularity_rank}]`);
        }
      } else {
        console.log(`  ⏩ SKIP     ${place.category_emoji} ${place.name} (already in DB)`);
      }
      skipped++;
      continue;
    }

    let youtubeVideoId: string | null = null;
    if (!skipYoutube && ytKey) {
      try {
        youtubeVideoId = await resolveYoutubeVideoId(place.name, place.city, ytKey);
      } catch (err) {
        console.warn(
          `   ⚠️  YouTube lookup failed for "${place.name}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await sleep(80);
    }

    const { error: insertErr } = await supabase.from('places').insert([{
      city:               place.city,
      name:               place.name,
      category:           place.category,
      description:        place.description,
      lat:                place.lat,
      lng:                place.lng,
      category_emoji:     place.category_emoji,
      social_proof_url:   place.social_proof_url,
      vibe_label:         place.vibe_label,
      youtube_video_id:   youtubeVideoId,
      // Top Picks metadata (only set when this place won a rank slot)
      top_pick_category:  meta._top_pick_category ?? null,
      popularity_rank:    meta._popularity_rank   ?? null,
    }]);

    if (insertErr) {
      console.error(`  ✗ INSERT error for "${place.name}": ${insertErr.message}`);
      errors++;
    } else {
      if (youtubeVideoId) youtubeTagged++;
      const ytHint = youtubeVideoId ? ` 🎬 ${youtubeVideoId}` : '';
      const topHint = meta._top_pick_category
        ? ` ⭐ ${meta._top_pick_category} #${meta._popularity_rank}`
        : '';
      console.log(
        `  ✓ INSERTED ${place.category_emoji} ${place.name.padEnd(36)} [${place.vibe_label}]${ytHint}${topHint}`,
      );
      inserted++;
    }
  }

  return { inserted, skipped, errors, youtubeTagged, topPicks };
}

// ── Janitor: verify stale places ──────────────────────────────────────────────

interface StalePlace {
  id: string;
  name: string;
  city: string;
  category_emoji: string;
  vibe_label: string;
  last_verified_at: string | null;
  status: string | null;
}

async function runJanitor(filterCity: string | undefined, dryRun: boolean): Promise<void> {
  const apiKey = process.env.EXA_API_KEY ?? '';
  if (!apiKey || apiKey.includes('your_')) {
    console.error('✗ Janitor mode requires EXA_API_KEY to be set in .env.local');
    process.exit(1);
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase    = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 30-day staleness cutoff
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Query stale places
  let query = supabase
    .from('places')
    .select('id, name, city, category_emoji, vibe_label, last_verified_at, status')
    .or(`last_verified_at.is.null,last_verified_at.lt.${cutoff}`)
    .order('last_verified_at', { ascending: true });

  if (filterCity) {
    query = query.ilike('city', filterCity);
  }

  const { data: stalePlaces, error } = await query;
  if (error) {
    console.error(`✗ Supabase query error: ${error.message}`);
    process.exit(1);
  }

  const places = (stalePlaces ?? []) as StalePlace[];
  console.log(`   Found ${places.length} stale place${places.length !== 1 ? 's' : ''} (unverified or last checked > 30 days ago)\n`);

  if (places.length === 0) {
    console.log('✅ All places are up-to-date. Nothing to do.');
    return;
  }

  let verified = 0;
  let flagged  = 0;
  let errors   = 0;

  for (const place of places) {
    const age = place.last_verified_at
      ? Math.floor((Date.now() - new Date(place.last_verified_at).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const ageLabel = age !== null ? `${age}d ago` : 'never verified';

    process.stdout.write(`  🔍 ${place.category_emoji} ${place.name.padEnd(36)} [${ageLabel}] → `);

    try {
      const result = await verifyWithExa(place.name, place.city, apiKey);

      const statusMap: Record<string, string> = {
        'verified-open':      'open',
        'flagged-closed':     'closed',
        'flagged-renovating': 'renovating',
        'unverified':         'unverified',
      };
      const newStatus = statusMap[result.status] ?? 'unverified';
      const icon =
        result.status === 'verified-open'      ? '✓ OPEN' :
        result.status === 'flagged-closed'     ? '⚠ CLOSED' :
        result.status === 'flagged-renovating' ? '🔧 RENOVATING' : '? UNKNOWN';

      console.log(icon);
      if (result.signal) console.log(`       Signal: "${result.signal}"`);

      if (dryRun) {
        verified++;
        if (result.status !== 'verified-open' && result.status !== 'unverified') flagged++;
        continue;
      }

      const { error: updateErr } = await supabase
        .from('places')
        .update({
          last_verified_at: result.checkedAt,
          status:           newStatus,
        })
        .eq('id', place.id);

      if (updateErr) {
        console.error(`       ✗ Update failed: ${updateErr.message}`);
        errors++;
      } else {
        verified++;
        if (result.status !== 'verified-open' && result.status !== 'unverified') flagged++;
      }
    } catch (err) {
      console.log('✗ ERROR');
      console.error(`       ${err instanceof Error ? err.message : String(err)}`);
      errors++;
    }

    // Small delay to avoid hammering Exa
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log('');
  console.log(dryRun ? '✅ Janitor dry-run complete (no writes)!' : '✅ Janitor complete!');
  console.log(`   Verified : ${verified} (${verified - flagged} open, ${flagged} flagged)`);
  console.log(`   Errors   : ${errors}`);
  if (flagged > 0 && !dryRun) {
    console.log(`\n   ⚠  ${flagged} place${flagged !== 1 ? 's' : ''} flagged — check Supabase and remove or update them`);
  }
}

// Lightweight inline Exa call — avoids importing src/lib/verification.ts
// (keeps the script self-contained; the logic mirrors verification.ts exactly)
async function verifyWithExa(
  name: string,
  city: string,
  apiKey: string,
): Promise<{ status: string; signal?: string; checkedAt: string }> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        query: `"${name}" ${city} closed renovating construction 2025 2026`,
        num_results: 5,
        type: 'keyword',
        use_autoprompt: false,
        contents: {
          highlights: {
            query: `${name} closed OR renovating OR construction OR temporarily closed`,
            numSentences: 2,
            highlightsPerUrl: 2,
          },
        },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return { status: 'unverified', checkedAt };

    const data = (await res.json()) as { results: Array<{ highlights?: string[] }> };
    const highlights = data.results.flatMap((r) => r.highlights ?? []);
    const HOURS = /close[sd]?\s+at\s+\d|closes?\s+\d|open\s+until|\d\s*[ap]m|\d{1,2}:\d{2}/i;

    const patterns: Array<{ re: RegExp; status: string; lowConf: boolean }> = [
      { re: /permanently\s+closed/i,               status: 'flagged-closed',      lowConf: false },
      { re: /closed\s+permanently/i,               status: 'flagged-closed',      lowConf: false },
      { re: /no\s+longer\s+(open|operating)/i,     status: 'flagged-closed',      lowConf: false },
      { re: /temporarily\s+closed/i,               status: 'flagged-closed',      lowConf: false },
      { re: /closed\s+for\s+renovation/i,          status: 'flagged-renovating',  lowConf: false },
      { re: /under\s+(major\s+)?renovation/i,      status: 'flagged-renovating',  lowConf: false },
      { re: /\bclosed\b/i,                         status: 'flagged-closed',      lowConf: true  },
      { re: /\bconstruction\b/i,                   status: 'flagged-renovating',  lowConf: true  },
    ];

    for (const h of highlights) {
      for (const { re, status, lowConf } of patterns) {
        if (!re.test(h)) continue;
        if (lowConf && HOURS.test(h)) continue;
        return { status, signal: h.slice(0, 120).trim(), checkedAt };
      }
    }
    return { status: 'verified-open', checkedAt };
  } catch {
    clearTimeout(timer);
    return { status: 'unverified', checkedAt };
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

const CATEGORY_ARG_ALIASES: Record<string, ScoutQueryCategoryKey> = {
  tourism_sites: 'tourism_sites',
  tourism: 'tourism_sites',
  heritage: 'tourism_sites',
  sites: 'tourism_sites',
  monuments: 'tourism_sites',
  restaurants: 'restaurants',
  restaurant: 'restaurants',
  food: 'restaurants',
  dining: 'restaurants',
  attractions: 'attractions',
  attraction: 'attractions',
  bars: 'bars',
  bar: 'bars',
};

function resolveScoutCategoryToken(token: string): ScoutQueryCategoryKey | null {
  const t = token.trim().toLowerCase();
  if (!t) return null;
  if (CATEGORY_ARG_ALIASES[t]) return CATEGORY_ARG_ALIASES[t];
  if ((SCOUT_QUERY_CATEGORY_KEYS as readonly string[]).includes(t)) return t as ScoutQueryCategoryKey;
  return null;
}

function parseCategoriesCliArg(raw: string): ScoutQueryCategoryKey[] {
  const tokens = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (tokens.length === 0) {
    throw new Error('--categories requires a non-empty comma-separated list.');
  }
  const out: ScoutQueryCategoryKey[] = [];
  const seen = new Set<ScoutQueryCategoryKey>();
  for (const tok of tokens) {
    const r = resolveScoutCategoryToken(tok);
    if (!r) {
      throw new Error(
        `Unknown category "${tok}". Use: ${SCOUT_QUERY_CATEGORY_KEYS.join(', ')} (aliases: tourism, food, bar, …).`,
      );
    }
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

/** First argv token that is not a flag or a flag's value (--city / --categories consume next arg). */
function firstPositionalScoutCity(args: string[]): string | undefined {
  const pairFlags = new Set(['--city', '--categories']);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (pairFlags.has(a) && i + 1 < args.length) i++;
      continue;
    }
    return a;
  }
  return undefined;
}

async function main(): Promise<void> {
  loadDotEnv();

  const args        = process.argv.slice(2);
  const isJanitor   = args.includes('--janitor');
  const dryRun      = args.includes('--dry-run');
  const forceMock   = args.includes('--mock');
  // Tavily is now the primary engine. --exa opts back into the legacy Exa path.
  // --tavily is kept as a harmless explicit-default for backward compatibility.
  const forceExa    = args.includes('--exa');
  const liveOnly    = args.includes('--live-only');
  const verbose     = args.includes('--verbose');

  let scoutCategoryKeys: ScoutQueryCategoryKey[] = [...SCOUT_QUERY_CATEGORY_KEYS];
  const categoriesIdx = args.indexOf('--categories');
  if (categoriesIdx !== -1) {
    const raw = args[categoriesIdx + 1];
    if (!raw || raw.startsWith('--')) {
      console.error('✗ --categories needs a value, e.g. --categories bars  or  --categories tourism_sites,restaurants');
      process.exit(1);
    }
    try {
      scoutCategoryKeys = parseCategoriesCliArg(raw);
    } catch (e) {
      console.error('✗', e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  }

  if (liveOnly && forceMock) {
    console.error('✗ --live-only cannot be used with --mock (choose one).');
    process.exit(1);
  }

  // --city flag works in both modes
  const cityFlagIdx = args.indexOf('--city');
  const cityFlag    = cityFlagIdx !== -1 ? args[cityFlagIdx + 1] : undefined;

  const city = isJanitor
    ? (cityFlag ?? undefined)
    : (cityFlag ?? firstPositionalScoutCity(args));

  if (!isJanitor && !city) {
    console.error(
      [
        '',
        'SCOUT MODE (discover new places):',
        '  npx tsx scripts/scout-agent.ts <city> [options]',
        '',
        '  Options:',
        '    --mock           Force mock data (offline, no API keys needed)',
        '    --live-only      Never fall back to mock; exit if live search fails',
        '    --tavily         Force Tavily even if EXA_API_KEY is set',
        '    --verbose        Print raw search content before extraction',
        '    --categories X   Comma-separated: tourism_sites | restaurants | attractions | bars',
        '                     (aliases: tourism, food, bar, …). Default: all four.',
        '    --skip-youtube   Skip YouTube Data API (no youtube_video_id on new rows)',
        '',
        'JANITOR MODE (re-verify stale places):',
        '  npx tsx scripts/scout-agent.ts --janitor [options]',
        '',
        '  Options:',
        '    --city <name> Filter to one city (default: all cities)',
        '    --dry-run     Preview without writing to Supabase',
        '',
        'Engine priority:  Exa (neural) → Tavily → Mock',
        '',
        'Examples:',
        '  npx tsx scripts/scout-agent.ts Rome',
        '  npx tsx scripts/scout-agent.ts Athens --categories tourism_sites',
        '  npx tsx scripts/scout-agent.ts Tokyo --verbose',
        '  npx tsx scripts/scout-agent.ts Paris --mock',
        '  npx tsx scripts/scout-agent.ts --janitor',
        '  npx tsx scripts/scout-agent.ts --janitor --city Rome --dry-run',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  // Guard required env vars up-front
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)  missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!isJanitor && !process.env.GEMINI_API_KEY) missing.push('GEMINI_API_KEY');
  if (missing.length) {
    console.error(`✗ Missing required env vars: ${missing.join(', ')}`);
    console.error('  Add them to .env.local then retry.');
    process.exit(1);
  }

  // ── Janitor mode ─────────────────────────────────────────────────────────────
  if (isJanitor) {
    console.log(`\n🧹 TravelOS Scout Agent — Janitor Mode`);
    console.log(`   City   : ${city ?? 'ALL cities'}`);
    console.log(`   Dry-run: ${dryRun ? 'YES (no writes)' : 'no'}`);
    console.log('');
    await runJanitor(city, dryRun);
    return;
  }

  // ── Scout mode ───────────────────────────────────────────────────────────────
  const hasExa    = !!process.env.EXA_API_KEY    && !process.env.EXA_API_KEY.includes('your_');
  const hasTavily = !!process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_');
  const engineLabel = forceMock
    ? 'MOCK'
    : forceExa && hasExa
      ? 'EXA (forced via --exa)'
      : hasTavily
        ? 'TAVILY (primary)'
        : hasExa
          ? 'EXA (Tavily key not set)'
          : liveOnly
            ? 'LIVE ONLY (no keys — will error)'
            : 'MOCK (no API keys)';

  console.log(`\n🔍 TravelOS Scout Agent v4 — Scout Mode`);
  console.log(`   City   : ${city!}`);
  console.log(`   Engine : ${engineLabel}`);
  console.log(`   Model  : Gemini ${process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview'}`);
  console.log(`   Scope  : ${categorySearchLabel(scoutCategoryKeys)}`);
  console.log('');

  try {
    // ── Phase 1: gather raw content ──────────────────────────────────────────
    console.log('📡 Phase 1 — Gathering research content…');
    const { content: rawContent, engine } = await gatherRawContent(
      city!,
      forceMock,
      forceExa,
      liveOnly,
      scoutCategoryKeys,
    );
    console.log(`   ${rawContent.length.toLocaleString()} chars via ${engine.toUpperCase()}\n`);

    if (verbose) {
      console.log('─── RAW CONTENT ────────────────────────────────────────');
      console.log(rawContent.slice(0, 3000) + (rawContent.length > 3000 ? '\n[… truncated …]' : ''));
      console.log('────────────────────────────────────────────────────────\n');
    }

    // ── Phase 2: Gemini extraction ───────────────────────────────────────────
    console.log('🤖 Phase 2 — Gemini extraction…');
    const places = await extractPlacesWithGemini(city!, rawContent, scoutCategoryKeys);
    console.log(`   ${places.length} valid places extracted\n`);

    if (places.length < TARGET_PLACES_PER_RUN) {
      console.log(`⚠️  Extracted ${places.length}/${TARGET_PLACES_PER_RUN} places. Try running again or use a correctly spelled city name for better recall.`);
    }

    if (places.length === 0) {
      console.log('⚠️  No places extracted. Try --verbose to inspect raw content, or --mock for a known-good run.');
      process.exit(0);
    }

    // Preview table
    console.log('📋 Extracted places:');
    for (const p of places) {
      const social = p.social_proof_url ? ' 🔗' : '';
      console.log(`   ${p.category_emoji}  ${p.name.padEnd(38)} [${p.vibe_label}]${social}`);
    }
    const withSocial = places.filter((p) => p.social_proof_url).length;
    if (withSocial > 0) console.log(`\n   🔗 ${withSocial} places have social proof URLs`);
    console.log('');

    // ── Phase 3: upsert to Supabase ──────────────────────────────────────────
    console.log('💾 Phase 3 — Upserting to Supabase `places` table…');
    const { inserted, skipped, errors, youtubeTagged, topPicks } = await upsertPlaces(places);

    console.log('');
    console.log('✅ Scout complete!');
    console.log(`   Inserted : ${inserted}`);
    console.log(`   Skipped  : ${skipped}  (duplicates)`);
    console.log(`   Errors   : ${errors}`);
    if (youtubeTagged > 0) console.log(`   YouTube  : ${youtubeTagged} new row(s) with youtube_video_id`);
    console.log(`   Top Picks: sightseeing=${topPicks.sightseeing}  history=${topPicks.history}  food=${topPicks.food}`);
    if (inserted > 0) {
      console.log(`\n   These ${inserted} places will now appear as VERIFIED INTERNAL DATA`);
      console.log(`   when any user requests an itinerary for ${city} 🗺️`);
    }
    const topTotal = topPicks.sightseeing + topPicks.history + topPicks.food;
    if (topTotal > 0) {
      console.log(`   ${topTotal} place(s) tagged for the Step 7 Top Sights card.`);
    }
    console.log('');

  } catch (err) {
    console.error(
      '\n✗ Scout agent failed:',
      err instanceof Error ? err.message : String(err),
    );
    process.exit(1);
  }
}

main();
