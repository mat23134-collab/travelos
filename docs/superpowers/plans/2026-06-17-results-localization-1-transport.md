# Results Localization — Plan 1 of 4: Language-Aware City Transport

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the city transport guide (the "transport cube") generate and cache in the trip's language, so a Hebrew trip shows Hebrew transport content — while keeping line/app/station names and prices in their original form.

**Architecture:** Add a `lang` dimension to the `transportation` cache (keyed by `(city_norm, lang)`); thread the trip language from `useItinerary` → the scout/read API routes → `runTransportScoutAgent`, whose Gemini prompt gains a language directive. Then re-scout Taipei in Hebrew and verify.

**Tech Stack:** Next.js 14 API routes, Supabase (`@supabase/supabase-js`, service-role writes / anon reads), Gemini transport scout, `node:assert` + `npx tsx` tests.

**Spec:** `docs/superpowers/specs/2026-06-17-results-page-localization-design.md` (§3.2).

**Decomposition (this is plan 1 of 4):**
1. **Transport (this plan).**
2. Tips (`packingTips`/`bestLocalTips`) language-awareness.
3. AI descriptions + single-trip Taipei regeneration.
4. UI string audit (wire remaining hard-coded strings to `tripUiCopy`).

**Branch:** cut a branch from `feature/results-glowup-phase-a` (the redesigned results page baseline).

**Test command:** `npx tsx <path>.ts` (assertions via `node:assert/strict`; pass prints a `✅` line). `npx tsc --noEmit` must stay clean. Do NOT run `npm run build` while a dev server holds `.next`.

---

## Task 1: Add `lang` to the transportation cache (DB migration)

**Files:** none in-repo — apply via Supabase MCP `apply_migration` (project_id `bvtsrhzmahzpybentmpk`), migration name `transportation_lang_dimension`.

- [ ] **Step 1: Apply the migration**

```sql
alter table public.transportation add column if not exists lang text not null default 'en';

-- Drop legacy single-column uniqueness on city_norm (constraint or index) so
-- the same city can hold one row per language.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.transportation'::regclass and contype = 'u'
      and (select array_agg(attname order by attname)
             from pg_attribute where attrelid = conrelid and attnum = any(conkey)) = array['city_norm']
  loop execute format('alter table public.transportation drop constraint %I', r.conname); end loop;

  for r in
    select c.relname as idxname
    from pg_index i join pg_class c on c.oid = i.indexrelid
    where i.indrelid = 'public.transportation'::regclass and i.indisunique
      and (select array_agg(attname order by attname)
             from pg_attribute where attrelid = i.indrelid and attnum = any(i.indkey)) = array['city_norm']
  loop execute format('drop index if exists public.%I', r.idxname); end loop;
end $$;

create unique index if not exists transportation_city_lang_uidx
  on public.transportation (city_norm, lang);
```

- [ ] **Step 2: Verify**

Run (Supabase MCP `execute_sql`):
```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='transportation' and column_name='lang';
select indexname from pg_indexes
where schemaname='public' and tablename='transportation' and indexname='transportation_city_lang_uidx';
```
Expected: one row each (the `lang` column and the new unique index exist). Existing rows now have `lang='en'`.

---

## Task 2: Language directive in the transport scout (TDD for the pure builder)

**Files:**
- Modify: `src/lib/transportScoutAgent.ts`
- Test: `src/lib/transportScoutAgent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/transportScoutAgent.test.ts
import assert from 'node:assert/strict';
import { transportLanguageDirective } from './transportScoutAgent';

// English (default) → no directive
assert.equal(transportLanguageDirective('en'), '');

// Hebrew → directive that localizes narrative but keeps names/prices original
const he = transportLanguageDirective('he');
assert.ok(he.includes('Hebrew'), 'mentions Hebrew');
assert.ok(/name|original|price/i.test(he), 'preserves names/prices');
assert.ok(he.startsWith('\n'), 'is appended as its own line block');

console.log('All transportScoutAgent directive tests passed ✅');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/transportScoutAgent.test.ts`
Expected: FAIL — `transportLanguageDirective` is not exported.

- [ ] **Step 3: Implement the directive + thread `lang`**

In `src/lib/transportScoutAgent.ts`, add the exported helper (near the top, after imports):

```ts
export function transportLanguageDirective(lang: 'en' | 'he'): string {
  if (lang !== 'he') return '';
  return (
    '\n\nOUTPUT_LANGUAGE: Hebrew (Modern Israeli Hebrew).\n' +
    '- Write all narrative fields in Hebrew: intro, every option.summary, scoutTipPayment, and link/option labels.\n' +
    '- KEEP ORIGINAL (do not translate or transliterate): transit line names, station names, app names, and every price/number.'
  );
}
```

Then change the signature and prompt of `runTransportScoutAgent` (currently lines ~128-160):

