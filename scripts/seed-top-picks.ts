// @ts-nocheck
/**
 * TravelOS — Fast Top-Picks Seeder
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 10 top places per category (sightseeing / history / food) for each
 * major city using a single Gemini call per city. No web search needed —
 * Gemini already knows iconic world destinations.
 *
 * Usage:
 *   npx tsx scripts/seed-top-picks.ts                  # seed all cities
 *   npx tsx scripts/seed-top-picks.ts --dry-run        # preview only
 *   npx tsx scripts/seed-top-picks.ts --city Tokyo     # single city
 *   npx tsx scripts/seed-top-picks.ts --force          # re-seed even if covered
 *
 * Required env vars (.env.local):
 *   GEMINI_API_KEY
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Env loader ────────────────────────────────────────────────────────────────

function loadDotEnv() {
  try {
    const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n');
    for (const line of lines) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 0) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch { /* rely on system env */ }
}

// ── Cities ────────────────────────────────────────────────────────────────────

const TARGET_CITIES = [
  // Europe
  'Paris', 'London', 'Rome', 'Madrid', 'Barcelona', 'Berlin', 'Vienna',
  'Amsterdam', 'Athens', 'Prague', 'Budapest', 'Lisbon', 'Istanbul',
  'Florence', 'Venice', 'Milan', 'Dubrovnik', 'Edinburgh', 'Copenhagen',
  'Stockholm', 'Santorini', 'Reykjavik',
  // Asia
  'Tokyo', 'Kyoto', 'Bangkok', 'Bali', 'Singapore', 'Seoul', 'Hong Kong',
  'Hanoi', 'Ho Chi Minh City', 'Kuala Lumpur', 'Mumbai', 'Delhi', 'Jaipur',
  'Dubai', 'Tel Aviv',
  // Africa & Middle East
  'Marrakech', 'Cape Town', 'Cairo',
  // Americas
  'New York', 'Los Angeles', 'Miami', 'San Francisco', 'Mexico City',
  'Buenos Aires', 'Rio de Janeiro', 'Lima', 'Cusco',
  // Oceania
  'Sydney', 'Melbourne',
];

const TOP_PICKS_PER_CATEGORY = 10;
const MIN_COVERED = 6; // skip city if it already has ≥ 6 per bucket

// ── Types ─────────────────────────────────────────────────────────────────────

type TopPickCategory = 'sightseeing' | 'history' | 'food';

interface TopPickPlace {
  name: string;
  description: string;
  lat: number;
  lng: number;
  category_emoji: string;
  vibe_label: string;
  quality_score: number;
  top_pick_category: TopPickCategory;
  popularity_rank: number;
}

// ── Gemini call ───────────────────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message: string; code: number };
}

async function askGemini(prompt: string): Promise<string> {
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY!;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as GeminiResponse;
  if (data.error) throw new Error(`Gemini error ${data.error.code}: ${data.error.message}`);
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  if (!raw) throw new Error('Gemini returned empty response');
  return raw;
}

// ── Generate top picks for a city ─────────────────────────────────────────────

