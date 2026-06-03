# SARTO-Style Results Page Redesign — Design Spec

**Date:** 2026-06-03
**Status:** Approved
**Scope:** Full redesign of the itinerary results page (ItineraryClient) to a SARTO-style light layout with day-card carousel, timeline-per-day, hotel selection card, and live map. All existing functionality preserved.

---

## Problem

The current `ItineraryClient.tsx` (2 062 lines) has two issues:
1. **UX:** Dark vertical-scroll layout is hard to navigate between days. No at-a-glance overview. Map is buried.
2. **Code:** One 2 000-line file that mixes state, handlers, sub-components, and render logic — hard for a new developer to work in.

---

## Goal

1. **Visual:** SARTO-inspired light teal layout — floating day cards, swipeable carousel, day detail with timeline + map, hotel selection card. Keep rotating destination-photo backgrounds.
2. **Architecture:** Extract all logic into `useItinerary` hook; split into focused sub-components. `ItineraryClient` becomes a thin orchestrator (~100 lines).

---

## Scope

### In scope
- New sticky `ItineraryHeader` (trip chips: dates · destination · hotel · group)
- `DayCarousel` — horizontal swipe carousel, one floating card per day
- `ItineraryDayCard` — day photo + bullet activities + nav dots/arrows
- `DayDetailPanel` — 2-col: `DayTimeline` left + `ItineraryMap` right
- `DayTimeline` — per-activity rows with contextual action buttons
- `HotelSelectionCard` — hotel options picker (replaces current BasecampSection in overview)
- `useItinerary` hook — all state + handlers extracted from ItineraryClient
- Color palette swap: dark `#091f36` overlay → light teal `rgba(180,228,222,0.82)`
- `ItineraryClient.tsx` gutted to thin orchestrator; all existing modals remain

### Out of scope
- Changes to `DraftOverview` (draft mode untouched)
- Changes to `SharePanel`, `QuickEdit`, `FeedbackSurveyModal`, `TripStoryCube`
- Changes to swap/API routes
- `ItineraryMap` component internals
- Weather live API (static placeholder copy only for now)
- Mobile swipe gestures (CSS scroll-snap is sufficient for v1)

---

## Architecture

### New file tree

```
src/
  hooks/
    useItinerary.ts              ← NEW — all state + handlers from ItineraryClient
  components/
    ItineraryHeader.tsx          ← NEW — sticky teal header with trip chips
    DayCarousel.tsx              ← NEW — horizontal carousel container + nav arrows
    ItineraryDayCard.tsx         ← NEW — single floating day card
    DayDetailPanel.tsx           ← NEW — 2-col orchestrator: timeline + map
    DayTimeline.tsx              ← NEW — per-activity timeline rows
    HotelSelectionCard.tsx       ← NEW — hotel options below carousel
    ItineraryClient.tsx          ← MODIFIED — thin orchestrator only (~100 lines)
```

Existing files **not modified**: `DayCard.tsx`, `DayPhoto.tsx`, `QuickEdit.tsx`,
`SharePanel.tsx`, `LogisticsDashboard.tsx`, `DraftOverview.tsx`, `TrendingTicker.tsx`,
`TripStoryCube.tsx`, `FeedbackSurveyModal.tsx`, `ItineraryMap.tsx`, `TransportCard.tsx`.

---

## `useItinerary` Hook

### Signature

