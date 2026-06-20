# Results Glow-Up — Phase A (Editorial Warmth) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the itinerary results page an editorial, warm, "less-AI" feel by adding a display serif (Fraunces), a warm-paper palette, and sunrise accents — replacing the cool mint overlay and Inter-everywhere headings, with zero new components.

**Architecture:** Pure styling/token change. Add a `--font-display` font variable + Tailwind-v4 `@theme` tokens in `globals.css`, wire the font in `layout.tsx`, then swap a handful of inline colors/classes in the `ItineraryClient.tsx` overview branch. No data, hooks, or logic change. Dark cinematic components stay dark.

**Tech Stack:** Next.js (Tailwind v4 via `@import "tailwindcss"` + `@theme`, **no** `tailwind.config`), `next/font/google`, framer-motion (already present).

**Spec:** `docs/superpowers/specs/2026-06-17-results-page-editorial-glowup-design.md` (Phase A).

> **Note on TDD:** Phase A is pure visual styling with **no testable logic** — there are no unit tests to write. "Verification" steps here are build + lint + manual visual checks. Phases B/C (which add derivations like `TripStats` and `CountUp`) will use real unit tests.

> **Branch first:** This repo's current branch is `feature/pexels-images`. Before Task 1, create a working branch:
> ```bash
> cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
> git checkout -b feature/results-glowup-phase-a
> ```

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/app/layout.tsx` | Load fonts, expose CSS variables on `<html>` | Modify — add Fraunces |
| `src/app/globals.css` | Design tokens + utilities | Modify — add `--font-display`, warm tokens, `.font-display` |
| `src/components/ItineraryClient.tsx` | Results page overview rendering | Modify — warm overlay/cards/text/shadows + serif headings + CTA pills |

---

## Task 1: Add the Fraunces display serif and `--font-display` token

**Files:**
- Modify: `src/app/layout.tsx:2`, `:24-29`, `:72`
- Modify: `src/app/globals.css` (inside `@theme`, after line 41; new utility near `:57`)

- [ ] **Step 1: Import Fraunces in layout.tsx**

In `src/app/layout.tsx`, change the font import on line 2 from:

```ts
import { Cormorant_Garamond, Inter } from 'next/font/google';
```
to:
```ts
import { Cormorant_Garamond, Fraunces, Inter } from 'next/font/google';
```

- [ ] **Step 2: Configure the Fraunces loader**

In `src/app/layout.tsx`, immediately after the `brandSerif` block (ends at line 29), add:

```ts
const display = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
```

- [ ] **Step 3: Expose the variable on `<html>`**

In `src/app/layout.tsx`, change line 72 from:

```tsx
    <html lang="en" className={`${inter.variable} ${brandSerif.variable} h-full`}>
```
to:
```tsx
    <html lang="en" className={`${inter.variable} ${brandSerif.variable} ${display.variable} h-full`}>
```

- [ ] **Step 4: Add the `--font-display` token and fix the broken `--font-serif`**

In `src/app/globals.css`, inside the `@theme` block, just before the closing `}` on line 42 (after `--color-danger: #ef4444;`), add:

```css

  /* ── Display / editorial serif ───────────────────────────────────────────── */
  --font-display: var(--font-display), 'Fraunces', ui-serif, Georgia, 'Times New Roman', serif;
  /* Makes the existing (currently broken) `font-serif` markup resolve to the display face */
  --font-serif:   var(--font-display);
```

- [ ] **Step 5: Add the `.font-display` utility class**

In `src/app/globals.css`, directly after the `.font-brand { … }` block (ends line 61), add:

```css

/* Editorial display headings — Fraunces */
.font-display {
  font-family: var(--font-display), ui-serif, Georgia, 'Times New Roman', serif;
  letter-spacing: -0.02em;
  font-optical-sizing: auto;
}
```

- [ ] **Step 6: Verify build + dev render**

