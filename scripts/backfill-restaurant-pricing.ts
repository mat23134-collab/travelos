// @ts-nocheck
/**
 * TravelOS — Restaurant price + lead-time backfill
 * ─────────────────────────────────────────────────────────────────────────────
 * Cheap, targeted fix for restaurants scouted before we added a real price band
 * and a booking lead time. It does NOT re-scout (no web search, no Places) — it
 * just asks Gemini, per city, to fill two fields for the venues we already have:
 *   • price_range        → an approximate per-person cost band (local currency)
 *   • translations.<lang>.bookingLeadTime → typical advance-booking window (he+en)
 *
 * Everything else (descriptions, links, ratings, photos) is untouched.
 *
 * Usage:
 *   npx tsx scripts/backfill-restaurant-pricing.ts                 # every city in the table
 *   npx tsx scripts/backfill-restaurant-pricing.ts --city Lisbon   # one city / comma-list
 *   npx tsx scripts/backfill-restaurant-pricing.ts --dry-run       # print, no writes
 *
 * Env (.env.local): GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { callGeminiJson, parseJsonArray } from '../src/lib/scoutShared';

const TABLE = 'restaurant_recommendations';

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
  } catch { /* system env */ }
}

const arg = (n: string) => {
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : null;
};
const flag = (n: string) => process.argv.includes(`--${n}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function backfillCity(db, city: string, dryRun: boolean) {
  const { data: rows, error } = await db
    .from(TABLE)
    .select('id, name, neighborhood, cuisine_style, price_level, price_range, translations')
    .ilike('city', city);
  if (error) { console.warn(`⚠️  ${city}: select failed — ${error.message}`); return; }
  if (!rows?.length) { console.log(`·  ${city}: no rows`); return; }

  const list = rows.map((r, i) => ({ i, name: r.name, neighborhood: r.neighborhood, cuisine: r.cuisine_style, priceLevel: r.price_level }));

  const raw = await callGeminiJson(
    'You price restaurants for a travel app. For each restaurant, return an approximate cost band PER PERSON for a typical meal, in the LOCAL currency with numbers (e.g. "€45–70 pp", "¥18,000–25,000 pp") — never bare symbols. Also return the typical advance-booking window as a short phrase in English and Hebrew (e.g. en "2–3 weeks ahead", he "שבועיים-שלושה מראש"). Return ONLY a JSON array, same order + same "i", each: { "i": <index>, "priceRange": "…", "leadTimeEn": "…", "leadTimeHe": "…" }.',
    `City: ${city}\nRestaurants:\n${JSON.stringify(list)}`,
    { temperature: 0.2 },
  );
  const parsed = parseJsonArray(raw) as Array<{ i: number; priceRange?: string; leadTimeEn?: string; leadTimeHe?: string }>;
  const byIndex = new Map(parsed.filter((p) => Number.isInteger(p.i)).map((p) => [p.i, p]));

  let updated = 0;
  for (const r of rows) {
    const p = byIndex.get(list.find((l) => l.name === r.name)?.i ?? -1);
    if (!p) continue;
    const priceRange = typeof p.priceRange === 'string' && p.priceRange.trim() ? p.priceRange.trim() : r.price_range;
    const tr = { ...(r.translations ?? {}) };
    if (p.leadTimeEn) tr.en = { ...(tr.en ?? {}), bookingLeadTime: p.leadTimeEn.trim() };
    if (p.leadTimeHe) tr.he = { ...(tr.he ?? {}), bookingLeadTime: p.leadTimeHe.trim() };

    if (dryRun) {
      console.log(`   ${r.name}  →  ${priceRange}  ·  ⏳ ${p.leadTimeEn ?? '—'} / ${p.leadTimeHe ?? '—'}`);
    } else {
      const { error: uErr } = await db.from(TABLE).update({ price_range: priceRange, translations: tr }).eq('id', r.id);
      if (uErr) console.warn(`   ⚠️ ${r.name}: ${uErr.message}`);
      else updated++;
    }
  }
  console.log(`✓  ${city}: ${dryRun ? `${rows.length} previewed` : `${updated}/${rows.length} updated`}`);
}

async function main() {
  loadDotEnv();
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) { console.error('✖ Missing Supabase env'); process.exit(1); }
  const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const dryRun = flag('dry-run');
  const cityArg = arg('city');
  let cities: string[];
  if (cityArg) {
    cities = cityArg.split(',').map((c) => c.trim()).filter(Boolean);
  } else {
    const { data } = await db.from(TABLE).select('city');
    cities = [...new Set((data ?? []).map((r) => r.city).filter(Boolean))];
  }

  console.log(`\n💶 Backfilling price + lead time for ${cities.length} cities (dryRun=${dryRun})\n`);
  for (const [i, city] of cities.entries()) {
    try { await backfillCity(db, city, dryRun); } catch (e) { console.warn(`⚠️  ${city}: ${e instanceof Error ? e.message : e}`); }
    if (i < cities.length - 1) await sleep(1200);
  }
  console.log('\n✓ Done.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