```typescript
// src/hooks/useItinerary.ts
export interface UseItineraryOptions {
  initialItinerary: Itinerary;
  initialProfile: TravelerProfile | null;
  initialViewMode?: 'draft' | 'final';
  initialTransportFromDb?: CityTransportGuide | null;
  initialTripSummaryUsername?: string | null;
}

export interface UseItineraryReturn {
  // Data
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  displayCityTransport: CityTransportGuide | null;
  basecampMarker: { lat: number; lng: number; label: string } | null;
  tripDatesLabel: string | null;

  // View state
  viewMode: 'draft' | 'final';
  setViewMode: (m: 'draft' | 'final') => void;
  selectedDayIndex: number;          // 0-based
  setSelectedDayIndex: (i: number) => void;

  // Background slideshow
  bgIdx: number;

  // Edit
  editBanner: string;

  // Hotel detail popover
  expandedHotel: HotelRecommendation | null;
  setExpandedHotel: (h: HotelRecommendation | null) => void;

  // Map
  focusedNeighborhood: string | undefined;
  mobileMapOpen: boolean;
  setMobileMapOpen: (v: boolean) => void;
  handleNeighborhoodClick: (n: string) => void;

  // Trip Story
  tripStoryOpen: boolean;
  setTripStoryOpen: (v: boolean) => void;

  // Feedback
  feedbackOpen: boolean;
  handleFeedbackDismiss: () => void;
  handleFeedbackSubmit: (p: FeedbackPayload) => void;

  // Share
  shareOpen: boolean;
  setShareOpen: (v: boolean) => void;
  sharePanelCopy: SharePanelCopy | null;

  // Activity actions
  persistAndSet: (next: Itinerary) => void;
  handleSwapActivity: (dayIdx: number, slot: string, data: SwapResult) => void;
  handleDraftUpdate: (updated: Itinerary) => void;
}

export function useItinerary(opts: UseItineraryOptions): UseItineraryReturn
```

### What moves into the hook

All `useState`, `useEffect`, `useRef`, `useMemo`, `useCallback` calls currently at
the top of `export function ItineraryClient(…)` — specifically:

| State | Type | Notes |
|---|---|---|
| `itinerary` | `Itinerary` | writable |
| `viewMode` | `'draft' \| 'final'` | |
| `selectedDayIndex` | `number` | NEW — replaces implicit day-0 assumption |
| `bgIdx` | `number` | slideshow interval |
| `editBanner` | `string` | 5 s timeout |
| `mobileMapOpen` | `boolean` | |
| `focusedNeighborhood` | `string \| undefined` | |
| `tripStoryOpen` | `boolean` | |
| `feedbackOpen` | `boolean` | timed 40–50 s |
| `shareOpen` | `boolean` | |
| `expandedHotel` | `HotelRecommendation \| null` | |
| `displayCityTransport` | derived | `useMemo` |
| `basecampMarker` | derived | `useMemo` |

---

## Component Specs

### `ItineraryClient.tsx` (after refactor)

```tsx
export function ItineraryClient(props: Props) {
  const itin = useItinerary(props);

  if (itin.viewMode === 'draft') {
    return <DraftOverview itinerary={itin.itinerary} onUpdate={itin.handleDraftUpdate}
                          onFinalize={() => itin.setViewMode('final')} ui={itin.ui} />;
  }

  return (
    <div className="min-h-screen relative" dir={itin.ui.dir} lang={itin.ui.htmlLang}>
      <RotatingBackground bgIdx={itin.bgIdx} />         {/* inline, no extraction needed */}
      <TealOverlay />                                    {/* new light overlay */}
      <ItineraryHeader itin={itin} />
      {itin.selectedDayIndex === -1
        ? (
          // Overview — inline in ItineraryClient, no separate component needed
          <>
            <DayCarousel ... />
            <HotelSelectionCard ... />
            <LogisticsDashboard ... />   {/* existing */}
            <TransportCard ... />        {/* existing */}
            <TrendingTicker ... />       {/* existing */}
          </>
        )
        : <DayDetailPanel itin={itin} />}

      {/* Existing modals — unchanged */}
      <AnimatePresence>{itin.editBanner && <EditBanner msg={itin.editBanner} />}</AnimatePresence>
      <AnimatePresence>{itin.shareOpen && <SharePanel ... />}</AnimatePresence>
      <AnimatePresence>{itin.expandedHotel && <HotelDetailCube ... />}</AnimatePresence>
      <AnimatePresence>{itin.tripStoryOpen && <TripStoryCube ... />}</AnimatePresence>
      <AnimatePresence>{itin.feedbackOpen && <FeedbackSurveyModal ... />}</AnimatePresence>
      <AnimatePresence>{itin.mobileMapOpen && <MobileMapOverlay ... />}</AnimatePresence>
    </div>
  );
}
```