async function generateTopPicksForCity(city: string): Promise<TopPickPlace[]> {
  const prompt = `You are a travel data expert building a curated city guide for ${city}.

Return exactly ${TOP_PICKS_PER_CATEGORY} places for each of these 3 categories:

1. "sightseeing" — iconic viewpoints, must-see landmarks, famous squares, world-class museums as tourist sights
2. "history"     — ancient ruins, UNESCO heritage sites, historic monuments, castles, archaeological sites
3. "food"        — standout restaurants, street food markets, famous eateries that define ${city}'s cuisine

Rules:
- Only include real, well-known places with accurate GPS coordinates
- Rank by popularity/importance (rank 1 = most iconic)
- vibe_label must be one of: luxury-pick | classic | local-favorite | viral-trend | budget-pick
- quality_score: integer 7-10
- category_emoji: single emoji that best represents the place
- description: max 20 words, specific and evocative

Return ONLY this JSON structure (no markdown, no prose):
{
  "sightseeing": [
    {"name":"...","description":"...","lat":0.0,"lng":0.0,"category_emoji":"🏛️","vibe_label":"classic","quality_score":9},
    ... (10 total)
  ],
  "history": [ ... (10 total) ],
  "food": [ ... (10 total) ]
}`;

  const raw = await askGemini(prompt);

  let parsed: Record<string, unknown[]>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown[]>;
  } catch {
    // Try extracting JSON from response
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON object found in Gemini response');
    parsed = JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown[]>;
  }

  const results: TopPickPlace[] = [];

  for (const cat of ['sightseeing', 'history', 'food'] as TopPickCategory[]) {
    const items = Array.isArray(parsed[cat]) ? parsed[cat] : [];
    items.slice(0, TOP_PICKS_PER_CATEGORY).forEach((item, idx) => {
      const p = item as Record<string, unknown>;
      const name = typeof p.name === 'string' ? p.name.trim() : '';
      const lat = typeof p.lat === 'number' ? p.lat : parseFloat(String(p.lat));
      const lng = typeof p.lng === 'number' ? p.lng : parseFloat(String(p.lng));

      if (!name || !isFinite(lat) || !isFinite(lng) || lat === 0 || lng === 0) {
        console.warn(`  ⚠️  Skipped "${name || '?'}" [${cat}] — invalid coords`);
        return;
      }

      results.push({
        name,
        description: typeof p.description === 'string' ? p.description.slice(0, 300) : '',
        lat,
        lng,
        category_emoji: typeof p.category_emoji === 'string' ? p.category_emoji : (cat === 'food' ? '🍽️' : cat === 'history' ? '🏛️' : '🗺️'),
        vibe_label: typeof p.vibe_label === 'string' ? p.vibe_label : 'classic',
        quality_score: typeof p.quality_score === 'number' ? Math.min(10, Math.max(1, Math.round(p.quality_score))) : 8,
        top_pick_category: cat,
        popularity_rank: idx + 1,
      });
    });
  }

  return results;
}

// ── Supabase upsert ───────────────────────────────────────────────────────────

async function upsertTopPicks(
  supabase: ReturnType<typeof createClient>,
  city: string,
  places: TopPickPlace[],
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0, updated = 0, errors = 0;

  for (const place of places) {
    // Check for existing row (case-insensitive name + city)
    const { data: existing, error: selErr } = await supabase
      .from('places')
      .select('id')
      .ilike('name', place.name)
      .ilike('city', city)
      .maybeSingle();

    if (selErr) { errors++; continue; }

    if (existing) {
      // Update top-pick fields on existing row
      const { error: updErr } = await supabase
        .from('places')
        .update({
          top_pick_category: place.top_pick_category,
          popularity_rank: place.popularity_rank,
          description: place.description || undefined,
        })
        .eq('id', (existing as { id: string }).id);

      if (updErr) { errors++; }
      else {
        updated++;
        console.log(`  ✏️  UPDATED  ${place.category_emoji} ${place.name} [${place.top_pick_category} #${place.popularity_rank}]`);
      }
    } else {
      // Insert new row
      const { error: insErr } = await supabase.from('places').insert({
        city,
        name: place.name,
        category: place.top_pick_category === 'food' ? 'restaurant' : place.top_pick_category === 'history' ? 'tourism_site' : 'attraction',
        description: place.description,
        lat: place.lat,
        lng: place.lng,
        category_emoji: place.category_emoji,
        social_proof_url: null,
        vibe_label: place.vibe_label,
        top_pick_category: place.top_pick_category,
        popularity_rank: place.popularity_rank,
      });

      if (insErr) {
        // Skip duplicates silently
        if (insErr.code !== '23505') {
          console.error(`  ✗ INSERT "${place.name}": ${insErr.message}`);
          errors++;
        }
      } else {
        inserted++;
        console.log(`  ✓ INSERTED ${place.category_emoji} ${place.name} [${place.top_pick_category} #${place.popularity_rank}]`);
      }
    }
  }

  return { inserted, updated, errors };
}

// ── Check existing coverage ───────────────────────────────────────────────────

