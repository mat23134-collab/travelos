# Day Summary: AI-Written "Daily Story" Narrative — Design

## Background

Phase 1 (shipped in `436a086`) added a "Today's Plan" card (`DaySummaryCard.tsx`) to each day-detail page, showing a deterministic summary built by `summarizeDay()` in `src/lib/tripStory.ts`. The text concatenates spot names with `·` separators (e.g. "Breakfast at X · Morning — Y · Lunch at Z").

Feedback after seeing it live: the text reads as mechanical, not like a "story". The user wants an AI-written narrative paragraph instead — but only for newly generated itineraries. Existing itineraries should keep showing the current deterministic text; no backfill/migration.

## Goal

When a new itinerary is generated via `/api/generate`, the LLM also writes a short narrative ("daily story") for each day, summarizing how the day flows and why it fits the trip. This narrative is stored on the day object and displayed by `DaySummaryCard`. Itineraries generated before this change lack the field and continue to show the existing deterministic `summarizeDay()` text.

## Approach

Add a new field directly to the existing single-shot `/api/generate` JSON schema/prompt — no extra LLM calls. The model already has full context about each day (theme, activities, dining) when producing that day's JSON object, so it can write a coherent narrative inline at no added latency or cost (only a small increase in output token count).

**Alternatives considered:**
- A separate per-day follow-up LLM call: rejected — 5–10 extra API calls per itinerary, with no benefit since the main generation call already has all the needed context.
- Lazy/on-demand generation when a day page is viewed: rejected — adds page-load latency and requires caching/persistence logic; unnecessary complexity given the deterministic fallback already exists.

## Changes

### 1. `src/lib/prompts.ts`
- Add a new field to the per-day JSON schema (near `transportTip`, after `webInsights` — around line 227-230):
  ```
  "daySummary": "2-3 sentence narrative: how the day flows, what you do first, where you go next, and why it fits this trip"
  ```
- Add `daySummary` to the Hebrew-translation field list (line 373's bilingual output rules block), so Hebrew trips get the narrative in Hebrew.

### 2. `src/lib/types.ts`
- Add `daySummary?: string;` to the `DayPlan` interface (lines 205-218), as an optional field so existing itineraries (which lack it) remain valid.

### 3. `src/components/DaySummaryCard.tsx`
- If `day.daySummary` is a non-empty string, render it directly instead of calling `summarizeDay()`.
- Otherwise, fall back to the existing `summarizeDay(day, dayIndex + 1, ui.lang)` behavior (unchanged).
- No other props/signature changes.

## Out of Scope

- No backfill/migration for existing itineraries.
- No changes to `TripStoryCube.tsx` (trip-wide story modal) — it continues using `summarizeDay()` for now.
- No changes to `/api/generate-stream` beyond whatever shared schema/prompt code it already reuses from `prompts.ts` (verify during implementation that it doesn't duplicate the schema separately).

## Testing

- Generate a new itinerary (English and Hebrew) and confirm `daySummary` appears in the day object and renders in `DaySummaryCard`.
- Load an existing (pre-change) itinerary and confirm `DaySummaryCard` still renders the deterministic `summarizeDay()` text (no `daySummary` field present).
- `npx tsc --noEmit` and `npm run build` pass.
