# Day Summary AI Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New itineraries get an AI-written "daily story" paragraph (`day.daySummary`) shown on the day page; itineraries without it keep the existing deterministic summary.

**Architecture:** Add `daySummary?: string` to `DayPlan`. Add a `"daySummary"` field to the `/api/generate` JSON schema in `src/lib/prompts.ts` (covers `/api/generate-stream` too, since it reuses the same prompt builder), including it in the Hebrew-translation rules. Extract the "pick AI text or fall back to deterministic summary" logic into a small exported pure function in `DaySummaryCard.tsx` so it can be unit-tested the same way `deriveDayBullets` is tested in `ItineraryDayCard.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, plain `node:assert/strict` test scripts run via `npx tsx`.

---

### Task 1: Add `daySummary` field to `DayPlan` type

**Files:**
- Modify: `src/lib/types.ts:205-218`

- [ ] **Step 1: Add the optional field**

In `src/lib/types.ts`, the `DayPlan` interface currently ends with:

```ts
export interface DayPlan {
  day: number;
  date?: string;
  theme?: string;
  morning?: Activity;
  afternoon?: Activity;
  evening?: Activity;
  breakfast?: DiningSpot;   // optional — populated from morning food activities or future prompt support
  lunch?: DiningSpot;
  dinner?: DiningSpot;
  estimatedDailyCost?: string;
  transportTip?: string;
  webInsights?: WebInsight[];
}
```

Add `daySummary?: string;` after `webInsights?: WebInsight[];`:

```ts
export interface DayPlan {
  day: number;
  date?: string;
  theme?: string;
  morning?: Activity;
  afternoon?: Activity;
  evening?: Activity;
  breakfast?: DiningSpot;   // optional — populated from morning food activities or future prompt support
  lunch?: DiningSpot;
  dinner?: DiningSpot;
  estimatedDailyCost?: string;
  transportTip?: string;
  webInsights?: WebInsight[];
  daySummary?: string;   // AI-written "daily story" paragraph (new itineraries only); falls back to summarizeDay() when absent
}
```

- [ ] **Step 2: Verify it compiles**

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npx tsc --noEmit ; echo "EXIT:$?"`
Expected: `EXIT:0` (no new type errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "Add optional daySummary field to DayPlan"
```

---

### Task 2: Add `daySummary` to the `/api/generate` JSON schema and Hebrew translation rules

**Files:**
- Modify: `src/lib/prompts.ts:227-230` (schema block)
- Modify: `src/lib/prompts.ts:373` (Hebrew translation field list)

- [ ] **Step 1: Add the field to the per-day JSON schema**

In `src/lib/prompts.ts`, the per-day schema currently has (around lines 226-230):

```ts
      "estimatedDailyCost": "string",
      "transportTip": "max 15 words",
      "webInsights": [
        { "text": "max 10 words actionable insight", "type": "tip | warning | trend", "source": "Blog Name, Year" }
      ]
```

Change it to add `"daySummary"` after `"webInsights"`:

```ts
      "estimatedDailyCost": "string",
      "transportTip": "max 15 words",
      "webInsights": [
        { "text": "max 10 words actionable insight", "type": "tip | warning | trend", "source": "Blog Name, Year" }
      ],
      "daySummary": "2-3 sentence narrative in a warm storytelling tone: how the day flows, what you do first, where you go next, and why this plan fits the trip"
```

Note: this is the LAST property in the day object, so the trailing comma must move from `"webInsights"`'s array onto the new line as shown above (the line after `"webInsights": [...]` now ends with `,` instead of nothing, and `"daySummary"` has no trailing comma).

- [ ] **Step 2: Add `daySummary` to the Hebrew translation rules**

In `src/lib/prompts.ts`, the bilingual output rules block (around line 373) currently reads:

```ts
2) HEBREW — all explanatory prose: strategicOverview; budgetSummary (dailyAverage, totalEstimate, includes); each day "theme" and human-readable "date" line; activity "description", "whyThis", "bestTimeToVisit", "transitFromPrevious", "duration", "estimatedCost" when prose; all DiningSpot text fields except the venue "name" and except "cuisine" (keep cuisine as short English token if needed, or Hebrew — prefer clear Hebrew for diners); webInsights[].text; packingTips[]; bestLocalTips[]; transportTip; cityTransport.intro, cityTransport.priceSingle, cityTransport.priceDayPass, cityTransport.priceWeekPass, cityTransport.scoutTipPayment, cityTransport.transportApp.name, cityTransport.options[].summary, cityTransport.options[].typicalPrice, cityTransport.options[].dailyAverage, cityTransport.options[].tripTotalEstimate, cityTransport.options[].optionLinkLabel, cityTransport.options[].tip, cityTransport.links[].label, cityTransport.links[].description; basecamp neighborhoodInsight / whyItFits / fitSummary / availabilitySummary / estimatedPriceRangeTripDates / otaPriceCompare[].note (keep currency symbols and numbers readable; keep OTA brand names in Latin: Booking.com, Agoda, Airbnb). For basecamp.booked.aroundHotel when HOTEL_BOOKED: Hebrew for areaHeadline, walkableHighlights[], signatureMove; keep vibes[] as short English tags; keep transitNearHotel[].modeLabel and lineOrRoute in English. Keep cityTransport.options[].mode as the real English/local system name (e.g. "JR Yamanote Line", "Metro M2") for map/ticket searches.
```

Change `webInsights[].text; packingTips[];` to `webInsights[].text; daySummary; packingTips[];`:

```ts
2) HEBREW — all explanatory prose: strategicOverview; budgetSummary (dailyAverage, totalEstimate, includes); each day "theme" and human-readable "date" line; activity "description", "whyThis", "bestTimeToVisit", "transitFromPrevious", "duration", "estimatedCost" when prose; all DiningSpot text fields except the venue "name" and except "cuisine" (keep cuisine as short English token if needed, or Hebrew — prefer clear Hebrew for diners); webInsights[].text; daySummary; packingTips[]; bestLocalTips[]; transportTip; cityTransport.intro, cityTransport.priceSingle, cityTransport.priceDayPass, cityTransport.priceWeekPass, cityTransport.scoutTipPayment, cityTransport.transportApp.name, cityTransport.options[].summary, cityTransport.options[].typicalPrice, cityTransport.options[].dailyAverage, cityTransport.options[].tripTotalEstimate, cityTransport.options[].optionLinkLabel, cityTransport.options[].tip, cityTransport.links[].label, cityTransport.links[].description; basecamp neighborhoodInsight / whyItFits / fitSummary / availabilitySummary / estimatedPriceRangeTripDates / otaPriceCompare[].note (keep currency symbols and numbers readable; keep OTA brand names in Latin: Booking.com, Agoda, Airbnb). For basecamp.booked.aroundHotel when HOTEL_BOOKED: Hebrew for areaHeadline, walkableHighlights[], signatureMove; keep vibes[] as short English tags; keep transitNearHotel[].modeLabel and lineOrRoute in English. Keep cityTransport.options[].mode as the real English/local system name (e.g. "JR Yamanote Line", "Metro M2") for map/ticket searches.
```

- [ ] **Step 3: Verify it compiles**

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npx tsc --noEmit ; echo "EXIT:$?"`
Expected: `EXIT:0`

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts.ts
git commit -m "Add daySummary narrative field to generation prompt schema"
```

---

### Task 3: Use `daySummary` in `DaySummaryCard` with fallback, and add a unit test

**Files:**
- Modify: `src/components/DaySummaryCard.tsx`
- Create: `src/components/DaySummaryCard.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/DaySummaryCard.test.ts`:

```ts
import assert from 'node:assert/strict';
import { getDaySummarySentences } from './DaySummaryCard';
import type { DayPlan } from '../lib/types';

