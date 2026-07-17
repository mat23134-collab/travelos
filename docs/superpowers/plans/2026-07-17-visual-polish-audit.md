# Visual Polish — Component-Level Glow-Up Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the remaining gap between Sarto and top-tier visual execution (Airbnb / Stripe / Linear) by fixing four *specific, audited* defects — an off-brand map, unsystematised image sizing, a split shadow system, and stale theme leftovers. This is a detail pass, not a redesign.

**Architecture:** Token additions in `src/app/globals.css` plus surgical edits to `DayPhoto.tsx`, `ItineraryMap.tsx`, `InteractiveMap.tsx`, and `DayCarousel.tsx`. No data layer, hooks, routing, or component-tree changes. Every task is independently shippable and visually reversible.

**Tech Stack:** Next.js 14, Tailwind v4 (`@theme` in `src/app/globals.css` — there is **no** `tailwind.config`), `react-map-gl` 7 + `mapbox-gl` 3, `lucide-react`, framer-motion.

**Source:** A visual-polish research report (external, generic) + a codebase audit performed 2026-07-17. **The audit overrides the report wherever they disagree** — see below.

---

## Audit findings (read first — this is why the plan is short)

The source report proposed four stages of work. Against the actual codebase, **most of Stage 1 and Stage 3 are already done or were never broken.** Verified:

| Report claim | Audit result | Verdict |
|---|---|---|
| "Spacing drift — arbitrary values like `p-[13px]`" | `grep` for arbitrary spacing across `src/` returns **zero hits** | ✅ Non-issue. Skip. |
| "Bootstrap-default hard single shadows" | Only **one** arbitrary shadow exists repo-wide | ✅ Mostly non-issue — but see T2 |
| "Pure-black shadows on warm surfaces" | `--shadow-card` / `--shadow-soft` are **already** tinted to `rgba(43,38,34,…)` | ✅ Already done |
| "No scrim behind text-over-image" | `DayCard.tsx:839` already has a proper `from-black/92 via-black/40 to-transparent` gradient floor-fade | ✅ Already done |
| "Radius chaos" | 6 tokens in consistent use; only **9** arbitrary radii repo-wide | 🟡 Minor. Deferred. |
| "Map pins are generic" | Pins are **already** numbered, day-coloured, white-ringed, with shadow + active state (`ItineraryMap.tsx:155`) | ✅ Better than report assumed |
| "Default-styled basemap" | Both maps hardcode stock `mapbox://styles/mapbox/dark-v11` | ❌ **Real gap → T3** |
| "Inconsistent card image ratios" | `DayPhoto` takes a **fixed pixel `height` prop**; callers pass 164 / 200 / 220 / 260. No `aspect-ratio`, no `object-position` | ❌ **Real gap → T1** |
| "No scroll-snap on carousel" | `DayCarousel.tsx` has no snap | ❌ **Real gap → T4** |

**One finding the report missed entirely:** `DAY_COLORS` (`ItineraryMap.tsx:70`) is a generic Tailwind rainbow (`#ff5a5f`, `#3b82f6`, `#10b981`, `#8b5cf6`…). It is completely disconnected from the terracotta/sunrise/paper palette in `@theme`. This is the single loudest "assembled from defaults" tell in the product, and it is a ~10-line fix. → **T3**.

**Deliberately out of scope:**
- **Spacing scale / lint rule** — nothing to fix; a lint rule guarding an already-clean codebase is churn.
- **Concentric radius rule** — real principle, but the 9 arbitrary radii don't justify a sweep through every card. Fold into the next card refactor.
- **Button 3-tier system** — needs a design call on primary/secondary/tertiary semantics across onboarding *and* results. That's a spec, not a mechanical task. → separate doc.
- **Clustering** — Sarto shows one trip's stops (tens, not hundreds). Mapbox's `clusterRadius: 50` default solves a density problem we don't have. YAGNI until a marker count justifies it.
- **Icon family audit** — `lucide-react` is the only icon dep. Already single-family.

> **Branch:** continue on `feature/results-glowup-phase-a` (consistent with Phase B's plan, which also builds on it).

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/app/globals.css` | Add ratio + brand day-colour tokens; drop stale teal | Modify |
| `src/components/DayPhoto.tsx` | Accept `ratio` + `focus` instead of raw pixel `height` | Modify |
| `src/components/ItineraryMap.tsx` | Brand basemap style + brand `DAY_COLORS` | Modify |
| `src/components/InteractiveMap.tsx` | Brand basemap style | Modify |
| `src/components/DayCarousel.tsx` | `scroll-snap` + reduced-motion-safe hover lift | Modify |

---

## Task 1: `DayPhoto` — ratio-based sizing with focal points

**Files:** Modify `src/components/DayPhoto.tsx`, and its 5 callers.

Today `DayPhoto` takes `height = 180` and applies it via inline `style={{ height }}`. Callers pass four different values (`DayTimeline.tsx:207` → 164, `DayDetailPanel.tsx:161` → 200, `ItineraryClient.tsx:127,627` → 220, `DayCard.tsx:518` → 260). `object-cover` is already correct, so nothing is *distorted* — but nothing is *systematic* either, and centre-cropping decapitates subjects.

- [ ] **Step 1:** Add a `ratio` prop (`'3/2' | '16/9' | '1/1' | '4/5'`, default `'3/2'`) and a `focus` prop (`string`, default `'50% 50%'`, passed to `object-position`).
- [ ] **Step 2:** Replace `style={{ height }}` with `style={{ aspectRatio: ratio, objectPosition: focus }}` on the wrapper at `DayPhoto.tsx:46`. Keep `height` as a deprecated escape hatch **only** if a caller genuinely needs a fixed pixel box; prefer deleting it.
- [ ] **Step 3:** Migrate each of the 5 callers to a ratio. Carousel/day cards → `3/2`. Hotel card (`ItineraryClient.tsx:127`) → `3/2`. Hero → `16/9`.
- [ ] **Step 4:** Verify no layout jump — `aspect-ratio` reserves the box, so CLS should *improve*.

**Verify:** Load the results page. Every day-card photo is the same shape; no vertical-photo letterboxing; no cropped-off landmarks.

## Task 2: Retire the stale teal glow

**Files:** Modify the one file carrying `shadow-[0_0_32px_rgba(72,180,190,0.30)]`.

- [ ] **Step 1:** `grep -rn "72,180,190" src/` — this is a leftover from the pre-terracotta teal theme (see `docs/superpowers/specs/2026-06-04-global-teal-theme.md`, superseded).
- [ ] **Step 2:** Replace with `shadow-soft`, or a terracotta-tinted glow if the element genuinely needs emphasis.

**Verify:** No cyan glow remains on any warm surface.

## Task 3: Brand the map (highest visual payoff)

**Files:** Modify `src/components/ItineraryMap.tsx`, `src/components/InteractiveMap.tsx`, `src/app/globals.css`.

Two sub-problems. Do **3b first** — it's 10 lines and delivers most of the win.

### 3a — Basemap style

- [ ] **Step 1:** Both maps hardcode `mapStyle="mapbox://styles/mapbox/dark-v11"` (`ItineraryMap.tsx:308`, `InteractiveMap.tsx:355`). Create **one** custom style in Mapbox Studio, desaturated and tinted toward `--color-bg-deep` (`#091f36`), with low-contrast roads/labels so pins dominate.
- [ ] **Step 2:** Extract the style URL to a shared constant (e.g. `src/lib/mapStyle.ts`) so both maps can never drift apart again. Read it from `NEXT_PUBLIC_MAPBOX_STYLE_URL` with the stock dark-v11 as fallback, and add the var to `.env.local.example`.

> **Note:** This is the only task with an external dependency (a Studio style must be authored by a human). If that blocks, ship 3b alone — it stands on its own.

### 3b — Brand the day colours

- [ ] **Step 1:** `DAY_COLORS` (`ItineraryMap.tsx:70`) is a generic rainbow. Replace with a sequence derived from the `@theme` palette — terracotta `#b8552e`, sunrise `#e0a44b`, sunrise-deep `#b8772e`, brand `#9e363a`, etc. — chosen so **adjacent days are distinguishable** and every colour clears contrast against the dark basemap.
- [ ] **Step 2:** Promote the sequence to `globals.css` as `--color-day-1 … --color-day-N` so the "Day at a glance" list and the pins provably read from one source.
- [ ] **Step 3:** Confirm the sidebar list uses the same tokens — the list **is** the legend; if they diverge, the linkage breaks.

**Verify:** Screenshot the map. It should look like a Sarto surface, not an embedded widget.

## Task 4: Carousel motion

**Files:** Modify `src/components/DayCarousel.tsx`.

- [ ] **Step 1:** Add `scroll-snap-type: x mandatory` to the scroller and `scroll-snap-align: start` to each card. Pure CSS, no JS.
- [ ] **Step 2:** Add a hover lift — `transition: transform 200ms ease-out` + `translateY(-4px)` with a shadow step-up. **Gate behind `prefers-reduced-motion: reduce`** (`MotionProvider.tsx` exists — check whether it already exposes a hook to reuse rather than hand-rolling a media query).
- [ ] **Step 3:** Animate `transform` only — never `width`/`height`/`top`.

**Verify:** Carousel settles on card boundaries on trackpad and touch. Hover lift disappears with reduced-motion on.

---

## Sequencing

**T3b → T2 → T1 → T4 → T3a.** T3b is the loudest defect and the cheapest fix. T3a goes last because it's human-blocked on a Studio style.

## Definition of done

- [ ] Every `DayPhoto` renders at a declared ratio; zero pixel `height` props remain.
- [ ] `grep -rn "dark-v11" src/` returns zero hits (or one, in the fallback constant).
- [ ] `DAY_COLORS` contains no colour absent from `@theme`.
- [ ] `npm run build` passes (full `tsc` — per repo convention, a 200 from the dev server does **not** catch type errors).
