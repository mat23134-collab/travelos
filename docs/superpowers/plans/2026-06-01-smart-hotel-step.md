# Smart Adaptive Hotel Step — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic hotel preference form with a context-aware step that reads the traveler's profile (group type, dynamics, budget) and shows personalised accommodation options, location preferences, and amenities — all flowing through to the AI prompt.

**Architecture:** Four focused changes — one new pure-function utility, two store additions, a UI rewrite of path B in SmartHotelStep, and two small URL-param wiring changes so the new fields travel from onboarding → plan → AI. `prompts.ts` already handles `hotelLocationPref` and `hotelAmenities` — no changes needed there.

**Tech Stack:** Next.js 14 App Router, TypeScript, Zustand (persist), Framer Motion, `node:assert/strict` tests run with `npx tsx`

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/lib/hotelPersonalization.ts` | **CREATE** | Pure function: profile → UI config |
| `src/app/onboarding/sections/SmartHotelStep.test.ts` | **UPDATE** | Add tests for the new export |
| `src/app/onboarding/sections/SmartHotelStep.tsx` | **REWRITE** | Path B: 4 progressive blocks, context-aware |
| `src/state/onboardingStore.ts` | **MODIFY** | Add `hotelLocationPref[]`, `hotelAmenities[]` fields + actions |
| `src/app/onboarding/page.tsx` | **MODIFY** | Pass new fields as URL params to `/plan` |
| `src/app/plan/page.tsx` | **MODIFY** | Read new params + hydrate `form` |

---

## Task 1 — `hotelPersonalization.ts` (new pure utility)

**Files:**
- Create: `src/lib/hotelPersonalization.ts`

- [ ] **Step 1.1 — Write the file**

```typescript
// src/lib/hotelPersonalization.ts
import type {
  AccommodationType,
  BudgetLevel,
  GroupType,
  HotelAmenity,
  HotelLocationPref,
} from './types';
import type { GroupDynamicsPayload } from './types';

export interface HotelPersonalizationConfig {
  headline: string;
  subline: string;
  /** Shown as a small badge above the headline. null = no badge (default config). */
  contextBadge: string | null;
  /** Accommodation types in preferred display order. First 2 get a subtle gold highlight. */
  accomOrder: AccommodationType[];
  /** Types shown at reduced opacity (not clickable — still selectable). */
  accomDimmed: AccommodationType[];
  /** Override descriptions per type. Falls back to ACCOM_BASE defaults. */
  accomDescriptions: Partial<Record<AccommodationType, string>>;
  /** Location options in preferred display order. */
  locationOrder: HotelLocationPref[];
  /** 3–4 pre-selected amenity suggestions for this traveler profile. */
  amenityPreset: HotelAmenity[];
}

const DEFAULT: HotelPersonalizationConfig = {
  headline:          'Where will you sleep?',
  subline:           'Your accommodation anchors routes, dining picks, and neighbourhood advice',
  contextBadge:      null,
  accomOrder:        ['boutique-hotel', 'airbnb', 'luxury-hotel', 'hostel', 'resort'],
  accomDimmed:       [],
  accomDescriptions: {},
  locationOrder:     ['center', 'transit', 'quiet', 'nature'],
  amenityPreset:     ['breakfast', 'pool'],
};

