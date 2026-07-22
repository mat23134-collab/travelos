/**
 * Only-Here anti-generic eval — Engine C's required guardrail before shipping:
 * "sample outputs across several cities and confirm each item passes the
 * 'couldn't-do-this-in-any-big-city' test." Read-only — never writes to the DB.
 *
 * Usage:
 *   npx tsx scripts/only-here-eval.ts [city1] [city2] [city3] ...
 *   (defaults to Tokyo, Rome, Tel Aviv if no cities given)
 *
 * Required env vars (.env.local, or `railway run` for the real production keys):
 *   GEMINI_API_KEY
 *   GOOGLE_PLACES_API_KEY   (optional — candidates still print without it, just unverified)
 *   TAVILY_API_KEY and/or EXA_API_KEY (optional — falls back to Gemini's own knowledge)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Same hand-rolled .env.local loader as scripts/scout-agent.ts (no dotenv dep
// in this project) — must run before importing anything that reads env vars
// at module scope.
function loadDotEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const lines = readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx < 0) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local not found — rely on system env (e.g. `railway run`)
  }
}
loadDotEnv();

async function main() {
  // Deferred import so the env vars above are set before this module (and its
  // transitive imports) read process.env at load time.
  const { runOnlyHereScoutAgent } = await import('../src/lib/onlyHereScoutAgent');

  const cities = process.argv.slice(2).filter(Boolean);
  const targets = cities.length > 0 ? cities : ['Tokyo', 'Rome', 'Tel Aviv'];

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — cannot run a real eval. Set it in .env.local or run via `railway run`.');
    process.exit(1);
  }

  for (const city of targets) {
    console.log(`\n${'='.repeat(70)}\n${city}\n${'='.repeat(70)}`);
    try {
      const recs = await runOnlyHereScoutAgent(city);
      if (recs.length === 0) {
        console.log('  (no candidates returned)');
        continue;
      }
      recs.forEach((r, i) => {
        console.log(`\n${i + 1}. ${r.name}${r.neighborhood ? ` — ${r.neighborhood}` : ''}  [score ${r.score}]`);
        console.log(`   what it is:     ${r.description ?? '(none)'}`);
        console.log(`   why only here:  ${r.whyOnlyHere ?? '(none — RED FLAG, missing the core distinctiveness field)'}`);
        console.log(`   hook line:      ${r.hookLine ?? '(none)'}`);
        console.log(`   how to do it:   ${r.howToDoIt ?? '(none)'}`);
        console.log(`   group fit:      ${(r.groupSuitability ?? []).join(', ') || '(anyone)'}`);
        console.log(`   verified:       ${r.googlePlaceId ? `yes (${r.rating ?? '?'}★, ${r.ratingCount ?? 0} ratings)` : 'no (expected for some genuine local specialties)'}`);
      });
    } catch (e) {
      console.error(`  scout failed for ${city}:`, e instanceof Error ? e.message : e);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('Review each "why only here" line: does it name a SPECIFIC local tie,');
  console.log('or could this same paragraph describe an attraction in any big city?');
  console.log('='.repeat(70));
}

main();