Run:
```bash
npm run lint
npm run dev
```
Expected: lint passes; dev server boots. Open the results page — headings that already use `font-serif` (onboarding, modals) now render in Fraunces, not Georgia. No console font 404s.

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat(results): add Fraunces display serif + fix broken font-serif token"
```

---

## Task 2: Add warm-paper, sunrise, and soft-shadow tokens

**Files:**
- Modify: `src/app/globals.css` (inside `@theme`, after the Task 1 additions)

- [ ] **Step 1: Add the warm token block**

In `src/app/globals.css`, inside `@theme`, just after the `--font-serif` lines added in Task 1 (still before the closing `}`), add:

```css

  /* ── Warm editorial surfaces (light sections) ────────────────────────────── */
  --color-paper:        #f7f1e7;  /* warm off-white — replaces cool mint overlay */
  --color-paper-sunk:   #efe6d6;  /* deeper paper for insets */
  --color-ink-warm:     #2b2622;  /* warm near-black body text on paper */
  --color-ink-warm-mut: #6b6358;  /* warm muted text */

  /* ── Sunrise accent (pulled from photography) ────────────────────────────── */
  --color-sunrise:      #e0a44b;
  --color-sunrise-soft: #f0c98a;
  --color-sunrise-deep: #b8772e;  /* text-on-paper safe */
```

- [ ] **Step 2: Add softened shadow utilities**

Soft shadows are not colors, so they go as plain custom properties. In `src/app/globals.css`, **after** the closing `}` of the `@theme` block (after line 42), add:

```css

/* ── Soft editorial shadows (replace neon glows on light sections) ─────────── */
:root {
  --shadow-soft: 0 10px 30px -12px rgba(43,38,34,0.18);
  --shadow-card: 0 4px 16px rgba(43,38,34,0.08);
}
```

- [ ] **Step 3: Verify build**

Run:
```bash
npm run lint
```
Expected: passes. (Tokens are not yet consumed — that's Task 4.)

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(results): add warm-paper, sunrise, and soft-shadow design tokens"
```

---

## Task 3: Apply the display serif to results headings

**Files:**
- Modify: `src/components/ItineraryClient.tsx` (overview caption `:1366-1371`, packing `:1431`, local-tips `:1447`)

> Find every results-page heading by grepping; the three below are the verified light-section headings. Apply `font-display` (do **not** restyle dark-surface headings — those stay sans).

- [ ] **Step 1: Make the overview caption editorial**

In `src/components/ItineraryClient.tsx`, change the caption block at lines 1366-1371 from:

```tsx
            <p
              className="text-center text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-3"
              style={{ color: 'rgba(60,120,114,0.7)' }}
            >
              Your {days.length}-Day Itinerary · tap a day to explore
            </p>
```
to:
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

- [ ] **Step 2: Apply font-display to the packing heading**

In `src/components/ItineraryClient.tsx:1431`, change:

```tsx
                <h3 className="font-bold text-[#222] mb-3 flex items-center gap-2 text-[14px]">
```
to:
```tsx
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-[18px]" style={{ color: 'var(--color-ink-warm)' }}>
```

- [ ] **Step 3: Apply font-display to the local-tips heading**

In `src/components/ItineraryClient.tsx:1447`, change:

```tsx
                <h3 className="font-bold text-[#222] mb-3 flex items-center gap-2 text-[14px]">
```
to:
```tsx
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-[18px]" style={{ color: 'var(--color-ink-warm)' }}>
```

- [ ] **Step 4: Verify visually**

Run (dev server from Task 1 still running, or restart `npm run dev`). Open the results overview.
Expected: the "Your N-Day Itinerary" line is a large italic Fraunces headline; packing/local-tips section titles are Fraunces. No layout overflow on mobile width (~380px).

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "feat(results): editorial serif headings in overview"
```

---

## Task 4: Warm the overview surfaces (overlay, cards, text, shadows)

**Files:**
- Modify: `src/components/ItineraryClient.tsx` (overlay `:1305`, budget card `:1396-1397`, packing/tips cards `:1430,:1436,:1446,:1452`)

- [ ] **Step 1: Replace the cool mint overlay with warm paper**

In `src/components/ItineraryClient.tsx:1305`, change:

```tsx
        style={{ zIndex: -1, background: 'rgba(180,228,222,0.82)' }}
