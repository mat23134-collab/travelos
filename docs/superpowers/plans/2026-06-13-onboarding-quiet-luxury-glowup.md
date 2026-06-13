# Onboarding Quiet-Luxury Glow-Up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the 7-step onboarding wizard to a unified quiet-luxury look (ivory page, hero photo strip, gold+deep-green palette, serif headlines, lucide icons) with dynamic per-step question copy.

**Architecture:** Two new pure modules (`onboardingTheme.ts` tokens, `stepCopy.ts` copy engine) are added first, then the shell (`page.tsx`) is reworked to own the page chrome and step headlines, then each section is restyled to consume the shared tokens. Zero changes to the zustand store, validation, routing, or generation payload.

**Tech Stack:** Next.js 14 (app router), React 18, Tailwind 4, framer-motion 11, lucide-react 0.474 (already installed), zustand. Tests: plain `node:assert/strict` scripts run with `npx tsx` (existing pattern: `src/app/onboarding/sections/SmartHotelStep.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-13-onboarding-quiet-luxury-glowup-design.md`

**Repo root:** `C:\Users\מתן כהן\OneDrive\שולחן העבודה\travel site` (branch `master`). All paths below are relative to it. Run all commands from the repo root.

**Verification used throughout:** `npx tsc --noEmit` (fast type check). Full `npm run build` only in the final task.

---

### Task 1: Design tokens module

**Files:**
- Create: `src/lib/onboardingTheme.ts`

- [ ] **Step 1: Create the tokens file**

```ts
/**
 * onboardingTheme — single source of design tokens for the onboarding wizard.
 * Quiet-luxury palette: warm gold accent on ivory, deep-green text.
 * Every onboarding section imports from here; no section defines its own
 * color constants.
 */
export const THEME = {
  gold:       '#c4a26a',                    // accent: selected borders, progress fill
  goldSoft:   'rgba(196,162,106,0.35)',     // faint accent (chevrons, dividers)
  ink:        '#1f2421',                    // CTA buttons, strongest text
  deepGreen:  '#0d2b27',                    // headlines
  textBody:   '#1a4a44',                    // card option titles
  textMuted:  '#3a7068',                    // sub-labels, secondary copy
  textFaint:  '#5a908a',                    // hints, tertiary copy
  ivory:      '#FDFCF9',                    // page background
  surface:    '#FFFFFF',                    // unselected card background
  surfaceSel: '#FAF6EE',                    // selected card background
  border:     '#E8E5DC',                    // unselected card border (1px)
  borderSel:  '#c4a26a',                    // selected card border (1px)
} as const;

export const CARD = {
  base:     { background: THEME.surface,    border: `1px solid ${THEME.border}` },
  selected: { background: THEME.surfaceSel, border: `1px solid ${THEME.borderSel}` },
} as const;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/onboardingTheme.ts
git commit -m "feat: add onboarding quiet-luxury design tokens"
```

---

### Task 2: Dynamic step-copy engine (TDD)

**Files:**
- Create: `src/lib/stepCopy.ts`
- Test: `src/lib/stepCopy.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/stepCopy.test.ts`:

```ts
import assert from 'node:assert/strict';
import { getStepCopy, spellNights } from './stepCopy';

// ── spellNights ──────────────────────────────────────────────────────────────
assert.equal(spellNights(1),  'One night');
assert.equal(spellNights(5),  'Five nights');
assert.equal(spellNights(12), 'Twelve nights');
assert.equal(spellNights(13), '13 nights');

// ── static fallbacks (nothing answered yet) ─────────────────────────────────
const empty = { cityName: null, nights: null, groupType: null };
assert.equal(getStepCopy(0, empty).headline, 'Where to?');
assert.equal(getStepCopy(1, empty).headline, 'When are you traveling?');
assert.equal(getStepCopy(2, empty).headline, "What's the budget?");
assert.equal(getStepCopy(3, empty).headline, 'How do you travel?');
assert.equal(getStepCopy(4, empty).headline, 'Where will you stay?');
assert.equal(getStepCopy(5, empty).headline, 'Any dining rules?');
assert.equal(getStepCopy(6, empty).headline, 'Last touch');

// every step has a non-empty sub line
for (let i = 0; i <= 6; i++) {
  assert.ok(getStepCopy(i, empty).sub.length > 0, `step ${i}: sub present`);
}

// ── dynamic variants ─────────────────────────────────────────────────────────
const rome = { cityName: 'Rome', nights: 5, groupType: null };
assert.equal(getStepCopy(1, rome).headline, 'When does Rome happen?');
assert.equal(getStepCopy(2, rome).headline, "Five nights in Rome — what's the budget?");
assert.equal(getStepCopy(3, rome).headline, 'How fast do you want Rome to move?');
assert.equal(getStepCopy(4, rome).headline, 'Where will you sleep in Rome?');
assert.equal(getStepCopy(5, rome).headline, 'Eating your way through Rome — any rules?');
assert.equal(getStepCopy(6, rome).headline, "Last touch — what can't you miss in Rome?");

// city known but dates not yet → step 2 falls back to city-only phrasing
const romeNoDates = { cityName: 'Rome', nights: null, groupType: null };
assert.equal(getStepCopy(2, romeNoDates).headline, "Rome — what's the budget?");

// out-of-range step → safe generic
assert.equal(getStepCopy(99, empty).headline, 'Almost there');

console.log('All stepCopy tests passed ✅');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx src/lib/stepCopy.test.ts`
Expected: FAIL — `Cannot find module './stepCopy'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/stepCopy.ts`:

```ts
/**
 * stepCopy — dynamic headline + sub line for each onboarding wizard step.
 * Pure function over a snapshot of the store; total fallbacks mean it can
 * never throw or return empty strings, regardless of how little the user
 * has answered.
 */
export interface StepCopyState {
  cityName:  string | null;
  nights:    number | null;
  groupType: string | null;
}

export interface StepCopy {
  headline: string;
  sub:      string;
}

const NIGHT_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** "Five nights" up to twelve, "13 nights" beyond. */
export function spellNights(n: number): string {
  const word = n >= 1 && n <= 12 ? NIGHT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? 'night' : 'nights'}`;
}

