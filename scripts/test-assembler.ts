/**
 * test-assembler.ts — run the deterministic assembler against your LIVE places
 * table, with no dev server / auth / route plumbing. Reads only the public
 * Supabase vars from .env.local (places has a public read policy).
 *
 *   npx tsx scripts/test-assembler.ts                 # Rome, couple/mid-range/moderate/4d
 *   npx tsx scripts/test-assembler.ts "Vienna"        # another covered city
 *   npx tsx scripts/test-assembler.ts "Paris" 5 family budget relaxed
 *     args: <city> [days] [groupType] [budget] [pace]
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { assembleItinerary, type AssemblerPlace } from '../src/services/assembler/assembleItinerary';

// ── load .env.local ───────────────────────────────────────────────────────────
try {
  for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
} catch { /* rely on system env */ }

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Prefer a REAL service-role key; otherwise use the anon key (places is public-read).
// Ignore the placeholder so a half-filled .env.local still works.
const key = (svc && !/PASTE|HERE|your_/i.test(svc)) ? svc : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
if (!url || !key) { console.error('Missing NEXT_PUBLIC_SUPABASE_URL / key in .env.local'); process.exit(1); }
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

// ── args ──────────────────────────────────────────────────────────────────────
const [, , cityArg, daysArg, groupArg, budgetArg, paceArg] = process.argv;
const city = cityArg || 'Rome';
const profile = {
  destination: city,
  duration: Number(daysArg) || 4,
  groupType: (groupArg as any) || 'couple',
  budget: (budgetArg as any) || 'mid-range',
  pace: (paceArg as any) || 'moderate',
  interests: ['history', 'food'],
  startDate: '2026-07-01',
};

async function main() {
  const cityOnly = city.split(',')[0].trim();
  const { data, error } = await db
    .from('places')
    .select('id,name,city,category,subcategory,description,lat,lng,category_emoji,price_tier,meal_slots,group_suitability,vibe,culinary_focus,vibe_label,top_pick_category,popularity_rank,google_rating,opening_hours,website_url,photo_url')
    .ilike('city', cityOnly)
    .limit(500);

  if (error) { console.error('DB read failed:', error.message); return; }
  const places = (data ?? []) as unknown as AssemblerPlace[];
  console.log(`\nLoaded ${places.length} places for "${cityOnly}".`);
  console.log(`Profile: ${profile.duration}d · ${profile.groupType} · ${profile.budget} · ${profile.pace}\n`);

  const { itinerary, reason, meta } = assembleItinerary(profile, places);
  console.log('gate meta:', meta);

  if (!itinerary) {
    console.log(`\n→ ASSEMBLER MISS (would fall back to the LLM): ${reason}`);
    return;
  }

  console.log(`\n→ ASSEMBLER HIT — built ${itinerary.days.length} days with zero LLM calls:\n`);
  for (const d of itinerary.days) {
    console.log(`Day ${d.day} (${d.date}) — ${d.theme}`);
    for (const s of ['morning', 'afternoon', 'evening'] as const) {
      const a = (d as any)[s];
      if (a) console.log(`  ${s.padEnd(9)} ${a.time_slot ?? ''}  ${a.name}${a.transitFromPrevious ? '  (' + a.transitFromPrevious + ')' : ''}`);
    }
    for (const m of ['breakfast', 'lunch', 'dinner'] as const) {
      const x = (d as any)[m];
      if (x) console.log(`  ${m.padEnd(9)} 🍴 ${x.name} [${x.priceRange}]`);
    }
  }

  // quick invariants
  const names: string[] = [];
  let dupDay = 0;
  for (const d of itinerary.days) {
    const acts = ['morning', 'afternoon', 'evening'].map((s) => (d as any)[s]).filter(Boolean);
    const subs = acts.map((a: any) => places.find((p) => p.name === a.name)?.subcategory);
    if (new Set(subs).size !== subs.length) dupDay++;
    for (const x of [...acts, (d as any).lunch, (d as any).dinner, (d as any).breakfast].filter(Boolean)) names.push(x.name);
  }
  console.log(`\nChecks: ${names.length} venues, repeats=${names.length - new Set(names).size}, days-with-duplicate-subcategory=${dupDay}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
