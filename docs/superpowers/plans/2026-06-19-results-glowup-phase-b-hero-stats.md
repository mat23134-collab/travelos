# Results Glow-Up — Phase B (Framed Hero + Floating Stats) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a framed, full-bleed destination **hero** and a floating **trip-stats strip** to the top of the itinerary results overview — the two most striking "travel-magazine" patterns from the Dribbble refs (#1 framed hero, #2 overlapping stat cards).

**Architecture:** Three new files — one pure derivation (`tripStats.ts`, unit-tested), two presentational components (`TripStats.tsx`, `ItineraryHero.tsx`) — mounted at the top of the `ItineraryClient.tsx` overview branch. Reuses the existing `DayPhoto` component for the hero image and the Phase-A warm tokens for styling. No data layer, hooks, or routing changes.

**Tech Stack:** Next.js, React, `next/font` Fraunces (Phase A), framer-motion (present), `DayPhoto` (existing). Tests run as standalone `tsx` scripts with `node:assert` — the repo's existing convention (e.g. `src/components/DaySummaryCard.test.ts`), run via `npx tsx <file>`.

**Spec:** `docs/superpowers/specs/2026-06-17-results-page-editorial-glowup-design.md` (Phase B — partial).

---

## Scope decision (read first)

The spec's Phase B listed four pieces. This plan delivers **B1 (hero)** and **B2 (trip stats)** only. The other two are **deliberately deferred** to their own plan:

- **B3 — Bento day grid wiring:** `BentoGrid` is a *non-exported* internal of `DayCard.tsx` (only `DayCard` is exported, `DayCard.tsx:1107`). Mounting it requires wiring `onSwapSlot` handlers **and** a UX decision: today, selecting a day routes to `DayDetailPanel` (timeline view) — so "bento in the overview" needs a call on whether it replaces, precedes, or coexists with that panel. That is a design choice, not a mechanical wiring task. → separate spec/plan.
- **B4 — `SectionCard`:** a pure refactor (consolidating the repeated `mx-3 sm:mx-12 rounded… paper shadow` shell). Phase A already warmed those sections; extracting a wrapper now is churn with no visual payoff (YAGNI). → fold into the B3 plan when sections get restructured.

This keeps Phase B focused, low-risk, and independently shippable.

> **Branch:** continue on `feature/results-glowup-phase-a` (Phase A is unmerged; Phase B builds on its tokens/font). No new branch needed. If you prefer isolation:
> ```bash
> cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
> git checkout -b feature/results-glowup-phase-b feature/results-glowup-phase-a
> ```

> **Note:** Existing overview microcopy is English literals (`Your N-Day Itinerary`, `tap a day to explore`) — not localized. New stat labels follow that same English-literal convention; Hebrew localization of the overview is a separate, pre-existing gap (out of scope).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/lib/tripStats.ts` | Pure derivation of trip counts from an `Itinerary` | Create |
| `src/lib/tripStats.test.ts` | Unit tests for the derivation | Create |
| `src/components/TripStats.tsx` | Presentational floating stat strip | Create |
| `src/components/ItineraryHero.tsx` | Framed full-bleed destination hero | Create |
| `src/components/ItineraryClient.tsx` | Mount hero + stats in overview | Modify |

---

## Task 1: Trip-stats derivation (TDD)

**Files:**
- Create: `src/lib/tripStats.ts`
- Test: `src/lib/tripStats.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/tripStats.test.ts`:

```ts
import assert from 'node:assert/strict';
import { deriveTripStats } from './tripStats';
import type { Itinerary } from './types';

function baseItin(partial: Partial<Itinerary>): Itinerary {
  return { destination: 'Tokyo', totalDays: 0, days: [], ...partial };
}

// counts attractions across morning/afternoon/evening, ignores empty slots
const itin = baseItin({
  totalDays: 2,
  days: [
    {
      day: 1,
      morning: { name: 'Senso-ji', neighborhood: 'Asakusa' },
      afternoon: { name: 'Ueno Park', neighborhood: 'Ueno' },
      breakfast: { name: 'Cafe' },
      lunch: { name: 'Ramen' },
    },
    {
      day: 2,
      morning: { name: 'Meiji Shrine', neighborhood: 'asakusa' }, // dup neighborhood, different case
      evening: { name: 'Shibuya', neighborhood: 'Shibuya' },
      dinner: { name: 'Izakaya' },
    },
  ],
});