export function getStepCopy(step: number, s: StepCopyState): StepCopy {
  const city = s.cityName?.trim() || null;

  switch (step) {
    case 0:
      return {
        headline: 'Where to?',
        sub: 'Choose a country, then pick your cities.',
      };
    case 1:
      return city
        ? { headline: `When does ${city} happen?`, sub: 'Pick your travel dates.' }
        : { headline: 'When are you traveling?',   sub: 'Pick your travel dates.' };
    case 2: {
      const sub = 'Budget calibrates every recommendation; interests bias the picks.';
      if (city && s.nights) return { headline: `${spellNights(s.nights)} in ${city} — what's the budget?`, sub };
      if (city)             return { headline: `${city} — what's the budget?`, sub };
      return { headline: "What's the budget?", sub };
    }
    case 3: {
      const sub = 'A few quiet questions to shape the restaurants, pace, and venues we choose.';
      return city
        ? { headline: `How fast do you want ${city} to move?`, sub }
        : { headline: 'How do you travel?', sub };
    }
    case 4: {
      const sub = 'Booked already, or shall we find the right neighborhood?';
      return city
        ? { headline: `Where will you sleep in ${city}?`, sub }
        : { headline: 'Where will you stay?', sub };
    }
    case 5: {
      const sub = 'Dietary needs we should respect. Optional — skip freely.';
      return city
        ? { headline: `Eating your way through ${city} — any rules?`, sub }
        : { headline: 'Any dining rules?', sub };
    }
    case 6: {
      const sub = 'Hand-picked recommendations and your must-sees.';
      return city
        ? { headline: `Last touch — what can't you miss in ${city}?`, sub }
        : { headline: 'Last touch', sub };
    }
    default:
      return { headline: 'Almost there', sub: 'Just a little more.' };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx src/lib/stepCopy.test.ts`
Expected: `All stepCopy tests passed ✅`

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` → exit 0.

```bash
git add src/lib/stepCopy.ts src/lib/stepCopy.test.ts
git commit -m "feat: add dynamic step-copy engine for onboarding wizard"
```

---

### Task 3: Shell rework — `page.tsx`

**Files:**
- Modify: `src/app/onboarding/page.tsx`

The shell currently paints a mint overlay over a fixed photo, colors each step differently, and shows a dot progress row. It becomes: ivory page, hero photo strip, gold segmented progress, serif headline from `getStepCopy`, ink CTA.

- [ ] **Step 1: Add imports and drop per-step colors**

At the top of `page.tsx` add:

```ts
import { THEME } from '@/lib/onboardingTheme';
import { getStepCopy } from '@/lib/stepCopy';
```

Replace the `STEPS` array (currently each entry has `color`) with:

```ts
const STEPS = [
  { label: 'Destination' },
  { label: 'Dates' },
  { label: 'Interests' },
  { label: 'Style' },
  { label: 'Stay' },
  { label: 'Dining' },
  { label: 'Our Picks' },
] as const;
```

Delete the line `const stepColor = STEPS[wizardStep]?.color ?? '#9e363a';` and every remaining use of `stepColor` (they are all replaced in the steps below).

- [ ] **Step 2: Replace the dot ProgressBar with gold segments + numbered label**

Replace the existing `ProgressBar` function with:

```tsx
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-1 w-32">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-colors duration-500"
          style={{ height: 3, background: i <= step ? THEME.gold : THEME.border }}
        />
      ))}
    </div>
  );
}
```

Replace the step-label `<motion.p>` block (the one rendering `Step {wizardStep + 1} of {STEPS.length} · …`) with a numbered label + serif headline driven by `getStepCopy`:

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={wizardStep}
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -4 }}
    className="mt-5 mb-8"
  >
    <p className="text-[11px] uppercase tracking-[0.22em]" style={{ color: THEME.gold }}>
      {String(wizardStep + 1).padStart(2, '0')} — {STEPS[wizardStep]?.label}
      <span style={{ color: THEME.textFaint }}> · of {String(STEPS.length).padStart(2, '0')}</span>
    </p>
    <h1
      className="font-serif text-[28px] leading-[1.15] tracking-[-0.015em] mt-2"
      style={{ color: THEME.deepGreen, fontWeight: 400 }}
    >
      {stepCopy.headline}
    </h1>
    <p className="mt-1.5 text-[13px] tracking-wide" style={{ color: THEME.textMuted }}>
      {stepCopy.sub}
    </p>
  </motion.div>
</AnimatePresence>
```

Inside `OnboardingPageContent`, next to the existing `nightCount` computation, add the copy snapshot (place it after `nightCount` so it can use it):

```ts
const stepCopy = getStepCopy(wizardStep, {
  cityName:  cities[0]?.name ?? (destination.trim() || null),
  nights:    nightCount,
  groupType: groupType || null,
});
```

(`nightCount` already exists; move its declaration above this block if needed.)

- [ ] **Step 3: Ivory page + hero strip replace the mint-overlay background**

Replace the `<main>` opening tag (the one with `backgroundImage: linear-gradient(rgba(180,228,222,…))`) with:

```tsx
<main className="min-h-screen relative" style={{ background: THEME.ivory }}>
```

Delete the entire "Step-colour accent glow" `<div className="fixed inset-0 …">` block (both radial/linear gradient children).

Add a `HeroStrip` component above `OnboardingPageContent`:

```tsx
function HeroStrip({ url, cityName }: { url: string | null; cityName: string | null }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!url && !failed;
  return (
    <div
      className="relative rounded-2xl overflow-hidden mb-2"
      style={{ height: 140, background: showPhoto ? THEME.ink : '#EAE7DE' }}
    >
      <AnimatePresence mode="wait">
        {showPhoto && (
          <motion.img
            key={url}
            src={url!}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setFailed(true)}
          />
        )}
      </AnimatePresence>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to top, rgba(13,20,18,0.55) 0%, transparent 55%)' }}
      />
      {cityName && (
        <p
          className="absolute bottom-3 left-4 font-serif text-[22px] tracking-[-0.01em]"
          style={{ color: '#FDFCF9', fontWeight: 400 }}
        >
          {cityName}
        </p>
      )}
    </div>
  );
}
```

Render it inside the header column, directly under the row holding the back arrow / wordmark / progress bar:

```tsx
<HeroStrip
  url={bgUrl || null}
  cityName={cities[0]?.name ?? (destination.trim() || null)}
