// @ts-nocheck
/**
 * TravelOS — Bank Pre-warmer
 * ─────────────────────────────────────────────────────────────────────────────
 * Fills the "book ahead" banks ahead of time so a traveler's city loads
 * instantly instead of scouting on demand:
 *   • public.restaurant_recommendations  (runRestaurantScoutAgent → upsert)
 *   • public.attraction_recommendations  (runAttractionScoutAgent  → upsert)
 *
 * The scout agents already produce both site languages (he + en), so one pass
 * per city covers everything. Runs cities sequentially to respect upstream
 * (Gemini / Exa / Google Places) rate limits, and is safe to re-run: by default
 * it SKIPS a city that already has a healthy bank (use --force to re-scout).
 *
 * Usage:
 *   npx tsx scripts/prewarm-banks.ts                      # all default cities
 *   npx tsx scripts/prewarm-banks.ts --city Lisbon        # one city
 *   npx tsx scripts/prewarm-banks.ts --city "Rome,Paris"  # a few
 *   npx tsx scripts/prewarm-banks.ts --only restaurants   # restaurants | attractions
 *   npx tsx scripts/prewarm-banks.ts --force              # re-scout even if covered
 *   npx tsx scripts/prewarm-banks.ts --limit 5            # cap how many cities
 *   npx tsx scripts/prewarm-banks.ts --dry-run            # scout + print, no writes
 *
 * Required env (.env.local): GEMINI_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
 * NEXT_PUBLIC_SUPABASE_URL (+ EXA_API_KEY / GOOGLE_PLACES_API_KEY if configured).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runRestaurantScoutAgent } from '../src/lib/restaurantScoutAgent';
import { upsertRestaurants, fetchRestaurantsForCity } from '../src/lib/restaurantBank';
import { runAttractionScoutAgent } from '../src/lib/attractionScoutAgent';
import { upsertAttractions, fetchAttractionsForCity } from '../src/lib/attractionBank';

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

// Default coverage — the cities you want ready out of the box. Override with --city.
const DEFAULT_CITIES = [
  'Paris', 'London', 'Rome', 'Madrid', 'Barcelona', 'Berlin', 'Vienna',
  'Amsterdam', 'Athens', 'Prague', 'Budapest', 'Lisbon', 'Istanbul',
  'Florence', 'Venice', 'Milan', 'Edinburgh', 'Copenhagen', 'Santorini',
  'Tokyo', 'Kyoto', 'Bangkok', 'Singapore', 'Seoul', 'Dubai', 'Tel Aviv',
  'Marrakech', 'Cape Town', 'New York', 'Los Angeles', 'Mexico City',
  'Buenos Aires', 'Rio de Janeiro', 'Sydney',
];

const COVERED_MIN = 5; // a bank with ≥ this many rows counts as "already warm"

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadDotEnv();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    console.error('✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const only = (arg('only') ?? 'both').toLowerCase();          // restaurants | attractions | both
  const doRest = only === 'both' || only === 'restaurants';
  const doAttr = only === 'both' || only === 'attractions';
  const force = flag('force');
  const dryRun = flag('dry-run');
  const limit = arg('limit') ? parseInt(arg('limit')!, 10) : Infinity;

  const cityArg = arg('city');
  let cities = cityArg ? cityArg.split(',').map((c) => c.trim()).filter(Boolean) : DEFAULT_CITIES;
  cities = cities.slice(0, limit);

  console.log(`\n🏨 Pre-warming banks for ${cities.length} cities  (only=${only}, force=${force}, dryRun=${dryRun})\n`);

  const summary: string[] = [];
  for (const [i, city] of cities.entries()) {
    const tag = `[${i + 1}/${cities.length}] ${city}`;
    try {
      if (doRest) {
        const existing = force ? [] : await fetchRestaurantsForCity(db, city, { lang: 'en' }).catch(() => []);
        if (existing.length >= COVERED_MIN && !force) {
          console.log(`⏭  ${tag} — restaurants already warm (${existing.length}), skipping`);
        } else {
          const recs = await runRestaurantScoutAgent(city);
          if (!dryRun) await upsertRestaurants(db, recs);
          console.log(`🍽️  ${tag} — restaurants ${dryRun ? 'scouted' : 'upserted'}: ${recs.length}`);
          summary.push(`${city}: 🍽️ ${recs.length}`);
        }
      }
      if (doAttr) {
        const existing = force ? [] : await fetchAttractionsForCity(db, city, { lang: 'en' }).catch(() => []);
        if (existing.length >= COVERED_MIN && !force) {
          console.log(`⏭  ${tag} — attractions already warm (${existing.length}), skipping`);
        } else {
          const recs = await runAttractionScoutAgent(city);
          if (!dryRun) await upsertAttractions(db, recs);
          console.log(`🎟️  ${tag} — attractions ${dryRun ? 'scouted' : 'upserted'}: ${recs.length}`);
          summary.push(`${city}: 🎟️ ${recs.length}`);
        }
      }
    } catch (e) {
      console.warn(`⚠️  ${tag} — failed: ${e instanceof Error ? e.message : e}`);
      summary.push(`${city}: ✖ ${e instanceof Error ? e.message : 'error'}`);
    }
    // Gentle pacing between cities to stay under upstream rate limits.
    if (i < cities.length - 1) await sleep(1500);
  }

  console.log(`\n✓ Done.\n${summary.join('\n')}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