export function getHotelPersonalization(
  groupType:    GroupType | '',
  groupDynamics: GroupDynamicsPayload | null,
  budget:       BudgetLevel | '',
): HotelPersonalizationConfig {
  const sub = groupDynamics?.subType ?? null;

  let cfg: HotelPersonalizationConfig = { ...DEFAULT, accomDescriptions: {} };

  // ── Solo ────────────────────────────────────────────────────────────────────
  if (groupType === 'solo' && sub === 'digital-nomad') {
    cfg = {
      ...cfg,
      headline:     'Your office away from home',
      subline:      'Fast Wi-Fi, a real desk, and a neighbourhood worth exploring',
      contextBadge: '💻 Personalized for a digital nomad',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'hostel', 'resort'],
      accomDimmed:  ['resort'],
      accomDescriptions: {
        'boutique-hotel': 'Character, reliable Wi-Fi, local feel',
        'airbnb':         'Full kitchen, long-stay rates, your own space',
        'hostel':         'Social, affordable, central',
        'luxury-hotel':   '5-star service & amenities',
        'resort':         'Self-contained, pool, curated',
      },
      locationOrder: ['transit', 'center', 'quiet', 'nature'],
      amenityPreset: ['workspace', 'gym'],
    };
  } else if (groupType === 'solo' && sub === 'adventure') {
    cfg = {
      ...cfg,
      headline:     'Fuelled and ready to explore',
      subline:      'A solid base to crash after big days out',
      contextBadge: '🏔️ Personalized for a solo adventurer',
      accomOrder:   ['hostel', 'boutique-hotel', 'airbnb', 'luxury-hotel', 'resort'],
      accomDimmed:  ['resort', 'luxury-hotel'],
      accomDescriptions: {
        'hostel':         'Meet fellow travellers, affordable, central',
        'boutique-hotel': 'Character-driven, local feel',
        'airbnb':         'Your own space, full kitchen',
        'luxury-hotel':   '5-star service & amenities',
        'resort':         'Self-contained, pool, curated',
      },
      locationOrder: ['center', 'transit', 'quiet', 'nature'],
      amenityPreset: ['breakfast', 'gym'],
    };
  } else if (groupType === 'solo' && sub === 'deep-recharge') {
    cfg = {
      ...cfg,
      headline:     'Your recharge sanctuary',
      subline:      'Calm, comfort, and zero pressure',
      contextBadge: '🧘 Personalized for a solo recharge trip',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Intimate, character-driven, quiet',
        'airbnb':         'Your own peaceful space',
        'luxury-hotel':   'Full service, spa, concierge',
        'resort':         'Self-contained, pool, curated',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['quiet', 'nature', 'center', 'transit'],
      amenityPreset: ['spa', 'breakfast'],
    };

  // ── Couple ──────────────────────────────────────────────────────────────────
  } else if (groupType === 'couple' && sub === 'romantic') {
    cfg = {
      ...cfg,
      headline:     'The perfect backdrop for you two',
      subline:      'Intimate, stylish, and in the heart of the city',
      contextBadge: "💑 Personalized for a couple's escape",
      accomOrder:   ['boutique-hotel', 'luxury-hotel', 'airbnb', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Character, intimacy, local feel',
        'luxury-hotel':   'Spoil yourselves — full amenities',
        'airbnb':         'Your own apartment, total privacy',
        'resort':         'Curated romance package',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['center', 'quiet', 'transit', 'nature'],
      amenityPreset: ['rooftop', 'breakfast', 'spa'],
    };
  } else if (groupType === 'couple') {
    // parent-child | reconnecting | default couple
    cfg = {
      ...cfg,
      headline:     'A base for quality time',
      subline:      'Comfortable, well-located, no stress',
      contextBadge: '💑 Personalized for you two',
      accomOrder:   ['boutique-hotel', 'airbnb', 'luxury-hotel', 'resort', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'boutique-hotel': 'Character-driven, local feel',
        'airbnb':         'Home away from home',
        'luxury-hotel':   'Full service, concierge',
        'resort':         'Self-contained, pool, curated',
        'hostel':         'Social, dorm-style',
      },
      locationOrder: ['quiet', 'transit', 'center', 'nature'],
      amenityPreset: ['breakfast', 'parking'],
    };

  // ── Family ──────────────────────────────────────────────────────────────────
  } else if (groupType === 'family') {
    cfg = {
      ...cfg,
      headline:     'Home base for the whole family',
      subline:      'Space, comfort, and a pool',
      contextBadge: '👨‍👩‍👧 Personalized for a family',
      accomOrder:   ['airbnb', 'resort', 'luxury-hotel', 'boutique-hotel', 'hostel'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'airbnb':         'Multiple rooms, kitchen, your own space',
        'resort':         "Pool, kids' activities, everything on site",
        'luxury-hotel':   'Suites, concierge, full service',
        'boutique-hotel': 'Intimate, character-driven',
        'hostel':         'Not suited for families',
      },
      locationOrder: ['quiet', 'center', 'transit', 'nature'],
      amenityPreset: ['pool', 'breakfast', 'parking', 'pets'],
    };

  // ── Group ───────────────────────────────────────────────────────────────────
  } else if (groupType === 'group' && sub === 'best-friends') {
    cfg = {
      ...cfg,
      headline:     'A base camp for the whole crew',
      subline:      'Enough space, great location, share-worthy',
      contextBadge: '🎉 Personalized for your group',
      accomOrder:   ['airbnb', 'hostel', 'boutique-hotel', 'luxury-hotel', 'resort'],
      accomDimmed:  ['resort'],
      accomDescriptions: {
        'airbnb':         'Your own place — best value for groups',
        'hostel':         'Social, affordable, meet everyone',
        'boutique-hotel': 'Character-driven, cool neighbourhood',
        'luxury-hotel':   'Full service, split the cost',
        'resort':         'Self-contained, pool',
      },
      locationOrder: ['center', 'transit', 'quiet', 'nature'],
      amenityPreset: ['rooftop', 'breakfast'],
    };
  } else if (groupType === 'group' && sub === 'work-crew') {
    cfg = {
      ...cfg,
      headline:     'Work hard, explore harder',
      subline:      'Reliable connectivity and a great location',
      contextBadge: '💼 Personalized for a work trip',
      accomOrder:   ['luxury-hotel', 'boutique-hotel', 'airbnb', 'hostel', 'resort'],
      accomDimmed:  ['hostel'],
      accomDescriptions: {
        'luxury-hotel':   'Business facilities, concierge, meeting rooms',
        'boutique-hotel': 'Character, reliable Wi-Fi, local feel',
        'airbnb':         'Group space, kitchen, work-from-anywhere',
        'hostel':         'Social, budget',
        'resort':         'Self-contained, pool',
      },
      locationOrder: ['transit', 'center', 'quiet', 'nature'],
      amenityPreset: ['workspace', 'breakfast', 'gym'],
    };
  } else if (groupType === 'group') {
    cfg = {
      ...cfg,
      headline:     'The whole group, one great base',
      subline:      'Space for everyone, great access to the city',
      contextBadge: '👥 Personalized for a group',
      accomOrder:   ['airbnb', 'luxury-hotel', 'boutique-hotel', 'hostel', 'resort'],
      accomDimmed:  [],
      accomDescriptions: {},
      locationOrder: ['center', 'quiet', 'transit', 'nature'],
      amenityPreset: ['pool', 'breakfast', 'parking'],
    };
  }

  // ── Budget overlay ─────────────────────────────────────────────────────────
  if (budget === 'budget') {
    cfg = {
      ...cfg,
      accomDimmed: [...new Set([...cfg.accomDimmed, 'luxury-hotel' as AccommodationType, 'resort' as AccommodationType])],
    };
  } else if (budget === 'luxury') {
    cfg = {
      ...cfg,
      accomDimmed: [...new Set([...cfg.accomDimmed, 'hostel' as AccommodationType])],
    };
  }

  return cfg;
}
```

- [ ] **Step 1.2 — Run TypeScript check**

```bash
cd "travel site" && npx tsc --noEmit --project tsconfig.json 2>&1 | grep "hotelPersonalization" | head -20
```

Expected: no errors mentioning `hotelPersonalization.ts`

- [ ] **Step 1.3 — Commit**

```bash
cd "travel site"
git add src/lib/hotelPersonalization.ts
git commit -m "feat: add getHotelPersonalization pure utility"
```

---

## Task 2 — Update `onboardingStore.ts`

**Files:**
- Modify: `src/state/onboardingStore.ts`

The store is missing `hotelLocationPref` and `hotelAmenities` fields, their initial values, actions, and persistence entries.

- [ ] **Step 2.1 — Add imports at top of file**

The file already imports `GroupDynamicsPayload`. Add the missing types to the same import:

Find this line (near top of file):
```typescript
import type { GroupDynamicsPayload } from '@/lib/types';
```

Replace with:
```typescript
import type { GroupDynamicsPayload, HotelLocationPref, HotelAmenity } from '@/lib/types';
```

- [ ] **Step 2.2 — Add fields to OnboardingState interface**

Find this block in the interface:
```typescript
  // Step 3b: Hotel preferences (when no hotel booked)
  accommodation:      'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort' | '';
  hotelNightlyBudget: 'budget' | 'mid' | 'comfort' | 'luxury' | '';
