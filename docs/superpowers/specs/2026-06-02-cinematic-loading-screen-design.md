# Cinematic Loading Screen — Design Spec

**Date:** 2026-06-02  
**Status:** Approved  
**Scope:** Replace `LoadingScreen` inline function in `plan/page.tsx` with a new cinematic component

---

## Problem

The current loading screen (`LoadingScreen` in `plan/page.tsx`) feels static and boring:
- Progress bar is a **fake looping animation** — not tied to actual generation progress
- "Phase 1/5" badge gives no percentage intuition
- No destination content to keep the user engaged
- Left panel and right panel feel disconnected visually
- No cinematic or editorial feel — mismatches the brand

Average wait time: **30–90 seconds**. Users need something to hold their attention.

---

## Goal

Replace the loading screen with a **Cinematic Intel Dashboard** that:
1. Shows **real percentage progress** derived from the SSE stream event count
2. Entertains with **destination facts** that rotate every 7 seconds
3. Displays **live place discoveries** (already arriving via SSE) as animated cards
4. Feels **cinematic and editorial** — large destination name, dramatic typography, atmospheric vignette

---

## Scope

### In scope
- New `src/components/LoadingScreen.tsx` component
- Destination facts data: `src/lib/destinationFacts.ts`
- Replace the `LoadingScreen` inline function in `plan/page.tsx` with an import
- Real percentage calculation based on `buildSignals` count

### Out of scope
- Changes to SSE stream logic (`generate-stream` route)
- Changes to `streamedPlaces` / `streamedTips` / `streamStatus` data structures
- Hebrew translation of the new copy (can be added later)
- Any changes to the itinerary result page

---

## Architecture

### New file: `src/components/LoadingScreen.tsx`

Extracts the current inline `LoadingScreen` function into a standalone component file. Keeps the same Props interface:

```typescript
interface LoadingScreenProps {
  destination: string;
  lang: TripLanguage;
  streamedPlaces: PlaceEvent[];
  streamedTips: string[];
  streamStatus: StatusEvent | null;
}
```

### New file: `src/lib/destinationFacts.ts`

Static lookup table of 3 facts per popular destination, plus a `_default` array for unknown cities:

```typescript
export function getDestinationFacts(destination: string): string[]
```

Returns 3 strings. Caller rotates through them with a `useState` timer.

### Modified: `src/app/plan/page.tsx`

Two changes only:
1. Remove the inline `LoadingScreen` function (lines 455–661)
2. Add import: `import { LoadingScreen } from '@/components/LoadingScreen'`

The `<LoadingScreen ... />` JSX call site in the main render is unchanged.

---

## Visual Design

### Layout

Full-screen, two-column (desktop) / stacked (mobile):

```
┌─────────────────────────────────────────────────────┐
│ TravelOS                              🔴 AI Build Live │  ← topbar
├──────────────────────────────┬──────────────────────┤
│                              │                      │
│  Building your trip to       │  Live discoveries    │
│  [destination eyebrow]       │                      │
│                              │  [place card x4]     │
│  [DESTINATION NAME]          │                      │
│   (huge, editorial)          │  [fact card]         │
│                              │                      │
│  [62%]  Complete             │                      │
│  [━━━━━━━━━━━━━━━━━━━━░░░]   │                      │
│                              │                      │
│  [done][done][active][·][·]  │                      │
│   step pills                 │                      │
│                              │                      │
├──────────────────────────────┴──────────────────────┤
│  ↻ Clustering days by neighborhood…           v1.x  │  ← bottom bar
└─────────────────────────────────────────────────────┘
```

### Background

- Dark base: `#091f36` (existing brand color)
- Atmospheric gradients: red glow from bottom-left (`rgba(158,54,58,0.22)`), blue from bottom-right (`rgba(74,123,222,0.15)`)
- Cinematic vignette overlay: radial darkening at edges + linear dark at bottom
- Subtle grain texture (CSS SVG filter)

### Typography

- **Destination name:** `clamp(42px, 6vw, 72px)`, weight 900, letter-spacing -2px — editorial magazine feel
- **Percentage number:** `clamp(72px, 10vw, 110px)`, weight 900, letter-spacing -4px
- **Step pills:** 11px, rounded-full, active has red glow border

### Percentage Logic

```typescript
// buildSignals = streamedPlaces.length + streamedTips.length + (streamStatus ? 1 : 0)
// Typical range: 0 → ~14 events over 30-90 seconds
const percent = Math.min(95, Math.round((buildSignals / 14) * 100));
// Jumps to 100 only when plan/page.tsx receives the 'complete' SSE event and redirects
```

