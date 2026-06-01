# Smart Adaptive Hotel Step — Design Spec

**Date:** 2026-06-01  
**Status:** Approved  
**Scope:** `src/app/onboarding/sections/SmartHotelStep.tsx` + supporting files  

---

## Problem

The current `SmartHotelStep` collects only two signals:
1. Accommodation type (5 generic options, same for everyone)
2. Nightly budget (2–4 options depending on type)

This is shallow. By the time the user reaches Step 4 (Accommodation), we already know their **destination, dates, budget tier, group type, and group dynamics**. None of that intelligence is used to personalise the hotel step. The AI also never receives location preference or amenity requirements, so its hotel recommendations are generic.

---

## Goal

Redesign `SmartHotelStep` into a **context-aware, adaptive form** that:

1. Reads traveler context already collected (groupType, groupDynamics, budget, pace)
2. Surfaces accommodation types in a personalised order with persona-specific descriptions
3. Adds two new preference dimensions: **location** (`hotelLocationPref`) and **amenities** (`hotelAmenities`)
4. Writes all selections to `onboardingStore` → flows through to `TravelerProfile` → enriches the AI prompt

**No DB schema changes. No new API routes. All target fields already exist in `TravelerProfile`.**

---

## Scope

### In scope
- Redesign of "Help me choose" path (Path B) in `SmartHotelStep`
- New `hotelPersonalization.ts` pure utility
- New store actions for `hotelLocationPref` and `hotelAmenities`
- Prompt update to inject location + amenity context
- Persistence of new fields through `onboardingStore` → `plan/page.tsx` → `/api/generate`

### Out of scope
- "I already have a hotel" path (Path A) — unchanged
- Live hotel search / real-time availability during onboarding
- DB schema changes
- Changes to `types.ts`, API routes, or the itinerary display layer

---

## Architecture

### New file: `src/lib/hotelPersonalization.ts`

A pure function with no side effects:

```ts
getHotelPersonalization(
  groupType: GroupType | '',
  groupDynamics: GroupDynamicsPayload | null,
  budget: BudgetLevel | '',
  pace: PaceLevel | '',
): HotelPersonalizationConfig
```

Returns:
```ts
interface HotelPersonalizationConfig {
  headline: string          // "Your perfect base in {destination}"
  subline: string           // persona-specific tagline
  contextBadge: string      // "Personalized for a couple's escape"
  accomOrder: AccommodationType[]   // preferred order, first 2 are highlighted
  accomDimmed: AccommodationType[]  // shown at low opacity
  locationOrder: HotelLocationPref[] // preferred location options first
  amenityPreset: HotelAmenity[]      // 3–4 suggested amenities for this profile
}
```

**Mapping table (all cases):**

| Who | Highlighted | Dimmed | Location order | Amenity preset |
|-----|------------|--------|----------------|----------------|
| solo · digital-nomad | boutique-hotel, airbnb | resort | transit, center, quiet, nature | workspace, gym |
| solo · adventure | hostel, boutique-hotel | resort, luxury-hotel | center, transit, quiet, nature | breakfast, gym |
| solo · deep-recharge | boutique-hotel, airbnb | hostel | quiet, nature, center, transit | spa, breakfast |
| couple · romantic | boutique-hotel, luxury-hotel | hostel | center, quiet, transit, nature | rooftop, breakfast, spa |
| couple · parent-child | boutique-hotel, airbnb | hostel | quiet, transit, center, nature | breakfast, parking |
| couple · reconnecting | boutique-hotel, luxury-hotel | hostel | quiet, center, nature, transit | spa, breakfast, rooftop |
| family (any) | airbnb, resort, luxury-hotel | hostel | quiet, center, transit, nature | pool, breakfast, parking, pets |
| group · best-friends | airbnb, hostel, boutique-hotel | resort | center, transit, quiet, nature | rooftop, breakfast |
| group · work-crew | luxury-hotel, boutique-hotel | hostel | transit, center, quiet, nature | workspace, breakfast, gym |
| group · mixed-ages | airbnb, luxury-hotel | hostel | center, quiet, transit, nature | pool, breakfast, parking |
| default (no context) | boutique-hotel, airbnb | — | center, transit, quiet, nature | breakfast, pool |

**Budget tier overlay:**
- `budget` → additionally dim `luxury-hotel` and `resort`
- `luxury` → additionally dim `hostel`; hide `budget` nightly tier

---

### Modified: `src/state/onboardingStore.ts`

Add two new actions (the fields `hotelLocationPref` and `hotelAmenities` already exist in `OnboardingState`):

```ts
setHotelLocationPref: (prefs: HotelLocationPref[]) => void
toggleHotelAmenity:   (amenity: HotelAmenity) => void
```

Both are included in `partialize` so they persist to localStorage.

---

### Modified: `src/app/onboarding/sections/SmartHotelStep.tsx`

**Path A ("I already have a hotel")** — unchanged.

**Path B ("Help me choose")** — expanded to 4 progressive reveal blocks:

```
Block 1: Accommodation type
  - Reads config from getHotelPersonalization()
  - Context badge at top ("Personalized for...")
  - Context-aware headline + subline
  - Options sorted per accomOrder; first 2 visually highlighted (gold border tint)
  - accomDimmed options shown at opacity 0.45
  - Descriptions rewritten per persona (e.g. Resort: "Kids' club, pool, everything on site" for family)
  - On select → calls setAccommodation() + resets budget if incompatible (existing logic)

Block 2: Nightly budget (reveals after type selected)
  - Existing logic, no changes

Block 3: Where in the city? (reveals after budget selected)
  - 2×2 grid of location buttons
  - Options: center 🏙️ / quiet 🌿 / transit 🚇 / nature 🌊
  - Sorted per config.locationOrder
  - Single select → calls setHotelLocationPref([value])
  - Sub-labels adapt to traveler ("Safe, residential" for family vs "Walk to everything" for couple)

Block 4: Must-haves? (reveals after location selected)
  - Horizontal pill row, multi-select (up to 3)
  - Shows config.amenityPreset options first, then remaining options
  - Calls toggleHotelAmenity()
  - All 9 amenities available but preset shown first
```

**Animation:** all blocks use existing `reveal` variants (`opacity 0→1, y 12→0`). No new animation code.

**"Skip" link** remains visible throughout (calls `onSkip`).

---

### Modified: `src/lib/prompts.ts`

In `buildUserPrompt()`, after the existing hotel/basecamp context block, add:

```ts
// Hotel preferences block
if (profile.hotelLocationPref?.length) {
  lines.push(`Hotel location preference: ${profile.hotelLocationPref.join(', ')}`);
}
if (profile.hotelAmenities?.length) {
  lines.push(`Must-have hotel amenities: ${profile.hotelAmenities.join(', ')}`);
}
```

This ensures the AI's `basecamp.recommendations` honour the user's stated preferences. No system prompt changes needed — the existing `HotelRecommendation` schema already includes `whyItFits`, `neighborhoodVibe`, and `fitSummary` where these preferences should surface.

---

## Data Flow

```
onboardingStore
  groupType, groupDynamics, budget, pace (already set in Steps 2–3)
        │
        ▼
hotelPersonalization.ts
  getHotelPersonalization(groupType, groupDynamics, budget, pace)
  → { headline, subline, contextBadge, accomOrder, accomDimmed,
      locationOrder, amenityPreset }
        │
        ▼
SmartHotelStep.tsx (Path B)
  User selects: accommodation, hotelNightlyBudget,
                hotelLocationPref[], hotelAmenities[]
        │
        ▼
onboardingStore (persisted to localStorage key: travelos-onboarding)
        │
        ▼
plan/page.tsx
  Builds TravelerProfile from store — all fields included automatically
  (hotelLocationPref and hotelAmenities are already mapped)
        │
        ▼
POST /api/generate
  buildUserPrompt(profile, ...) injects:
  "Hotel location preference: center, quiet"
  "Must-have hotel amenities: rooftop, breakfast"
        │
        ▼
AI (Gemini / Claude)
  basecamp.recommendations:
    - whyItFits references location preference
    - neighborhoodVibe matches locationPref
    - fitSummary mentions amenities
```

---

## Component Interface

```tsx
// SmartHotelStep.tsx — unchanged public interface
interface Props {
  onComplete: () => void;
  onSkip:     () => void;
}
```

No changes to how the parent (`onboarding/page.tsx`) calls this component.

---

## Amenities Reference

All 9 `HotelAmenity` values with display labels:

| Value | Label | Emoji |
|-------|-------|-------|
| `breakfast` | Breakfast included | ☕ |
| `pool` | Swimming pool | 🏊 |
| `workspace` | Desk / co-working | 💻 |
| `gym` | Fitness center | 🏋️ |
| `parking` | Free parking | 🅿️ |
| `spa` | Spa & wellness | 🛁 |
| `suite` | Junior suite / extra space | 🛏️ |
| `rooftop` | Rooftop bar / terrace | 🌅 |
| `pets` | Pet-friendly | 🐾 |

---

## Location Options Reference

| Value | Label | Sub-label (family) | Sub-label (couple) | Emoji |
|-------|-------|--------------------|--------------------|-------|
| `center` | City center | Walk to attractions | Walk to everything | 🏙️ |
| `quiet` | Quiet area | Safe, residential | Intimate neighbourhood | 🌿 |
| `transit` | Near transit | Easy to get around | Metro at your door | 🚇 |
| `nature` | Nature / parks | Kids love it | Scenic surroundings | 🌊 |

---

## Error Handling

- If `groupType` is empty (user skipped vibe step) → use default config (no badge shown)
- If user selects an amenity already at max (3) → pill toggles off the earliest selection (FIFO) **OR** allow unlimited — prefer unlimited for simplicity
- If `hotelNightlyBudget` becomes incompatible after accommodation change → reset to `''` (existing logic, unchanged)
- All new fields are optional in `TravelerProfile` — if empty, prompt builder simply omits those lines

---

## Files Changed Summary

| File | Change type | Description |
|------|-------------|-------------|
| `src/lib/hotelPersonalization.ts` | **NEW** | Pure function: traveler context → UI config |
| `src/app/onboarding/sections/SmartHotelStep.tsx` | **MODIFY** | Expand Path B with 4-block progressive reveal |
| `src/state/onboardingStore.ts` | **MODIFY** | Add `setHotelLocationPref` + `toggleHotelAmenity` actions |
| `src/lib/prompts.ts` | **MODIFY** | Inject `hotelLocationPref` + `hotelAmenities` into user prompt |

**Not changed:** `types.ts`, `database.ts`, any API routes, `itinerary` display components, `hotelNormalize.ts`.