/>
```

The existing `bgUrl` memo and `resolveBackgroundImage` calls stay exactly as they are.

- [ ] **Step 4: Restyle back buttons and footer CTA to the unified palette**

Header back arrow: replace its `style` with
`{ color: THEME.textMuted, border: `1px solid ${THEME.border}` }`.

Footer wrapper: replace the mint gradient style with:

```tsx
style={{
  background: 'linear-gradient(to top, rgba(253,252,249,0.97) 60%, transparent 100%)',
  paddingTop: 36,
}}
```

Footer Back button `style` becomes:

```tsx
style={{ background: THEME.surface, border: `1px solid ${THEME.border}`, color: THEME.textMuted }}
```

Continue/Generate button: replace its `style` object with:

```tsx
style={{
  background: stepState.canContinue
    ? wizardStep === STEPS.length - 1 ? THEME.gold : THEME.ink
    : THEME.border,
  color: stepState.canContinue
    ? wizardStep === STEPS.length - 1 ? THEME.ink : '#FDFCF9'
    : THEME.textFaint,
  boxShadow: stepState.canContinue ? '0 6px 18px -6px rgba(31,36,33,0.35)' : 'none',
  opacity: stepState.canContinue ? 1 : 0.7,
  cursor: stepState.canContinue ? 'pointer' : 'default',
}}
```

Also update `BrandWordmark accent={stepColor}` → `accent={THEME.gold}`, and the two `StepSkeleton` placeholder backgrounds from `rgba(255,255,255,…)` to `rgba(31,36,33,0.06)` / `rgba(31,36,33,0.04)` so they are visible on ivory.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` → exit 0.
Run: `npm run dev` briefly and load `http://localhost:3000/onboarding` → ivory page, hero strip (neutral before city chosen), gold segments, serif headline, ink CTA. Stop the dev server.

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat: quiet-luxury shell for onboarding wizard (ivory, hero strip, gold progress, dynamic headlines)"
```

---

### Task 4: Restyle PreferencesSection (budget + interests)

**Files:**
- Modify: `src/app/onboarding/sections/PreferencesSection.tsx`

- [ ] **Step 1: Swap constants, icons, and header**

1. Replace `const GREEN = '#2e9e74'; const MUTED = '#3a7068';` with
   `import { THEME, CARD } from '@/lib/onboardingTheme';` and add
   `import { Wallet, CreditCard, Gem, Landmark, UtensilsCrossed, Mountain, Palette, Moon, Flower2, ShoppingBag } from 'lucide-react';`
   Then replace every `GREEN` → `THEME.gold` and `MUTED` → `THEME.textMuted` use.
2. Change option icon fields from emoji strings to lucide components.
   `BUDGET_OPTIONS`: `icon: Wallet` (budget), `icon: CreditCard` (mid-range), `icon: Gem` (luxury).
   `INTEREST_OPTIONS`: culture→`Landmark`, food→`UtensilsCrossed`, adventure→`Mountain`, art→`Palette`, nightlife→`Moon`, wellness→`Flower2`, shopping→`ShoppingBag`, hidden-gems→`Gem`.
   Update the type accordingly: `icon: LucideIcon` (`import type { LucideIcon } from 'lucide-react';`).
3. Render icons as components instead of `<span>{opt.icon}</span>`:

```tsx
<opt.icon
  size={18}
  strokeWidth={1.75}
  style={{ color: sel ? THEME.gold : THEME.textMuted }}
  className="shrink-0"