```ts
export async function runTransportScoutAgent(
  city: string,
  opts?: { tripDays?: number; lang?: 'en' | 'he' },
): Promise<CityTransportGuide | null> {
  const c = city.trim();
  if (!c) return null;

  const tripDays =
    typeof opts?.tripDays === 'number' && Number.isFinite(opts.tripDays) && opts.tripDays > 0
      ? Math.min(30, Math.round(opts.tripDays))
      : 5;
  const lang = opts?.lang === 'he' ? 'he' : 'en';

  let ragBlock = '';
  const exaBlock = await gatherTransportExaSnippets(c);
  if (exaBlock) ragBlock += exaBlock;
  try {
    const hits = await searchWeb(`${c} public transport official tickets metro bus day pass how to pay`);
    if (hits.length > 0) {
      ragBlock +=
        '\n\nWEB SNIPPETS (extra grounding):\n' +
        hits.slice(0, 8).map((h) => `- ${h.title}: ${h.snippet}`).join('\n');
    }
  } catch {
    /* optional */
  }

  const userPrompt =
    `City: ${c}\n` +
    `TRIP_DAY_COUNT: ${tripDays} (use this exact day count for every tripTotalEstimate).\n` +
    `Produce the mobility JSON described in the system message.${transportLanguageDirective(lang)}${ragBlock}`;

  const raw = await callGeminiTransport(userPrompt);
  const parsed = parseAIJson(raw);
  return parseTransportGuideJson(parsed);
}
```

- [ ] **Step 4: Run test + typecheck**

Run: `npx tsx src/lib/transportScoutAgent.test.ts` → PASS (`✅`).
Run: `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transportScoutAgent.ts src/lib/transportScoutAgent.test.ts
git commit -m "feat(transport): language directive in the scout prompt"
```

---

## Task 3: Thread `lang` through the transportation cache helpers

**Files:**
- Modify: `src/lib/tripTransport.ts`

- [ ] **Step 1: Update the three helpers to be language-scoped**

Replace `fetchTransportGuideForCity`, `upsertTransportationGuide`, and `ensureTransportationForCity` with `lang`-aware versions (default `'en'` keeps every existing caller working):

```ts
export async function fetchTransportGuideForCity(
  db: SupabaseClient,
  city: string,
  lang: 'en' | 'he' = 'en',
): Promise<CityTransportGuide | null> {
  const key = normalizeCityKey(city);
  if (!key) return null;
  const { data, error } = await db
    .from('transportation')
    .select('guide')
    .eq('city_norm', key)
    .eq('lang', lang)
    .maybeSingle();
  if (error) {
    console.warn('[tripTransport] transportation select:', error.message);
    return null;
  }
  return parseTransportGuideJson(data?.guide);
}

export async function upsertTransportationGuide(
  db: SupabaseClient,
  cityDisplay: string,
  guide: CityTransportGuide,
  lang: 'en' | 'he' = 'en',
): Promise<void> {
  const city_name = cityDisplay.trim();
  if (!city_name) return;
  const row = { city_name, lang, guide, updated_at: new Date().toISOString() };
  const { error } = await db.from('transportation').upsert(row, { onConflict: 'city_norm,lang' });
  if (error) {
    const e = error as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN TRANSPORTATION:');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
  } else {
    console.log('✅ transportation upsert OK for city:', city_name, 'lang:', lang);
  }
}

export async function ensureTransportationForCity(
  db: SupabaseClient,
  cityRaw: string,
  tripDays?: number,
  lang: 'en' | 'he' = 'en',
): Promise<void> {
  const city = cityRaw.trim();
  if (!city) return;

  const STALE_MS = 90 * 24 * 60 * 60 * 1000; // 3 months
  const key = normalizeCityKey(city);
  const { data: existing, error: selErr } = await db
    .from('transportation')
    .select('id, updated_at')
    .eq('city_norm', key)
    .eq('lang', lang)
    .maybeSingle();
  if (selErr) {
    const e = selErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN TRANSPORTATION (select check):');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
    return;
  }
  if (existing) {
    const updatedAt = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
    if (Date.now() - updatedAt <= STALE_MS) {
      console.log('ℹ️  transportation already exists for city:', city, 'lang:', lang, '— skipping scout');
      return;
    }
    console.log('🔄 transportation data for city:', city, 'lang:', lang, 'is older than 3 months — refreshing…');
  }

  console.log('🔍 transportation missing for city:', city, 'lang:', lang, '— running scout agent…');
  try {
    const guide = await runTransportScoutAgent(city, { tripDays, lang });
    if (!guide || !hasTransportContent(guide)) {
      console.warn('⚠️  scout returned empty guide for', city);
      return;
    }
    await upsertTransportationGuide(db, city, guide, lang);
  } catch (e) {
    console.warn('⚠️  transportation scout failed (non-critical):', e instanceof Error ? e.message : e);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0. (All existing callers still compile because `lang` defaults to `'en'`.)

- [ ] **Step 3: Commit**

```bash
git add src/lib/tripTransport.ts
git commit -m "feat(transport): language-scope the transportation cache helpers"
```

---

## Task 4: Accept `lang` in the transport API routes

**Files:**
- Modify: `src/app/api/transportation/route.ts`
- Modify: `src/app/api/transportation/scout/route.ts`

- [ ] **Step 1: Read route — accept `lang`**

Replace the body of `GET` in `src/app/api/transportation/route.ts`:

```ts
export async function GET(req: NextRequest) {
  const city = req.nextUrl.searchParams.get('city')?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city query parameter is required' }, { status: 400 });
  }
  const langParam = req.nextUrl.searchParams.get('lang');
  const lang = langParam === 'he' ? 'he' : 'en';

  const guide = await fetchTransportGuideForCity(supabase, city, lang);
  return NextResponse.json({ guide: guide ?? null });
}
```

- [ ] **Step 2: Scout route — accept `tripLanguage` and pass it through**

In `src/app/api/transportation/scout/route.ts`, change the body parse + scout/upsert calls:

```ts
  const body = (await req.json().catch(() => null)) as { city?: string; tripDays?: number; tripLanguage?: string } | null;
  const city = body?.city?.trim() ?? '';
  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }
  const lang = body?.tripLanguage === 'he' ? 'he' : 'en';