// AI-written daySummary present → used verbatim, as a single sentence
const withAiSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
  daySummary: 'You start the day climbing Castle Hill for sweeping views, then wander down into the Old Town for a relaxed afternoon of cafes and hidden courtyards.',
};
assert.deepEqual(
  getDaySummarySentences(withAiSummary, 0, 'en'),
  ['You start the day climbing Castle Hill for sweeping views, then wander down into the Old Town for a relaxed afternoon of cafes and hidden courtyards.'],
  'AI daySummary is used verbatim when present',
);

// Empty/whitespace-only daySummary → falls back to summarizeDay
const withBlankSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
  daySummary: '   ',
};
const fallbackSentences = getDaySummarySentences(withBlankSummary, 0, 'en');
assert.ok(fallbackSentences.length > 0, 'Falls back to summarizeDay output for blank daySummary');
assert.ok(fallbackSentences[0].includes('Old Town Discovery'), 'Fallback includes the theme');

// No daySummary field at all (old itineraries) → falls back to summarizeDay
const noSummary: DayPlan = {
  day: 1,
  theme: 'Old Town Discovery',
  morning: { name: 'Castle Hill' },
};
const noSummarySentences = getDaySummarySentences(noSummary, 0, 'en');
assert.deepEqual(noSummarySentences, fallbackSentences, 'Missing daySummary falls back identically to a blank one');

console.log('✓ getDaySummarySentences — all tests passed');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npx tsx src/components/DaySummaryCard.test.ts ; echo "EXIT:$?"`
Expected: FAIL — `getDaySummarySentences` is not exported from `./DaySummaryCard` (module has no such export)

- [ ] **Step 3: Implement `getDaySummarySentences` and use it in the component**

Replace the full contents of `src/components/DaySummaryCard.tsx` (currently):

```tsx
'use client';

