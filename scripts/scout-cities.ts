/**
 * TravelOS — batch restaurant-scout runner.
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs the restaurant scout AGENT (Exa/Tavily → Gemini → Google Places → scoring)
 * over our curated destinations and upserts each city's bank into
 * `public.restaurant_recommendations`. This pre-warms every featured city at once
 * instead of waiting for a traveler to trigger it lazily.
 *
 * Each city runs a general pass PLUS a budget-scoped pass in parallel (so the bank
 * isn't luxury-skewed from the first save), exactly like the /api/restaurants/scout
 * "brand-new city" path.
 *
 * Run where OUTBOUND ACCESS + API KEYS EXIST (the managed sandbox has neither):
 *   npx tsx scripts/scout-cities.ts --dry-run          # list what would run
 *   npx tsx scripts/scout-cities.ts                    # scout all featured cities
 *   npx tsx scripts/scout-cities.ts --only-missing     # skip cities that already have a bank
 *   npx tsx scripts/scout-cities.ts --city Florence    # a single city
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                   GEMINI_API_KEY, EXA_API_KEY (or TAVILY_API_KEY), Google Places key.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DESTINATIONS } from '@/lib/destinations';
import { runRestaurantScoutAgent } from '@/lib/restaurantScoutAgent';
import { upsertRestaurants, cityLastUpdated, MAX_PRICE_LEVEL_BY_BUDGET } from '@/lib/restaurantBank';

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

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const flag = (n: string) => process.argv.includes(`--${n}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadDotEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    console.error('✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const dryRun = flag('dry-run');
  const onlyMissing = flag('only-missing');
  const cityFilter = arg('city');
  // Budget-scoped second pass to guarantee affordable/mid-range coverage.
  const midMaxLevel = MAX_PRICE_LEVEL_BY_BUDGET['mid-range'];

  const cities = (cityFilter ? [{ name: cityFilter }] : DESTINATIONS).map((c) => c.name);

  let scouted = 0, skipped = 0, failed = 0;
  for (const city of cities) {
    try {
      if (onlyMissing && (await cityLastUpdated(db, city)) != null) {
        console.log(`   – ${city}: already has a bank, skipping`);
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`   • ${city}: would scout (general + ≤tier${midMaxLevel}) — DRY RUN`);
        scouted++;
        continue;
      }
      const [primary, topUp] = await Promise.all([
        runRestaurantScoutAgent(city),
        runRestaurantScoutAgent(city, { maxPriceLevel: midMaxLevel }),
      ]);
      const recs = [...primary, ...topUp];
      if (recs.length === 0) {
        console.warn(`   ! ${city}: scout returned 0 restaurants`);
        failed++;
        continue;
      }
      await upsertRestaurants(db, recs);
      console.log(`   ✓ ${city}: ${recs.length} restaurants upserted`);
      scouted++;
      await sleep(2000); // gentle pacing between cities (Gemini/Exa/Places rate limits)
    } catch (e) {
      console.warn(`   ! ${city}: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }
  }
  console.log(`\n✓ Done — ${scouted} scouted, ${skipped} skipped, ${failed} failed.${dryRun ? ' (dry-run)' : ''}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