```
to:
```tsx
        style={{ zIndex: -1, background: 'rgba(247,241,231,0.88)' }}
```

> This is the single biggest "feel" change — turns the whole page wash from cool mint to warm paper.

- [ ] **Step 2: Warm the budget card surface + shadow**

In `src/components/ItineraryClient.tsx`, change lines 1396-1397 from:

```tsx
                className="mx-3 sm:mx-12 mb-6 rounded-3xl p-5 grid sm:grid-cols-3 gap-3 bg-white"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}
```
to:
```tsx
                className="mx-3 sm:mx-12 mb-6 rounded-3xl p-5 grid sm:grid-cols-3 gap-3"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
```

- [ ] **Step 2b: Warm the packing card surface + shadow**

In `src/components/ItineraryClient.tsx:1430`, change:

```tsx
              <div className="mx-3 sm:mx-12 mb-6 rounded-2xl p-5 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
```
to:
```tsx
              <div className="mx-3 sm:mx-12 mb-6 rounded-2xl p-5" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
```

- [ ] **Step 2c: Warm the local-tips card surface + shadow**

In `src/components/ItineraryClient.tsx:1446`, change:

```tsx
              <div className="mx-3 sm:mx-12 mb-6 rounded-2xl p-5 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
```
to:
```tsx
              <div className="mx-3 sm:mx-12 mb-6 rounded-2xl p-5" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
```

- [ ] **Step 3: Warm the list text on the paper cards**

In `src/components/ItineraryClient.tsx`, the packing list item at line 1436 and local-tips item at line 1452 both read `className="flex gap-2 text-[13px] text-[#555]"`. Replace **both** occurrences:

```tsx
                    <li key={i} className="flex gap-2 text-[13px] text-[#555]">
```
with:
```tsx
                    <li key={i} className="flex gap-2 text-[13px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
```

> There are exactly two matches (packing + local tips). If your editor does a global replace, confirm the count is 2.

- [ ] **Step 4: Verify visually + check the print regression**

Open the results overview.
Expected: page background is warm paper; the budget / packing / local-tips cards are warm off-white (not stark white) with soft shadows; list text is warm grey.
Also check `globals.css:341` print rule targets `.bg-white.rounded-2xl` — since we removed `bg-white` from these cards, **print preview** (Ctrl+P) will no longer border them. Acceptable for Phase A (flagged in spec A4); do **not** change print styles now.

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "feat(results): warm-paper overlay, cards, and text in overview"
```

---

## Task 5: Sunrise accents + pill CTAs with arrows

**Files:**
- Modify: `src/components/ItineraryClient.tsx` (checkmarks `:1437,:1453`, footer CTA `:1466-1476`, mobile FAB `:1488-1491`)

- [ ] **Step 1: Recolor the checkmark/sparkle to sunrise**

In `src/components/ItineraryClient.tsx:1437`, change:

```tsx
                      <span className="flex-shrink-0 mt-0.5 text-[#5aada5]">✓</span>{tip}
```
to:
```tsx
                      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-sunrise-deep)' }}>✓</span>{tip}
```

And at line 1453, change:

```tsx
                      <span className="flex-shrink-0 mt-0.5 text-[#5aada5]">✦</span>{tip}
```
to:
```tsx
                      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-sunrise-deep)' }}>✦</span>{tip}
```

- [ ] **Step 2: Footer CTA → soft shadow + trailing arrow**

In `src/components/ItineraryClient.tsx`, change the footer CTA block at lines 1466-1476 from:

```tsx
            <div className="text-center py-8 mx-3 sm:mx-12 print:hidden" style={{ borderTop: '1px solid rgba(90,173,165,0.2)' }}>
              <p className="text-sm mb-4 text-[#3a8a82]">{itin.ui.footerPrompt(itin.profile?.groupType)}</p>
              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm"
                  style={{ background: '#5aada5', boxShadow: '0 6px 24px -4px rgba(90,173,165,0.5)' }}
                >
                  {itin.ui.planNewTripButton}
                </Link>
              </motion.div>
            </div>
```
to:
```tsx
            <div className="text-center py-8 mx-3 sm:mx-12 print:hidden" style={{ borderTop: '1px solid rgba(184,119,46,0.22)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--color-ink-warm-mut)' }}>{itin.ui.footerPrompt(itin.profile?.groupType)}</p>
              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-full text-white font-semibold text-sm"
                  style={{ background: '#5aada5', boxShadow: 'var(--shadow-soft)' }}
                >
                  {itin.ui.planNewTripButton}
                  <span aria-hidden>↗</span>
                </Link>
              </motion.div>
            </div>
```

- [ ] **Step 3: Soften the mobile FAB shadow**

In `src/components/ItineraryClient.tsx`, the FAB at lines 1488-1489 uses `shadow-xl`. Change line 1488-1489 from:

```tsx
          className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold shadow-xl print:hidden"
          style={{ background: 'rgba(90,173,165,0.92)', border: '1px solid rgba(255,255,255,0.25)' }}
```
to:
```tsx
          className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold print:hidden"
          style={{ background: 'rgba(90,173,165,0.92)', border: '1px solid rgba(255,255,255,0.25)', boxShadow: 'var(--shadow-soft)' }}
```

- [ ] **Step 4: Verify visually**

Expected: checkmarks/sparkles are warm sunrise-brown; footer CTA is a full pill with a trailing ↗ and a soft (non-glowing) shadow; mobile FAB shadow is softer.

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "feat(results): sunrise accents and pill CTA with arrow"
```

---

## Task 6: Cross-cutting QA pass

**Files:** none (verification only)

- [ ] **Step 1: Build is clean**

Run:
```bash
npm run lint
npm run build
```
Expected: both succeed with no new errors/warnings introduced by Phase A.

- [ ] **Step 2: RTL / Hebrew check**

Load the results page for a trip whose `ui.dir === 'rtl'` (Hebrew). Confirm: the italic Fraunces caption falls back gracefully for Hebrew glyphs (Fraunces has no Hebrew — verify the Hebrew heading is legible via the token fallback chain; if it looks wrong, note it for a Hebrew-font fallback follow-up, do not block). Warm cards and CTA mirror correctly (they use `mx-`/`gap-`, already direction-safe).

- [ ] **Step 3: Reduced-motion check**

Enable OS "reduce motion". Reload results. Confirm nothing regressed (Phase A added no animation; framer-motion already honors it via `MotionProvider`).

- [ ] **Step 4: Regression check on font-serif consumers**

Open `/onboarding` and any modal that used `font-serif` (e.g. the feedback survey, vibe/top-sights sections). Confirm those headings now render Fraunces and look intentional, not broken. If any heading became too heavy/light, note it — do not fix dark-surface components in Phase A.

- [ ] **Step 5: Final commit (if any QA tweak was needed)**

```bash
git add -A
git commit -m "chore(results): phase A QA fixes"
```

> If no tweaks were needed, skip this step.

---

## Self-Review (completed by plan author)

- **Spec coverage (Phase A):** A1 typography → Tasks 1, 3. A2 tokens → Task 2. A3 pointed swaps (overlay/cards/text/CTA/checkmarks) → Tasks 4, 5. A4 risks (gold literals untouched, dark surfaces untouched, print regression accepted, font-serif regression QA'd) → Tasks 4 step 4, 6 step 4. ✅
- **Placeholder scan:** every code step shows exact before/after. No TBDs. ✅
- **Consistency:** token names (`--color-paper`, `--color-ink-warm`, `--color-ink-warm-mut`, `--color-sunrise-deep`, `--shadow-card`, `--shadow-soft`, `--font-display`) defined in Tasks 1-2 and consumed identically in Tasks 3-5. ✅
- **Out of scope (correctly deferred to B/C):** ItineraryHero, TripStats, Bento wiring, scroll-reveal, tilt, count-up, route-draw, parallax, sticky map. Gold-literal migration. Footer/SiteBackground navy seam.
