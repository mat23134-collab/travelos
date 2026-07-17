/**
 * TravelOS — Backfill Israeli-calibration signals (Expand→Backfill→Verify→Contract, step 2)
 * ─────────────────────────────────────────────────────────────────────────────
 * Populates value_score, near_landmark / landmark_distance_m, tourist_trap_penalty
 * and recomputes composite_score for EXISTING restaurant rows, using the exact
 * same scoring functions the scout uses. near_landmark is derived by haversine
 * from each restaurant to the city's attraction bank (≤200m = on a landmark).
 *
 * kosher_status / veg / vegan / hebrew_social_url / last_review_at are NOT
 * backfillable here (they need the scout / Google reviews) — they populate on
 * the next re-scout and read null-safe until then.
 *
 * NOT a route handler — run manually. Never triggered by a user request.
 *
 * Usage:
 *   npx tsx scripts/backfill-restaurant-israeli.ts --dry-run
 *   npx tsx scripts/backfill-restaurant-israeli.ts
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { rowToRec } from '../src/lib/restaurantBank';
import { cityMeanRating, computeValueScore, touristTrapPenalty, computeCompositeScore } from '../src/lib/restaurantScoring';
import { haversineKm } from '../src/services/assembler/geo';

/** Restaurants within this distance of a major attraction are "on a landmark". */
const NEAR_LANDMARK_M = 200;

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

  const { data: restRows, error } = await db.from('restaurant_recommendations').select('*');
  if (error || !restRows) { console.error('✖ Read failed:', error?.message); process.exit(1); }

  // Attraction coordinates per normalized city (the "landmarks").
  const { data: attrRows } = await db
    .from('attraction_recommendations')
    .select('city_normalized, latitude, longitude');
  const landmarksByCity = new Map<string, { lat: number; lng: number }[]>();
  for (const a of attrRows ?? []) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const row = a as any;
    if (row.latitude == null || row.longitude == null) continue;
    const list = landmarksByCity.get(row.city_normalized) ?? [];
    list.push({ lat: row.latitude, lng: row.longitude });
    landmarksByCity.set(row.city_normalized, list);
  }

  // Group restaurants by city for the per-city Bayesian mean.
  const byCity = new Map<string, { rows: ReturnType<typeof rowToRec>[]; ids: string[] }>();
  for (const row of restRows) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const anyRow = row as any;
    const rec = rowToRec(anyRow);
    const key = rec.city.trim().toLowerCase();
    const bucket = byCity.get(key) ?? { rows: [], ids: [] };
    bucket.rows.push(rec);
    bucket.ids.push(anyRow.id);
    byCity.set(key, bucket);
  }

  let updated = 0;
  for (const [cityKey, { rows, ids }] of byCity) {
    const mean = cityMeanRating(rows);
    const landmarks = landmarksByCity.get(cityKey) ?? [];
    for (let i = 0; i < rows.length; i++) {
      const rec = rows[i];
      // near_landmark via nearest attraction (only when we have coords).
      let nearLandmark: boolean | null = null;
      let distanceM: number | null = null;
      if (rec.latitude != null && rec.longitude != null && landmarks.length) {
        let bestKm = Infinity;
        for (const lm of landmarks) bestKm = Math.min(bestKm, haversineKm({ lat: rec.latitude, lng: rec.longitude }, lm));
        distanceM = Math.round(bestKm * 1000);
        nearLandmark = distanceM <= NEAR_LANDMARK_M;
      }
      rec.nearLandmark = nearLandmark;
      rec.landmarkDistanceM = distanceM;
      const value = computeValueScore(rec, mean);
      const trap = touristTrapPenalty(rec, mean);
      const composite = computeCompositeScore(rec, mean);

      if (dryRun) {
        console.log(`  ${cityKey} · ${rec.name}: value=${value} trap=${trap} near=${nearLandmark ?? '?'} composite=${composite}`);
        continue;
      }
      const { error: upErr } = await db
        .from('restaurant_recommendations')
        .update({
          value_score: value,
          tourist_trap_penalty: trap,
          near_landmark: nearLandmark,
          landmark_distance_m: distanceM,
          composite_score: composite,
          score: composite,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ids[i]);
      if (upErr) console.warn(`  ! ${rec.name}: ${upErr.message}`);
      else updated++;
    }
  }

  console.log(`\n✓ ${dryRun ? '(dry-run) would update' : 'updated'} ${dryRun ? restRows.length : updated} row(s) across ${byCity.size} cities.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
