/**
 * TravelOS Scout Agent
 * ─────────────────────────────────────────────────────────────────────────────
 * Standalone CLI script — runs outside the Next.js app.
 *
 * Usage:
 *   npx tsx scripts/scout-agent.ts <city>         # live Tavily search
 *   npx tsx scripts/scout-agent.ts <city> --mock  # mock data (no API keys needed)
 *
 * Examples:
 *   npx tsx scripts/scout-agent.ts Rome
 *   npx tsx scripts/scout-agent.ts Paris --mock
 *
 * Required env vars (in .env.local):
 *   ANTHROPIC_API_KEY           — Claude API key
 *   NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — Service-role key (bypasses Row-Level Security)
 *
 * Optional:
 *   TAVILY_API_KEY              — enables live web search (omit → uses mock data)
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

// ── Mock search content (used when Tavily key is absent) ──────────────────────
// Rich enough to give Claude good signal for extraction tests.

const MOCK_CONTENT: Record<string, string> = {
  rome: `
    TikTok viral: Supplì Roma at Via San Francesco a Ripa — best supplì in Rome, queues out the door,
    locals-only spot #roma #streetfood. Il Sorpasso bar in Prati — aperitivo terrace views, massive on
    Instagram @ilsorpassoroma, locals love the spritz hour. Pizzarium Bonci — pizza al taglio going viral
    worldwide for unconventional toppings, Michelin-mentioned. Testaccio market — where Romans actually
    shop for fresh produce, zero tourists, authentic neighbourhood. Tram Depot cafe Testaccio —
    converted tram depot turned neighbourhood bar, local favourite. Vineria Il Chianti — secret wine bar
    in alley off Campo de' Fiori, not in any guidebook. Quarticciolo street art district — hidden gem,
    Rome's answer to Shoreditch, locals only, TikTok @romestreetart. Ponte Sisto sunset spot — romantic
    lesser-known bridge, breathtaking views, viral on Pinterest.
  `,
  paris: `
    TikTok famous: Rosa Bonheur sur Seine — floating bar on the Seine, #paris trending, @rosabonheur.
    Le Perchoir Ménilmontant rooftop — hidden gem locals adore, stunning panorama. Le Train Bleu brasserie
    inside Gare de Lyon — Belle Époque masterpiece, tourists walk past it daily. Chez Janou bistro in
    Le Marais — 79 types of pastis, locals favourite, no tourists. Marché d'Aligre — most authentic Paris
    market, hidden from guidebooks, local shopping. Les Papilles wine bistro — hidden gem, prix fixe menu,
    locals queue outside every weekend. Septime restaurant — world-famous natural wine bistro, Parisian
    foodies obsessed. Ob-La-Di café Marais — viral brunch spot @obladi_paris.
  `,
  london: `
    Going viral on TikTok: Dishoom Covent Garden — legendary Indian breakfast, queue worthy @dishoom.
    Maltby Street Market south London — east London hidden foodie gem, locals only on Saturday mornings.
    Netil360 rooftop Hackney — trending on Instagram for Hackney skyline views. Brockwell Park Lido —
    local south London secret, open-air swimming. HIDE restaurant Piccadilly — viral for stunning tree
    interior design @hiderestaurant. Leake Street Tunnel Waterloo — legal graffiti tunnel hidden under
    station. Bermondsey Beer Mile — craft beer corridor, local favourite weekend activity. The Marksman
    gastropub Hackney — locals swear by it, unknown to tourists, no reservations taken.
  `,
  athens: `
    Viral: The Clumsies bar — World's 50 Best Bars, Athens locals and expats obsessed @theclumsies.
    Strefi Hill — locals-only sunset spot, panoramic views over Athens, zero tourists, hidden gem.
    Stavros Niarchos Foundation rooftop park — trending on IG for Athens views @snfcc. Exarchia
    neighbourhood — authentic Athens, artists, anarchists, real local cafes, off beaten path.
    Birdman cocktail bar — hidden gem bar, not in Lonely Planet, local favourite. Varvakios market —
    authentic Athens central market, where locals shop, raw and real. Psyrri neighbourhood — vibrant,
    authentic, where Athenians go out, not tourist area. Little Tree Books and Coffee — viral neighbourhood
    cafe @littletreebooks.
  `,
  budapest: `
    TikTok sensation: Szimpla Kert ruin bar — must-visit, #budapest viral, @szimplakertruin. Instant-Fogas
    massive ruin bar complex — huge on social media, weekend institution. Gerbeaud Confectionery — historic
    café on Vörösmarty Square, viral for luxury pastries @gerbeaud. New York Café — most Instagram-worthy
    interior in Budapest, historic opulence. Gellért Hill hidden viewpoint — local secret, panoramic views,
    zero tourists midweek. Holdudvar market hall — locals food market, artisan produce, unknown to tourists.
    Fekete espresso bar — best specialty coffee locals swear by, neighbourhood favourite. Kazinczy Street
    ruin bar area — authentic Budapest nightlife hidden in Jewish Quarter.
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

// ── Tavily live search ────────────────────────────────────────────────────────

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

async function gatherRawContent(city: string, useMock: boolean): Promise<string> {
  const hasTavily =
    process.env.TAVILY_API_KEY &&
    !process.env.TAVILY_API_KEY.includes('your_');

  if (useMock || !hasTavily) {
    console.log('  → Using mock search content (TAVILY_API_KEY not set — pass --mock to suppress this warning)');
    return getMockContent(city);
  }

  const queries = [
    `${city} TikTok viral trending hidden spots Instagram 2025 2026`,
    `${city} best hidden gems locals only secret restaurants bars cafes`,
    `${city} top authentic local experiences not tourist traps 2026`,
  ];

  console.log(`  → Querying Tavily (${queries.length} searches)…`);
  const settled = await Promise.allSettled(queries.map(searchTavily));

  const chunks = settled.flatMap((r) =>
    r.status === 'fulfilled' ? [r.value] : [],
  );
  if (chunks.length === 0) {
    console.log('  → Tavily returned no results — falling back to mock data');
    return getMockContent(city);
  }

  return chunks.join('\n\n━━━━━━━━━━\n\n');
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

RAW RESEARCH CONTENT (web search results + social media signals):
${rawContent}

Your task: extract every distinct, named place/venue mentioned above into structured JSON.

For each place output an object with EXACTLY these fields:
{
  "city": "${city}",
  "name": "Official venue name",
  "category": "restaurant | bar | cafe | attraction | market | nightlife | nature | hotel | shopping",
  "description": "The Secret Sauce — why locals love it, what makes it special, any social media angle. Max 60 words.",
  "lat": 0.0000,   // accurate GPS latitude for this specific venue, 4 decimal places
  "lng": 0.0000,   // accurate GPS longitude for this specific venue, 4 decimal places
  "category_emoji": "🍕",  // single emoji: 🍕🍷☕🏛️🛒🎶🌿🏨🛍️🌆
  "social_proof_url": "https://..." or null,  // TikTok/Instagram URL only if explicitly mentioned
  "vibe_label": "hidden-gem | local-favorite | viral-trend | classic | luxury-pick | budget-pick"
}

RULES:
- Only extract real, named, specific venues — no generic descriptions
- If clearly TikTok/Instagram viral → vibe_label = "viral-trend"
- If described as locals-only / hidden / off-beaten-path → vibe_label = "hidden-gem"
- If where locals eat/drink regularly → vibe_label = "local-favorite"
- Coordinates MUST be the actual GPS location of that specific venue (not city centre)
- Do NOT invent social_proof_url — only include if the URL is explicitly in the content
- Aim for 6–12 places. Quality over quantity.

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
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(
    /\/+$/,
    '',
  );
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.',
    );
  }

  // Service-role client — bypasses Row Level Security
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let inserted = 0;
  let skipped = 0;
  let errors = 0;

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
        `  ✓ INSERTED ${place.category_emoji} ${place.name} [${place.vibe_label}]`,
      );
      inserted++;
    }
  }

  return { inserted, skipped, errors };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadDotEnv();

  const args = process.argv.slice(2);
  const city = args.find((a) => !a.startsWith('--'));
  const useMock = args.includes('--mock');

  if (!city) {
    console.error(
      [
        '',
        'Usage:   npx tsx scripts/scout-agent.ts <city> [--mock]',
        '',
        'Options:',
        '  --mock   Use built-in mock data (no Tavily key needed)',
        '',
        'Examples:',
        '  npx tsx scripts/scout-agent.ts Rome',
        '  npx tsx scripts/scout-agent.ts Paris --mock',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }

  // Guard required env vars up-front
  const missing: string[] = [];
  if (!process.env.ANTHROPIC_API_KEY) missing.push('ANTHROPIC_API_KEY');
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (missing.length) {
    console.error(`✗ Missing required env vars: ${missing.join(', ')}`);
    console.error('  Add them to .env.local then retry.');
    process.exit(1);
  }

  console.log(`\n🔍 TravelOS Scout Agent`);
  console.log(`   City   : ${city}`);
  console.log(`   Mode   : ${useMock ? 'MOCK' : process.env.TAVILY_API_KEY ? 'LIVE (Tavily)' : 'MOCK (no Tavily key)'}`);
  console.log(`   Model  : ${process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'}`);
  console.log('');

  try {
    // ── Phase 1: gather raw content ──────────────────────────────────────────
    console.log('📡 Phase 1 — Gathering web content…');
    const rawContent = await gatherRawContent(city, useMock);
    console.log(`   ${rawContent.length.toLocaleString()} chars collected\n`);

    // ── Phase 2: Claude extraction ───────────────────────────────────────────
    console.log('🤖 Phase 2 — Claude extraction…');
    const places = await extractPlacesWithClaude(city, rawContent);
    console.log(`   ${places.length} valid places extracted\n`);

    if (places.length === 0) {
      console.log('⚠️  No places extracted. Try --mock or check the raw content above.');
      process.exit(0);
    }

    // Preview
    console.log('📋 Extracted places:');
    for (const p of places) {
      console.log(`   ${p.category_emoji}  ${p.name.padEnd(36)} [${p.vibe_label}]`);
    }
    console.log('');

    // ── Phase 3: upsert to Supabase ──────────────────────────────────────────
    console.log('💾 Phase 3 — Upserting to Supabase `places` table…');
    const { inserted, skipped, errors } = await upsertPlaces(places);

    console.log('');
    console.log('✅ Scout complete!');
    console.log(`   Inserted : ${inserted}`);
    console.log(`   Skipped  : ${skipped}  (duplicates)`);
    console.log(`   Errors   : ${errors}`);
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
