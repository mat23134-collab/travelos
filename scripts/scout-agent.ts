/**
 * TravelOS Scout Agent — v2 (Exa-powered)
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone CLI script — runs outside the Next.js app.
 *
 * Search priority:
 *   1. Exa  (neural + social search — best for underground/viral discovery)
 *   2. Tavily (broad web search — fallback if no Exa key)
 *   3. Mock  (built-in rich data — for offline testing)
 *
 * Usage:
 *   npx tsx scripts/scout-agent.ts <city>            # auto-select best engine
 *   npx tsx scripts/scout-agent.ts <city> --mock     # force mock (offline)
 *   npx tsx scripts/scout-agent.ts <city> --tavily   # force Tavily even if Exa set
 *   npx tsx scripts/scout-agent.ts <city> --verbose  # print raw content before extraction
 *
 * Examples:
 *   npx tsx scripts/scout-agent.ts Rome
 *   npx tsx scripts/scout-agent.ts Tokyo --verbose
 *   npx tsx scripts/scout-agent.ts Paris --mock
 *
 * Required env vars (in .env.local):
 *   ANTHROPIC_API_KEY           — Claude API key
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service-role key (bypasses Row-Level Security)
 *
 * Optional:
 *   EXA_API_KEY                 — Exa neural search (primary engine)
 *   TAVILY_API_KEY              — Tavily web search (fallback engine)
 *   ANTHROPIC_MODEL             — override Claude model (default: claude-haiku-4-5-20251001)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk';
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

// ── Exa search — neural + social targeting ────────────────────────────────────
// Uses three complementary query strategies:
//   (a) social/blog sites for viral discovery via tweet/personal-site categories
//   (b) travel blogs + Reddit for hidden-gem local knowledge
//   (c) general underground/authentic angle with autoprompt refinement

async function searchExa(city: string): Promise<string> {
  const apiKey = process.env.EXA_API_KEY ?? '';

  const queries: Array<{
    query: string;
    category?: string;
    type: 'neural' | 'keyword';
    use_autoprompt: boolean;
    num_results: number;
  }> = [
    // 1 — Social signals: tweet/Instagram/TikTok viral content
    {
      query: `${city} hidden gem local secret restaurant bar cafe going viral TikTok Instagram`,
      category: 'tweet',
      type: 'neural',
      use_autoprompt: true,
      num_results: 8,
    },
    // 2 — Personal travel blogs: off-the-beaten-path local knowledge
    {
      query: `${city} underground spots locals only authentic hidden neighborhood gems personal travel blog`,
      category: 'personal site',
      type: 'neural',
      use_autoprompt: true,
      num_results: 8,
    },
    // 3 — Reddit + forum intelligence: real locals vs tourist crowds
    {
      query: `${city} best local spots avoid tourists hidden gems site:reddit.com OR site:tripadvisor.com`,
      type: 'keyword',
      use_autoprompt: false,
      num_results: 6,
    },
  ];

  console.log(`  → Exa neural search (${queries.length} targeted queries)…`);

  const settled = await Promise.allSettled(
    queries.map(async ({ query, category, type, use_autoprompt, num_results }) => {
      const body: Record<string, unknown> = {
        query,
        num_results,
        type,
        use_autoprompt,
        contents: {
          // Full text — up to 1500 chars per result for Claude context
          text: { maxCharacters: 1500 },
          // AI-extracted highlights most relevant to "local travel gems"
          highlights: {
            query: `hidden gem local favorite viral spot ${city}`,
            numSentences: 3,
            highlightsPerUrl: 2,
          },
          // Short summary for quick signal
          summary: { query: `What makes this place special in ${city}?` },
        },
      };
      if (category) body.category = category;

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
  let socialUrls: string[] = [];

  for (const result of settled) {
    if (result.status === 'rejected') {
      console.warn(`  ⚠️  Exa query failed: ${result.reason}`);
      continue;
    }

    for (const r of result.value.results) {
      // Collect social proof URLs from tweet/Instagram/TikTok results
      if (
        r.url.includes('twitter.com') ||
        r.url.includes('x.com') ||
        r.url.includes('instagram.com') ||
        r.url.includes('tiktok.com')
      ) {
        socialUrls.push(r.url);
      }

      const parts: string[] = [];
      parts.push(`[${r.title ?? 'Untitled'}] (${r.url})`);
      if (r.summary)    parts.push(`Summary: ${r.summary}`);
      if (r.highlights?.length) parts.push(`Highlights: ${r.highlights.join(' | ')}`);
      if (r.text)       parts.push(r.text.slice(0, 800));

      chunks.push(parts.join('\n'));
    }
  }

  if (chunks.length === 0) throw new Error('Exa returned no results');

  // Append deduplicated social URLs as a signal block for Claude
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

async function gatherViaTavily(city: string): Promise<string> {
  const queries = [
    `${city} TikTok viral trending hidden spots Instagram 2025 2026`,
    `${city} best hidden gems locals only secret restaurants bars cafes`,
    `${city} top authentic local experiences not tourist traps 2026`,
  ];

  console.log(`  → Tavily web search (${queries.length} queries)…`);
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
  forceTavily: boolean,
): Promise<{ content: string; engine: Engine }> {
  if (forceMock) {
    console.log('  → Mode: MOCK (forced)');
    return { content: getMockContent(city), engine: 'mock' };
  }

  const hasExa    = !!process.env.EXA_API_KEY    && !process.env.EXA_API_KEY.includes('your_');
  const hasTavily = !!process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_');

  // Exa — primary, unless --tavily flag
  if (hasExa && !forceTavily) {
    try {
      const content = await searchExa(city);
      return { content, engine: 'exa' };
    } catch (err) {
      console.warn(`  ⚠️  Exa failed: ${err instanceof Error ? err.message : err}`);
      console.log('  → Falling back to Tavily…');
    }
  }

  // Tavily — fallback
  if (hasTavily) {
    try {
      const content = await gatherViaTavily(city);
      return { content, engine: 'tavily' };
    } catch (err) {
      console.warn(`  ⚠️  Tavily failed: ${err instanceof Error ? err.message : err}`);
      console.log('  → Falling back to mock data…');
    }
  }

  // Mock — final fallback
  if (!hasExa && !hasTavily) {
    console.log('  → No API keys set (EXA_API_KEY / TAVILY_API_KEY) — using mock data');
  } else {
    console.log('  → All live engines failed — using mock data');
  }
  return { content: getMockContent(city), engine: 'mock' };
}

// ── Claude extraction ─────────────────────────────────────────────────────────

async function extractPlacesWithClaude(
  city: string,
  rawContent: string,
): Promise<Place[]> {
  const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001';
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log(`  → Claude model: ${model}`);

  const prompt = `You are a travel intelligence extraction agent for TravelOS.

CITY: ${city}

RAW RESEARCH CONTENT (web search results, blog posts, social media signals):
${rawContent}

Your task: extract every distinct, named place/venue mentioned above into structured JSON.

VIBE CLASSIFICATION GUIDE:
- "viral-trend"    → explicitly TikTok/Instagram/social media famous, trending hashtags, going viral
- "hidden-gem"     → described as locals-only, secret, off-beaten-path, not in guidebooks, underground
- "local-favorite" → where locals actually eat/drink/hang, neighbourhood staple, not tourist-facing
- "classic"        → iconic, historic, landmark status — still worth it
- "luxury-pick"    → high-end, upscale, premium price point
- "budget-pick"    → affordable, cheap eats, value for money

For each place output an object with EXACTLY these fields:
{
  "city": "${city}",
  "name": "Official venue name",
  "category": "restaurant | bar | cafe | attraction | market | nightlife | nature | hotel | shopping",
  "description": "The Secret Sauce — why locals love it, what makes it special, any social media angle. Include specific details (what to order, best time, crowd vibe). Max 60 words.",
  "lat": 0.0000,   // accurate GPS latitude, 4 decimal places. MUST be the specific venue, not city centre.
  "lng": 0.0000,   // accurate GPS longitude, 4 decimal places. MUST be the specific venue, not city centre.
  "category_emoji": "🍕",  // single emoji: 🍕 🍷 ☕ 🏛️ 🛒 🎶 🌿 🏨 🛍️ 🌆 🎭 🍺 🌅
  "social_proof_url": "https://...",  // ONLY real URLs from the content (TikTok/Instagram/Twitter). null if none found.
  "vibe_label": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick"
}

STRICT RULES:
- Only extract real, named, specific venues — no generic area descriptions
- Coordinates MUST be accurate for the specific venue (not the city centre or neighbourhood centroid)
- Do NOT invent or guess social_proof_url — only use URLs explicitly present in the content above
- Aim for 8–14 places. Quality and specificity over quantity.
- Every place must have a genuine vibe_label based on how it was described in the source
- PRIORITIZE places with social media signals and "underground" / "locals-only" framing

Return ONLY a valid JSON array. No markdown fences. No prose. Start with [ end with ].`;

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw =
    message.content[0].type === 'text' ? message.content[0].text.trim() : '';

  // Strict extraction: first [ to last ]
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      'Claude did not return a JSON array. Preview:\n' + raw.slice(0, 400),
    );
  }

  const parsed = JSON.parse(raw.slice(start, end + 1)) as unknown[];

  // Runtime validation — drop malformed entries
  return parsed.filter((p): p is Place => {
    if (typeof p !== 'object' || p === null) return false;
    const place = p as Record<string, unknown>;
    return (
      typeof place.name === 'string' &&
      place.name.trim().length > 0 &&
      typeof place.lat === 'number' &&
      typeof place.lng === 'number' &&
      place.lat !== 0 &&
      place.lng !== 0
    );
  });
}

// ── Supabase upsert (service-role key bypasses RLS) ───────────────────────────

async function upsertPlaces(
  places: Place[],
): Promise<{ inserted: number; skipped: number; errors: number }> {
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

  for (const place of places) {
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
      console.log(`  ⏩ SKIP     ${place.category_emoji} ${place.name} (already in DB)`);
      skipped++;
      continue;
    }

    const { error: insertErr } = await supabase.from('places').insert([{
      city:             place.city,
      name:             place.name,
      category:         place.category,
      description:      place.description,
      lat:              place.lat,
      lng:              place.lng,
      category_emoji:   place.category_emoji,
      social_proof_url: place.social_proof_url,
      vibe_label:       place.vibe_label,
    }]);

    if (insertErr) {
      console.error(`  ✗ INSERT error for "${place.name}": ${insertErr.message}`);
      errors++;
    } else {
      console.log(
        `  ✓ INSERTED ${place.category_emoji} ${place.name.padEnd(36)} [${place.vibe_label}]`,
      );
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadDotEnv();

  const args       = process.argv.slice(2);
  const city       = args.find((a) => !a.startsWith('--'));
  const forceMock  = args.includes('--mock');
  const forceTavily = args.includes('--tavily');
  const verbose    = args.includes('--verbose');

  if (!city) {
    console.error(
      [
        '',
        'Usage:   npx tsx scripts/scout-agent.ts <city> [options]',
        '',
        'Options:',
        '  --mock     Force mock data (no API keys needed, offline)',
        '  --tavily   Force Tavily even if EXA_API_KEY is set',
        '  --verbose  Print raw search content before extraction',
        '',
        'Engine priority:  Exa (neural) → Tavily → Mock',
        '',
        'Examples:',
        '  npx tsx scripts/scout-agent.ts Rome',
        '  npx tsx scripts/scout-agent.ts Tokyo --verbose',
        '  npx tsx scripts/scout-agent.ts Paris --mock',
        '  npx tsx scripts/scout-agent.ts London --tavily',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  // Guard required env vars up-front
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY)         missing.push('ANTHROPIC_API_KEY');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL)   missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY)  missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    console.error(`✗ Missing required env vars: ${missing.join(', ')}`);
    console.error('  Add them to .env.local then retry.');
    process.exit(1);
  }

  const hasExa    = !!process.env.EXA_API_KEY    && !process.env.EXA_API_KEY.includes('your_');
  const hasTavily = !!process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_');
  const engineLabel = forceMock
    ? 'MOCK'
    : forceTavily && hasTavily
      ? 'TAVILY (forced)'
      : hasExa
        ? 'EXA (neural + social)'
        : hasTavily
          ? 'TAVILY (Exa key not set)'
          : 'MOCK (no API keys)';

  console.log(`\n🔍 TravelOS Scout Agent v2`);
  console.log(`   City   : ${city}`);
  console.log(`   Engine : ${engineLabel}`);
  console.log(`   Model  : ${process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'}`);
  console.log('');

  try {
    // ── Phase 1: gather raw content ──────────────────────────────────────────
    console.log('📡 Phase 1 — Gathering research content…');
    const { content: rawContent, engine } = await gatherRawContent(city, forceMock, forceTavily);
    console.log(`   ${rawContent.length.toLocaleString()} chars via ${engine.toUpperCase()}\n`);

    if (verbose) {
      console.log('─── RAW CONTENT ────────────────────────────────────────');
      console.log(rawContent.slice(0, 3000) + (rawContent.length > 3000 ? '\n[… truncated …]' : ''));
      console.log('────────────────────────────────────────────────────────\n');
    }

    // ── Phase 2: Claude extraction ───────────────────────────────────────────
    console.log('🤖 Phase 2 — Claude extraction…');
    const places = await extractPlacesWithClaude(city, rawContent);
    console.log(`   ${places.length} valid places extracted\n`);

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
    const { inserted, skipped, errors } = await upsertPlaces(places);

    console.log('');
    console.log('✅ Scout complete!');
    console.log(`   Inserted : ${inserted}`);
    console.log(`   Skipped  : ${skipped}  (duplicates)`);
    console.log(`   Errors   : ${errors}`);
    if (inserted > 0) {
      console.log(`\n   These ${inserted} places will now appear as VERIFIED INTERNAL DATA`);
      console.log(`   when any user requests an itinerary for ${city} 🗺️`);
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
