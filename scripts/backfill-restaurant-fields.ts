/**
 * TravelOS — Backfill derivable book-ahead fields for EXISTING restaurant rows
 * ─────────────────────────────────────────────────────────────────────────────
 * A full re-scout is the proper way to populate every new column (Gemini writes
 * accurate genre / book_ahead_level / dietary_tags / meal_slots). But three of
 * the new fields are derivable from data ALREADY in the row, and they drive the
 * most visible parts of the ranker — so this one-off pass lights up existing
 * banks immediately, without paying for a re-scout:
 *
 *   • cuisine_genre     ← canonicalizeGenre(cuisine_style)   (MMR diversity + chip)
 *   • neighborhood_slug ← normalizeNeighborhoodSlug(neighborhood) (GeoFit match)
 *   • country_code      ← CITY_COUNTRY[normalized city]       (platform routing)
 *
 * It only fills a field when it's currently null (never overwrites a real scout
 * value) and then recomputes composite_score / bayes_rating so the genre-derived
 * book-ahead prior flows into the score. Reuses the exact app functions, so the
 * result matches what the scout would write.
 *
 * A subsequent full re-scout (replace mode) overwrites all of this with better
 * data — this is a stop-gap, safe to run repeatedly (idempotent).
 *
 * Usage:
 *   npx tsx scripts/backfill-restaurant-fields.ts --dry-run   # preview only
 *   npx tsx scripts/backfill-restaurant-fields.ts             # write
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { rowToRec, normalizeCity, normalizeNeighborhoodSlug } from '../src/lib/restaurantBank';
import { canonicalizeGenre } from '../src/lib/restaurantGenre';
import { cityMeanRating, bayesRating, computeCompositeScore } from '../src/lib/restaurantScoring';

/**
 * Best-effort city → ISO-2 country for legacy rows scouted before we captured
 * country_code from Google Places. Keyed by normalizeCity(city). Fresh scouts
 * populate country_code directly, so this only needs the already-banked cities
 * plus common destinations; anything unmapped stays null (platform router then
 * falls back to Google Reserve / the global OTA).
 */
const CITY_COUNTRY: Record<string, string> = {
  tokyo: 'JP', kyoto: 'JP', osaka: 'JP',
  rome: 'IT', venice: 'IT', florence: 'IT', milan: 'IT', naples: 'IT',
  paris: 'FR', bordeaux: 'FR', lyon: 'FR', nice: 'FR', marseille: 'FR',
  barcelona: 'ES', madrid: 'ES', seville: 'ES', valencia: 'ES', 'san sebastian': 'ES',
  lisbon: 'PT', porto: 'PT',
  amsterdam: 'NL', rotterdam: 'NL',
  london: 'GB', edinburgh: 'GB', manchester: 'GB',
  berlin: 'DE', munich: 'DE', hamburg: 'DE',
  'new york': 'US', 'los angeles': 'US', 'san francisco': 'US', chicago: 'US', miami: 'US', 'las vegas': 'US',
  toronto: 'CA', montreal: 'CA', vancouver: 'CA',
  dubai: 'AE', 'abu dhabi': 'AE',
  'tel aviv': 'IL', jerusalem: 'IL',
  singapore: 'SG', bangkok: 'TH', 'kuala lumpur': 'MY', bali: 'ID', 'ho chi minh city': 'VN', hanoi: 'VN', 'hong kong': 'HK',
  vienna: 'AT', prague: 'CZ', athens: 'GR', copenhagen: 'DK', stockholm: 'SE', dublin: 'IE', budapest: 'HU',
  istanbul: 'TR', 'mexico city': 'MX', 'buenos aires': 'AR', 'rio de janeiro': 'BR', 'sao paulo': 'BR',
};

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

  const { data, error } = await db.from('restaurant_recommendations').select('*');
  if (error || !data) {
    console.error('✖ Read failed:', error?.message);
    process.exit(1);
  }

  // Group by city so the Bayesian mean prior matches the scout's per-batch calc.
  const byCity = new Map<string, { rec: ReturnType<typeof rowToRec>; id: string }[]>();
  for (const row of data) {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const rec = rowToRec(row as any);
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const id = (row as any).id as string;
    const k = normalizeCity(rec.city);
    (byCity.get(k) ?? byCity.set(k, []).get(k)!).push({ rec, id });
  }

  let touched = 0;
  const genreCounts: Record<string, number> = {};

  for (const [cityKey, entries] of byCity) {
    const mean = cityMeanRating(entries.map((e) => e.rec));
    const country = CITY_COUNTRY[cityKey] ?? null;

    for (const { rec, id } of entries) {
      const genre = rec.cuisineGenre ?? canonicalizeGenre(rec.cuisineStyle) ?? null;
      const slug = rec.neighborhoodSlug ?? normalizeNeighborhoodSlug(rec.neighborhood);
      const cc = rec.countryCode ?? country;

      // Apply derived fields onto the rec so the composite reflects the genre
      // (its book-ahead prior feeds the A-term when book_ahead_level is null).
      rec.cuisineGenre = genre;
      const composite = computeCompositeScore(rec, mean);
      const bayes = Number(bayesRating(rec.rating, rec.ratingCount, mean).toFixed(3));
      if (genre) genreCounts[genre] = (genreCounts[genre] ?? 0) + 1;

      if (dryRun) {
        touched++;
        console.log(`  ${cityKey} · ${rec.name}: genre=${genre ?? '—'} cc=${cc ?? '—'} slug=${slug ?? '—'} composite=${composite}`);
        continue;
      }
      const { error: upErr } = await db
        .from('restaurant_recommendations')
        .update({
          cuisine_genre: genre,
          neighborhood_slug: slug,
          country_code: cc,
          composite_score: composite,
          bayes_rating: bayes,
          score: composite,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (upErr) console.warn(`  ! ${rec.name}: ${upErr.message}`);
      else touched++;
    }
  }

  console.log(`\nGenre distribution: ${Object.entries(genreCounts).sort((a, b) => b[1] - a[1]).map(([g, n]) => `${g}:${n}`).join(', ') || '(none matched)'}`);
  console.log(`✓ ${dryRun ? '(dry-run) would update' : 'updated'} ${touched} row(s) across ${byCity.size} cities.\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
