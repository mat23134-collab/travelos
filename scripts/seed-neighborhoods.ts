/**
 * TravelOS — Neighborhood polygon ingestion (city_neighborhoods).
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches real neighborhood boundaries from OpenStreetMap (Nominatim,
 * polygon_geojson) and upserts them into `city_neighborhoods` via the
 * `upsert_city_neighborhood` RPC (which handles Polygon/MultiPolygon).
 *
 * The Dynamic Neighborhood Profiler maps a day's POIs onto these polygons — so
 * the richer this table, the more days light up a guide. Nominatim asks for a
 * descriptive User-Agent and ≤1 request/second; this script respects both.
 *
 * Run where OUTBOUND ACCESS TO nominatim.openstreetmap.org IS ALLOWED (the
 * managed sandbox blocks it):
 *   npx tsx scripts/seed-neighborhoods.ts --dry-run
 *   npx tsx scripts/seed-neighborhoods.ts
 *   npx tsx scripts/seed-neighborhoods.ts --city Florence
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

interface CitySpec {
  city: string;
  country: string;
  neighborhoods: { en: string; he: string }[];
}

// Seed list — extend freely. Names are the OSM-recognizable neighborhood names.
const CITIES: CitySpec[] = [
  { city: 'Florence', country: 'Italy', neighborhoods: [
    { en: 'Santa Croce', he: 'סנטה קרוצ׳ה' }, { en: 'Oltrarno', he: 'אולטרארנו' },
    { en: 'San Marco', he: 'סן מרקו' }, { en: 'Santa Maria Novella', he: 'סנטה מריה נובלה' },
  ] },
  { city: 'Rome', country: 'Italy', neighborhoods: [
    { en: 'Trastevere', he: 'טרסטוורה' }, { en: 'Monti', he: 'מונטי' },
    { en: 'Centro Storico', he: 'המרכז ההיסטורי' }, { en: 'Testaccio', he: 'טסטאצ׳ו' },
  ] },
  { city: 'Tokyo', country: 'Japan', neighborhoods: [
    { en: 'Shibuya', he: 'שיבויה' }, { en: 'Shinjuku', he: 'שינג׳וקו' },
    { en: 'Asakusa', he: 'אסקוסה' }, { en: 'Ginza', he: 'גינזה' },
  ] },
  { city: 'Paris', country: 'France', neighborhoods: [
    { en: 'Le Marais', he: 'לה מארה' }, { en: 'Saint-Germain-des-Prés', he: 'סן ז׳רמן' },
    { en: 'Montmartre', he: 'מונמארטר' },
  ] },
];

interface NominatimHit { display_name?: string; geojson?: { type?: string } }

async function fetchPolygon(neighborhood: string, city: string, country: string): Promise<string | null> {
  const q = encodeURIComponent(`${neighborhood}, ${city}, ${country}`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=jsonv2&polygon_geojson=1&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TravelOS/1.0 (neighborhood ingestion)' } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = (await res.json()) as NominatimHit[];
  const g = data?.[0]?.geojson;
  if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon')) return null;
  return JSON.stringify(g);
}

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
  const cityFilter = arg('city');
  const cities = cityFilter ? CITIES.filter((c) => c.city.toLowerCase() === cityFilter.toLowerCase()) : CITIES;

  let ok = 0, miss = 0;
  for (const spec of cities) {
    for (const n of spec.neighborhoods) {
      try {
        const geojson = await fetchPolygon(n.en, spec.city, spec.country);
        await sleep(1100); // Nominatim: ≤ 1 req/sec
        if (!geojson) { console.log(`   – ${spec.city} / ${n.en}: no polygon`); miss++; continue; }
        if (dryRun) { console.log(`   • ${spec.city} / ${n.en}: polygon ${geojson.length} chars (DRY RUN)`); ok++; continue; }
        const { error } = await db.rpc('upsert_city_neighborhood', {
          _city: spec.city, _name_english: n.en, _name_hebrew: n.he, _geojson: geojson,
        });
        if (error) { console.warn(`   ! ${spec.city} / ${n.en}: ${error.message}`); miss++; }
        else { console.log(`   ✓ ${spec.city} / ${n.en}`); ok++; }
      } catch (e) {
        console.warn(`   ! ${spec.city} / ${n.en}: ${e instanceof Error ? e.message : String(e)}`);
        miss++;
      }
    }
  }
  console.log(`\n✓ Done — ${ok} upserted, ${miss} skipped.${dryRun ? ' (dry-run)' : ''}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
