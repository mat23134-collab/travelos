# Mobile Responsive Fixes — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Targeted CSS/layout fixes across 6 components to make the SARTO-style results page fully usable on mobile (375px–430px screens).

---

## Problem

The SARTO-style results page was built and tested at desktop width. Several components break or degrade badly on mobile:

1. `DayCarousel` — 48px side padding leaves no room for 340px-wide cards on a 375px screen
2. `ItineraryDayCard` — fixed `minWidth: 340` overflows all narrow viewports
3. `ItineraryClient` overview — `mx-12` (48px each side) leaves only 279px content width on 375px
4. `ItineraryHeader` — chips + action buttons in one row overflow on mobile
5. `HotelSelectionCard` — 3 columns of hotels are ~93px each, unreadable
6. `DayDetailPanel` — map with `minHeight: 480` takes the whole screen; timeline is hidden below

---

## Goal

Every page section must be readable and usable on a 375px screen without horizontal scroll, overflow, or hidden content.

---

## Scope

### In scope
- `src/components/ItineraryDayCard.tsx` — responsive minWidth
- `src/components/DayCarousel.tsx` — reduced mobile padding, hide nav arrows on mobile
- `src/components/ItineraryHeader.tsx` — 2-row layout on mobile
- `src/components/HotelSelectionCard.tsx` — single column on mobile
- `src/components/DayDetailPanel.tsx` — hide map on mobile, show map button
- `src/components/ItineraryClient.tsx` — replace `mx-12` with `mx-3 sm:mx-12`

### Out of scope
- Onboarding flow mobile fixes (separate task)
- Loading screen mobile (already mobile-first)
- Touch swipe gestures on carousel (CSS scroll-snap is sufficient)
- Bottom navigation bar (not in scope for this sprint)

---

## Fix 1: `ItineraryDayCard` — Responsive card width

**File:** `src/components/ItineraryDayCard.tsx`

Change fixed `minWidth: 340` to a responsive value using CSS `min()`:

```typescript
// Before
minWidth: 340,
maxWidth: 360,

// After
minWidth: 'min(340px, calc(100vw - 80px))',
maxWidth: 'min(360px, calc(100vw - 64px))',
```

On a 375px screen: `min(340, 375-80) = min(340, 295) = 295px` wide card — fits perfectly.
On a 768px+ screen: `min(340, 688) = 340px` — unchanged.

---

## Fix 2: `DayCarousel` — Mobile-friendly layout

**File:** `src/components/DayCarousel.tsx`

**Padding:** Change `px-12` to `px-3 sm:px-12`. On mobile, only 12px side padding is needed since there are no nav arrows.

**Nav arrows:** Hide on mobile. Arrows are not needed when touch scroll works.
```tsx
// NavArrow component: add hidden sm:flex to className
className="hidden sm:flex absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full ..."
```

**Gap:** Change `gap-4` to `gap-3 sm:gap-4` — slightly tighter on mobile.

---

## Fix 3: `ItineraryHeader` — 2-row mobile layout

**File:** `src/components/ItineraryHeader.tsx`

On mobile, the single-row layout `[brand][chips][actions]` overflows. Replace with:

```
Desktop (sm+):  [ TravelOS | ← Overview ]  [ chips scrollable ]  [ Share | New Trip ]
Mobile:         Row 1: [ TravelOS | ← Overview ]       [ Share | New Trip ]
                Row 2: [ chips — horizontal scroll    ]
```

Implementation:
- Wrap the nav content in `flex flex-col sm:flex-row`
- Row 1 (`flex items-center justify-between`): Brand + back button on left, Share + New Trip on right
- Row 2 (`sm:hidden` — only on mobile, or `sm:flex-1` on desktop): chips horizontal scroll
- Hide "Draft" and "Scout Picks" buttons on mobile (`hidden sm:inline-flex`)
- Header height: `h-auto py-2 sm:h-14 sm:py-0`

---

## Fix 4: `HotelSelectionCard` — Single column on mobile

**File:** `src/components/HotelSelectionCard.tsx`

The hotel columns grid currently uses `gridTemplateColumns: repeat(N, 1fr)` inline. Replace with responsive Tailwind:

```tsx
// Before: inline style gridTemplateColumns
// After: use className with responsive grid
<div className={`grid divide-x divide-black/[0.06] sm:grid-cols-${hotels.length} grid-cols-1 divide-y sm:divide-y-0`}>
```

On mobile: hotels stack vertically, each full-width row, separated by horizontal dividers.
On desktop (sm+): existing side-by-side columns.

If `hotels.length` is dynamic (1-3), use a Tailwind safelist or inline style only for `sm:` width:
```tsx
<div
  className="grid grid-cols-1 sm:divide-x divide-y sm:divide-y-0"
  style={{ ['--sm-cols' as string]: hotels.length }}
>
```
Simpler approach: always render `sm:grid-cols-3` and let it auto-fit.

Concrete implementation: Replace the current inline `gridTemplateColumns` style with:
```tsx
className="grid grid-cols-1 sm:grid-cols-3"
style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}
```
And add a bottom border to each `HotelColumn` on mobile:
```tsx
// HotelColumn: add border-b sm:border-b-0 border-black/[0.06]
className="p-4 transition-colors group border-b sm:border-b-0 last:border-b-0"
style={{ borderColor: 'rgba(0,0,0,0.06)' }}
```

---

## Fix 5: `DayDetailPanel` — Map hidden on mobile

**File:** `src/components/DayDetailPanel.tsx`

The 2-column grid (`grid-cols-1 sm:grid-cols-2`) already stacks on mobile, but the map column still renders below the timeline, taking 480px height — too tall on small screens.

Solution: Hide the right-column map on mobile. Add a compact "View on Map" button below the timeline on mobile only.

```tsx
{/* Right: Map — hidden on mobile */}
<div className="hidden sm:block rounded-2xl overflow-hidden bg-white" ...>
  ...map...
</div>

{/* Mobile map trigger — shown only on mobile, below timeline */}
<div className="sm:hidden mt-3">
  <button
    type="button"
    onClick={onOpenMobileMap}
    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
    style={{ background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }}
  >
    🗺 View Day {dayIndex + 1} on Map
  </button>
</div>
```

Add `onOpenMobileMap: () => void` to `DayDetailPanelProps`. Wire it in `ItineraryClient` to call `itin.setMobileMapOpen(true)`.

---

## Fix 6: `ItineraryClient` — Overview section margins

**File:** `src/components/ItineraryClient.tsx`

Every section in the overview currently uses `mx-12` (3rem = 48px each side). On a 375px screen, this leaves only 279px of content width — too narrow.

Replace all `mx-12` with `mx-3 sm:mx-12` throughout the overview section:

Affected elements:
- `HotelSelectionCard` wrapper
- Budget summary `motion.div`
- Full trip map `section`
- Transport card `div`
- Packing tips `div`
- Best local tips `div`
- Logistics `div`
- Footer CTA `div`

Also the section label `<p>` text: change `py-3` to `px-4 py-3`.

---

## Breakpoints Used

| Class | Meaning |
|-------|---------|
| (no prefix) | mobile-first — applies to all sizes |
| `sm:` | ≥ 640px (tablet and up) |
| `hidden sm:block` | hidden on mobile, visible on tablet+ |
| `sm:hidden` | visible on mobile only |

---

## Files Changed Summary

| File | Action | Key change |
|------|--------|-----------|
| `src/components/ItineraryDayCard.tsx` | Modify | `min()` CSS function for responsive card width |
| `src/components/DayCarousel.tsx` | Modify | `px-3 sm:px-12`, hide NavArrow on mobile |
| `src/components/ItineraryHeader.tsx` | Modify | 2-row layout on mobile, hide secondary actions |
| `src/components/HotelSelectionCard.tsx` | Modify | `grid-cols-1 sm:grid-cols-3`, stacked on mobile |
| `src/components/DayDetailPanel.tsx` | Modify | `hidden sm:block` on map, add mobile map button |
| `src/components/ItineraryClient.tsx` | Modify | `mx-3 sm:mx-12` on all overview sections |

**No new files. No new components. No API changes.**