```

Replace with:
```typescript
  // Step 3b: Hotel preferences (when no hotel booked)
  accommodation:      'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort' | '';
  hotelNightlyBudget: 'budget' | 'mid' | 'comfort' | 'luxury' | '';
  hotelLocationPref:  HotelLocationPref[];
  hotelAmenities:     HotelAmenity[];
```

- [ ] **Step 2.3 — Add action signatures to OnboardingState interface**

Find this block in the interface (near the actions section):
```typescript
  setAccommodation:      (a: 'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort') => void;
  setHotelNightlyBudget: (b: OnboardingState['hotelNightlyBudget']) => void;
```

Replace with:
```typescript
  setAccommodation:      (a: 'hostel' | 'boutique-hotel' | 'luxury-hotel' | 'airbnb' | 'resort') => void;
  setHotelNightlyBudget: (b: OnboardingState['hotelNightlyBudget']) => void;
  setHotelLocationPref:  (prefs: HotelLocationPref[]) => void;
  toggleHotelAmenity:    (amenity: HotelAmenity) => void;
```

- [ ] **Step 2.4 — Add initial values**

Find the INITIAL object block containing:
```typescript
  accommodation:      '',
  hotelNightlyBudget: '',
```

Replace with:
```typescript
  accommodation:      '',
  hotelNightlyBudget: '',
  hotelLocationPref:  [],
  hotelAmenities:     [],
```

- [ ] **Step 2.5 — Add action implementations**

Find these lines in the `create` implementation:
```typescript
      setAccommodation:      (a) => set({ accommodation: a }),
      setHotelNightlyBudget: (b) => set({ hotelNightlyBudget: b }),
```

Replace with:
```typescript
      setAccommodation:      (a) => set({ accommodation: a }),
      setHotelNightlyBudget: (b) => set({ hotelNightlyBudget: b }),
      setHotelLocationPref:  (prefs) => set({ hotelLocationPref: prefs }),
      toggleHotelAmenity: (amenity) => set((s) => {
        const current = s.hotelAmenities ?? [];
        const next = current.includes(amenity)
          ? current.filter((a) => a !== amenity)
          : [...current, amenity];
        return { hotelAmenities: next };
      }),
```

- [ ] **Step 2.6 — Add to partialize**

Find in the `partialize` function:
```typescript
        accommodation:      s.accommodation,
        hotelNightlyBudget: s.hotelNightlyBudget,
```

Replace with:
```typescript
        accommodation:       s.accommodation,
        hotelNightlyBudget:  s.hotelNightlyBudget,
        hotelLocationPref:   s.hotelLocationPref,
        hotelAmenities:      s.hotelAmenities,
```

- [ ] **Step 2.7 — Type check**

```bash
cd "travel site" && npx tsc --noEmit 2>&1 | grep "onboardingStore" | head -20
```

Expected: no errors

- [ ] **Step 2.8 — Commit**

```bash
cd "travel site"
git add src/state/onboardingStore.ts
git commit -m "feat(store): add hotelLocationPref and hotelAmenities fields and actions"
```

---

## Task 3 — Rewrite `SmartHotelStep.tsx` (path B)

**Files:**
- Rewrite: `src/app/onboarding/sections/SmartHotelStep.tsx`
- Update test: `src/app/onboarding/sections/SmartHotelStep.test.ts`

- [ ] **Step 3.1 — Replace the full file**

```typescript
// src/app/onboarding/sections/SmartHotelStep.tsx
'use client';