Cap at 95% to avoid "100%" before the redirect fires. The user never sees a frozen 100%.

### Step Pills

Replace the current vertical step list with horizontal pills:

```
[✓ Signals] [✓ Food blogs] [● Clustering] [· Tuning] [· Filtering]
```

States:
- `done`: white/25%, strikethrough text, no border glow
- `active`: white/100%, `rgba(158,54,58,0.18)` background, red border + glow, animated red dot
- `pending`: white/15%, no border

### Live Discovery Cards (right panel)

Shows last 4 items from `streamedPlaces`. Each card:
- Emoji (from `PlaceEvent.emoji`)
- Name (from `PlaceEvent.name`)
- Description/slot (from `PlaceEvent.description` or `PlaceEvent.slot + day`)
- Badge based on `PlaceEvent.vibeLabel`:
  - `'hidden-gem'` → `💎 Hidden Gem` (gold)
  - `'local-favorite'` → `🏘 Local Pick` (blue)
  - others → no badge

New cards slide in from the right (`translateX(16px) → 0`) with 0.4s ease.
Cards are displayed newest-first (reverse the last-4 slice).

### Destination Fact Card

Below the place cards. Rotates every 7 seconds through `getDestinationFacts(destination)`.  
Uses a `useEffect` timer that increments a `factIndex` state.  
Style: blue-tinted glass card with 💡 icon.

### Bottom Status Bar

Shows `streamStatus.icon + streamStatus.message` when present, otherwise "Analyzing your preferences…".  
Thin horizontal layout, centered, with a CSS spin loader.

---

## Destination Facts Coverage

15 cities covered explicitly; all others fall back to `_default`:

| City | Facts |
|------|-------|
| Paris | Eiffel Tower, Montmartre hill, 2,000+ km metro |
| Tokyo | Michelin stars, vending machines, 13 million commuters |
| Rome | 7 hills, pasta shapes, Trevi Fountain coins |
| London | Double-deckers, 270 nationalities, oldest underground |
| Barcelona | Sagrada Família still unfinished, 4km beach |
| Amsterdam | 165 canals, more bikes than people, Rijksmuseum |
| Lisbon | 7 hills, oldest European capital bookshop, trams |
| New York | 800 languages, Central Park larger than Monaco |
| Dubai | 0 income tax, 85% expats, world's tallest building |
| Athens | Democracy invented here, 3,000 years of history |
| Budapest | Most thermal spas in the world, Danube splits city |
| Vienna | Birthplace of psychoanalysis, 600 coffee houses |
| Rio de Janeiro | 80+ beaches, Carnival 2M attendees, 2 microclimates |
| Sydney | Opera House 14 years late, world's largest natural harbour |
| Singapore | 4 official languages, changi airport waterfall |
| `_default` | AI is geo-clustering, hidden gems being surfaced, trip DNA |

---

## Component Interface

```typescript
// src/components/LoadingScreen.tsx
export function LoadingScreen({
  destination,
  lang,
  streamedPlaces,
  streamedTips,
  streamStatus,
}: {
  destination: string;
  lang: TripLanguage;
  streamedPlaces: PlaceEvent[];
  streamedTips: string[];
  streamStatus: StatusEvent | null;
}) { ... }
```

Identical to the current interface — the call site in `plan/page.tsx` does not change.

---

## Data Flow

```
plan/page.tsx (SSE listener)
  → streamedPlaces[]   (PlaceEvent: name, emoji, description, slot, day, vibeLabel)
  → streamedTips[]
  → streamStatus       (StatusEvent: message, icon)
        │
        ▼
LoadingScreen component
  ├── buildSignals = streamedPlaces.length + streamedTips.length + (streamStatus ? 1 : 0)
  ├── percent = Math.min(95, Math.round(buildSignals / 14 * 100))
  ├── activeStep = Math.min(4, Math.floor(buildSignals / 2))
  ├── recentPlaces = streamedPlaces.slice(-4).reverse()
  └── facts = getDestinationFacts(destination) → rotated by useEffect timer
```

---

## Files Changed Summary

| File | Action | Description |
|------|--------|-------------|
| `src/components/LoadingScreen.tsx` | **CREATE** | Full cinematic component |
| `src/lib/destinationFacts.ts` | **CREATE** | Facts lookup + `getDestinationFacts()` |
| `src/app/plan/page.tsx` | **MODIFY** | Remove inline function, add import |
