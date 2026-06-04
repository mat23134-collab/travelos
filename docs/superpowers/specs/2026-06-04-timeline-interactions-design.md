# Timeline Interactions — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Wire 3 interactive features on the DayTimeline: Google Maps navigation, PlaceDetailCube modal, and Find Alternative panel with 2 AI proposals + free text.

---

## Problem

The DayTimeline rows in the new SARTO results page show action buttons that don't work:
- **"Explore Details"** — button exists, nothing happens
- **"Find Alternative"** — dining rows are silently no-op; activity rows call swap immediately with no user review
- **No navigation** — no way to get directions to a place

---

## Goal

1. **Navigate button** — open Google Maps directions from current location on every timeline row
2. **PlaceDetailCube** — floating modal showing place info + "why we chose this" when Explore Details is clicked
3. **Find Alternative panel** — show 2 AI proposals + free-text fallback; user picks before committing

---

## Scope

### In scope
- `src/components/PlaceDetailCube.tsx` (NEW)
- `src/components/AlternativePickerPanel.tsx` (NEW)
- `src/components/DayTimeline.tsx` (MODIFY — add navigate link, onExplore, onFindAlternative)
- `src/components/DayDetailPanel.tsx` (MODIFY — own state for PlaceDetailCube + AlternativePickerPanel)
- `src/app/api/swap/route.ts` (MODIFY — add `proposalsOnly: true, count: 2` mode)
- `src/lib/prompts.ts` (MODIFY — add `buildProposalsPrompt` that returns 2 activities)

### Out of scope
- Backend reservation / booking
- Live restaurant availability check
- Hebrew translation of new copy
- Mobile-specific swipe gestures on the panel

---

## Architecture

```
DayDetailPanel
  ├── state: activePlace: TimelineRow | null       → controls PlaceDetailCube
  ├── state: activeSwap: SwapTarget | null         → controls AlternativePickerPanel
  │
  ├── DayTimeline
  │     ├── per row: <a Navigate>                  → Google Maps link (no state)
  │     ├── per row: onExplore(row)                → sets activePlace
  │     └── per row: onFindAlternative(row)        → sets activeSwap
  │
  ├── PlaceDetailCube (when activePlace !== null)
  │     └── onClose → clears activePlace
  │
  └── AlternativePickerPanel (when activeSwap !== null)
        ├── calls POST /api/swap with proposalsOnly:true → gets proposals[]
        └── onCommit(activity, summary) → calls handleCommitActivitySwap or handleSlotSwap
```

---

## Feature 1: Navigate Button

### Behavior

Every `TimelineItem` in `DayTimeline` gets a small blue "Navigate" link:
```
<a href="https://www.google.com/maps/dir/?api=1&destination=PLACE_NAME,+NEIGHBORHOOD,+CITY"
   target="_blank" rel="noopener noreferrer">
  📍 Navigate
</a>
```

### URL construction
```typescript
export function buildMapsDirectionsUrl(name: string, neighborhood: string | undefined, city: string): string {
  const dest = [name, neighborhood, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
```

Pure function — exported from `DayTimeline.tsx` for testing.

### Visual
- Small blue `<a>` tag matching the mockup: `background: #fff`, `border: 1px solid rgba(66,133,244,0.35)`, `color: #4285f4`
- Google Maps pin SVG icon (12×12) + text "Navigate"
- `target="_blank"` — opens in new tab

---

## Feature 2: PlaceDetailCube

### New file: `src/components/PlaceDetailCube.tsx`

Floating modal, same pattern as the existing `HotelDetailCube` in `ItineraryClient.tsx`.

### Props
```typescript
interface PlaceDetailCubeProps {
  row: TimelineRow;          // from DayTimeline.tsx
  destination: string;
  onClose: () => void;
}
```