`selectedDayIndex === -1` means Overview mode; any value ≥ 0 means Day Detail mode.

---

### `ItineraryHeader.tsx`

**Layout:** Sticky top, `z-50`, height 56px.

```
[ TravelOS ]  [ 📅 15–22 Oct ]  [ 📍 Rome ]  [ 🏨 Hotel Indigo ]  [ 👥 2 Adults ]    [ Share ↗ ]
```

**Props:**
```typescript
interface ItineraryHeaderProps {
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  onShareOpen: () => void;
  onBackToOverview: () => void;   // shown only when selectedDayIndex >= 0
  selectedDayIndex: number;
}
```

**Styles:**
- `background: #5aada5`
- Chips: `background: rgba(255,255,255,0.18)`, `border: 1px solid rgba(255,255,255,0.25)`, `border-radius: 999px`, `font-size: 12px`, `color: #fff`
- "← Overview" back-link appears on left when in day-detail view

---

### `DayCarousel.tsx`

Renders the overview: section label + left/right nav arrows + scroll container + `HotelSelectionCard` below.

**Props:**
```typescript
interface DayCarouselProps {
  days: DayPlan[];
  selectedDayIndex: number;
  onSelectDay: (idx: number) => void;
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  onExpandHotel: (h: HotelRecommendation) => void;
}
```

**Scroll container:**
```css
display: flex;
gap: 16px;
overflow-x: auto;
scroll-snap-type: x mandatory;
scrollbar-width: none;
padding: 12px 4px 20px;
```

Nav arrows: absolute-positioned `◁` / `▷` buttons calling `carousel.scrollBy({ left: ±360, behavior: 'smooth' })`.

---

### `ItineraryDayCard.tsx`

A single floating day card in the carousel.

**Props:**
```typescript
interface ItineraryDayCardProps {
  day: DayPlan;
  dayNumber: number;          // 1-based
  isActive: boolean;
  totalDays: number;
  destination: string;
  onClick: () => void;
}
```

**Structure:**
```
┌────────────────────────────────────┐
│  DAY 1                Welcome to   │  ← header row
│                          Rome!     │
├────────────────────────────────────┤
│                                    │
│         [DayPhoto]  190px          │  ← existing DayPhoto component
│                                    │
├────────────────────────────────────┤
│  • Check-in to Hotel Indigo        │  ← bullets: first 3 activities
│  • Ancient Rome walking tour       │    derived from morning/afternoon/evening
│  • Welcome Dinner in Trastevere    │
├────────────────────────────────────┤
│  ● ○ ○ ○        ←  →              │  ← dots + arrows
└────────────────────────────────────┘
```

**Styles:**
- `min-width: 340px`, `max-width: 360px`
- `background: #fff`, `border-radius: 20px`
- Shadow: `0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)`
- Hover: `translateY(-4px)`, deeper shadow
- `scroll-snap-align: center`

**Bullet derivation:**
```typescript
const bullets = [
  day.morning?.name,
  day.afternoon?.name,
  day.evening?.name,
].filter(Boolean).slice(0, 3);
```

---

### `DayDetailPanel.tsx`

Two-column layout (desktop). Stacked on mobile (`< 768px`).

**Props:**
```typescript
interface DayDetailPanelProps {
  day: DayPlan;
  dayIndex: number;
  totalDays: number;
  destination: string;
  profile: TravelerProfile | null;
  itin: UseItineraryReturn;
}
```

**Layout:**
```
┌──────────────────────────┬──────────────────────┐
│  [DayPhoto 200px]        │                      │
│  [Weather widget]        │   ItineraryMap       │
│  [DayTimeline]           │   (existing)         │
└──────────────────────────┴──────────────────────┘
│  ← Back to Overview  |  Edit Summary  |  Share  │
```

