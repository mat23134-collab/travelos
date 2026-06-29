/**
 * translate-places-he.ts — one-off data localization.
 *
 * Translates `places.description` → `places.description_he` (Hebrew) for every
 * row that still has a Latin (English) description and no Hebrew yet. Proper
 * names (venues, restaurants, attractions, dishes, cuisine proper nouns,
 * neighborhoods) are kept verbatim; only generic words/labels are translated.
 *
 * Idempotent + resumable: only touches rows where description_he IS NULL.
 * Run:  npx tsx scripts/translate-places-he.ts
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// ── Load .env.local (tsx doesn't auto-load it) ────────────────────────────────
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? '';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing env (SUPABASE_URL / SERVICE_KEY / ANTHROPIC_KEY)');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
// Generous per-request timeout + retries so transient API timeouts don't drop a batch to English.
const claude = new Anthropic({ apiKey: ANTHROPIC_KEY, timeout: 120_000, maxRetries: 4 });

const BATCH = Number(process.env.TRANSLATE_BATCH) || 25;

const SYSTEM = `You are a professional English→Hebrew translator for a premium travel app.
Translate each place "description" into natural, fluent Hebrew.

CRITICAL RULES:
- KEEP VERBATIM (do NOT translate or transliterate): venue / restaurant / attraction / hotel names, neighborhood names, dish names (e.g. "Oeuf Mayonnaise", "Steak Frites"), and cuisine proper nouns (e.g. "French", "Thai" stay as-is inside a name, but the generic word "Cuisine" is translated).
- TRANSLATE generic words and labels, e.g. "Must try" → "חובה לטעום", "Cuisine" → "מטבח".
- Keep it concise — same length feel as the source.
- Return ONLY a JSON array, one object per input item: {"id": <id>, "he": "<hebrew>"} — same ids, same order, no extra text.`;

type Row = { id: number | string; description: string };

async function translateBatch(rows: Row[]): Promise<Map<string, string>> {
  const input = rows.map((r) => ({ id: r.id, text: r.description }));
  const res = await claude.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  });
  const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
  const json = text.slice(text.indexOf('['), text.lastIndexOf(']') + 1);
  const parsed = JSON.parse(json) as Array<{ id: string | number; he: string }>;
  const out = new Map<string, string>();
  for (const p of parsed) if (p?.he) out.set(String(p.id), p.he);
  return out;
}

async function main() {
  let totalDone = 0;
  for (let pass = 0; ; pass++) {
    const { data: rows, error } = await db
      .from('places')
      .select('id, description')
      .is('description_he', null)
      .filter('description', 'not.is', null)
      .limit(BATCH);

    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;

    // Skip rows with no Latin chars (shouldn't happen — already copied) by copying as-is.
    const needLLM = rows.filter((r) => /[a-zA-Z]/.test(r.description ?? ''));
    const copyOnly = rows.filter((r) => !/[a-zA-Z]/.test(r.description ?? ''));
    for (const r of copyOnly) {
      await db.from('places').update({ description_he: r.description }).eq('id', r.id);
    }

    if (needLLM.length > 0) {
      try {
        const map = await translateBatch(needLLM as Row[]);
        for (const r of needLLM) {
          const he = map.get(String(r.id));
          if (he) {
            await db.from('places').update({ description_he: he }).eq('id', r.id);
            totalDone++;
          } else {
            // No translation returned — fall back to original so we never re-loop forever.
            await db.from('places').update({ description_he: r.description }).eq('id', r.id);
          }
        }
      } catch (err) {
        console.error(`batch ${pass} failed:`, err instanceof Error ? err.message : err);
        // Mark this batch as fallback to avoid an infinite loop, then continue.
        for (const r of needLLM) {
          await db.from('places').update({ description_he: r.description }).eq('id', r.id);
        }
      }
    }
    console.log(`pass ${pass}: +${rows.length}  (translated so far: ${totalDone})`);
  }
  console.log(`✅ done. translated ${totalDone} descriptions.`);
}

main();