/>
```

4. Delete the whole header block (the green numbered circle `3` + `<h2>Your travel style</h2>` + sub `<p>`) — the shell now renders the headline. The two inner labels ("Daily budget", "What lights you up?") stay, restyled with `THEME.textMuted` / `THEME.textFaint`.
5. Selection style: in both budget rows and interest chips replace selected/unselected styles with `CARD.selected` / `CARD.base` (spread: `style={sel ? CARD.selected : CARD.base}`), title color `sel ? THEME.deepGreen : THEME.textBody`. Remove the `animate` glow `boxShadow` prop on budget rows and delete both pop-in `✓` `<motion.span>` blocks.
6. In the `isCompleted` summary block (kept for safety even though the wizard always passes `isCompleted={false}`), replace `GREEN` uses with `THEME.gold` and render `{budgetOpt?.label}` without the emoji; replace the `interestIcons` emoji line with a plain count: `` `${interests.length} interests` ``.

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit` → exit 0. Spot-check step 3 of 7 in the browser (`npm run dev`): cards white with `#E8E5DC` borders, selected = gold border + `#FAF6EE`, lucide icons.

```bash
git add src/app/onboarding/sections/PreferencesSection.tsx
git commit -m "refactor: quiet-luxury restyle for PreferencesSection"
```

---

### Task 5: Align VibeSection + TopSightsSection to shared tokens

These two are already quiet-luxury styled; they only need (a) THEME imports instead of local constants, (b) their local `<h2>` headers removed (shell owns headlines now).

**Files:**
- Modify: `src/app/onboarding/sections/VibeSection.tsx`
- Modify: `src/app/onboarding/sections/TopSightsSection.tsx`

- [ ] **Step 1: VibeSection**

1. Delete the local constant block (`IVORY`, `IVORY_DIM`, `IVORY_FAINT`, `ACCENT`, `ACCENT_SOFT`, `SURFACE`, `SURFACE_SEL`, `BORDER`, `BORDER_SEL`) and add `import { THEME } from '@/lib/onboardingTheme';` then map every use:
   `IVORY`→`THEME.deepGreen`, `IVORY_DIM`→`THEME.textMuted`, `IVORY_FAINT`→`THEME.textFaint`, `ACCENT`→`THEME.gold`, `ACCENT_SOFT`→`THEME.goldSoft`, `SURFACE`→`THEME.surface`, `SURFACE_SEL`→`THEME.surfaceSel`, `BORDER`→`` `1px solid ${THEME.border}` ``, `BORDER_SEL`→`` `1px solid ${THEME.borderSel}` ``. Hardcoded `'#1a4a44'` option-title colors → `THEME.textBody`.
2. Delete the header block in the active form: the `<div>` containing `<h2 …>Who's coming with you?</h2>` and its sub `<p>` (lines ~150–165). The inner uppercase labels ("Style of travel", "Pace", etc.) stay.
3. Glass-card wrappers (`rgba(255,255,255,0.65)` + backdrop-blur) become solid: `background: THEME.surface`, keep the border via `1px solid ${THEME.border}`, drop `backdrop-blur-2xl` classes (page is now flat ivory; blur has nothing to blur).

- [ ] **Step 2: TopSightsSection**

Same constant mapping as VibeSection (it uses the identical local names `IVORY`/`IVORY_DIM`/`IVORY_FAINT`/`ACCENT`/`BORDER_SEL`). Delete its top `<h2>` header block + sub `<p>` (lines ~80–89); keep the section-internal serif sub-headers (e.g. the `text-[18px]`/`text-[20px]` ones) since they label sub-groups, not the step.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → exit 0. Browser spot-check steps 4 and 7 of 7.

