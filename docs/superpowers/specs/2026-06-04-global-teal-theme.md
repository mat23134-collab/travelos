# Global Teal Theme — Design Spec

**Date:** 2026-06-04
**Status:** Approved
**Scope:** Apply the light-teal + rotating-photo background from the itinerary results page to all pages on TravelOS, including the home page.

---

## Problem

The itinerary results page (SARTO-style, already built) looks great with its light teal background and rotating destination photos. All other pages still use the old dark navy (`#091f36` / `#0b1220`) backgrounds, creating visual inconsistency.

---

## Goal

Every page on TravelOS should share:
1. **Rotating STEP_BACKGROUNDS** destination photos (crossfade every 8 s)
2. **Light teal overlay** `rgba(180,228,222,0.82)`
3. **Film grain texture** for depth

---

## Architecture Decision

**Shared `SiteBackground` component in `layout.tsx`** — renders behind all pages at `z-index: -20`. Individual pages can override by rendering their own backgrounds at higher z-indices (e.g. `ItineraryClient` keeps its own destination-matched background at `z-index: -2/-1`).

The `SiteBackground` is a "floor" — any page that doesn't have its own background will show it. Pages with their own backgrounds simply cover it.

---

## New File: `src/components/SiteBackground.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { STEP_BACKGROUNDS } from '@/lib/stepBackgrounds';
import { ITIN_RESULTS_NOISE_DATA_URL } from '@/lib/itineraryResultsPalette';