### Layout
```
┌─────────────────────────────────────────────┐
│  [DayPhoto — "PLACE_NAME CITY landmark"]    │  ← 180px, dark overlay
│                                      [✕]    │
│  Vieux Lyon & Traboules                     │  ← name on photo
│  📍 Vieux Lyon                              │  ← neighborhood
├─────────────────────────────────────────────┤
│  💡 Why we chose this                        │  ← section label
│  "The authentic medieval heart of Lyon…"    │  ← whyThis ?? description ?? fallback
├─────────────────────────────────────────────┤
│  ⏱ 2h  ·  💰 Free  ·  ✓ Verified open      │  ← meta row
│  [tag] [tag] [tag]                          │
│  💎 Hidden Gem badge (if applicable)        │
├─────────────────────────────────────────────┤
│  [📍 Navigate ↗]     [🌐 Official site ↗]   │  ← footer actions
└─────────────────────────────────────────────┘
```

### Content resolution
| Field | Source | Fallback |
|-------|--------|---------|
| Name | `row.activity?.name ?? row.dining?.name` | `row.name` |
| Why/description | `row.activity?.whyThis` | `row.activity?.description` | `"A curated pick for your trip."` |
| Duration | `row.activity?.duration` | omit |
| Cost | `row.activity?.estimatedCost` | omit |
| Verification | `row.activity?.verificationStatus` | omit |
| Tags | `row.activity?.tags` | omit |
| Hidden gem | `row.activity?.isHiddenGem` | false |
| Website | `row.activity?.website_url ?? row.dining?.website_url` | omit |
| Photo query | `"${row.name} ${destination} landmark"` | |

### Visual
- Full-screen overlay: `bg-black/60 backdrop-blur-sm`
- Card: `max-w-md`, `border-radius: 24px`, white
- Enters from below on mobile, center on desktop (Framer Motion)
- `DayPhoto` component for the header image (already used in DayDetailPanel)
- `verificationStatus === 'verified-open'` → green "✓ Verified open" badge
- `verificationStatus === 'flagged-closed'` → red "⚠ May be closed" badge

---

## Feature 3: Find Alternative Panel

### New file: `src/components/AlternativePickerPanel.tsx`

### Props
```typescript
interface AlternativePickerPanelProps {
  target: SwapTarget;        // see below
  itinerary: Itinerary;
  onCommit: (activity: Activity, summary: string, diningField?: 'lunch' | 'dinner') => void;
  onClose: () => void;
}

interface SwapTarget {
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';   // activity slot
  diningField?: 'lunch' | 'dinner';             // set for dining rows
  currentName: string;
  neighborhood?: string;
}
```

### States
1. **Loading** — spinner + "Finding the best options near {neighborhood}…"
2. **Results** — 2 proposal cards + free-text row
3. **Error** — "Couldn't fetch suggestions. Try typing below."

### Proposal card
```
┌──────────────────────────────────────────────┐
│  🥐  Café Sillon                             │
│       Modern French · Vieux Lyon · ~€18     │
│  💡 Same neighborhood, known for creative…  │
└──────────────────────────────────────────────┘
```
- Selected card: `border-color: #5aada5`, `background: #e8f4f2`
- Clicking a card → selects it + updates confirm button text

### Free text fallback
Below both proposals, separated by "Neither works?" divider:
```
[  Tell us what you're looking for…     ] [→]
```
Textarea + send button. On submit: calls the swap API again with the custom request text, replaces both proposal cards with a new loading + result.

### Confirm button
`"✓ Use {selectedName}"` — calls `onCommit(activity, summary, diningField?)`

### Slot mapping for dining rows
Dining spots (lunch/dinner) don't have their own activity slot. Map them to the nearest slot:
```typescript
const slotForDining = (field: 'lunch' | 'dinner'): 'morning' | 'afternoon' | 'evening' =>
  field === 'lunch' ? 'morning' : 'evening';
```
Use an appropriate request string: `"Find a better ${field} restaurant"`.

---

## API Change: Proposals Mode

### Modified: `src/app/api/swap/route.ts`

Add to `SwapPayload`:
```typescript
/** When true: return 2 proposals without persisting to DB */
proposalsOnly?: boolean;
```

Add to response types — new `SwapProposalsResult`:
```typescript
export interface SwapProposalsResult {
  proposals: Activity[];   // always length 2
}
```