const stats = deriveTripStats(itin);
assert.equal(stats.days, 2, 'days');
assert.equal(stats.attractions, 4, 'attractions = 4 slots present');
assert.equal(stats.neighborhoods, 3, 'unique neighborhoods (Asakusa/asakusa merge) = Asakusa, Ueno, Shibuya');
assert.equal(stats.meals, 3, 'meals = breakfast+lunch+dinner present');

// falls back to days.length when totalDays is 0/missing
const noTotal = baseItin({ totalDays: 0, days: [{ day: 1, morning: { name: 'X' } }] });
assert.equal(deriveTripStats(noTotal).days, 1, 'days falls back to days.length');

// empty itinerary → all zeros, no throw
const empty = deriveTripStats(baseItin({}));
assert.deepEqual(empty, { days: 0, attractions: 0, neighborhoods: 0, meals: 0 }, 'empty');

console.log('✓ deriveTripStats — all tests passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
npx tsx src/lib/tripStats.test.ts
```
Expected: FAIL — `Cannot find module './tripStats'` (file not created yet).

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/tripStats.ts`:

```ts
import type { Itinerary } from './types';

export interface TripStats {
  days: number;
  attractions: number;
  neighborhoods: number;
  meals: number;
}

/** Derive headline trip counts from an itinerary. Pure — no side effects. */
export function deriveTripStats(itinerary: Itinerary): TripStats {
  const days = itinerary.days ?? [];
  let attractions = 0;
  let meals = 0;
  const neighborhoods = new Set<string>();

  for (const day of days) {
    for (const slot of [day.morning, day.afternoon, day.evening]) {
      if (!slot) continue;
      attractions += 1;
      const n = slot.neighborhood?.trim().toLowerCase();
      if (n) neighborhoods.add(n);
    }
    for (const meal of [day.breakfast, day.lunch, day.dinner]) {
      if (meal) meals += 1;
    }
  }

  return {
    days: itinerary.totalDays || days.length,
    attractions,
    neighborhoods: neighborhoods.size,
    meals,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
npx tsx src/lib/tripStats.test.ts
```
Expected: `✓ deriveTripStats — all tests passed`

- [ ] **Step 5: Commit**

```bash
git add src/lib/tripStats.ts src/lib/tripStats.test.ts
git commit -m "feat(results): add trip-stats derivation with tests"
```

---

## Task 2: `TripStats` presentational strip

**Files:**
- Create: `src/components/TripStats.tsx`

> Fully presentational — takes an array of `{ value, label }` items so the parent controls labels/order. Floating cards that overlap the hero's bottom edge (`-mt-10`), responsive: overlap on `sm+`, plain grid on mobile. Uses Phase-A warm tokens.

- [ ] **Step 1: Create the component**

Create `src/components/TripStats.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

export interface StatItem {
  value: number | string;
  label: string;
}

/** Floating stat strip that overlaps the hero above it. Hidden items (falsy value) are dropped. */
export function TripStats({ items }: { items: StatItem[] }) {
  const shown = items.filter((it) => it.value !== 0 && it.value !== '' && it.value != null);
  if (shown.length === 0) return null;

  return (
    <div className="relative z-10 mx-3 sm:mx-12 -mt-10 sm:-mt-12">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {shown.map((it, i) => (
          <motion.div
            key={it.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ delay: i * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
            className="rounded-2xl px-4 py-4 text-center"
            style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
          >
            <div
              className="font-display text-2xl sm:text-3xl leading-none tabular-nums"
              style={{ color: 'var(--color-ink-warm)' }}
            >
              {it.value}
            </div>
            <div
              className="mt-1.5 text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-ink-warm-mut)' }}
            >
              {it.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run:
```bash
npx tsc --noEmit
```
Expected: exit 0 (no errors). The component isn't mounted yet — that's Task 4.

- [ ] **Step 3: Commit**

```bash
git add src/components/TripStats.tsx
git commit -m "feat(results): add floating TripStats strip component"
```

---

## Task 3: `ItineraryHero` framed hero

**Files:**
- Create: `src/components/ItineraryHero.tsx`

> Framed full-bleed photo (rounded, margins) using the existing `DayPhoto` (it ships its own gradient scrim + dark mode + lazy load). A category pill, an editorial serif headline (`destination`), a date subhead, and a small glass info-card with a pill CTA in the bottom corner. Direction-safe (uses `ms-/me-`, no hardcoded left/right).

- [ ] **Step 1: Create the component**

Create `src/components/ItineraryHero.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { DayPhoto } from '@/components/DayPhoto';

interface Props {
  destination: string;
  dateRange?: string | null;
  totalDays: number;
  /** Optional CTA target; defaults to /onboarding. */
  ctaHref?: string;
  ctaLabel?: string;
}

export function ItineraryHero({
  destination,
  dateRange,
  totalDays,
  ctaHref = '/onboarding',
  ctaLabel = 'Plan another trip',
}: Props) {
  return (
    <div className="mx-3 sm:mx-12 mb-2">
      <div className="relative rounded-[28px] overflow-hidden" style={{ boxShadow: 'var(--shadow-soft)' }}>
        {/* Background photo (DayPhoto provides scrim + lazy load) */}
        <DayPhoto query={`${destination} skyline`} alt={destination} height={380} dark />

        {/* Category pill — top start */}
        <div className="absolute top-4 inset-inline-start-4">
          <span
            className="inline-block px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            Your Itinerary
          </span>
        </div>

        {/* Headline + dates — bottom, over the scrim */}
        <div className="absolute inset-inline-0 bottom-0 p-5 sm:p-7">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="font-display italic text-white text-3xl sm:text-5xl leading-tight drop-shadow"
          >
            {destination}
          </motion.h1>
          <p className="mt-1.5 text-white/80 text-sm sm:text-base font-medium">
            {[dateRange, `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`].filter(Boolean).join(' · ')}
          </p>

          {/* Glass CTA card — bottom end */}
          <div className="mt-4 flex justify-end">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              {ctaLabel}
              <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run:
```bash
npx tsc --noEmit
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItineraryHero.tsx
git commit -m "feat(results): add framed ItineraryHero component"
```

---

## Task 4: Mount hero + stats in the overview

**Files:**
- Modify: `src/components/ItineraryClient.tsx` (imports near other component imports; overview top — currently the Phase-A caption block immediately inside `<div className="max-w-5xl mx-auto py-4">`)

- [ ] **Step 1: Add imports**

In `src/components/ItineraryClient.tsx`, find the existing import of `DayCarousel`:

```tsx
import { DayCarousel } from '@/components/DayCarousel';
```
and add directly after it:
```tsx
import { ItineraryHero } from '@/components/ItineraryHero';
import { TripStats } from '@/components/TripStats';
import { deriveTripStats } from '@/lib/tripStats';
```

- [ ] **Step 2: Replace the overview caption with hero + stats**

In `src/components/ItineraryClient.tsx`, find this Phase-A block (inside the overview branch, right after `<div className="max-w-5xl mx-auto py-4">`):

```tsx
            <p
              className="font-display text-center text-2xl sm:text-3xl italic px-4 pt-6 pb-3"
              style={{ color: 'var(--color-ink-warm)' }}
            >
              Your {days.length}-Day Itinerary
            </p>
            <p
              className="text-center text-[11px] font-bold uppercase tracking-[0.12em] pb-3"
              style={{ color: 'var(--color-ink-warm-mut)' }}
            >
              tap a day to explore
            </p>
```
and replace it with:
```tsx
            <ItineraryHero
              destination={itin.itinerary.destination}
              dateRange={formatTripDateRange(itin.profile?.startDate, itin.profile?.endDate)}
              totalDays={days.length}
              ctaLabel={itin.ui.planNewTripButton}
            />

            <TripStats
              items={[
                { value: deriveTripStats(itin.itinerary).days, label: 'Days' },
                { value: deriveTripStats(itin.itinerary).attractions, label: 'Attractions' },
                { value: deriveTripStats(itin.itinerary).neighborhoods, label: 'Neighborhoods' },
                { value: deriveTripStats(itin.itinerary).meals, label: 'Meals' },
              ]}
            />

            <p
              className="text-center text-[11px] font-bold uppercase tracking-[0.12em] pt-8 pb-3"
              style={{ color: 'var(--color-ink-warm-mut)' }}
            >
              tap a day to explore
            </p>
```

> Note: `formatTripDateRange` is already imported in this file. `itin.profile?.startDate` / `endDate` exist on `TravelerProfile` (used elsewhere in this file, e.g. the hotel cube). `itin.ui.planNewTripButton` is the existing CTA string.

- [ ] **Step 3: Hoist the stats derivation (avoid recomputing 4×)**

The block above calls `deriveTripStats` four times for readability. Tidy it: just **above** the `return`/JSX of the overview — locate the line `/* ══ OVERVIEW ══` and the `<div className="max-w-5xl mx-auto py-4">` that follows. Immediately before that `<div>` is inside JSX, so instead hoist near the other `const` derivations at the top of the component body. Find where `days` is derived (search for `const days =`) and add right after it:

```tsx
  const tripStats = deriveTripStats(itin.itinerary);
```
Then change the four `deriveTripStats(itin.itinerary).X` references in Step 2's `items` array to `tripStats.X`:
```tsx
              items={[
                { value: tripStats.days, label: 'Days' },
                { value: tripStats.attractions, label: 'Attractions' },
                { value: tripStats.neighborhoods, label: 'Neighborhoods' },
                { value: tripStats.meals, label: 'Meals' },
              ]}
```

> If `const days =` sits inside a conditional/hook ordering that makes a sibling `const` awkward, instead define `const tripStats = deriveTripStats(itin.itinerary);` at the same scope as `days`. The derivation is cheap and pure; correctness matters more than placement.

- [ ] **Step 4: Verify typecheck + build**

Run:
```bash
npx tsc --noEmit
npm run build
```
Expected: both exit 0. The `/itinerary` and `/itinerary/[id]` routes compile.

- [ ] **Step 5: Visual check**

Run `npm run dev`, open a results page (overview). Confirm:
- A framed, rounded destination hero with an italic Fraunces headline and date subline.
- Four warm stat cards overlapping the hero's bottom edge (2-col on mobile, 4-col on `sm+`).
- "tap a day to explore" sits below the stats, above the carousel.
- No console errors; image loads (or graceful pulse fallback).

- [ ] **Step 6: Commit**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "feat(results): mount framed hero + floating trip stats in overview"
```

---

## Task 5: Cross-cutting QA

**Files:** none (verification only)

- [ ] **Step 1: Unit + build green**

Run:
```bash
npx tsx src/lib/tripStats.test.ts
npx tsc --noEmit
npm run build
```
Expected: test prints `✓`, typecheck and build exit 0.

- [ ] **Step 2: Mobile (~380px)**

In dev tools responsive mode at ~380px: hero height is comfortable, headline doesn't clip, stat cards are a clean 2-col grid (overlap reduced), CTA tappable.

- [ ] **Step 3: RTL / Hebrew**

Load a Hebrew (`ui.dir === 'rtl'`) trip. Confirm the category pill (top) and CTA (bottom) sit on the correct logical sides — they use `inset-inline-start`/`justify-end`, which flip with `dir`. Headline reads correctly (Fraunces lacks Hebrew glyphs → falls back via the token chain; if a Hebrew destination looks wrong, note for a Hebrew-display-font follow-up, don't block).

- [ ] **Step 4: Empty/partial data**

Sanity: a trip with no neighborhoods or no meals drops those stat cards (the `TripStats` filter removes zero-value items) rather than showing "0".

- [ ] **Step 5: Final commit (only if a QA tweak was needed)**

```bash
git add -A
git commit -m "chore(results): phase B QA fixes"
```

---

## Self-Review (completed by plan author)

- **Spec coverage:** B1 framed hero → Task 3 + Task 4. B2 floating stats with real data sources (`totalDays`/slot counts/neighborhood set/meal counts, all from `types.ts`) → Tasks 1, 2, 4. "km walking" intentionally omitted (no reliable field — spec permitted omit). B3/B4 explicitly deferred with rationale (Scope decision section). ✅
- **Placeholder scan:** every code step shows complete code. No TBD/TODO. ✅
- **Type consistency:** `TripStats` interface (`days`/`attractions`/`neighborhoods`/`meals`) defined in Task 1, consumed identically in Tasks 2/4. `StatItem` (`value`/`label`) defined in Task 2, built in Task 4. `ItineraryHero` props (`destination`/`dateRange`/`totalDays`/`ctaHref`/`ctaLabel`) defined in Task 3, passed in Task 4. `deriveTripStats(itinerary)` signature stable across tasks. ✅
- **Reuse:** `DayPhoto` (hero image), `formatTripDateRange` (already imported), Phase-A tokens (`--color-paper`, `--color-ink-warm`, `--color-ink-warm-mut`, `--shadow-card`, `--shadow-soft`, `.font-display`). No new deps. ✅
- **Deferred (next plan):** Bento day-grid wiring (needs UX decision vs `DayDetailPanel`), `SectionCard` refactor, scroll-reveal/tilt/count-up/route-draw/parallax (Phase C).