```bash
git add src/app/onboarding/sections/VibeSection.tsx src/app/onboarding/sections/TopSightsSection.tsx
git commit -m "refactor: VibeSection and TopSightsSection consume shared theme tokens"
```

---

### Task 6: Restyle DestinationSection + DatesSection

**Files:**
- Modify: `src/app/onboarding/sections/DestinationSection.tsx`
- Modify: `src/app/onboarding/sections/DatesSection.tsx`

- [ ] **Step 1: DestinationSection**

1. Replace `const RED = '#9e363a'; const MUTED = '#3a7068';` (and any sibling constants at the top) with `import { THEME, CARD } from '@/lib/onboardingTheme';`; map `RED`→`THEME.gold`, `MUTED`→`THEME.textMuted`, hardcoded `'#0d2b27'`→`THEME.deepGreen`.
2. Delete the `<h2>Where to?</h2>` + sub `<p>` header block (~lines 315–316 and surrounding wrapper) — shell owns it.
3. Trip-type cards (~line 387): `icon: '📍'` → `icon: MapPin`, `icon: '🗺️'` → `icon: Map` with `import { MapPin, Map } from 'lucide-react';` and render via `<opt.icon size={18} strokeWidth={1.75} … />` as in Task 4 step 1.3.
4. Apply `CARD.base` / `CARD.selected` to all selectable cards (country grid, trip-type, city chips) replacing their current border/background pairs; selected-glow box-shadows removed.

- [ ] **Step 2: DatesSection**

1. Replace `const BLUE = '#4a7bde'; const RED = '#9e363a'; const MUTED = '#3a7068';` with the THEME import; map `BLUE`→`THEME.gold`, `RED`→`THEME.gold`, `MUTED`→`THEME.textMuted`, the inline `'#4a7bde'` (~line 308) → `THEME.gold`, `'#3a7068'` → `THEME.textMuted`, `'#0d2b27'` → `THEME.deepGreen`.
2. Delete the `<h2>When?</h2>` + sub `<p>` header block (~lines 290–291 and wrapper).
3. Calendar selected-day / range styling that used `BLUE`/`RED` now uses `THEME.gold` for the selected bound days and `THEME.surfaceSel` for the in-range fill; "Optional" pill (~line 347) → `background: THEME.surfaceSel, color: THEME.textMuted`.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → exit 0. Browser spot-check steps 1–2 of 7 including picking a date range.

```bash
git add src/app/onboarding/sections/DestinationSection.tsx src/app/onboarding/sections/DatesSection.tsx
git commit -m "refactor: quiet-luxury restyle for Destination and Dates sections"
```

---

### Task 7: Restyle SmartHotelStep + FinishingTouchesForm

**Files:**
- Modify: `src/app/onboarding/sections/SmartHotelStep.tsx`
- Modify: `src/components/FinishingTouchesForm.tsx`

- [ ] **Step 1: SmartHotelStep**

1. Replace `const GOLD = '#c5912a'; const MUTED = '#3a7068';` with the THEME import; `GOLD`→`THEME.gold`, `MUTED`→`THEME.textMuted`, `'#0d2b27'`→`THEME.deepGreen`.
2. Remove the rendered `<h2>{config.headline}</h2>` and `<p>{config.subline}</p>` (~lines 235–236) — the shell headline covers step 4 now. **Keep** `getHotelPersonalization` and its `contextBadge` rendering (the personalization badge is still shown); only the h2/sub go.
3. Emoji → lucide (add to imports, render as `<Icon size={18} strokeWidth={1.75} …/>` per Task 4):
   - `ACCOM_BASE`: hostel→`BedDouble`, boutique-hotel→`Hotel`, luxury-hotel→`Star`, airbnb→`Home`, resort→`TreePalm`
   - nightly budget options: budget→`Coins`, mid→`Banknote`, comfort→`CreditCard`, luxury→`Gem`
   - location options: city-center 🏙️→`Building2`, nature 🌿→`Leaf`, transit 🚇→`TrainFront`, waterfront 🌊→`Waves`
   - `AMENITY_OPTIONS`: breakfast→`Coffee`, pool→`Waves`, workspace→`Laptop`, gym→`Dumbbell`, parking→`SquareParking`, spa→`Bath`, suite→`BedDouble`, rooftop→`Sunset`, pets→`PawPrint`
   - path cards (~242–243): 🏨→`Hotel`, 🔍→`Search`
   Change the relevant `icon: string` type fields to `icon: LucideIcon`. **Important:** `getNightlyOptionsForAccommodation` is exported and unit-tested on `label` only — keep its signature and labels identical so `SmartHotelStep.test.ts` still passes.
