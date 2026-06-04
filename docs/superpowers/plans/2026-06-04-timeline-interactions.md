# Timeline Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire three interactive features on the DayTimeline: a Google Maps navigate button, a PlaceDetailCube modal ("Explore Details"), and an AlternativePickerPanel ("Find Alternative") with 2 AI proposals + free-text fallback.

**Architecture:** All backend infrastructure already exists — `/api/swap-proposals` returns 2 alternatives, `/api/swap` commits a chosen one. We only need to build 2 new UI components (`PlaceDetailCube`, `AlternativePickerPanel`), update `DayTimeline` to call new props, and update `DayDetailPanel` to own the state and render the modals.

**Tech Stack:** Next.js 14 App Router, TypeScript, React hooks, Framer Motion, Tailwind CSS v4. Tests with `node:assert/strict` + `npx tsx`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/components/DayTimeline.tsx` | **MODIFY** | Add `buildMapsDirectionsUrl`, `slotForDining`, `SwapTarget` type; new props `onExplore` + `onFindAlternative`; wire Navigate link |
| `src/components/DayTimeline.test.ts` | **MODIFY** | Add tests for the 2 new pure helpers |
| `src/components/PlaceDetailCube.tsx` | **CREATE** | Floating modal: photo header + whyThis + meta + navigate/website footer |
| `src/components/AlternativePickerPanel.tsx` | **CREATE** | Loading → 2 proposals → free text → commit |
| `src/components/DayDetailPanel.tsx` | **MODIFY** | Own `activePlace` + `activeSwap` state; pass new props to DayTimeline; render both modals |
| `src/components/ItineraryClient.tsx` | **MODIFY** | Pass `onCommitActivitySwap` prop to DayDetailPanel |

**Backend files — NO CHANGES needed:**
- `/api/swap-proposals/route.ts` — already returns `{ alternatives: SwapProposalAlternative[] }`
- `/api/swap/route.ts` — `replacementActivity` path already commits without LLM
- `src/lib/prompts.ts` — `buildSwapProposalsPrompt` already implemented

---

## Task 1: DayTimeline — pure helpers + new props

**Files:**
- Modify: `src/components/DayTimeline.tsx`
- Modify: `src/components/DayTimeline.test.ts`

- [ ] **Step 1: Write failing tests for new helpers**

Add to the BOTTOM of `src/components/DayTimeline.test.ts` (after existing assertions):

```typescript
// ── NEW: buildMapsDirectionsUrl ───────────────────────────────────────────
import { buildMapsDirectionsUrl, slotForDining } from './DayTimeline';

// Full params
const url1 = buildMapsDirectionsUrl('Café Sillon', 'Vieux Lyon', 'Lyon');
assert.ok(url1.startsWith('https://www.google.com/maps/dir/?api=1&destination='), `bad prefix: ${url1}`);
assert.ok(url1.includes('Caf%C3%A9') || url1.includes('Caf'), `missing name in: ${url1}`);

// Missing neighborhood (should still work)
const url2 = buildMapsDirectionsUrl('Colosseum', undefined, 'Rome');
assert.ok(url2.includes('Colosseum'), `missing name: ${url2}`);
assert.ok(!url2.includes('undefined'), `undefined in URL: ${url2}`);

// slotForDining
assert.equal(slotForDining('lunch'), 'morning');
assert.equal(slotForDining('dinner'), 'evening');

console.log('✓ DayTimeline helpers: all NEW assertions passed');
```

- [ ] **Step 2: Run test — expect failure**

```bash
cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
npx tsx src/components/DayTimeline.test.ts
```

Expected: `SyntaxError` or `is not a function` — `buildMapsDirectionsUrl` not yet exported.

- [ ] **Step 3: Add pure helpers + new types + new props to DayTimeline.tsx**

Replace the entire content of `src/components/DayTimeline.tsx` with:

```tsx
'use client';

import { motion } from 'framer-motion';
import type { DayPlan, Activity, DiningSpot } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

// ── Pure helpers (exported for tests) ────────────────────────────────────────

export function isHotelCheckIn(activity: Pick<Activity, 'name'>): boolean {
  return /(check[- ]?in|hotel|accommodation)/i.test(activity.name ?? '');
}

export type TimelineRowType = 'activity' | 'dining';

export interface TimelineRow {
  type: TimelineRowType;
  slot: string;
  name: string;
  time: string;
  emoji: string;
  activity?: Activity;
  dining?: DiningSpot;
}

/** Build ordered timeline rows: morning → lunch → afternoon → dinner → evening */
export function buildTimelineRows(day: DayPlan): TimelineRow[] {
  const rows: TimelineRow[] = [];
  if (day.morning) {
    rows.push({ type: 'activity', slot: 'morning', name: day.morning.name ?? 'Morning activity', time: day.morning.startTime ?? day.morning.time_slot?.split('–')[0]?.trim() ?? 'Morning', emoji: day.morning.category_emoji ?? (isHotelCheckIn(day.morning) ? '🏨' : '☀️'), activity: day.morning });
  }
  if (day.lunch) {
    rows.push({ type: 'dining', slot: 'lunch', name: day.lunch.name ?? 'Lunch', time: 'Lunch', emoji: '🍽️', dining: day.lunch });
  }
  if (day.afternoon) {
    rows.push({ type: 'activity', slot: 'afternoon', name: day.afternoon.name ?? 'Afternoon activity', time: day.afternoon.startTime ?? day.afternoon.time_slot?.split('–')[0]?.trim() ?? 'Afternoon', emoji: day.afternoon.category_emoji ?? '🌤', activity: day.afternoon });
  }
  if (day.dinner) {
    rows.push({ type: 'dining', slot: 'dinner', name: day.dinner.name ?? 'Dinner', time: 'Dinner', emoji: '🍷', dining: day.dinner });
  }
  if (day.evening) {
    rows.push({ type: 'activity', slot: 'evening', name: day.evening.name ?? 'Evening activity', time: day.evening.startTime ?? day.evening.time_slot?.split('–')[0]?.trim() ?? 'Evening', emoji: day.evening.category_emoji ?? '🌙', activity: day.evening });
  }
  return rows;
}

/** Google Maps directions URL from current location to a named place. */
export function buildMapsDirectionsUrl(name: string, neighborhood: string | undefined, city: string): string {
  const dest = [name, neighborhood, city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}

/** Map dining field to nearest activity slot for the swap API. */
export function slotForDining(field: 'lunch' | 'dinner'): 'morning' | 'evening' {
  return field === 'lunch' ? 'morning' : 'evening';
}

// ── SwapTarget — passed to onFindAlternative ──────────────────────────────────

export interface SwapTarget {
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  diningField?: 'lunch' | 'dinner';
  currentName: string;
  neighborhood?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  ui: ItineraryUiStrings;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  onExplore: (row: TimelineRow) => void;
  onFindAlternative: (target: SwapTarget) => void;
}

export function DayTimeline({
  day, dayIndex, destination, onSwapSlot: _onSwapSlot,
  onNeighborhoodClick, onExplore, onFindAlternative,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ui: _ui,
}: DayTimelineProps) {
  const rows = buildTimelineRows(day);

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[#888] bg-white rounded-2xl" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
        No activities planned for this day yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {rows.map((row, i) => {
        // Build swap target for this row
        const slot = row.type === 'activity'
          ? (row.slot as 'morning' | 'afternoon' | 'evening')
          : slotForDining(row.slot as 'lunch' | 'dinner');
        const diningField = row.type === 'dining' ? (row.slot as 'lunch' | 'dinner') : undefined;
        const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;

        const swapTarget: SwapTarget = { dayIndex, slot, diningField, currentName: row.name, neighborhood };

        return (
          <TimelineItem
            key={`${row.slot}-${i}`}
            row={row}
            isLast={i === rows.length - 1}
            destination={destination}
            swapTarget={swapTarget}
            onExplore={() => onExplore(row)}
            onFindAlternative={() => onFindAlternative(swapTarget)}
            onNeighborhoodClick={onNeighborhoodClick}
          />
        );
      })}
    </div>
  );
}

function TimelineItem({
  row, isLast, destination, swapTarget: _swapTarget,
  onExplore, onFindAlternative, onNeighborhoodClick,
}: {
  row: TimelineRow;
  isLast: boolean;
  destination: string;
  swapTarget: SwapTarget;
  onExplore: () => void;
  onFindAlternative: () => void;
  onNeighborhoodClick: (n: string) => void;
}) {
  const isCheckIn = row.type === 'activity' && row.activity && isHotelCheckIn(row.activity);
  const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;
  const mapsUrl = buildMapsDirectionsUrl(row.name, neighborhood, destination);

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Time */}
      <span className="text-[13px] font-bold flex-shrink-0 w-[52px] pt-0.5" style={{ color: '#5aada5' }}>
        {row.time}
      </span>

      {/* Icon */}
      <span className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5" style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}>
        {row.emoji}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className="text-[13px] font-bold text-[#222]">{row.name}</span>
          {row.activity?.isHiddenGem && (
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}>
              💎 Hidden Gem
            </span>
          )}
        </div>

        {neighborhood && (
          <button type="button" onClick={() => onNeighborhoodClick(neighborhood)} className="text-[11px] text-[#5aada5] hover:underline mb-2 block text-left">
            📍 {neighborhood}
          </button>
        )}

        <div className="flex flex-wrap gap-1.5 items-center">
          {isCheckIn ? (
            <>
              <TlBtn onClick={onExplore}>Hotel Details</TlBtn>
              <TlBtn onClick={onFindAlternative} primary>Change Hotel</TlBtn>
            </>
          ) : row.type === 'dining' ? (
            <>
              <TlBtn onClick={onFindAlternative} primary>Find Alternative</TlBtn>
              <TlBtn onClick={onExplore}>Explore Details</TlBtn>
            </>
          ) : (
            <>
              <TlBtn onClick={onFindAlternative} primary>Modify</TlBtn>
              <TlBtn onClick={onExplore}>Explore Details</TlBtn>
            </>
          )}
          {/* Google Maps navigate link — every row */}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors hover:bg-blue-50"
            style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
            </svg>
            Navigate
          </a>
        </div>
      </div>
    </div>
  );
}