When `proposalsOnly: true`:
1. Call `buildProposalsPrompt` (2-activity version)
2. Parse the response as `{ proposals: Activity[] }`
3. Return `NextResponse.json({ proposals })` — NO `persistSwap` call
4. HTTP 200

When `proposalsOnly: false` (default): existing behaviour unchanged.

### Modified: `src/lib/prompts.ts`

Add `buildProposalsPrompt`:
```typescript
export function buildProposalsPrompt(params: {
  itinerary: Itinerary;
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  request: string;
}): string
```

Same context as `buildSwapPrompt` but asks for a JSON array of 2 activities:
```
Return a JSON object: { "proposals": [<Activity>, <Activity>], "summaries": ["why 1", "why 2"] }
Each Activity MUST include: name, description, whyThis, neighborhood, estimatedCost, duration, latitude, longitude, category_emoji.
The two proposals should be meaningfully different options (different style, price point, or vibe).
```

The `whyThis` field on each proposal becomes the "why we chose this" sentence shown in the panel.

---

## DayTimeline Changes

### New props
```typescript
interface DayTimelineProps {
  // existing
  day: DayPlan;
  dayIndex: number;
  destination: string;
  ui: ItineraryUiStrings;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  // NEW
  onExplore: (row: TimelineRow) => void;
  onFindAlternative: (target: SwapTarget) => void;
}
```

### Per-row changes
Every `TimelineItem` gains:
- "Explore Details" button → calls `onExplore(row)`
- "Navigate" link → `buildMapsDirectionsUrl(row.name, neighborhood, destination)`
- "Find Alternative" / "Change Hotel" → calls `onFindAlternative(swapTarget)`
- "Modify" (activities) → calls `onFindAlternative(swapTarget)` — same panel, same flow

The `onSwapSlot` prop is no longer called directly from `DayTimeline` — all modifications go through `AlternativePickerPanel`. `onSwapSlot` remains on DayDetailPanel for direct slot swaps triggered by QuickEdit.

---

## DayDetailPanel Changes

### New state
```typescript
const [activePlace, setActivePlace] = useState<TimelineRow | null>(null);
const [activeSwap, setActiveSwap] = useState<SwapTarget | null>(null);
```

### Wire AlternativePickerPanel.onCommit
```typescript
const handleAlternativeCommit = (activity: Activity, summary: string, diningField?: 'lunch' | 'dinner') => {
  itin.handleCommitActivitySwap(dayIndex, activeSwap!.slot, activity, summary, diningField);
  setActiveSwap(null);
};
```

---

## Files Changed Summary

| File | Action | What changes |
|------|--------|--------------|
| `src/components/PlaceDetailCube.tsx` | **CREATE** | Place info floating modal |
| `src/components/AlternativePickerPanel.tsx` | **CREATE** | 2-proposal + free-text swap picker |
| `src/components/DayTimeline.tsx` | **MODIFY** | Add navigate link, onExplore, onFindAlternative; export buildMapsDirectionsUrl |
| `src/components/DayDetailPanel.tsx` | **MODIFY** | Add activePlace + activeSwap state, render new modals |
| `src/app/api/swap/route.ts` | **MODIFY** | Add proposalsOnly mode |
| `src/lib/prompts.ts` | **MODIFY** | Add buildProposalsPrompt |

---

## Testing

Pure functions to test:
- `buildMapsDirectionsUrl('Café Sillon', 'Vieux Lyon', 'Lyon')` → valid Google Maps URL
- `slotForDining('lunch')` → `'morning'`; `slotForDining('dinner')` → `'evening'`
- `buildProposalsPrompt(...)` → string containing `"proposals"` and `"whyThis"` instructions

Integration smoke test:
1. Open day detail → click "Navigate" → Google Maps opens in new tab
2. Click "Explore Details" → PlaceDetailCube appears with whyThis text
3. Click "Find Alternative" (dining row) → AlternativePickerPanel shows loading then 2 proposals
4. Pick a proposal → confirm → timeline row updates + edit banner shows
5. Type custom request → send → new proposals appear
6. Click "Find Alternative" (activity row) → same panel, same flow