4. Selection states → `CARD.base` / `CARD.selected` as in previous tasks; remove glow shadows and pop-in ✓ marks.

- [ ] **Step 2: FinishingTouchesForm**

1. Replace `const ACCENT = '#9e363a';` (line 6) with the THEME import; `ACCENT`→`THEME.gold`; `'#0d2b27'`→`THEME.deepGreen`.
2. The two `<h2>{headerCopy.title}</h2>` blocks (lines ~64, ~72): delete the one rendered in `dietary`/`recommendations` mode (wizard renders headline in shell). If a quick read shows the same component is also used outside the wizard in `mode="all"` (check with `grep -rn "FinishingTouchesForm" src/`), keep the `mode === 'all'` header and only suppress it for `dietary`/`recommendations` modes.
3. Option rows use emoji via `{opt.icon}` / `{pick.icon}` (lines ~106, ~165) — map the dietary/must-have option arrays to lucide icons the same way (inspect the arrays at the top of the file; pick semantically close lucide names, e.g. vegetarian→`Leaf`, kosher/halal→`BadgeCheck`, gluten-free→`WheatOff`, vegan→`Sprout`; must-have picks: viewpoint→`Mountain`, market→`ShoppingBag`, museum→`Landmark`, etc. — exact names at the executor's discretion from the lucide catalog, `icon: LucideIcon` type).
4. Selection states → `CARD.base` / `CARD.selected`.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc --noEmit` → exit 0.
Run: `npx tsx src/app/onboarding/sections/SmartHotelStep.test.ts`
Expected: `All SmartHotelStep tests passed ✅`

```bash
git add src/app/onboarding/sections/SmartHotelStep.tsx src/components/FinishingTouchesForm.tsx
git commit -m "refactor: quiet-luxury restyle for SmartHotelStep and FinishingTouchesForm"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run all unit tests**

```bash
npx tsx src/lib/stepCopy.test.ts
npx tsx src/app/onboarding/sections/SmartHotelStep.test.ts
```

Expected: both print their ✅ pass lines.

- [ ] **Step 2: Lint + build**

```bash
npm run lint
npm run build
```

Expected: lint exit 0 (pre-existing warnings unrelated to onboarding are acceptable; no new errors in touched files); build completes.

- [ ] **Step 3: Manual walkthrough**

Run `npm run dev`, open `http://localhost:3000/onboarding`, and verify:
1. Pre-city state: neutral hero strip, "Where to?" headline.
2. Pick a country + city → hero strip crossfades to the city photo with serif city name; step 2 headline reads "When does {city} happen?".
3. Pick dates → step 3 headline includes spelled night count ("Five nights in …").
4. Walk all 7 steps: no emojis anywhere, every selected card = gold border + `#FAF6EE` fill, CTA is ink (gold on the final Generate step).
5. Narrow the window to ~390px (mobile): hero strip, progress, and cards stay inside the column.
6. Resume path: navigate away mid-wizard, return to `/onboarding?resume=1` → re-enters at the saved step with correct headline.
7. Back navigation from step 7 to step 1 — slide animations still work.

- [ ] **Step 4: Final commit (if walkthrough produced fixes)**

```bash
git add -A
git commit -m "fix: polish from onboarding glow-up walkthrough"
```