**Day navigation:** Previous/Next arrows above the content let the user advance through days without going back to overview.

**Weather widget (static):**
```typescript
// v1: static placeholder — no live weather API
// copy: "Typical weather for [month] in [destination]"
// icon: ☀️ / ⛅ based on month (Northern Hemisphere heuristic)
```

---

### `DayTimeline.tsx`

Per-activity list for one day.

**Props:**
```typescript
interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  onSwap: (slot: string) => void;    // triggers existing QuickEdit/swap flow
  onNeighborhoodClick: (n: string) => void;
  ui: ItineraryUiStrings;
}
```

**Activity row:**
```
09:00  [🏨]  Hotel Check-in
             [ Hotel Details ]  [ Change Hotel ]
```

**Slot → emoji mapping (reuse existing `category_emoji` when present):**
```typescript
const SLOT_EMOJI: Record<string, string> = {
  morning:   '☀️',
  afternoon: '🌤',
  evening:   '🌙',
};
```

**Contextual action buttons by activity tags/slot:**

| Condition | Buttons |
|-----------|---------|
| slot=`morning` AND hotel check-in keyword | Hotel Details · Change Hotel |
| tags include `food` OR `restaurant` OR slot is `lunch`/`dinner` | View Menu · Reservation · Find Alternative |
| `isHiddenGem === true` | 💎 Hidden Gem badge (display only) |
| default activity | Explore Details · Modify Time |

"Find Alternative" and "Modify Time" wire into the existing `onSwap` callback which opens `QuickEdit`.

**Dining spots** (`day.lunch`, `day.dinner`) rendered as separate rows. The `DiningSpot` name, cuisine, and price-range are shown; no alternatives dropdown in v1 (the "Find Alternative" button triggers the existing swap/QuickEdit flow instead).

---

### `HotelSelectionCard.tsx`

Shown below the carousel in overview mode. Replaces `BasecampSection`.

**Props:**
```typescript
interface HotelSelectionCardProps {
  basecamp: Basecamp;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  onExpandHotel: (h: HotelRecommendation) => void;
}
```

**Layout:** Teal header bar + 3 hotel columns (or `< 3` if fewer recommendations).

```
┌─ 🏨 Your Accommodation ─────── 3 options found ─┐
│  [Hotel Indigo ✓]  [Budget Option]  [Luxury]     │
│  ★★★★☆             ★★★★☆             ★★★★★      │
│  Centro Storico    Termini           Popolo        │
│  €185/night        €48/night         €420/night    │
└──────────────────────────────────────────────────┘
```

Selected hotel highlighted (`background: #e8f4f2`).
Clicking any hotel opens the existing `HotelDetailCube` modal.

When `basecamp.type === 'booked'` (user already has a hotel), show that hotel in slot 1 marked "Your Hotel" — no change button.
When `basecamp.type === 'ai-recommended'`, show AI picks with "Change Hotel" affordance.

---

## Visual Design

### Color overlay change

**Before:** `linear-gradient(170deg, rgba(18,52,59,0.85) …)` (dark teal)
**After:** `rgba(180, 228, 222, 0.82)` solid light-teal wash over the rotating photo

The rotating photo background (`STEP_BACKGROUNDS`, existing) is **unchanged** — still crossfades every 8 s. Only the overlay color changes.

### Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--teal` | `#5aada5` | Header, primary buttons, accents |
| `--teal-dark` | `#3a8a82` | Hover states, text on light bg |
| `--teal-light` | `#e8f4f2` | Button backgrounds, card badges |
| `--card-bg` | `#ffffff` | Day cards, timeline card, hotel card |
| `--card-shadow` | `0 8px 32px rgba(0,0,0,0.12)` | All floating cards |
| `--text-primary` | `#222222` | Card headings |
| `--text-secondary` | `#666666` | Card sub-text |
| `--overlay` | `rgba(180,228,222,0.82)` | Background color wash |

### Typography

