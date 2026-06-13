# Onboarding Wizard — Quiet Luxury Glow-Up

**Date:** 2026-06-13
**Scope:** `src/app/onboarding/` — wizard shell + all 7 step sections
**Type:** Visual polish + dynamic question copy. Zero logic/store/validation changes.

## Goal

Upgrade the trip-builder wizard from its current mixed look (mint-overlay photo
background, per-step accent colors, emoji icons, static question copy) to a
unified "quiet luxury" design: ivory background, hero photo strip, warm-gold +
deep-green palette, serif headlines, lucide line icons, and step headlines that
react to earlier answers.

## Decisions (approved by user)

1. **Background:** clean ivory page + destination photo confined to a top hero strip.
2. **Palette:** one unified palette (warm gold `#c4a26a` + deep green `#0d2b27`)
   replacing the per-step colors (red/blue/green/purple/amber).
3. **Dynamic copy:** full dynamic phrasing layer — step headlines reference the
   chosen city, night count, and group type.

## Architecture

### New files

**`src/lib/onboardingTheme.ts`** — single source of design tokens.

```ts
export const THEME = {
  gold:        '#c4a26a',
  goldSoft:    'rgba(196,162,106,0.35)',
  ink:         '#1f2421',   // CTA buttons, dark text
  deepGreen:   '#0d2b27',   // headlines
  textMuted:   '#3a7068',
  textFaint:   '#5a908a',
  ivory:       '#FDFCF9',   // page background
  surface:     '#FFFFFF',   // unselected card
  surfaceSel:  '#FAF6EE',   // selected card
  border:      '#E8E5DC',   // unselected card border
  borderSel:   '#c4a26a',   // selected card border
} as const;
```

All 7 sections import from here; the per-file `GREEN` / `MUTED` / `IVORY` /
`ACCENT` constant blocks currently duplicated across sections are deleted.

**`src/lib/stepCopy.ts`** — pure function returning per-step headline + sub
from onboarding store state.

```ts
interface StepCopy { headline: string; sub: string }
export function getStepCopy(step: number, s: {
  cityName: string | null;   // cities[0]?.name ?? destination ?? null
  nights: number | null;
  groupType: string | null;
}): StepCopy
```

Examples (with static fallbacks when city/dates are not yet known):

| Step | Static fallback | Dynamic |
|------|-----------------|---------|
| 0 Destination | "Where to?" | — (no prior answers) |
| 1 Dates | "When are you traveling?" | "When does Rome happen?" |
| 2 Budget+interests | "What's the budget?" | "Five nights in Rome — what's the budget?" |
| 3 Style/pace | "How do you travel?" | "How fast do you want Rome to move?" |
| 4 Stay | "Where will you stay?" | "Where will you sleep in Rome?" |
| 5 Dining | "Any dining rules?" | "Eating your way through Rome — any rules?" |
| 6 Picks | "Last touch" | "Last touch — what can't you miss in Rome?" |

Night count is spelled out up to twelve ("Five nights"), numeric beyond.
Pure function → unit-testable without React.

### Modified files

**`src/app/onboarding/page.tsx`** (shell)

- Remove mint-overlay + fixed photo background and the step-color radial glows.
  Page background becomes flat ivory.
- Add a **hero strip** at the top: ~140px tall, rounded-2xl, full column width.
  Shows the `resolveBackgroundImage(...)` photo (existing helper, unchanged)
  with a soft dark gradient at the bottom and the city name in serif over it.
  Before a city is chosen: neutral muted strip with the brand wordmark only.
  Crossfades when the photo URL changes (framer-motion).
- Progress bar → 7 thin segments that fill with gold, plus a numbered label
  `03 — TRAVEL STYLE · OF 07` (gold, letter-spaced) replacing the current
  dot row and "Step X of Y" line.
- `STEPS` array loses per-step `color`; keeps `label`.
- Footer CTA: ink (`#1f2421`) at every step; final Generate step uses gold.
  Remove colored glow box-shadows; keep a single soft neutral shadow.
- Step headline rendered by the shell from `getStepCopy(...)` (serif, ~28px),
  so sections no longer render their own h2 headers.

**All 7 sections** (`DestinationSection`, `DatesSection`, `PreferencesSection`,
`VibeSection`, `SmartHotelStep`, `FinishingTouchesSection`, `TopSightsSection`)

- Emoji icons (💚💛💎🏛️🍜🧗🎨🌃🧘🛍️ etc.) → lucide-react line icons
  (already a dependency). Icon color: muted green unselected, gold selected.
- Unified selection language: white card, 1px `#E8E5DC` border → selected:
  gold border + `#FAF6EE` background. No glow shadows, no green ✓ pop-in;
  selection is shown by border/background/icon-color change only.
- Numbered colored circle headers (the green "3" badge etc.) deleted —
  numbering lives in the progress label now.
- Section-local color constants replaced by `THEME` imports.
- Internal sub-labels ("Daily budget", "What lights you up?") stay, restyled
  with the shared tokens.

## Data flow

`useOnboardingStore` (unchanged) → shell computes `{ cityName, nights,
groupType }` → `getStepCopy(wizardStep, ...)` → headline rendered in shell.
Sections keep reading/writing the store exactly as today.

## Error handling

No new failure modes: `stepCopy` is pure with total fallbacks (every field
nullable → static copy). Hero strip falls back to the neutral brand strip if
the image fails to load (`onError`). Chunk-retry, auth guard, resume logic
untouched.

## Out of scope

- No store, validation, routing, or generation-payload changes.
- No changes to `/plan`, dashboard, or itinerary pages.
- Slide animations, lazy-loading, and ChunkLoadError safety net stay as-is.
- No new dependencies.

## Testing

- Unit tests for `getStepCopy` (fallbacks, city interpolation, night spelling,
  per-step variants) following the existing `SmartHotelStep.test.ts` pattern.
- `npm run build` + lint pass.
- Manual visual walkthrough of all 7 steps (desktop + mobile width), including
  the pre-city state of the hero strip and the resume (`?resume=1`) path.