import { summarizeDay } from '@/lib/tripStory';
import type { DayPlan } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

interface DaySummaryCardProps {
  day: DayPlan;
  dayIndex: number;
  ui: ItineraryUiStrings;
}

export function DaySummaryCard({ day, dayIndex, ui }: DaySummaryCardProps) {
  const sentences = summarizeDay(day, dayIndex + 1, ui.lang);
  if (sentences.length === 0) return null;

  return (
    <div className="px-4 py-3 rounded-2xl bg-white" style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
      <div className="text-[12px] font-bold text-[#222] mb-1">{ui.daySummaryTitle}</div>
      <p className="text-[12.5px] text-[#555] leading-relaxed">{sentences.join(' ')}</p>
    </div>
  );
}
```

with:

```tsx
'use client';

import { summarizeDay } from '@/lib/tripStory';
import type { DayPlan } from '@/lib/types';
import type { ItineraryUiStrings, TripUiLang } from '@/lib/tripUiCopy';

interface DaySummaryCardProps {
  day: DayPlan;
  dayIndex: number;
  ui: ItineraryUiStrings;
}

/**
 * Returns the sentences to show in the "Today's Plan" card: the AI-written
 * `day.daySummary` narrative when present and non-empty, otherwise the
 * deterministic `summarizeDay()` output (used by itineraries generated
 * before this field existed).
 */
export function getDaySummarySentences(day: DayPlan, dayIndex: number, lang: TripUiLang): string[] {
  const aiSummary = day.daySummary?.trim();
  if (aiSummary) return [aiSummary];
  return summarizeDay(day, dayIndex + 1, lang);
}

export function DaySummaryCard({ day, dayIndex, ui }: DaySummaryCardProps) {
  const sentences = getDaySummarySentences(day, dayIndex, ui.lang);
  if (sentences.length === 0) return null;

  return (
    <div className="px-4 py-3 rounded-2xl bg-white" style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
      <div className="text-[12px] font-bold text-[#222] mb-1">{ui.daySummaryTitle}</div>
      <p className="text-[12.5px] text-[#555] leading-relaxed">{sentences.join(' ')}</p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npx tsx src/components/DaySummaryCard.test.ts ; echo "EXIT:$?"`
Expected: prints `✓ getDaySummarySentences — all tests passed` and `EXIT:0`

- [ ] **Step 5: Type-check and build**

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npx tsc --noEmit ; echo "EXIT:$?"`
Expected: `EXIT:0`

Run: `cd "C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site" ; npm run build ; echo "EXIT:$?"`
Expected: `EXIT:0`

- [ ] **Step 6: Commit**

```bash
git add src/components/DaySummaryCard.tsx src/components/DaySummaryCard.test.ts
git commit -m "Show AI-written daySummary in Today's Plan card with fallback"
```

---

### Task 4: Manual verification with a freshly generated itinerary

**Files:** none (manual verification only)

- [ ] **Step 1: Generate a new English itinerary**

Run the app locally (`npm run dev`), generate a new itinerary for any destination, open a day-detail page, and confirm:
- The "Today's Plan" / "📋 Today's Plan" card shows a 2-3 sentence narrative (not the `·`-separated deterministic format).
- The narrative mentions the day's actual activities (morning/afternoon/evening or dining spots).

- [ ] **Step 2: Generate a new Hebrew itinerary**

Repeat with `tripLanguage: 'he'` (e.g. via the trip-language toggle in the planner). Confirm the "📋 תקציר היום" card shows a Hebrew narrative paragraph.

- [ ] **Step 3: Confirm old itineraries still work**

Open an itinerary that was generated before this change (or any itinerary object without a `daySummary` field). Confirm the "Today's Plan" card still shows the original `·`-separated deterministic summary — no errors, no blank card.

---

## Self-Review Notes

- **Spec coverage:** All 3 spec changes covered — schema field (Task 2), `DayPlan` type (Task 1), `DaySummaryCard` fallback logic (Task 3). Hebrew translation rule update (spec section 1) covered in Task 2 Step 2. Manual testing (spec's "Testing" section) covered in Task 4.
- **Placeholder scan:** No TBD/TODO; all code blocks are complete and copy-pasteable.
- **Type consistency:** `getDaySummarySentences(day: DayPlan, dayIndex: number, lang: TripUiLang): string[]` matches its usage in the component (`getDaySummarySentences(day, dayIndex, ui.lang)`) and in the test (`getDaySummarySentences(withAiSummary, 0, 'en')`). `daySummary?: string` on `DayPlan` (Task 1) matches `day.daySummary?.trim()` usage (Task 3).
- **Out of scope confirmed:** No changes needed to `/api/generate-stream/route.ts` (reuses `buildUserPrompt`/schema from `prompts.ts`) or `TripStoryCube.tsx` (unchanged, per spec).