export function SiteBackground() {
  const [bgIdx, setBgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setBgIdx((i) => (i + 1) % STEP_BACKGROUNDS.length), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      {/* Layer 1: rotating destination photo */}
      <AnimatePresence initial={false}>
        <motion.div
          key={bgIdx}
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -20,
            backgroundImage: `url("${STEP_BACKGROUNDS[bgIdx].imageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* Layer 2: light teal overlay */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: -19, background: 'rgba(180,228,222,0.82)' }}
      />

      {/* Layer 3: film grain */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none opacity-[0.022]"
        style={{
          zIndex: -18,
          backgroundImage: `url(${ITIN_RESULTS_NOISE_DATA_URL})`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'multiply',
        }}
      />
    </>
  );
}
```

---

## Modified: `src/app/layout.tsx`

Add `<SiteBackground />` as first child of `<body>`, before `{children}`:

```tsx
import { SiteBackground } from '@/components/SiteBackground';

// In RootLayout body:
<body className="min-h-full antialiased">
  <SiteBackground />   {/* ← ADD */}
  <MotionProvider>
    <AuthProvider>
      {children}
      <Footer />
      <LegalConsentBanner />
    </AuthProvider>
  </MotionProvider>
  <CanvasShell />
  <VersionStamp />
</body>
```

**Note:** The `Footer` at the bottom of `layout.tsx` already has `background: '#071629'` (explicit dark), so it remains dark — no change needed to Footer.

---

## Page-by-Page Changes

### `src/app/onboarding/page.tsx`

The onboarding page has its own destination-matched background using `resolveBackgroundImage`. This overrides the global `SiteBackground` naturally (inline style on `<main>` is in the page flow, not behind).

**Change:** Update the overlay inside the existing `backgroundImage` style from dark navy to teal:

```typescript
// BEFORE (line ~406):
backgroundImage: `linear-gradient(rgba(9,31,54,0.76), rgba(9,31,54,0.91)), url("${bgUrl}")`,

// AFTER:
backgroundImage: `linear-gradient(rgba(180,228,222,0.82), rgba(180,228,222,0.82)), url("${bgUrl}")`,
```

Also remove the fallback `backgroundColor: '#091f36'` from the main container — the global `SiteBackground` handles the blank state.

---

### `src/app/auth/page.tsx`

**Changes:**
1. Remove `backgroundColor: '#091f36'` from the `<main>` element
2. Remove the two ambient orbs (red + blue blurred divs) — they're dark-themed decorations that don't work on teal
3. Auth card background: change from `rgba(255,255,255,0.035)` to `rgba(255,255,255,0.82)` + add `backdropFilter: blur(16px)` — makes the card a white frosted glass on teal
4. Text inside the card: inputs and labels currently use `color: 'rgba(255,255,255,0.70)'` etc. Change form field labels/text to dark `#333`. Button (Sign in) keeps teal `#9e363a` (or change to `#5aada5`).

**Auth card color map:**
| Element | Before | After |
|---------|--------|-------|
| Card bg | `rgba(255,255,255,0.035)` | `rgba(255,255,255,0.82)` |
| Card border | `rgba(255,255,255,0.07)` | `rgba(90,173,165,0.25)` |
| Label text | `rgba(255,255,255,0.55)` | `#555` |
| Input bg | `rgba(255,255,255,0.05)` | `rgba(255,255,255,0.6)` |
| Input border | `rgba(255,255,255,0.10)` | `rgba(90,173,165,0.3)` |
| Input text | white | `#222` |
| Error text | red/pink | keep (already red) |
| Submit button | keep `#9e363a` | keep |
| Back link | `text-white/35` | `text-[#3a8a82]/70` |

---

### `src/app/dashboard/page.tsx`

**Changes:**
1. Remove `backgroundColor: '#091f36'` from `<main>`
2. Remove ambient orb `div` (dark-red blur)
3. Header sticky bar: change from dark `rgba(9,31,54,0.90)` to teal `rgba(90,173,165,0.90)` — matches `ItineraryHeader` style

Trip cards in the dashboard have their own backgrounds and will remain as-is (they work on any background).

**Dashboard header color map:**
| Element | Before | After |
|---------|--------|-------|
| Header bg | `rgba(9,31,54,0.90)` | `rgba(90,173,165,0.90)` |
| Header border | `border-white/6` | `border-white/20` |
| Brand text | white | white (keep) |
| Email text | `text-white/30` | `text-white/60` |
| Log out button | `text-white/50` | `text-white/80` |

---

### `src/app/plan/page.tsx`

The plan page has multiple states:
- **Pre-generation form** — dark bg
- **LoadingScreen** — cinematic dark (keep as-is)

**Change:** Remove `backgroundColor: '#091f36'` from the outermost wrapper. The `LoadingScreen` component already renders with `background: '#091f36'` set directly on it, so it continues to look cinematic/dark. Pre-form sections show the teal background.

**Note:** LoadingScreen has its own explicit background — do NOT change it. Only remove the page-level `#091f36`.

---

### `src/app/page.tsx` (Home)

The home page is the most complex — it has a cinematic hero section (`CinematicHeroBackground`) with dark overlay for text readability, plus feature and destination sections.

**Strategy:** Add teal background via global `SiteBackground`. Make the hero section locally dark (via `CinematicHeroBackground` which already has `rgba(11,18,32,0.42–0.97)` overlay). Change the main page `backgroundColor` from `#0b1220` to `transparent`.

**Changes:**
1. Remove `style={{ backgroundColor: NIGHT }}` from `<main>`
2. Keep `CinematicHeroBackground` as-is — it renders with its own dark overlay inside the hero section
3. The feature cards section: change card backgrounds from dark-glass (`rgba(255,255,255,0.05)`) to white-glass (`rgba(255,255,255,0.70)`) and text from white to dark `#222`
4. Feature section heading: `color: '#fff'` → `color: '#1a4a44'`
5. Destination postcards section: already has photos in the cards — text colors to dark

---

### Pages NOT changing

- `src/app/itinerary/page.tsx` — uses `ItineraryClient` which has its own background — no change needed
- `src/app/itinerary/[id]/page.tsx` — same
- `src/app/privacy/page.tsx` — not user-facing enough to prioritize
- `src/app/terms/page.tsx` — same
- `src/app/explore/[city]/page.tsx` — can be done separately
- `src/components/LoadingScreen.tsx` — keeps dark cinematic look — do NOT change

---

## Files Changed Summary

| File | Action | Key change |
|------|--------|-----------|
| `src/components/SiteBackground.tsx` | **CREATE** | Global rotating photo + teal overlay |
| `src/app/layout.tsx` | **MODIFY** | Add `<SiteBackground />` |
| `src/app/onboarding/page.tsx` | **MODIFY** | Overlay → teal, remove dark fallback |
| `src/app/auth/page.tsx` | **MODIFY** | White card, dark text, remove dark bg |
| `src/app/dashboard/page.tsx` | **MODIFY** | Remove dark bg, teal header |
| `src/app/plan/page.tsx` | **MODIFY** | Remove dark bg (LoadingScreen untouched) |
| `src/app/page.tsx` | **MODIFY** | Transparent bg, white-glass feature cards |

---

## Z-Index Stack

```
z: -18  Film grain (SiteBackground layer 3)
z: -19  Teal overlay (SiteBackground layer 2)
z: -20  Rotating photo (SiteBackground layer 1)
        ← everything above this is page content or page-specific bg
        ← ItineraryClient uses z: -2/-1 for its own destination bg
        ← LoadingScreen uses its own fixed bg at default z
```