function TlBtn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className="text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-colors"
      style={primary
        ? { background: '#5aada5', color: '#fff', border: '1px solid #5aada5' }
        : { background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx tsx src/components/DayTimeline.test.ts
```

Expected output (2 lines — old + new):
```
✓ DayTimeline helpers: all 11 assertions passed
✓ DayTimeline helpers: all NEW assertions passed
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: errors ONLY about `onExplore` / `onFindAlternative` not yet passed by `DayDetailPanel` — those are fine, we fix in Task 4.

- [ ] **Step 6: Commit**

```bash
git add src/components/DayTimeline.tsx src/components/DayTimeline.test.ts
git commit -m "feat(timeline): add navigate link, onExplore, onFindAlternative, SwapTarget"
```

---

## Task 2: PlaceDetailCube

**Files:**
- Create: `src/components/PlaceDetailCube.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/PlaceDetailCube.tsx`:

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { TimelineRow } from '@/components/DayTimeline';
import { buildMapsDirectionsUrl } from '@/components/DayTimeline';

interface PlaceDetailCubeProps {
  row: TimelineRow;
  destination: string;
  onClose: () => void;
}

export function PlaceDetailCube({ row, destination, onClose }: PlaceDetailCubeProps) {
  const activity = row.activity;
  const dining = row.dining;

  const name = activity?.name ?? dining?.name ?? row.name;
  const neighborhood = activity?.neighborhood ?? dining?.neighborhood;
  const whyText = activity?.whyThis ?? activity?.description ?? 'A curated pick for your trip.';
  const duration = activity?.duration;
  const cost = activity?.estimatedCost;
  const tags = activity?.tags ?? [];
  const isHiddenGem = activity?.isHiddenGem ?? false;
  const verificationStatus = activity?.verificationStatus;
  const websiteUrl = activity?.website_url ?? dining?.website_url;
  const photoQuery = `${name} ${destination} landmark`;
  const mapsUrl = buildMapsDirectionsUrl(name, neighborhood, destination);

  const verificationBadge = (() => {
    if (verificationStatus === 'verified-open') return { text: '✓ Verified open', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.2)' };
    if (verificationStatus === 'flagged-closed') return { text: '⚠ May be closed', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.2)' };
    if (verificationStatus === 'flagged-renovating') return { text: '🔧 Renovating', color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)' };
    return null;
  })();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        {/* Card */}
        <motion.div
          className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] overflow-hidden z-10 flex flex-col"
          style={{ background: '#fff', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.4)', maxHeight: '88dvh' }}
          initial={{ y: '100%', scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '60%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {/* Photo header */}
          <div className="relative flex-shrink-0 h-[180px] overflow-hidden">
            <DayPhoto query={photoQuery} alt={name} height={180} dark />

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

            {/* Close button */}
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.85 }}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
            >
              ✕
            </motion.button>

            {/* Name + neighborhood on photo */}
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="text-[20px] font-black text-white leading-tight mb-1">{name}</h3>
              {neighborhood && (
                <p className="text-[12px] text-white/75 font-semibold">📍 {neighborhood}</p>
              )}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 flex flex-col gap-4">

              {/* Why we chose this */}
              <div className="rounded-xl p-4" style={{ background: '#f0faf9', border: '1px solid rgba(90,173,165,0.18)' }}>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#5aada5] mb-2">
                  💡 Why we chose this
                </div>
                <p className="text-[13px] text-[#333] leading-relaxed">{whyText}</p>
              </div>

              {/* Meta row */}
              {(duration || cost || verificationBadge || isHiddenGem) && (
                <div className="flex flex-wrap gap-2 items-center">
                  {duration && (
                    <span className="text-[12px] font-semibold text-[#555] flex items-center gap-1">
                      <span>⏱</span> {duration}
                    </span>
                  )}
                  {cost && (
                    <span className="text-[12px] font-semibold text-[#555] flex items-center gap-1">
                      <span>·</span>
                      <span>💰</span> {cost}
                    </span>
                  )}
                  {verificationBadge && (
                    <span
                      className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ color: verificationBadge.color, background: verificationBadge.bg, border: `1px solid ${verificationBadge.border}` }}
                    >
                      {verificationBadge.text}
                    </span>
                  )}
                  {isHiddenGem && (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}>
                      💎 Hidden Gem
                    </span>
                  )}
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#e8f4f2', color: '#3a8a82' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 flex gap-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
              style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
              </svg>
              Navigate
            </a>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold transition-colors"
                style={{ background: '#5aada5', color: '#fff' }}
              >
                🌐 Official Site
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "PlaceDetailCube" | head -5
```

Expected: no errors for PlaceDetailCube.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlaceDetailCube.tsx
git commit -m "feat(ui): add PlaceDetailCube modal (Explore Details)"
```

---

## Task 3: AlternativePickerPanel

**Files:**
- Create: `src/components/AlternativePickerPanel.tsx`

- [ ] **Step 1: Check the SwapProposalAlternative type**

```bash
grep -n "SwapProposalAlternative\|export interface\|placeIntro\|whyItFitsYou" "src/app/api/swap-proposals/route.ts" | head -10
```

Confirm the type is:
```typescript
interface SwapProposalAlternative {
  placeIntro: string;
  whyItFitsYou: string;
  activity: Activity;
}
```

- [ ] **Step 2: Create the component**

Create `src/components/AlternativePickerPanel.tsx`:

```tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Activity, Itinerary, TravelerProfile } from '@/lib/types';
import type { SwapTarget } from '@/components/DayTimeline';
import type { SwapProposalAlternative } from '@/app/api/swap-proposals/route';

interface AlternativePickerPanelProps {
  target: SwapTarget;
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  onCommit: (activity: Activity, summary: string, diningField?: 'lunch' | 'dinner') => void;
  onClose: () => void;
}

type PanelState = 'loading' | 'results' | 'error';

export function AlternativePickerPanel({
  target, itinerary, profile, onCommit, onClose,
}: AlternativePickerPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('loading');
  const [alternatives, setAlternatives] = useState<SwapProposalAlternative[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [customText, setCustomText] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch proposals on mount
  useEffect(() => {
    let cancelled = false;
    setPanelState('loading');

    const fetchProposals = async (request?: string) => {
      try {
        const res = await fetch('/api/swap-proposals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            itinerary,
            dayIndex: target.dayIndex,
            slot: target.slot,
            profile: profile ?? null,
            ...(request ? { request } : {}),
          }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok || !Array.isArray(data.alternatives) || data.alternatives.length < 2) {
            setErrorMsg(data.error ?? 'No suggestions returned. Try describing what you want below.');
            setPanelState('error');
          } else {
            setAlternatives(data.alternatives);
            setSelectedIdx(0);
            setPanelState('results');
          }
        }
      } catch {
        if (!cancelled) {
          setErrorMsg('Connection error. Try typing a custom request below.');
          setPanelState('error');
        }
      }
    };

    void fetchProposals();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCustomSubmit = async () => {
    if (!customText.trim()) return;
    setCustomLoading(true);
    try {
      const res = await fetch('/api/swap-proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itinerary,
          dayIndex: target.dayIndex,
          slot: target.slot,
          profile: profile ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.alternatives) || data.alternatives.length < 2) {
        setErrorMsg(data.error ?? 'No results. Try a different description.');
      } else {
        setAlternatives(data.alternatives);
        setSelectedIdx(0);
        setPanelState('results');
        setCustomText('');
      }
    } catch {
      setErrorMsg('Connection error. Please try again.');
    } finally {
      setCustomLoading(false);
    }
  };

  const handleConfirm = () => {
    const chosen = alternatives[selectedIdx];
    if (!chosen) return;
    const summary = `Swapped to ${chosen.activity.name}`;
    onCommit(chosen.activity, summary, target.diningField);
  };

  const locationHint = target.neighborhood ?? itinerary.destination ?? '';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] overflow-hidden z-10 flex flex-col"
          style={{ background: '#fff', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.4)', maxHeight: '88dvh' }}
          initial={{ y: '100%', scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '60%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {/* Handle */}
          <div className="flex-shrink-0 pt-3 pb-1 flex justify-center sm:hidden">
            <div className="w-10 h-1 rounded-full bg-black/15" />
          </div>

          {/* Header */}
          <div className="flex-shrink-0 px-5 pt-4 pb-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#5aada5] mb-1">
                  Find Alternative
                </div>
                <h3 className="text-[15px] font-black text-[#222]">
                  Replace: {target.currentName}
                </h3>
                {locationHint && (
                  <p className="text-[12px] text-[#888] mt-0.5">📍 {locationHint}</p>
                )}
              </div>
              <motion.button
                type="button"
                onClick={onClose}
                whileTap={{ scale: 0.85 }}
                aria-label="Close"
                className="w-7 h-7 rounded-full flex items-center justify-center text-[#888] text-xs"
                style={{ background: 'rgba(0,0,0,0.06)' }}
              >
                ✕
              </motion.button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">

            {/* LOADING */}
            {panelState === 'loading' && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 px-5">
                <div
                  className="w-8 h-8 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(90,173,165,0.2)', borderTopColor: '#5aada5' }}
                />
                <p className="text-[13px] text-[#888]">
                  Finding the best options near {locationHint || 'your location'}…
                </p>
              </div>
            )}

            {/* RESULTS */}
            {(panelState === 'results' || panelState === 'error') && (
              <div className="p-4 flex flex-col gap-3">

                {panelState === 'results' && alternatives.map((alt, idx) => (
                  <motion.button
                    key={alt.activity.name ?? idx}
                    type="button"
                    onClick={() => setSelectedIdx(idx)}
                    whileTap={{ scale: 0.98 }}
                    className="w-full text-left rounded-2xl p-4 transition-all"
                    style={{
                      border: selectedIdx === idx ? '2px solid #5aada5' : '2px solid rgba(90,173,165,0.2)',
                      background: selectedIdx === idx ? '#e8f4f2' : 'rgba(240,250,249,0.4)',
                    }}
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-[22px] flex-shrink-0">{alt.activity.category_emoji ?? '🏙️'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[14px] font-black text-[#222] mb-0.5">{alt.activity.name}</div>
                        <div className="text-[11px] text-[#888]">
                          {[alt.activity.neighborhood, alt.activity.estimatedCost].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {selectedIdx === idx && (
                        <span className="text-[#5aada5] text-base flex-shrink-0">✓</span>
                      )}
                    </div>
                    {/* Why it fits */}
                    <div
                      className="flex items-start gap-2 rounded-xl px-3 py-2"
                      style={{ background: 'rgba(90,173,165,0.08)', border: '1px solid rgba(90,173,165,0.15)' }}
                    >
                      <span className="text-[12px] flex-shrink-0">💡</span>
                      <p className="text-[11px] text-[#3a8a82] leading-relaxed">{alt.whyItFitsYou}</p>
                    </div>
                  </motion.button>
                ))}

                {/* Error state message */}
                {panelState === 'error' && errorMsg && (
                  <div
                    className="rounded-xl p-3 text-[12px] text-[#888]"
                    style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
                  >
                    {errorMsg}
                  </div>
                )}

                {/* Divider */}
                <div className="flex items-center gap-3 my-1">
                  <div className="flex-1 h-px bg-black/08" />
                  <span className="text-[11px] text-[#aaa] font-semibold whitespace-nowrap">
                    {panelState === 'results' ? 'Neither works?' : 'Describe what you want'}
                  </span>
                  <div className="flex-1 h-px bg-black/08" />
                </div>

                {/* Custom text input */}
                <div className="flex gap-2 items-end">
                  <textarea
                    ref={textareaRef}
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleCustomSubmit(); } }}
                    rows={2}
                    placeholder="e.g. vegetarian-friendly, under €15, closer to the hotel…"
                    className="flex-1 rounded-xl px-3 py-2 text-[13px] text-[#333] outline-none resize-none"
                    style={{ border: '1px solid rgba(90,173,165,0.35)', background: '#fafffe', fontFamily: 'inherit' }}
                  />
                  <motion.button
                    type="button"
                    onClick={() => void handleCustomSubmit()}
                    disabled={!customText.trim() || customLoading}
                    whileTap={{ scale: 0.9 }}
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0 disabled:opacity-40"
                    style={{ background: '#5aada5' }}
                  >
                    {customLoading
                      ? <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      : '→'
                    }
                  </motion.button>
                </div>
              </div>
            )}
          </div>

          {/* Confirm footer — only when results shown */}
          {panelState === 'results' && (
            <div className="flex-shrink-0 px-5 pb-5 pt-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
              <motion.button
                type="button"
                onClick={handleConfirm}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3 rounded-xl text-[14px] font-black text-white"
                style={{ background: '#5aada5', boxShadow: '0 4px 14px rgba(90,173,165,0.45)' }}
              >
                ✓ Use {alternatives[selectedIdx]?.activity.name ?? 'selected option'}
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "AlternativePickerPanel" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/AlternativePickerPanel.tsx
git commit -m "feat(ui): add AlternativePickerPanel with 2 proposals + free text"
```

---

## Task 4: Wire DayDetailPanel

**Files:**
- Modify: `src/components/DayDetailPanel.tsx`

- [ ] **Step 1: Replace DayDetailPanel with the wired version**

Replace the full contents of `src/components/DayDetailPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { DayPhoto } from '@/components/DayPhoto';
import { DayTimeline, type TimelineRow, type SwapTarget } from '@/components/DayTimeline';
import { PlaceDetailCube } from '@/components/PlaceDetailCube';
import { AlternativePickerPanel } from '@/components/AlternativePickerPanel';
import type { DayPlan, Itinerary, TravelerProfile, Activity } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';
import type { ItineraryMapLabels } from '@/components/ItineraryMap';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full rounded-2xl animate-pulse"
        style={{ background: 'rgba(90,173,165,0.12)', border: '1px solid rgba(90,173,165,0.2)', minHeight: 400 }}
      />
    ),
  },
);

interface DayDetailPanelProps {
  day: DayPlan;
  dayIndex: number;
  totalDays: number;
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  mapLabels: ItineraryMapLabels;
  basecampMarker: { lat: number; lng: number; label: string } | null;
  focusedNeighborhood: string | undefined;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onCommitActivitySwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    activity: Activity,
    summary: string,
    diningField?: 'lunch' | 'dinner',
  ) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onBackToOverview: () => void;
}

export function DayDetailPanel({
  day, dayIndex, totalDays, itinerary, profile, ui, mapLabels,
  basecampMarker, focusedNeighborhood,
  onSwapSlot, onCommitActivitySwap, onNeighborhoodClick,
  onPrevDay, onNextDay, onBackToOverview,
}: DayDetailPanelProps) {
  const destination = itinerary.destination ?? '';
  const photoQuery = `${destination} ${day.theme ?? 'travel'} landmark`;
  const weatherEmoji = getWeatherEmoji(profile?.startDate, dayIndex);

  // ── Modal state ────────────────────────────────────────────────────────────
  const [activePlace, setActivePlace] = useState<TimelineRow | null>(null);
  const [activeSwap, setActiveSwap] = useState<SwapTarget | null>(null);

  const handleCommit = (activity: Activity, summary: string, diningField?: 'lunch' | 'dinner') => {
    onCommitActivitySwap(dayIndex, activeSwap!.slot, activity, summary, diningField);
    setActiveSwap(null);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={`day-detail-${dayIndex}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="max-w-5xl mx-auto px-4 sm:px-6 py-4"
        >
          {/* Day navigation strip */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onPrevDay}
              disabled={dayIndex === 0}
              className="flex items-center gap-1 text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ color: '#3a8a82' }}
            >
              {dayIndex === 0 ? '← Previous' : `← Day ${dayIndex}`}
            </button>
            <span className="text-sm font-bold text-[#222]">
              Day {dayIndex + 1} — {day.theme ?? `Day ${dayIndex + 1} of ${totalDays}`}
            </span>
            <button
              type="button"
              onClick={onNextDay}
              disabled={dayIndex === totalDays - 1}
              className="flex items-center gap-1 text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ color: '#3a8a82' }}
            >
              {dayIndex === totalDays - 1 ? 'Next →' : `Day ${dayIndex + 2} →`}
            </button>
          </div>

          {/* 2-col grid */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">

            {/* Left: photo + weather + timeline */}
            <div className="flex flex-col gap-3">
              <div className="relative rounded-2xl overflow-hidden h-[200px]" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
                <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={200} />
              </div>

              {/* Weather widget */}
              <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white" style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}>
                <span className="text-3xl">{weatherEmoji}</span>
                <div>
                  <div className="text-[22px] font-black text-[#222] leading-none">—°</div>
                  <div className="text-[11px] text-[#888] mt-0.5">Typical weather · {destination}</div>
                </div>
              </div>

              {/* Timeline — now wired */}
              <DayTimeline
                day={day}
                dayIndex={dayIndex}
                destination={destination}
                ui={ui}
                onSwapSlot={onSwapSlot}
                onNeighborhoodClick={onNeighborhoodClick}
                onExplore={(row) => setActivePlace(row)}
                onFindAlternative={(target) => setActiveSwap(target)}
              />
            </div>

            {/* Right: Map */}
            <div
              className="rounded-2xl overflow-hidden bg-white"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minHeight: 480 }}
            >
              <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                <div>
                  <div className="text-[13px] font-bold text-[#222]">Day {dayIndex + 1} Route</div>
                  <div className="text-[11px] text-[#888]">{destination}</div>
                </div>
              </div>
              <div style={{ height: 'calc(100% - 52px)', minHeight: 380 }}>
                <ItineraryMap
                  days={[day]}
                  destination={destination}
                  focusedNeighborhood={focusedNeighborhood}
                  basecampMarker={basecampMarker}
                  labels={mapLabels}
                />
              </div>
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <ActionBtn onClick={onBackToOverview}>← Back to Overview</ActionBtn>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* ── Modals — outside the AnimatePresence wrapper ─────────────────────── */}
      {activePlace && (
        <PlaceDetailCube
          row={activePlace}
          destination={destination}
          onClose={() => setActivePlace(null)}
        />
      )}
      {activeSwap && (
        <AlternativePickerPanel
          target={activeSwap}
          itinerary={itinerary}
          profile={profile}
          onCommit={handleCommit}
          onClose={() => setActiveSwap(null)}
        />
      )}
    </>
  );
}