async function getCoverage(
  supabase: ReturnType<typeof createClient>,
): Promise<Map<string, Record<TopPickCategory, number>>> {
  const { data, error } = await supabase
    .from('places')
    .select('city, top_pick_category')
    .not('top_pick_category', 'is', null);

  if (error) throw new Error(error.message);

  const map = new Map<string, Record<TopPickCategory, number>>();
  for (const row of data ?? []) {
    const key = (row.city as string).toLowerCase().trim();
    if (!map.has(key)) map.set(key, { sightseeing: 0, history: 0, food: 0 });
    const cat = row.top_pick_category as TopPickCategory;
    if (cat in map.get(key)!) map.get(key)![cat]++;
  }
  return map;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  loadDotEnv();

  const args      = process.argv.slice(2);
  const dryRun    = args.includes('--dry-run');
  const force     = args.includes('--force');
  const cityIdx   = args.indexOf('--city');
  const singleCity = cityIdx !== -1 ? args[cityIdx + 1] : undefined;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  for (const v of ['GEMINI_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!process.env[v]) { console.error(`✗ Missing env var: ${v}`); process.exit(1); }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cities = singleCity ? [singleCity] : TARGET_CITIES;

  console.log('\n🌐 TravelOS — Top-Picks Fast Seeder');
  console.log(`   ${cities.length} cities · ${TOP_PICKS_PER_CATEGORY} places/category · model: ${process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'}`);
  console.log(`   Mode: ${dryRun ? 'DRY-RUN' : force ? 'FORCE' : 'LIVE'}\n`);

  // Current coverage
  const coverage = await getCoverage(supabase);

  // Print table & build queue
  console.log('  City'.padEnd(26) + 'Sight  Hist   Food   Status');
  console.log('  ' + '─'.repeat(55));

  const queue: string[] = [];
  for (const city of cities) {
    const key = city.toLowerCase();
    const c = coverage.get(key) ?? { sightseeing: 0, history: 0, food: 0 };
    const covered = c.sightseeing >= MIN_COVERED && c.history >= MIN_COVERED && c.food >= MIN_COVERED;
    const status = covered && !force ? '✓ ok' : '→ seed';
    console.log(
      `  ${city.padEnd(24)} ${String(c.sightseeing).padEnd(7)}${String(c.history).padEnd(7)}${String(c.food).padEnd(7)}${status}`
    );
    if (!covered || force) queue.push(city);
  }

  console.log(`\n  ${queue.length} cities to seed\n`);
  if (queue.length === 0) { console.log('✅ All cities covered!\n'); return; }

  let totalInserted = 0, totalUpdated = 0, totalErrors = 0, totalSkipped = 0;

  for (let i = 0; i < queue.length; i++) {
    const city = queue[i];
    console.log(`\n[${i + 1}/${queue.length}] ${city}`);

    if (dryRun) {
      console.log(`  [DRY-RUN] Would generate ${TOP_PICKS_PER_CATEGORY * 3} places for ${city}`);
      continue;
    }

    try {
      process.stdout.write(`  → Calling Gemini…`);
      const places = await generateTopPicksForCity(city);
      process.stdout.write(` ${places.length} places extracted\n`);

      if (places.length === 0) {
        console.warn(`  ⚠️  No valid places returned — skipping`);
        totalSkipped++;
        continue;
      }

      const { inserted, updated, errors } = await upsertTopPicks(supabase, city, places);
      console.log(`  → inserted ${inserted}, updated ${updated}, errors ${errors}`);
      totalInserted += inserted;
      totalUpdated += updated;
      totalErrors += errors;

    } catch (err) {
      console.error(`  ✗ Failed: ${err instanceof Error ? err.message : String(err)}`);
      totalSkipped++;
    }

    // Small pause between cities to respect API rate limits
    if (i < queue.length - 1) await new Promise(r => setTimeout(r, 1000));
  }

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Done!');
  console.log(`   Inserted : ${totalInserted}`);
  console.log(`   Updated  : ${totalUpdated}`);
  console.log(`   Errors   : ${totalErrors}`);
  console.log(`   Skipped  : ${totalSkipped}`);
  console.log('');
}

main().catch(err => {
  console.error('✗', err instanceof Error ? err.message : err);
  process.exit(1);
});
