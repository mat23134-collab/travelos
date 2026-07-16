/**
 * TravelOS — Restaurant bank re-verification (§10)
 * ─────────────────────────────────────────────────────────────────────────────
 * Refreshes the stalest verified restaurant rows against Google Place Details:
 * updated rating / review count / website / composite score, and DELETES places
 * Google reports as permanently closed (a dead reservation link is the worst
 * failure mode for the book-ahead panel).
 *
 * Meant to run nightly via cron (or the admin trigger route). Processes the
 * cities with stale rows, a bounded number of rows each, to stay gentle on the
 * Places quota.
 *
 * Usage:
 *   npx tsx scripts/restaurant-reverify.ts --dry-run                 # preview, no writes
 *   npx tsx scripts/restaurant-reverify.ts                           # write for real
 *   npx tsx scripts/restaurant-reverify.ts --city Tokyo,Rome         # specific cities
 *   npx tsx scripts/restaurant-reverify.ts --limit 30                # rows per city (default 20)
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *                    GOOGLE_PLACES_API_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { reverifyCity, citiesNeedingReverify } from '../src/lib/restaurantReverify';

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
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    console.error('✖ Missing GOOGLE_PLACES_API_KEY — re-verification needs Google Place Details.');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const dryRun = flag('dry-run');
  const limit = Number(arg('limit')) || 20;
  const cityArg = arg('city');
  const cities = cityArg
    ? cityArg.split(',').map((c) => c.trim()).filter(Boolean)
    : await citiesNeedingReverify(db);

  if (cities.length === 0) {
    console.log('✓ Nothing stale to re-verify.');
    return;
  }

  console.log(`\n🔁 Restaurant re-verify — ${cities.length} cities, ${limit}/city, mode=${dryRun ? 'DRY RUN' : 'WRITE'}`);
  let totals = { checked: 0, updated: 0, closed: 0, skipped: 0 };

  for (const [i, city] of cities.entries()) {
    const r = await reverifyCity(db, city, { limit, dryRun });
    console.log(
      `   ${city}: checked ${r.checked}, updated ${r.updated}, closed ${r.closed}, skipped ${r.skipped}`,
    );
    totals = {
      checked: totals.checked + r.checked,
      updated: totals.updated + r.updated,
      closed: totals.closed + r.closed,
      skipped: totals.skipped + r.skipped,
    };
    if (i < cities.length - 1) await sleep(1000); // gentle on the Places quota
  }

  console.log(
    `\n✓ Done — checked ${totals.checked}, updated ${totals.updated}, closed ${totals.closed}, skipped ${totals.skipped}.` +
    `${dryRun ? ' (dry-run — nothing written)' : ''}\n`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });
