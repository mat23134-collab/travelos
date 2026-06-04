# Mobile Responsive Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 components so the SARTO-style itinerary results page works correctly on 375px mobile screens without overflow, hidden content, or broken layouts.

**Architecture:** Pure CSS/layout fixes — Tailwind responsive prefixes (`sm:`), CSS `min()` function for fluid widths, and one new optional prop on DayDetailPanel for the mobile map trigger. No new components, no API changes, no logic changes.

**Tech Stack:** Tailwind CSS v4, Next.js 14, TypeScript, inline React styles.

---

## File Map

| File | Change |
|------|--------|
| `src/components/ItineraryDayCard.tsx` | Fluid card width using `min()` |
| `src/components/DayCarousel.tsx` | Reduced mobile padding, hidden nav arrows on mobile |
| `src/components/ItineraryHeader.tsx` | 2-row layout on mobile, hide secondary actions |
| `src/components/HotelSelectionCard.tsx` | Single column on mobile |
| `src/components/DayDetailPanel.tsx` | Hide map on mobile + "View on Map" button |
| `src/components/ItineraryClient.tsx` | `mx-3 sm:mx-12` everywhere + wire mobile map |

---

## Task 1: ItineraryDayCard + DayCarousel — fluid widths

**Files:**
- Modify: `src/components/ItineraryDayCard.tsx`
- Modify: `src/components/DayCarousel.tsx`

- [ ] **Step 1: Fix ItineraryDayCard — responsive minWidth/maxWidth**

In `src/components/ItineraryDayCard.tsx`, find the `style` object on the `motion.div` (around line 50):

```typescript
// BEFORE
style={{
  minWidth: 340,
  maxWidth: 360,
  scrollSnapAlign: 'center',
  ...
}}
```

Change to:
```typescript
// AFTER
style={{
  minWidth: 'min(340px, calc(100vw - 80px))',
  maxWidth: 'min(360px, calc(100vw - 64px))',
  scrollSnapAlign: 'center',
  ...
}}
```

On 375px: `min(340, 375-80) = min(340, 295) = 295px` → card fits perfectly.
On 768px+: `min(340, 688) = 340px` → unchanged.

- [ ] **Step 2: Fix DayCarousel — padding + hide arrows on mobile**

In `src/components/DayCarousel.tsx`, make these 3 changes:

**Change 1** — wrapper padding: `px-12` → `px-3 sm:px-12`
```tsx
// BEFORE
<div className="relative px-12 py-2">

// AFTER
<div className="relative px-3 sm:px-12 py-2">
```

**Change 2** — scroll gap: `gap-4` → `gap-3 sm:gap-4`
```tsx
// BEFORE
className="flex gap-4 overflow-x-auto pb-4 pt-1 [&::-webkit-scrollbar]:hidden"

// AFTER
className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 [&::-webkit-scrollbar]:hidden"
```

**Change 3** — NavArrow: add `hidden sm:flex` to its className:
```tsx
// BEFORE
className="absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition-all hover:scale-110"

// AFTER
className="hidden sm:flex absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full items-center justify-center text-base font-bold transition-all hover:scale-110"
```

- [ ] **Step 3: Type-check**

```bash
cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
npx tsc --noEmit 2>&1 | head -10
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ItineraryDayCard.tsx src/components/DayCarousel.tsx
git commit -m "fix(mobile): responsive card width, hide carousel arrows on mobile"
```

---

## Task 2: ItineraryHeader — 2-row mobile layout

**Files:**
- Modify: `src/components/ItineraryHeader.tsx`

- [ ] **Step 1: Replace nav content with 2-row layout**

Replace the entire `<nav>` element (from `<nav` to the closing `</nav>`) with:

```tsx
<nav
  className={`sticky z-50 print:hidden transition-all ${editBanner ? 'top-10' : 'top-0'}`}
  style={{ background: '#5aada5', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
>
  {/* ── Row 1: Brand + Back + Actions ─────────────────────────────────── */}
  <div className="flex items-center gap-2 px-4 sm:px-6 h-12 sm:h-14">
    {/* Back to overview (day-detail only) */}
    {selectedDayIndex >= 0 && (
      <motion.button
        onClick={onBackToOverview}
        whileTap={{ scale: 0.93 }}
        className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-semibold transition-colors flex-shrink-0"
      >
        ←
      </motion.button>
    )}

    {/* Brand */}
    <Link href="/" className="flex-shrink-0">
      <BrandWordmark accent="rgba(255,255,255,0.9)" className="text-base text-white" />
    </Link>

    {/* Desktop chips — inline on sm+ */}
    <div className="hidden sm:flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none min-w-0">
      {dateLabel && <Chip>📅 {dateLabel}</Chip>}
      {dest && <Chip>📍 {dest}</Chip>}
      {hotelLabel && <Chip>🏨 {hotelLabel}</Chip>}
      {groupLabel && <Chip>👥 {groupLabel}</Chip>}
    </div>

    {/* Spacer on mobile (chips move to row 2) */}
    <div className="flex-1 sm:hidden" />

    {/* Actions */}
    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
      {/* Draft button — desktop only */}
      {initialViewMode !== 'final' && onBackToDraft && (
        <motion.button
          onClick={onBackToDraft}
          whileTap={{ scale: 0.92 }}
          className="hidden sm:inline-flex text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white hover:border-white/50 transition-colors"
        >
          {ui.draft}
        </motion.button>
      )}
      <SharePanel
        itinerary={itinerary}
        profile={profile}
        itineraryDbId={itinerary._id ?? null}
        accessToken={session?.access_token ?? null}
        copy={shareCopy}
      />
      {/* Scout picks — desktop only */}
      {isAdmin && dest && (
        <Link
          href={`/explore/${encodeURIComponent(dest)}`}
          className="hidden sm:inline-flex text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
        >
          {ui.scoutPicks}
        </Link>
      )}
      <Link
        href="/onboarding"
        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
      >
        {ui.newTrip}
      </Link>
    </div>
  </div>

  {/* ── Row 2: Chips — mobile only ──────────────────────────────────────── */}
  <div className="sm:hidden flex items-center gap-2 px-4 pb-2 overflow-x-auto scrollbar-none">
    {dateLabel && <Chip>📅 {dateLabel}</Chip>}
    {dest && <Chip>📍 {dest}</Chip>}
    {hotelLabel && <Chip>🏨 {hotelLabel}</Chip>}
    {groupLabel && <Chip>👥 {groupLabel}</Chip>}
  </div>
</nav>
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "ItineraryHeader" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItineraryHeader.tsx
git commit -m "fix(mobile): ItineraryHeader 2-row layout, hide secondary actions"
```

---

## Task 3: HotelSelectionCard — single column on mobile

**Files:**
- Modify: `src/components/HotelSelectionCard.tsx`

- [ ] **Step 1: Replace flex columns with responsive grid**

In `src/components/HotelSelectionCard.tsx`, find the hotel columns container (around line 118):

```tsx
// BEFORE
<div className="bg-white flex divide-x divide-black/[0.06]">
  {displayHotels.map((hotel, i) => (
    <HotelColumn ... />
  ))}
</div>
```

Replace with:
```tsx
// AFTER
<div className="bg-white grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06]">
  {displayHotels.map((hotel, i) => (
    <HotelColumn ... />
  ))}
</div>
```

When `displayHotels.length < 3`, the empty grid cells are fine — they just render nothing.

- [ ] **Step 2: Verify HotelColumn has no fixed width**

Search for any `width`, `flex-1`, or `min-w` on `HotelColumn`:
```bash
grep -n "flex-1\|min-w\|width" src/components/HotelSelectionCard.tsx | head -10
```

If `HotelColumn` has `flex: 1`, remove it — in a grid layout, `flex: 1` is ignored but it's cleaner to remove.

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HotelSelectionCard.tsx
git commit -m "fix(mobile): HotelSelectionCard stacks vertically on mobile"
```

---

## Task 4: DayDetailPanel — hide map on mobile + map button

**Files:**
- Modify: `src/components/DayDetailPanel.tsx`

- [ ] **Step 1: Add `onOpenMobileMap` prop**

In `src/components/DayDetailPanel.tsx`, add to `DayDetailPanelProps` interface:
```typescript
onOpenMobileMap?: () => void;
```

And destructure it in the function signature:
```typescript
export function DayDetailPanel({
  ..., onBackToOverview, onOpenMobileMap,
}: DayDetailPanelProps) {
```

- [ ] **Step 2: Hide map on mobile, show "View on Map" button**

Find the Right column (map) div. It currently starts with:
```tsx
{/* Right: Map */}
<div
  className="rounded-2xl overflow-hidden bg-white"
  style={{ boxShadow: '...', minHeight: 480 }}
>
```

**Change 1** — Add `hidden sm:block` to hide map on mobile:
```tsx
<div
  className="hidden sm:block rounded-2xl overflow-hidden bg-white"
  style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minHeight: 480 }}