function ActionBtn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
      style={primary
        ? { background: '#5aada5', color: '#fff', boxShadow: '0 4px 12px rgba(90,173,165,0.4)' }
        : { background: '#fff', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {children}
    </motion.button>
  );
}

function getWeatherEmoji(startDate: string | null | undefined, dayOffset: number): string {
  if (!startDate) return '🌤';
  try {
    const d = new Date(`${startDate.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + dayOffset);
    const month = d.getMonth();
    if (month >= 11 || month <= 1) return '❄️';
    if (month >= 2 && month <= 4) return '🌸';
    if (month >= 5 && month <= 7) return '☀️';
    return '🍂';
  } catch { return '🌤'; }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: errors about `onCommitActivitySwap` not being passed by `ItineraryClient`. That's expected — fixed in Task 5.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayDetailPanel.tsx
git commit -m "feat(ui): DayDetailPanel wires PlaceDetailCube + AlternativePickerPanel"
```

---

## Task 5: Wire ItineraryClient

**Files:**
- Modify: `src/components/ItineraryClient.tsx`

- [ ] **Step 1: Find the DayDetailPanel call site in ItineraryClient**

```bash
grep -n "DayDetailPanel\|onCommitActivity\|handleCommit" src/components/ItineraryClient.tsx | head -10
```

- [ ] **Step 2: Add `onCommitActivitySwap` prop to the DayDetailPanel call site**

Find the `<DayDetailPanel` JSX block in `ItineraryClient.tsx`. It currently looks like:

```tsx
<DayDetailPanel
  day={selectedDay}
  dayIndex={itin.selectedDayIndex}
  totalDays={days.length}
  itinerary={itin.itinerary}
  profile={itin.profile}
  ui={itin.ui}
  mapLabels={itin.mapLabels}
  basecampMarker={itin.basecampMarker}
  focusedNeighborhood={itin.focusedNeighborhood}
  onSwapSlot={(slot, req) => itin.handleSlotSwap(itin.selectedDayIndex, slot, req)}
  onNeighborhoodClick={itin.handleNeighborhoodClick}
  onPrevDay={() => itin.setSelectedDayIndex(Math.max(0, itin.selectedDayIndex - 1))}
  onNextDay={() => itin.setSelectedDayIndex(Math.min(days.length - 1, itin.selectedDayIndex + 1))}
  onBackToOverview={() => itin.setSelectedDayIndex(-1)}
/>
```

Add one prop after `onSwapSlot`:

```tsx
  onCommitActivitySwap={(dayIdx, slot, activity, summary, diningField) =>
    itin.handleCommitActivitySwap(dayIdx, slot, activity, summary, diningField)
  }
```

- [ ] **Step 3: Type-check — must be clean**

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

All three must pass.

- [ ] **Step 5: Smoke test (manual)**

Start the dev server:
```bash
npm run dev
```

Navigate to an itinerary page. Open Day Detail. Verify:
1. ✅ Every timeline row has a blue "Navigate" link → opens Google Maps in new tab
2. ✅ "Explore Details" button → opens PlaceDetailCube with whyThis text
3. ✅ "Find Alternative" on dining row → AlternativePickerPanel shows spinner then 2 proposals
4. ✅ Click a proposal card → highlights with teal border
5. ✅ "✓ Use [name]" button → timeline updates + edit banner shows
6. ✅ Custom text → send → new proposals appear
7. ✅ "Modify" on activity row → same AlternativePickerPanel flow
8. ✅ Closing either modal via ✕ or backdrop click works

- [ ] **Step 6: Commit and push**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "feat(itinerary): wire onCommitActivitySwap to DayDetailPanel"
git push origin master
```

---

## Self-Review

**Spec coverage:**
- [x] Navigate button on every row → Task 1 (buildMapsDirectionsUrl + link)
- [x] PlaceDetailCube with DayPhoto, whyThis, meta, navigate footer → Task 2
- [x] AlternativePickerPanel: loading / 2 proposals / free text / confirm → Task 3
- [x] DayTimeline new props: onExplore + onFindAlternative → Task 1
- [x] DayDetailPanel owns activePlace + activeSwap state → Task 4
- [x] ItineraryClient passes onCommitActivitySwap → Task 5
- [x] dining rows: diningField passed through → slotForDining maps lunch→morning, dinner→evening → Task 1 + Task 3
- [x] Error state in AlternativePickerPanel (API fail) → Task 3
- [x] Verification status badges in PlaceDetailCube → Task 2
- [x] Backend NOT changed — `/api/swap-proposals` + `/api/swap` already implemented

**Type consistency:**
- `SwapTarget` defined in `DayTimeline.tsx`, imported by `DayDetailPanel.tsx` and `AlternativePickerPanel.tsx` ✓
- `onCommitActivitySwap` signature matches `useItinerary.handleCommitActivitySwap` signature ✓
- `SwapProposalAlternative` imported from `/api/swap-proposals/route.ts` ✓
