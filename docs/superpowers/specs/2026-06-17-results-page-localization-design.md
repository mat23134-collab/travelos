# Results-Page Localization (Trip Language) — Design Spec

> **Date:** 2026-06-17
> **Status:** Approved direction (key decisions made), ready for implementation planning.
> **Baseline branch:** `feature/results-glowup-phase-a` (the redesigned results page lives here).
> **Test target:** the Taipei itinerary (`itineraries.id = fa354528-c4c4-4bb6-ba8d-f7f085a22099`, `tripLanguage = 'he'`).

## 1. Goal

The results/itinerary page must render entirely in the **trip language the traveler chose during onboarding** (e.g. Hebrew, RTL). The **only** content that stays in its original language is **official place names** — venue names, hotel names, transit line/app names, and English map-label neighborhoods. Everything else — UI chrome, transport guide, tips, recommendations, and AI descriptions — must match the trip language. Today it is a mix.

## 2. Root-cause analysis (where the mix comes from)

The codebase already has the machinery; the mix comes from three distinct sources:

1. **UI chrome — mostly already localized.** `src/lib/tripUiCopy.ts` (`itineraryUi(lang)`, `dayCardUi(lang)`, `draftSlotUi(lang)`) is fully bilingual (he/en + `dir`/`htmlLang`), and `useItinerary` selects it from `profile.tripLanguage`. `TransportCard.tsx` is a clean example — every label goes through `ui.*`. **Gap:** some components added in the results redesign may still hard-code English strings instead of using `ui.*`. These need an audit.

2. **Cached, language-agnostic DATA — the biggest source.**
   - **Transport guide:** `runTransportScoutAgent(city, { tripDays })` (`src/lib/transportScoutAgent.ts`) generates the guide with no language input; `upsertTransportationGuide(db, city, guide)` caches **one row per city** (`transportation.city_name` unique). So a Hebrew trip still gets the English guide (`intro`, mode `summary`, `scoutTipPayment`, link labels).
   - **Tips:** `packing_tips` / `local_tips` are generated in `src/app/api/generate/route.ts` and cached on the same `transportation` row — also language-agnostic.

3. **AI itinerary descriptions (`itinerary_json`).** The generation prompt already instructs the right behavior: `tripOutputLanguageBlock(profile)` in `prompts.ts` emits, for `tripLanguage === 'he'`, "TRIP_OUTPUT_LANGUAGE: Hebrew" with "ENGLISH ONLY — official venue names…". So **new** generations are correct. The **existing** Taipei itinerary was stored with mixed content and must be regenerated.

## 3. Design

### 3.1 UI audit (Source 1)

Audit every component rendered on the final itinerary view for hard-coded user-facing English, and route each string through `itineraryUi(lang)` / `dayCardUi(lang)`, adding missing Hebrew keys to `tripUiCopy.ts`. Components to check (from the redesign diff): `ItineraryHero`, `TripStats`, `LogisticsDashboard`, `ItineraryDayCard`, `DayTimeline`, `DayDetailPanel`, `HotelSelectionCard`, `PlaceDetailCube`, `TrendingTicker`, `ItineraryHeader`, `AttractionsBank`, budget cells. `TransportCard` is already compliant (reference example). Place names, ratings, and prices are **not** translated.

### 3.2 Language-aware transport + tips generation (Source 2)

- **Schema:** add a `lang text not null default 'en'` column to `public.transportation`; replace the per-city uniqueness with uniqueness on `(city_norm, lang)` so English and Hebrew guides coexist. (Existing rows backfill to `lang='en'`.)
- **Generation:** thread the trip language end-to-end:
  - `useItinerary` already calls `POST /api/transportation/scout` with `{ city, tripDays }` — add `tripLanguage`.
  - The scout route passes it to `runTransportScoutAgent(city, { tripDays, lang })`, whose prompt gains a language directive: **output narrative fields (intro, summaries, scout tips, link labels) in the trip language; keep line names, app names, station names, and prices in their original form.**
  - `upsertTransportationGuide(db, city, guide, lang)` and the read path (`/api/transportation?city=…`) become language-scoped by `(city, lang)`.
- **Tips:** apply the same language directive where `packing_tips` / `local_tips` are generated in `api/generate/route.ts`, and store/read them under the trip language. (If tips live on the `transportation` row, they ride the same `(city_norm, lang)` key.)

### 3.3 Regenerate Taipei (Source 3)

After 3.1 + 3.2 land, regenerate the Taipei itinerary in Hebrew so stored descriptions + transport + tips come back localized:
- Clear/replace the English Taipei caches (`transportation` row for Taipei, the itinerary's `itinerary_json`).
- Re-run the generation pipeline for the Taipei trip with `tripLanguage='he'`.
- This is a **one-trip, manual** action for testing — **no bulk regeneration** of other itineraries. Existing non-Hebrew trips are untouched; future trips are correct automatically.

## 4. Scope & constraints

- **In scope:** UI string audit + wiring; language-aware transport & tips generation (incl. the `transportation.lang` migration); regenerate the single Taipei trip.
- **Out of scope (v1):** bulk re-translation/regeneration of existing itineraries; translating place names/prices/ratings; a language switcher on an already-generated trip.
- **Place-name rule (everywhere):** never translate or transliterate official venue/line/app/station names — they stay in their original (usually English) form.

## 5. Testing

- **Pure/unit (TDD where applicable):** any new pure helper (e.g. a `transportCacheKey(city, lang)` or a language-directive builder) gets a unit test in the repo's `node:assert` + `npx tsx` style.
- **Schema:** verify the migration backfills existing rows to `lang='en'` and the new uniqueness holds.
- **Manual (Taipei):** after regeneration, open the Taipei itinerary and confirm — transport cube, tips, recommendations, and descriptions are Hebrew (RTL), while venue/line/app names remain original. Confirm an English trip for the same city still gets the English cache (no cross-contamination).

## 6. Open implementation details to confirm during planning

- Exact location where `packing_tips` / `local_tips` are generated and whether they are stored on `transportation` or elsewhere (affects whether they share the `(city_norm, lang)` key).
- The precise mechanism to trigger a single-trip regeneration (existing endpoint/flag vs. a one-off script).
- Whether the localization work ships on `feature/results-glowup-phase-a` directly or on a branch cut from it.