```

and where the guide is produced + cached:

```ts
    const guide = await runTransportScoutAgent(city, { tripDays, lang });
    if (!guide || !hasTransportContent(guide)) {
      return NextResponse.json({ ok: false, guide: null, message: 'Scout returned no usable guide' }, { status: 422 });
    }
    await upsertTransportationGuide(db, city, guide, lang);
```

(The per-city cooldown key should also include lang — change `const key = city.toLowerCase();` to `const key = \`${city.toLowerCase()}::${lang}\`;`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/transportation/route.ts src/app/api/transportation/scout/route.ts
git commit -m "feat(transport): thread trip language through the transport API routes"
```

---

## Task 5: Send the trip language from the client (useItinerary)

**Files:**
- Modify: `src/hooks/useItinerary.ts`

Context: the transport effect polls `GET /api/transportation?city=…` and, on a miss, POSTs to `/api/transportation/scout` with `{ city, tripDays }`. The trip language is `profile?.tripLanguage` (`'he' | 'en'`).

- [ ] **Step 1: Derive the language once in the effect**

Inside the transport `useEffect` (the block that builds `poll` and posts to scout), add near the top of the effect body:

```ts
    const tripLang = profile?.tripLanguage === 'he' ? 'he' : 'en';
```

- [ ] **Step 2: Pass it to the read poll**

Change the poll fetch URL:

```ts
        const res = await fetch(`/api/transportation?city=${encodeURIComponent(city)}&lang=${tripLang}`);
```

- [ ] **Step 3: Pass it to the scout POST body**

Change the scout POST body:

```ts
            body: JSON.stringify({ city, tripDays: itinerary.totalDays, tripLanguage: tripLang }),
```

- [ ] **Step 4: Add `profile` to the effect dependency array**

Ensure the effect deps include the language source, e.g. add `profile?.tripLanguage` to the dependency array of that `useEffect`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useItinerary.ts
git commit -m "feat(transport): request the transport guide in the trip language"
```

---

## Task 6: Regenerate Taipei's transport in Hebrew + verify

**Files:** none (data/ops + manual verification)

- [ ] **Step 1: Force a fresh Hebrew scout for Taipei**

Start the dev server (`preview_start`). Trigger the scout for Taipei in Hebrew (authenticated request — reuse the app session, or call from the running app by opening the Taipei itinerary which auto-scouts). To force directly, from the browser console on the running app (so the session cookie is sent):

```js
await fetch('/api/transportation/scout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ city: 'Taipei', tripDays: 5, tripLanguage: 'he' }),
}).then(r => r.json());
```

- [ ] **Step 2: Verify the Hebrew row was cached**

Run (Supabase MCP `execute_sql`):
```sql
select lang, left(guide->>'intro', 60) as intro_head
from public.transportation where city_norm = 'taipei' order by lang;
```
Expected: two rows — `en` (original) and `he` (Hebrew `intro`). Line/app names inside the guide remain original.

- [ ] **Step 3: Manual check in the app**

Open the Taipei itinerary (`tripLanguage='he'`) in the browser. Confirm the transport cube's narrative (intro, mode summaries, scout tip, link labels) is now **Hebrew/RTL**, while line names, app names, and prices stay original. Confirm an English trip for Taipei would still read the `en` row (no cross-contamination).

- [ ] **Step 4: Commit (only if Step 3 surfaced code fixes)**

```bash
git add -A
git commit -m "fix(transport): polish from the Taipei Hebrew walkthrough"
```

---

## Notes for the implementer

- **Default `'en'` everywhere** keeps every existing caller and every existing cached row working unchanged — only Hebrew trips get new behavior.
- **Never translate** transit line names, station names, app names, or prices — only the narrative fields.
- The `transportation.lang` column + `(city_norm, lang)` unique index are the contract; `upsert(..., { onConflict: 'city_norm,lang' })` depends on that index existing (Task 1 first).
- After this plan, the transport cube is Hebrew. Tips, AI descriptions/regeneration, and the UI string audit are plans 2-4.
