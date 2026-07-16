/**
 * TravelOS — Backfill composite_score / bayes_rating (Expand→Backfill→Verify→Contract, step 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * One-off maintenance script. Computes composite_score + bayes_rating for every
 * existing row in restaurant_recommendations using the EXACT same functions the
 * scout uses (computeCompositeScore / bayesRating), so backfilled rows and
 * freshly-scouted rows are scored identically.
 *
 * The per-city Bayesian mean prior is computed over each city's rated rows
 * (fallback 4.1), matching cityMeanRating().
 *
 * NOT a route handler — run manually / from a migration-adjacent job. Never
 * triggered by a user request.
 *
 * Usage:
 *   npx tsx scripts/backfill-restaurant-composite.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-restaurant-composite.ts             # write
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { rowToRec } from '../src/lib/restaurantBank';
import { cityMeanRating, bayesRating, computeCompositeScore } from '../src/lib/restaurantScoring';

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

const flag = (n: string) => process.argv.includes(`--${n}`);

async function main() {
  loadDotEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    console.error('✖ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  const dryRun = flag('dry-run');
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  // Pull every row (paged) grouped by city so the Bayesian city-mean prior
  // matches how the scout computes it per batch.
  const { data, error } = await db.from('restaurant_recommendations').select('*');
  if (error || !data) {
    console.error('✖ Read failed:', error?.message);
    process.exit(1);
  }

  const byCity = new Map<string, ReturnType<typeof rowToRec>[]>();
  for (const row of data) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const rec = rowToRec(row as any);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    (rec as any)._id = (row as any).id;
    const key = rec.city.trim().toLowerCase();
    (byCity.get(key) ?? byCity.set(key, []).get(key)!).push(rec);
  }

  let updated = 0;
  for (const [city, recs] of byCity) {
    const mean = cityMeanRating(recs);
    for (const rec of recs) {
      const composite = computeCompositeScore(rec, mean);
      const bayes = Number(bayesRating(rec.rating, rec.ratingCount, mean).toFixed(3));
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      const id = (rec as any)._id as string;
      if (dryRun) {
        console.log(`  ${city} · ${rec.name}: composite=${composite} bayes=${bayes}`);
        continue;
      }
      const { error: upErr } = await db
        .from('restaurant_recommendations')
        .update({ composite_score: composite, bayes_rating: bayes, score: composite, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (upErr) console.warn(`  ! ${rec.name}: ${upErr.message}`);
      else updated++;
    }
  }

  console.log(`\n✓ ${dryRun ? '(dry-run) would update' : 'updated'} ${dryRun ? data.length : updated} row(s) across ${byCity.size} cities.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
