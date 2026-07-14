/**
 * TravelOS — Restaurant budget top-up scout
 * ─────────────────────────────────────────────────────────────────────────────
 * Adds affordable/mid-range restaurants (priceLevel 1–2) to a city's existing
 * `restaurant_recommendations` bank WITHOUT touching what's already there.
 *
 * Why this exists: the original restaurant scout prompt curated fine-dining
 * only, so cities scouted before that changed skew entirely luxury. Re-running
 * the normal scout would DELETE those rows (upsertRestaurants defaults to
 * replace-the-city-bank). This script uses 'additive' mode instead — it only
 * ever inserts new, budget-tier rows; existing rows (including the luxury
 * picks) are never deleted or modified.
 *
 * Usage:
 *   npx tsx scripts/restaurant-budget-scout.ts --dry-run             # preview, no writes
 *   npx tsx scripts/restaurant-budget-scout.ts                       # write for real
 *   npx tsx scripts/restaurant-budget-scout.ts --city Tokyo,Lisbon   # override the city list
 *   npx tsx scripts/restaurant-budget-scout.ts --lang he             # localize primary text to Hebrew
 *
 * Env (.env.local): GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *                    SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY,
 *                    TAVILY_API_KEY or EXA_API_KEY (web research)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { runRestaurantScoutAgent } from '../src/lib/restaurantScoutAgent';
import { upsertRestaurants, MAX_PRICE_LEVEL_BY_BUDGET } from '../src/lib/restaurantBank';

// ── Env loader (same pattern as the other scripts/*.ts CLIs) ──────────────────
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

// The 12 cities with an existing (luxury-skewed) bank, per the request.
const DEFAULT_CITIES = [
  'Amsterdam', 'Barcelona', 'Dubai', 'Florence', 'Lisbon', 'London',
  'New York', 'Paris', 'Rome', 'Tel Aviv', 'Tokyo', 'Venice',
];

// "budget" tier ceiling (priceLevel <= 2) — same convention as
// MAX_PRICE_LEVEL_BY_BUDGET.budget in restaurantBank.ts, i.e. what a
// budget/mid-range trip sees by default in the book-ahead panel.
const MAX_PRICE_LEVEL = MAX_PRICE_LEVEL_BY_BUDGET.budget;

async function runCity(
  db: ReturnType<typeof createClient>,
  city: string,
  dryRun: boolean,
): Promise<void> {
  console.log(`\n🍽️  ${city} — scouting affordable/mid-range (priceLevel ≤ ${MAX_PRICE_LEVEL})…`);
  try {
    const recs = await runRestaurantScoutAgent(city, { maxPriceLevel: MAX_PRICE_LEVEL });

    if (recs.length === 0) {
      console.log(`   ⚠️  No candidates verified within budget for ${city}.`);
      return;
    }

    if (dryRun) {
      console.log(`   → ${recs.length} candidate(s) (DRY RUN — nothing written):`);
      for (const r of recs) {
        console.log(
          `      • ${r.name}${r.neighborhood ? ` (${r.neighborhood})` : ''} — ` +
          `${r.priceRange ?? 'price n/a'} · priceLevel ${r.priceLevel ?? '?'} · ` +
          `${r.rating != null ? `★${r.rating}` : 'unrated'}${r.googlePlaceId ? ' · verified' : ' · UNVERIFIED'}`,
        );
      }
      return;
    }

    const written = await upsertRestaurants(db, recs, { mode: 'additive' });
    const skipped = recs.length - written;
    console.log(
      `   ✓ ${city}: +${written} new row(s) written` +
      (skipped > 0 ? ` (${skipped} already existed — skipped, not touched)` : ''),
    );
  } catch (e) {
    console.warn(`   ✗ ${city}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  loadDotEnv();

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    console.error('✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('✖ Missing GEMINI_API_KEY in .env.local');
    process.exit(1);
  }
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.warn('⚠️  GOOGLE_PLACES_API_KEY not set — candidates will be unverified and the budget filter cannot confirm real prices.');
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const dryRun = flag('dry-run');
  const cityArg = arg('city');
  const cities = cityArg
    ? cityArg.split(',').map((c) => c.trim()).filter(Boolean)
    : DEFAULT_CITIES;

  console.log(`\n💰 Restaurant budget top-up — ${cities.length} cities, mode=${dryRun ? 'DRY RUN' : 'ADDITIVE WRITE'}`);
  console.log(`   Cities: ${cities.join(', ')}`);
  if (!dryRun) {
    console.log('   Existing rows (incl. luxury picks) are never deleted or modified — this only adds new budget-tier rows.\n');
  }

  for (const [i, city] of cities.entries()) {
    await runCity(db, city, dryRun);
    if (i < cities.length - 1) await sleep(1500); // be gentle on Gemini/Places/Exa rate limits
  }

  console.log(`\n✓ Done.${dryRun ? ' Re-run without --dry-run to write these rows.' : ''}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