/**
 * SmartHotelStep — Step 4 of the onboarding wizard.
 *
 * Two paths:
 *   A) "I have a hotel" — geocode search → confirm (unchanged)
 *   B) "Help me choose" — 4 progressive blocks driven by traveler context:
 *        Block 1: Accommodation type (ordered + dimmed by persona)
 *        Block 2: Nightly budget (filtered by type — existing logic)
 *        Block 3: Where in the city? (hotelLocationPref — single select)
 *        Block 4: Must-haves? (hotelAmenities — multi select)
 *
 * Context (groupType, groupDynamics, budget) is read from onboardingStore
 * and passed to getHotelPersonalization() which returns the display config.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { getHotelPersonalization } from '@/lib/hotelPersonalization';
import type { AccommodationType, HotelAmenity, HotelLocationPref } from '@/lib/types';

const GOLD  = '#c5912a';
const MUTED = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.18 } },
};

// ── Static lookup tables ───────────────────────────────────────────────────────

const ACCOM_BASE: Record<AccommodationType, { label: string; icon: string; defaultDesc: string }> = {
  'hostel':         { label: 'Hostel / Guesthouse', icon: '🛏️', defaultDesc: 'Social, affordable, central' },
  'boutique-hotel': { label: 'Boutique Hotel',      icon: '🏨', defaultDesc: 'Character-driven, local feel' },
  'luxury-hotel':   { label: 'Luxury Hotel',        icon: '⭐', defaultDesc: '5-star service & amenities' },
  'airbnb':         { label: 'Apartment / Airbnb',  icon: '🏠', defaultDesc: 'Live like a local, full kitchen' },
  'resort':         { label: 'Resort',              icon: '🌴', defaultDesc: 'Self-contained, pool, curated' },
};

// ── Nightly budget (exported — used by test) ──────────────────────────────────

export const NIGHTLY_OPTIONS = [
  { value: 'budget'  as const, label: 'Up to $80',   icon: '🪙' },
  { value: 'mid'     as const, label: '$80 - $150',  icon: '💵' },
  { value: 'comfort' as const, label: '$150 - $300', icon: '💳' },
  { value: 'luxury'  as const, label: '$300+',       icon: '💎' },
] as const;

type NightlyOption = (typeof NIGHTLY_OPTIONS)[number];

export function getNightlyOptionsForAccommodation(
  accommodation: AccommodationType | '',
): readonly NightlyOption[] {
  switch (accommodation) {
    case 'hostel':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'budget' || o.value === 'mid');
    case 'luxury-hotel':
    case 'resort':
      return NIGHTLY_OPTIONS.filter((o) => o.value === 'comfort' || o.value === 'luxury');
    case 'boutique-hotel':
    case 'airbnb':
      return NIGHTLY_OPTIONS.filter((o) => o.value !== 'budget');
    default:
      return NIGHTLY_OPTIONS;
  }
}

// ── Location options ──────────────────────────────────────────────────────────

const LOCATION_OPTIONS: Record<
  HotelLocationPref,
  { label: string; icon: string; subLabel: (groupType: string) => string }
> = {
  center:  {
    label: 'City center',
    icon:  '🏙️',
    subLabel: (gt) => gt === 'family' ? 'Walk to attractions' : 'Walk to everything',
  },
  quiet:   {
    label: 'Quiet area',
    icon:  '🌿',
    subLabel: (gt) => gt === 'family' ? 'Safe, residential' : gt === 'couple' ? 'Intimate neighbourhood' : 'Residential, calm',
  },
  transit: {
    label: 'Near transit',
    icon:  '🚇',
    subLabel: (gt) => gt === 'family' ? 'Easy to get around' : 'Metro at your door',
  },
  nature:  {
    label: 'Nature / parks',
    icon:  '🌊',
    subLabel: (gt) => gt === 'family' ? 'Kids love the outdoors' : gt === 'couple' ? 'Scenic surroundings' : 'Green surroundings',
  },
};

// ── Amenity options ───────────────────────────────────────────────────────────

const AMENITY_OPTIONS: Record<HotelAmenity, { label: string; icon: string }> = {
  breakfast: { label: 'Breakfast',          icon: '☕' },
  pool:      { label: 'Pool',               icon: '🏊' },
  workspace: { label: 'Workspace',          icon: '💻' },
  gym:       { label: 'Gym',                icon: '🏋️' },
  parking:   { label: 'Parking',            icon: '🅿️' },
  spa:       { label: 'Spa',                icon: '🛁' },
  suite:     { label: 'Suite / extra space', icon: '🛏️' },
  rooftop:   { label: 'Rooftop',            icon: '🌅' },
  pets:      { label: 'Pet-friendly',       icon: '🐾' },
};
const ALL_AMENITIES = Object.keys(AMENITY_OPTIONS) as HotelAmenity[];

// ── Component ─────────────────────────────────────────────────────────────────

type Path = 'booked' | 'choose' | null;
type SearchStatus = 'idle' | 'loading' | 'found' | 'error';

interface Props {
  onComplete: () => void;
  onSkip:     () => void;
}

export function SmartHotelStep({ onComplete, onSkip }: Props) {
  const {
    hotelAddress, hotelLat, hotelLng,
    setHotelLocation, clearHotelLocation,
    accommodation, hotelNightlyBudget,
    hotelLocationPref, hotelAmenities,
    setAccommodation, setHotelNightlyBudget,
    setHotelLocationPref, toggleHotelAmenity,
    destination, groupType, groupDynamics, budget,
  } = useOnboardingStore();

  // Personalization config derived from traveler context
  const config = useMemo(
    () => getHotelPersonalization(groupType, groupDynamics, budget),
    [groupType, groupDynamics, budget],
  );

  const [path, setPath]             = useState<Path>(hotelAddress ? 'booked' : null);
  const [query, setQuery]           = useState(hotelAddress || '');
  const [searchStatus, setStatus]   = useState<SearchStatus>(hotelAddress ? 'found' : 'idle');
  const [errMsg, setErrMsg]         = useState('');

  const visibleNightlyOptions = useMemo(
    () => getNightlyOptionsForAccommodation(accommodation),
    [accommodation],
  );

  // Reset budget when accommodation changes and new type doesn't include current budget
  useEffect(() => {
    if (
      accommodation &&
      hotelNightlyBudget &&
      !visibleNightlyOptions.some((o) => o.value === hotelNightlyBudget)
    ) {
      setHotelNightlyBudget('');
    }
  }, [accommodation, hotelNightlyBudget, setHotelNightlyBudget, visibleNightlyOptions]);

  // Amenity display order: preset first, then the rest
  const orderedAmenities = useMemo(() => {
    const preset = config.amenityPreset.filter((a) => ALL_AMENITIES.includes(a));
    const rest   = ALL_AMENITIES.filter((a) => !preset.includes(a));
    return [...preset, ...rest];
  }, [config.amenityPreset]);

  // ── Path A helpers ────────────────────────────────────────────────────────

  async function handleSearch() {
    const q = query.trim();
    if (q.length < 3) return;
    setStatus('loading');
    setErrMsg('');
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (!data?.length) throw new Error('Not found');
      const { lat, lon, display_name } = data[0];
      setHotelLocation(display_name ?? q, parseFloat(lat), parseFloat(lon));
      setStatus('found');
    } catch {
      setStatus('error');
      setErrMsg('Hotel not found — try a different name or address');
    }
  }

  function handleClear() {
    clearHotelLocation();
    setQuery('');
    setStatus('idle');
  }

  function handlePathSelect(p: Path) {
    if (p === 'choose') {
      clearHotelLocation();
      setQuery('');
      setStatus('idle');
    }
    setPath(p);
  }

  function handleAccommodationSelect(type: AccommodationType) {
    setAccommodation(type);
    const next = getNightlyOptionsForAccommodation(type);
    if (hotelNightlyBudget && !next.some((o) => o.value === hotelNightlyBudget)) {
      setHotelNightlyBudget('');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div>
        {config.contextBadge && (
          <div
            className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3"
            style={{ background: 'rgba(197,145,42,0.12)', color: GOLD, border: '1px solid rgba(197,145,42,0.25)' }}
          >
            {config.contextBadge}
          </div>
        )}
        <h2 className="text-2xl font-black text-white tracking-tight">{config.headline}</h2>
        <p className="text-sm mt-1" style={{ color: MUTED }}>{config.subline}</p>
      </div>

      {/* Path selector */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { p: 'booked' as Path, icon: '🏨', label: 'I already have a hotel', sub: 'Let me enter it' },
          { p: 'choose' as Path, icon: '🔍', label: 'Help me choose',          sub: 'Set my preferences' },
        ] as const).map(({ p, icon, label, sub }) => {
          const sel = path === p;
          return (
            <motion.button
              key={p!}
              onClick={() => handlePathSelect(p)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              animate={sel
                ? { boxShadow: `0 0 0 2px ${GOLD}, 0 10px 28px -6px rgba(197,145,42,0.28)` }
                : { boxShadow: 'none' }
              }
              className="relative flex flex-col items-start gap-2 p-4 rounded-2xl border text-left transition-colors"
              style={sel
                ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }
              }
            >
              {sel && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: GOLD }}>
                  <span className="text-white text-[9px] font-bold">✓</span>
                </motion.div>
              )}
              <span className="text-2xl leading-none">{icon}</span>
              <div>
                <p className="text-sm font-bold leading-tight"
                  style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>{label}</p>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{sub}</p>
              </div>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ── PATH A: Hotel search (unchanged) ──────────────────────── */}
        {path === 'booked' && (
          <motion.div key="booked-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-3">
            <AnimatePresence mode="wait">
              {searchStatus !== 'found' ? (
                <motion.div key="search-input"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex gap-2">
                  <div
                    className="flex-1 flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = `rgba(197,145,42,0.45)`)}
                    onBlur={(e)  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                  >
                    <span className="text-base shrink-0">🏨</span>
                    <input
                      type="text"
                      placeholder={`Hotel name or address in ${destination || 'your destination'}…`}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="flex-1 bg-transparent text-sm text-white placeholder-white/30 outline-none"
                    />
                  </div>
                  <motion.button
                    onClick={handleSearch}
                    disabled={query.trim().length < 3 || searchStatus === 'loading'}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="px-4 py-3 rounded-xl text-sm font-bold text-white disabled:opacity-40"
                    style={{ background: searchStatus === 'loading' ? 'rgba(197,145,42,0.30)' : GOLD }}
                  >
                    {searchStatus === 'loading' ? '…' : 'Find'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div key="hotel-found"
                  variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="flex items-start gap-3 px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(197,145,42,0.10)', border: '1.5px solid rgba(197,145,42,0.35)' }}>
                  <span className="text-xl mt-0.5">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{hotelAddress.split(',')[0]}</p>
                    <p className="text-[11px] mt-0.5 truncate" style={{ color: MUTED }}>{hotelAddress}</p>
                    {hotelLat != null && (
                      <p className="text-[10px] mt-1 font-mono" style={{ color: 'rgba(79,95,118,0.7)' }}>
                        {hotelLat.toFixed(4)}, {hotelLng!.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <button onClick={handleClear} aria-label="Clear hotel"
                    className="shrink-0 text-sm mt-0.5 transition-colors"
                    style={{ color: 'rgba(197,145,42,0.5)' }}>✕</button>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {searchStatus === 'error' && (
                <motion.p variants={reveal} initial="hidden" animate="visible" exit="exit"
                  className="text-sm px-4 py-2.5 rounded-xl"
                  style={{ background: 'rgba(158,54,58,0.12)', color: '#f87171', border: '1px solid rgba(158,54,58,0.25)' }}>
                  ⚠️ {errMsg}
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* ── PATH B: Preferences (4 progressive blocks) ──────────── */}
        {path === 'choose' && (
          <motion.div key="choose-path"
            variants={reveal} initial="hidden" animate="visible" exit="exit"
            className="flex flex-col gap-5">

            {/* Block 1: Accommodation type */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                What kind of place?
              </p>
              <div className="flex flex-col gap-2">
                {config.accomOrder.map((type) => {
                  const base        = ACCOM_BASE[type];
                  const desc        = config.accomDescriptions[type] ?? base.defaultDesc;
                  const sel         = accommodation === type;
                  const dimmed      = !sel && config.accomDimmed.includes(type);
                  const highlighted = !dimmed && config.accomOrder.indexOf(type) < 2;
                  return (
                    <motion.button
                      key={type}
                      onClick={() => handleAccommodationSelect(type)}
                      whileHover={dimmed ? {} : { scale: 1.01, x: 2 }}
                      whileTap={dimmed ? {} : { scale: 0.98 }}
                      className="flex items-center gap-3.5 px-4 py-3 rounded-xl border text-left transition-all"
                      style={{
                        opacity: dimmed ? 0.4 : 1,
                        borderColor: sel
                          ? GOLD
                          : highlighted ? 'rgba(197,145,42,0.30)'
                          : 'rgba(255,255,255,0.07)',
                        background: sel
                          ? 'rgba(197,145,42,0.10)'
                          : highlighted ? 'rgba(197,145,42,0.04)'
                          : 'rgba(255,255,255,0.02)',
                      }}
                    >
                      <span className="text-xl shrink-0 leading-none">{base.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold leading-tight"
                          style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>{base.label}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>{desc}</p>
                      </div>
                      {sel && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="text-xs font-bold shrink-0" style={{ color: GOLD }}>✓</motion.span>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Block 2: Nightly budget — reveals after accommodation type chosen */}
            <AnimatePresence>
              {accommodation && (
                <motion.div key="nightly"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Nightly budget per room
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {visibleNightlyOptions.map((opt) => {
                      const sel = hotelNightlyBudget === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          onClick={() => setHotelNightlyBudget(opt.value)}
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          animate={sel ? { boxShadow: `0 0 0 2px ${GOLD}` } : { boxShadow: 'none' }}
                          className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                            : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                          }
                        >
                          <span className="text-lg shrink-0">{opt.icon}</span>
                          <span className="text-xs font-semibold leading-tight"
                            style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.82)' }}>{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block 3: Location preference — reveals after budget chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && (
                <motion.div key="location"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Where in the city?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {config.locationOrder.map((loc) => {
                      const opt = LOCATION_OPTIONS[loc];
                      const sel = (hotelLocationPref ?? []).includes(loc);
                      return (
                        <motion.button
                          key={loc}
                          onClick={() => setHotelLocationPref([loc])}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.97 }}
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                            : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                          }
                        >
                          <span className="text-base shrink-0">{opt.icon}</span>
                          <div>
                            <p className="text-xs font-semibold leading-tight"
                              style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.85)' }}>{opt.label}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                              {opt.subLabel(groupType)}
                            </p>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Block 4: Amenities — reveals after location chosen */}
            <AnimatePresence>
              {accommodation && hotelNightlyBudget && (hotelLocationPref ?? []).length > 0 && (
                <motion.div key="amenities"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } }}
                  exit={{ opacity: 0 }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
                    Must-haves?{' '}
                    <span className="normal-case font-normal">pick any</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {orderedAmenities.map((amenity) => {
                      const opt = AMENITY_OPTIONS[amenity];
                      const sel = (hotelAmenities ?? []).includes(amenity);
                      return (
                        <motion.button
                          key={amenity}
                          onClick={() => toggleHotelAmenity(amenity)}
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.96 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors"
                          style={sel
                            ? { borderColor: GOLD, background: 'rgba(197,145,42,0.12)', color: '#d4a235' }
                            : { borderColor: 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.75)' }
                          }
                        >
                          <span>{opt.icon}</span>
                          <span>{opt.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Skip */}
      <button
        onClick={onSkip}
        className="text-xs text-center transition-colors"
        style={{ color: 'rgba(79,95,118,0.7)' }}
      >
        Skip — I&apos;ll add my hotel later
      </button>

    </div>
  );
}
```

- [ ] **Step 3.2 — Update the test file** (keeps existing tests + adds new ones)

Replace `src/app/onboarding/sections/SmartHotelStep.test.ts` with:

```typescript
import assert from 'node:assert/strict';
import { getNightlyOptionsForAccommodation } from './SmartHotelStep';
import { getHotelPersonalization } from '../../lib/hotelPersonalization';

// ── existing tests (unchanged) ──────────────────────────────────────────────

const labels = (accommodation: Parameters<typeof getNightlyOptionsForAccommodation>[0]) =>
  getNightlyOptionsForAccommodation(accommodation).map((option) => option.label);

assert.deepEqual(labels('luxury-hotel'), ['$150 - $300', '$300+']);
assert.deepEqual(labels('resort'),       ['$150 - $300', '$300+']);
assert.deepEqual(labels('boutique-hotel'), ['$80 - $150', '$150 - $300', '$300+']);
assert.deepEqual(labels('hostel'),       ['Up to $80', '$80 - $150']);
assert.deepEqual(labels('airbnb'),       ['$80 - $150', '$150 - $300', '$300+']);

console.log('✓ getNightlyOptionsForAccommodation — all label tests passed');

// ── new personalization tests ────────────────────────────────────────────────

// Default (no group type)
const defaultCfg = getHotelPersonalization('', null, '');
assert.equal(defaultCfg.contextBadge, null, 'default: no badge');
assert.equal(defaultCfg.accomOrder.length, 5, 'default: 5 options');
assert.ok(defaultCfg.amenityPreset.length > 0, 'default: some amenities');

// Solo digital-nomad
const nomad = getHotelPersonalization('solo', { subType: 'digital-nomad' }, 'mid-range');
assert.equal(nomad.accomOrder[0], 'boutique-hotel', 'nomad: boutique first');
assert.equal(nomad.accomOrder[1], 'airbnb',         'nomad: airbnb second');
assert.ok(nomad.amenityPreset.includes('workspace'), 'nomad: workspace preset');
assert.ok(nomad.accomDimmed.includes('resort'),      'nomad: resort dimmed');
assert.ok(nomad.contextBadge !== null,               'nomad: badge shown');

// Family
const family = getHotelPersonalization('family', null, 'mid-range');
assert.equal(family.accomOrder[0], 'airbnb',  'family: airbnb first');
assert.equal(family.accomOrder[1], 'resort',  'family: resort second');
assert.ok(family.amenityPreset.includes('pool'),     'family: pool preset');
assert.ok(family.accomDimmed.includes('hostel'),     'family: hostel dimmed');

// Couple romantic
const romantic = getHotelPersonalization('couple', { subType: 'romantic' }, 'mid-range');
assert.equal(romantic.accomOrder[0], 'boutique-hotel', 'romantic: boutique first');
assert.equal(romantic.accomOrder[1], 'luxury-hotel',   'romantic: luxury second');
assert.ok(romantic.amenityPreset.includes('rooftop'),  'romantic: rooftop preset');

// Budget overlay
const budgetSolo = getHotelPersonalization('solo', { subType: 'adventure' }, 'budget');
assert.ok(budgetSolo.accomDimmed.includes('luxury-hotel'), 'budget: dims luxury');
assert.ok(budgetSolo.accomDimmed.includes('resort'),       'budget: dims resort');

// Luxury overlay
const luxuryCouple = getHotelPersonalization('couple', { subType: 'romantic' }, 'luxury');
assert.ok(luxuryCouple.accomDimmed.includes('hostel'), 'luxury: dims hostel');

// Group work-crew
const workCrew = getHotelPersonalization('group', { subType: 'work-crew' }, 'mid-range');
assert.equal(workCrew.accomOrder[0], 'luxury-hotel',           'work-crew: luxury first');
assert.ok(workCrew.amenityPreset.includes('workspace'),         'work-crew: workspace preset');
assert.ok(workCrew.locationOrder[0] === 'transit',              'work-crew: transit first');

console.log('✓ getHotelPersonalization — all personalization tests passed');
console.log('All SmartHotelStep tests passed ✅');
```

- [ ] **Step 3.3 — Run the tests**

```bash
cd "travel site" && npx tsx src/app/onboarding/sections/SmartHotelStep.test.ts
```

Expected output:
```
✓ getNightlyOptionsForAccommodation — all label tests passed
✓ getHotelPersonalization — all personalization tests passed
All SmartHotelStep tests passed ✅
```

- [ ] **Step 3.4 — Type check**

```bash
cd "travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors

- [ ] **Step 3.5 — Commit**

```bash
cd "travel site"
git add src/app/onboarding/sections/SmartHotelStep.tsx src/app/onboarding/sections/SmartHotelStep.test.ts
git commit -m "feat: rewrite SmartHotelStep with context-aware 4-block path B"
```

---

## Task 4 — Wire URL params in `onboarding/page.tsx`

**Files:**
- Modify: `src/app/onboarding/page.tsx`

The `handleGenerateTrip()` function currently passes `accommodation` and `hotelNightlyBudget` but not the two new fields.

- [ ] **Step 4.1 — Add the new params to handleGenerateTrip**

Find this block in `handleGenerateTrip()`:
```typescript
    // Accommodation preferences (if no hotel booked)
    if (accommodation)      params.set('accommodation',      accommodation);
    if (hotelNightlyBudget) params.set('hotelNightlyBudget', hotelNightlyBudget);
```

Replace with:
```typescript
    // Accommodation preferences (if no hotel booked)
    if (accommodation)                   params.set('accommodation',      accommodation);
    if (hotelNightlyBudget)              params.set('hotelNightlyBudget', hotelNightlyBudget);
    if (hotelLocationPref?.length)       params.set('hotelLocationPref',  hotelLocationPref.join(','));
    if (hotelAmenities?.length)          params.set('hotelAmenities',     hotelAmenities.join(','));
```

- [ ] **Step 4.2 — Make sure the destructure at the top of the component includes the new fields**

Find the destructure of `useOnboardingStore()` in the component (it already includes `accommodation` and `hotelNightlyBudget`). Ensure it also includes:

```typescript
    hotelLocationPref, hotelAmenities,
```

Search for the existing destructure. It will look like:
```typescript
  const {
    ...
    accommodation, hotelNightlyBudget,
    ...
  } = useOnboardingStore();
```

Add the two new fields to the same destructure:
```typescript
    accommodation, hotelNightlyBudget, hotelLocationPref, hotelAmenities,
```

- [ ] **Step 4.3 — Type check**

```bash
cd "travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors

- [ ] **Step 4.4 — Commit**

```bash
cd "travel site"
git add src/app/onboarding/page.tsx
git commit -m "feat(onboarding): pass hotelLocationPref and hotelAmenities to /plan"
```

---

## Task 5 — Read new params in `plan/page.tsx`

**Files:**
- Modify: `src/app/plan/page.tsx`

The plan page reads URL params and hydrates `form`. It already uses `hotelLocationPref` and `hotelAmenities` from `form` when building `TravelerProfile` (lines 1162–1163), but it never reads them from the URL. Fix that now.

- [ ] **Step 5.1 — Read the new params from searchParams**

Find this block (around line 843):
```typescript
    const preAccommodation      = searchParams.get('accommodation')      ?? '';
    const preHotelNightlyBudget = searchParams.get('hotelNightlyBudget') ?? '';
```

Replace with:
```typescript
    const preAccommodation       = searchParams.get('accommodation')      ?? '';
    const preHotelNightlyBudget  = searchParams.get('hotelNightlyBudget') ?? '';
    const preHotelLocationRaw    = searchParams.get('hotelLocationPref')  ?? '';
    const preHotelLocationPref   = preHotelLocationRaw
      ? preHotelLocationRaw.split(',').filter(Boolean)
      : [];
    const preHotelAmenitiesRaw   = searchParams.get('hotelAmenities')     ?? '';
    const preHotelAmenities      = preHotelAmenitiesRaw
      ? preHotelAmenitiesRaw.split(',').filter(Boolean)
      : [];
```

- [ ] **Step 5.2 — Hydrate them into form**

Find this block inside `setForm({...})` (around line 917):
```typescript
      accommodation:     validAccommodations.includes(preAccommodation)     ? preAccommodation         : '',
      hotelNightlyBudget: validNightlyBudgets.includes(preHotelNightlyBudget) ? preHotelNightlyBudget : '',
```

Replace with:
```typescript
      accommodation:      validAccommodations.includes(preAccommodation)       ? preAccommodation      : '',
      hotelNightlyBudget: validNightlyBudgets.includes(preHotelNightlyBudget)  ? preHotelNightlyBudget : '',
      hotelLocationPref:  preHotelLocationPref,
      hotelAmenities:     preHotelAmenities,
```

- [ ] **Step 5.3 — Type check**

```bash
cd "travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: no errors

- [ ] **Step 5.4 — Commit**

```bash
cd "travel site"
git add src/app/plan/page.tsx
git commit -m "feat(plan): read hotelLocationPref and hotelAmenities from URL params"
```

---

## Task 6 — Final integration check

- [ ] **Step 6.1 — Run all tests**

```bash
cd "travel site" && npx tsx src/app/onboarding/sections/SmartHotelStep.test.ts
```

Expected:
```
✓ getNightlyOptionsForAccommodation — all label tests passed
✓ getHotelPersonalization — all personalization tests passed
All SmartHotelStep tests passed ✅
```

- [ ] **Step 6.2 — Full TypeScript check (zero errors)**

```bash
cd "travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l
```

Expected: `0`

- [ ] **Step 6.3 — Build check**

```bash
cd "travel site" && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (or similar Next.js success output)

- [ ] **Step 6.4 — Push to GitHub**

```bash
cd "travel site" && git push origin master
```

---

## What to verify manually in the browser

After `npm run dev`:

1. Start a new onboarding at `/onboarding`
2. Pick any destination → dates → complete Vibe step as **Couple / Romantic**
3. Reach the hotel step — verify:
   - Badge shows "💑 Personalized for a couple's escape"
   - Boutique Hotel and Luxury Hotel have a subtle gold highlight
   - Hostel is dimmed (opacity 0.4)
   - Descriptions are persona-specific
4. Click "Help me choose", select Boutique Hotel → budget appears ✓
5. Select $150-$300 → Location grid appears ✓ (4 buttons: center, quiet, transit, nature)
6. Select "City center" → Amenities row appears ✓ (rooftop, breakfast, spa shown first)
7. Select 2 amenities → Continue
8. Reach `/plan` → check the URL contains `hotelLocationPref=center&hotelAmenities=rooftop,breakfast`
9. Generate a trip → in the AI response, `basecamp.recommendations` should mention location and amenity preferences

---

## Self-review notes

- `prompts.ts` **already** handles `hotelLocationPref` and `hotelAmenities` (lines 521–534) — no changes needed there ✓
- `types.ts` **already** has `HotelLocationPref`, `HotelAmenity`, and all their values — no changes needed ✓
- Existing test for `getNightlyOptionsForAccommodation` is preserved in the updated test file — backward compat ✓
- `getHotelPersonalization` is a pure function — easy to test, no React/store dependencies ✓
- All 5 accommodation types always appear (dimmed ones are at 0.4 opacity, still selectable if user wants) ✓
- No DB changes, no API route changes ✓