| Element | Size | Weight |
|---------|------|--------|
| Header brand | 18px | 900 |
| Day number (DAY 1) | 20px | 900 |
| Day title | 16px | 700 |
| Timeline activity name | 13px | 700 |
| Timeline time | 13px | 700, `#5aada5` |
| Action buttons | 11px | 600 |
| Section label | 11px | 700, uppercase, tracked |

### Responsive breakpoints

| Breakpoint | Behaviour |
|------------|-----------|
| `≥ 900px` | 2-col detail (timeline + map side by side) |
| `< 900px` | stacked — map below timeline |
| `< 600px` | carousel shows 1 card at a time; hotel card stacks vertically |

---

## Data Flow

```
ItineraryClient
  └── useItinerary(opts) → itin
        │
        ├── itin.selectedDayIndex === -1  → Overview
        │     ├── DayCarousel
        │     │     └── ItineraryDayCard × N
        │     └── HotelSelectionCard
        │
        └── itin.selectedDayIndex >= 0   → Day Detail
              └── DayDetailPanel
                    ├── DayPhoto (existing)
                    ├── WeatherWidget (static)
                    ├── DayTimeline
                    │     └── onSwap → QuickEdit (existing)
                    └── ItineraryMap (existing)
```

---

## Preserving Existing Functionality

| Feature | Current home | After refactor |
|---------|-------------|----------------|
| QuickEdit / swap activity | inline in ItineraryClient | `onSwap` prop in `DayTimeline` → same handler from `useItinerary` |
| HotelDetailCube (hotel modal) | inline in ItineraryClient | stays inline, triggered via `itin.expandedHotel` |
| SharePanel | inline in ItineraryClient | stays inline, triggered via `itin.shareOpen` |
| FeedbackSurveyModal | inline in ItineraryClient | stays inline, triggered via `itin.feedbackOpen` |
| TripStoryCube | inline in ItineraryClient | stays inline, triggered via `itin.tripStoryOpen` |
| MobileMapOverlay | inline in ItineraryClient | stays inline, triggered via `itin.mobileMapOpen` |
| DraftOverview | rendered by ItineraryClient | stays — gated by `viewMode === 'draft'` |
| LogisticsDashboard / TransportCard | rendered in final view | rendered inside `OverviewView` below `HotelSelectionCard` |
| TrendingTicker | rendered in final view | stays in `OverviewView` |
| Budget summary | rendered in final view | stays in `OverviewView` |

Nothing is deleted — all existing code is reorganised, not removed.

---

## Files Changed Summary

| File | Action | Reason |
|------|--------|--------|
| `src/hooks/useItinerary.ts` | **CREATE** | Extract all state + handlers |
| `src/components/ItineraryHeader.tsx` | **CREATE** | New sticky header |
| `src/components/DayCarousel.tsx` | **CREATE** | Overview carousel container |
| `src/components/ItineraryDayCard.tsx` | **CREATE** | Single day floating card |
| `src/components/DayDetailPanel.tsx` | **CREATE** | Day detail 2-col layout |
| `src/components/DayTimeline.tsx` | **CREATE** | Activity timeline |
| `src/components/HotelSelectionCard.tsx` | **CREATE** | Hotel options below carousel |
| `src/components/ItineraryClient.tsx` | **REWRITE** | Thin orchestrator (~100 lines) |

**No other files are modified.** All existing components, APIs, stores, and routes stay as-is.

---

## Testing

No new test files required for this redesign (pure UI refactor, no new business logic).
Existing manual smoke-test checklist:

1. Overview loads — carousel shows all days
2. Click a day card → switches to detail view
3. "← Back to Overview" returns to carousel
4. QuickEdit opens from timeline "Modify Time" button
5. "Find Alternative" triggers swap flow correctly
6. Share panel opens from header Share button
7. Hotel card shows recommendations; clicking opens HotelDetailCube modal
8. Background photo crossfade still works
9. Mobile: timeline and map stack vertically; carousel is single-card
10. Draft mode (`initialViewMode="draft"`) still renders DraftOverview unchanged