>
```

**Change 2** — Add mobile map button below the timeline in the Left column.
Find the closing `</div>` of the left flex column (after `<DayTimeline ... />`). Add this AFTER DayTimeline but still INSIDE the left column div:

```tsx
{/* Mobile map button — sm:hidden */}
{onOpenMobileMap && (
  <button
    type="button"
    onClick={onOpenMobileMap}
    className="sm:hidden w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
    style={{ background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }}
  >
    🗺 View Day {dayIndex + 1} on Map
  </button>
)}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -10
```

Expected: no errors from DayDetailPanel. There may be a new error in ItineraryClient about missing `onOpenMobileMap` — that's fine, fixed in Task 5.

- [ ] **Step 4: Commit**

```bash
git add src/components/DayDetailPanel.tsx
git commit -m "fix(mobile): hide map on mobile, add View on Map button"
```

---

## Task 5: ItineraryClient — margins + wire mobile map

**Files:**
- Modify: `src/components/ItineraryClient.tsx`

- [ ] **Step 1: Replace all `mx-12` with `mx-3 sm:mx-12` in overview section**

Find every occurrence of `mx-12` in the overview section of ItineraryClient (the section after `DayCarousel` and `HotelSelectionCard`, approximately lines 1388–1470). Replace ALL 6 occurrences:

```
Line ~1393: className="mx-12 mb-6 rounded-3xl ...  → "mx-3 sm:mx-12 mb-6 rounded-3xl ..."
Line ~1403: className="mx-12 mb-6 hidden sm:block  → "mx-3 sm:mx-12 mb-6 hidden sm:block ..."
Line ~1414: className="mx-12 mb-6"                 → "mx-3 sm:mx-12 mb-6"
Line ~1427: className="mx-12 mb-6 rounded-2xl ...  → "mx-3 sm:mx-12 mb-6 rounded-2xl ..."
Line ~1443: className="mx-12 mb-6 rounded-2xl ...  → "mx-3 sm:mx-12 mb-6 rounded-2xl ..."
Line ~1458: className="mx-12 mb-6"                 → "mx-3 sm:mx-12 mb-6"
Line ~1463: className="text-center py-8 mx-12 ...  → "text-center py-8 mx-3 sm:mx-12 ..."
```

Use a search-and-replace: in the overview section (between the `DayCarousel` block and the closing `</div>`), replace every `mx-12` with `mx-3 sm:mx-12`.

Also fix the section label `<p>`:
```tsx
// BEFORE
<p className="text-center text-[11px] font-bold uppercase tracking-[0.12em] py-3"

// AFTER
<p className="text-center text-[11px] font-bold uppercase tracking-[0.12em] px-4 py-3"
```

- [ ] **Step 2: Pass `onOpenMobileMap` to DayDetailPanel**

Find the `<DayDetailPanel` JSX block and add the new prop after `onBackToOverview`:

```tsx
onBackToOverview={() => itin.setSelectedDayIndex(-1)}
onOpenMobileMap={() => itin.setMobileMapOpen(true)}
```

- [ ] **Step 3: Final type-check — must be ZERO errors**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: **zero TypeScript errors**.

- [ ] **Step 4: Run all tests**

```bash
npx tsx src/components/DayTimeline.test.ts
npx tsx src/lib/formatTripDateRange.test.ts
npx tsx src/components/ItineraryDayCard.test.ts
```

All must pass.

- [ ] **Step 5: Commit and push**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "fix(mobile): mx-3 sm:mx-12 on overview sections, wire mobile map from DayDetailPanel"
git push origin master
```

---

## Self-Review

**Spec coverage:**
- [x] `ItineraryDayCard` fluid width → Task 1
- [x] `DayCarousel` reduced padding + hidden arrows → Task 1
- [x] `ItineraryHeader` 2-row mobile layout → Task 2
- [x] `ItineraryHeader` Draft + Scout hidden on mobile → Task 2
- [x] `HotelSelectionCard` single column on mobile → Task 3
- [x] `DayDetailPanel` map hidden on mobile → Task 4
- [x] `DayDetailPanel` mobile map button → Task 4
- [x] `ItineraryClient` `mx-3 sm:mx-12` everywhere → Task 5
- [x] `onOpenMobileMap` wired from ItineraryClient → DayDetailPanel → Task 5

**Type consistency:**
- `onOpenMobileMap?: () => void` — optional prop, added to interface in Task 4, passed in Task 5 ✓
- No new types introduced ✓

**No placeholders:** All steps contain exact code diffs ✓
