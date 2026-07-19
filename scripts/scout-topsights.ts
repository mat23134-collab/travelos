/**
 * TravelOS — batch "Our Picks" (top sights) scout runner.
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs the top-sights scout AGENT (Exa/Tavily → Gemini → Google Places → rank)
 * over our curated destinations and upserts each city's curated bank into
 * `public.places` (top_pick_category + popularity_rank) — the data source
 * behind onboarding Step 7 ("Our Picks", /api/landmarks).
 *
 * Until this runs, that bank is 100% hand-seeded for 4 cities (Rome, Paris,
 * London, Vienna) — every other destination hits the "we don't have curated
 * picks yet" empty state right before Generate. This closes that gap.
 *
 * Run where OUTBOUND ACCESS + API KEYS EXIST (the managed sandbox has neither):
 *   npx tsx scripts/scout-topsights.ts --dry-run          # list what would run
 *   npx tsx scripts/scout-topsights.ts                    # scout all featured cities
 *   npx tsx scripts/scout-topsights.ts --only-missing      # skip cities that already have a bank
 *   npx tsx scripts/scout-topsights.ts --city Florence     # a single city
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY,
 *      GOOGLE_PLACES_API_KEY, TAVILY_API_KEY and/or EXA_API_KEY.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { DESTINATIONS } from '@/lib/destinations';
import { runTopSightsScoutAgent } from '@/lib/topSightsScoutAgent';
import { cityHasTopSights, upsertTopSights } from '@/lib/topSightsBank';

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
  const cities = (cityFilter ? [{ name: cityFilter }] : DESTINATIONS).map((c) => c.name);

  let scouted = 0, skipped = 0, failed = 0;
  for (const city of cities) {
    try {
      if (onlyMissing && (await cityHasTopSights(db, city))) {
        console.log(`   – ${city}: already has curated picks, skipping`);
        skipped++;
        continue;
      }
      if (dryRun) {
        console.log(`   • ${city}: would scout (sightseeing + history + food) — DRY RUN`);
        scouted++;
        continue;
      }
      const rows = await runTopSightsScoutAgent(city);
      if (rows.length === 0) {
        console.warn(`   ! ${city}: scout returned 0 picks`);
        failed++;
        continue;
      }
      const ok = await upsertTopSights(db, rows);
      console.log(`   ✓ ${city}: ${ok}/${rows.length} picks upserted`);
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
