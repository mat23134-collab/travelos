# Cinematic Loading Screen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static loading screen in `plan/page.tsx` with a cinematic full-screen experience showing real percentage progress, live place discovery cards, and rotating destination facts.

**Architecture:** Extract the loading screen into a standalone `LoadingScreen.tsx` component (+ `destinationFacts.ts` data file). The parent `plan/page.tsx` gains only an import — the `<LoadingScreen .../>` call site at line 1297 is unchanged. `PlaceEvent` and `StatusEvent` types move from `plan/page.tsx` to `LoadingScreen.tsx` and are re-exported so the parent can import them.

**Tech Stack:** Next.js 14, TypeScript, Framer Motion (`motion`, `AnimatePresence`), Tailwind CSS v4, `node:assert/strict` tests via `npx tsx`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/destinationFacts.ts` | **CREATE** | Static facts per city + `getDestinationFacts()` |
| `src/lib/destinationFacts.test.ts` | **CREATE** | Tests for the facts lookup |
| `src/components/LoadingScreen.tsx` | **CREATE** | Full cinematic loading component |
| `src/app/plan/page.tsx` | **MODIFY** | Remove inline types/functions, add import |

---

## Task 1 — `destinationFacts.ts`

**Files:**
- Create: `src/lib/destinationFacts.ts`
- Create: `src/lib/destinationFacts.test.ts`

- [ ] **Step 1.1 — Write the test first**

Create `src/lib/destinationFacts.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { getDestinationFacts } from './destinationFacts';

// Known city returns 3 facts
const paris = getDestinationFacts('Paris');
assert.equal(paris.length, 3, 'Paris: exactly 3 facts');
assert.ok(paris.every((f) => typeof f === 'string' && f.length > 10), 'Paris: all facts are non-empty strings');

// Unknown city returns default facts
const unknown = getDestinationFacts('Atlantis');
assert.equal(unknown.length, 3, 'Unknown city: falls back to 3 default facts');

// Whitespace is trimmed
const padded = getDestinationFacts('  Tokyo  ');
assert.equal(padded.length, 3, 'Trimmed key still resolves');

// All 15 covered cities return facts (not default)
const cities = [
  'Paris','Tokyo','Rome','London','Barcelona','Amsterdam',
  'Lisbon','New York','Dubai','Athens','Budapest','Vienna',
  'Rio de Janeiro','Sydney','Singapore',
];
for (const city of cities) {
  const facts = getDestinationFacts(city);
  assert.equal(facts.length, 3, `${city}: 3 facts`);
  assert.ok(facts[0].length > 20, `${city}: first fact is substantial`);
}

console.log('✓ getDestinationFacts — all tests passed');
```

- [ ] **Step 1.2 — Run test (expect FAIL)**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsx src/lib/destinationFacts.test.ts
```

Expected: `Error: Cannot find module './destinationFacts'`

- [ ] **Step 1.3 — Write the implementation**

Create `src/lib/destinationFacts.ts`:

```typescript
// src/lib/destinationFacts.ts
// Static destination facts shown on the loading screen.
// Each city has exactly 3 facts. Unknown cities fall back to '_default'.

const FACTS: Record<string, [string, string, string]> = {
  'Paris': [
    'The Eiffel Tower was originally planned to be demolished in 1909 — it survived because of its radio antenna.',
    'Paris has more than 450 parks and gardens, covering 3,000 hectares of green space.',
    "The city's metro carries 4.5 million passengers a day across 16 lines and 302 stations.",
  ],
  'Tokyo': [
    'Tokyo has more Michelin-starred restaurants than any other city on Earth.',
    'There are over 13 million vending machines in Japan — roughly one for every 10 people.',
    'Shinjuku station handles over 3.5 million commuters every day — the world\'s busiest.',
  ],
  'Rome': [
    'Rome sits on 7 hills — the same layout that inspired the founding myths of the city in 753 BC.',
    'The Trevi Fountain collects roughly €3,000 in coins every day, donated to a local charity.',
    'Italy has more UNESCO World Heritage Sites than any other country in the world.',
  ],
  'London': [
    "London's red double-decker buses were standardised after World War II — there are over 8,000 of them.",
    'More than 270 languages are spoken in Greater London — the most linguistically diverse city on Earth.',
    'The London Underground is the world\'s oldest metro system, opened in January 1863.',
  ],
  'Barcelona': [
    "The Sagrada Família has been under construction since 1882 — it's expected to finish around 2026.",
    'Barcelona has 4.5 km of beaches, all created artificially for the 1992 Olympic Games.',
    'Antoni Gaudí designed 7 buildings in Barcelona, all of which are UNESCO World Heritage Sites.',
  ],
  'Amsterdam': [
    'Amsterdam has more bicycles than residents — roughly 880,000 bikes for 800,000 people.',
    'The city sits on 165 canals spanning 100 km — more than Venice.',
    'The Rijksmuseum houses over 1 million objects, including Rembrandt\'s Night Watch.',
  ],
  'Lisbon': [
    'Lisbon is one of the oldest capitals in Europe — over 3,000 years old, predating Rome.',
    "The city's yellow trams have been running since 1873; Tram 28 is the most iconic.",
    'Bertrand Bookshop in Lisbon is the oldest operating bookshop in the world, open since 1732.',
  ],
  'New York': [
    'New York City is home to speakers of over 800 languages — the most linguistically diverse city on Earth.',
    'Central Park (341 hectares) is larger than the entire Principality of Monaco.',
    'The subway runs 24 hours a day, 365 days a year — the only major metro in the world to do so.',
  ],
  'Dubai': [
    'Dubai has zero income tax and zero capital gains tax for both residents and businesses.',
    "Roughly 85% of Dubai's population are expatriates from over 200 countries.",
    "The Burj Khalifa at 828m is so tall you can watch the sunset twice — once from ground, once from the top.",
  ],
  'Athens': [
    'Athens is considered the birthplace of democracy — the first known democratic system dates to 507 BC.',
    'The Acropolis has been continuously inhabited for over 5,000 years.',
    'Athens has more theatre stages per capita than any other city in the world.',
  ],
  'Budapest': [
    'Budapest has more thermal springs than any other capital city — over 120 hot springs and 80 geothermal wells.',
    'The Danube River divides the city into two historic halves: hilly Buda and flat Pest.',
    "Budapest's metro Line 1 (1896) is the oldest on the European continent.",
  ],
  'Vienna': [
    'Vienna is considered the birthplace of psychoanalysis — Sigmund Freud worked here from 1891 to 1938.',
    'The city has over 600 traditional coffee houses (Kaffeehäuser), a UNESCO-recognised cultural heritage.',
    'The Vienna Philharmonic New Year\'s Concert is broadcast to over 90 countries every year.',
  ],
  'Rio de Janeiro': [
    'Rio has over 80 beaches — Ipanema alone stretches 2.7 km along the Atlantic coast.',
    "Rio's Carnival is the world's largest party, attracting over 2 million people per day to the streets.",
    'Rio has two distinct micro-climates: sunny in Ipanema while raining in Santa Teresa, just 20 minutes apart.',
  ],
  'Sydney': [
    'The Sydney Opera House took 14 years to build (1959–1973) and cost 15× its original budget.',
    "Sydney Harbour is the world's largest natural harbour, covering 55 square kilometres.",
    "Sydney's Bondi Beach is home to one of the world's first surf lifesaving clubs — founded in 1907.",
  ],
  'Singapore': [
    'Singapore has four official languages: English, Mandarin, Malay, and Tamil.',
    "Changi Airport's indoor waterfall — the Rain Vortex — is the world's tallest indoor waterfall at 40 metres.",
    "Singapore's green cover has actually increased since independence: today 47% of the island is greenery.",
  ],
  '_default': [
    'Your trip is being geo-clustered around your hotel — every day radiates outward to minimise transit time.',
    'The AI is scanning travel blogs and local guides to surface hidden gems over tourist traps.',
    'Itinerary DNA analysis in progress — activities are being matched to your budget, pace, and interests.',
  ],
};

/**
 * Returns exactly 3 facts for the given destination.
 * Falls back to generic facts if the city is not in the lookup table.
 */
export function getDestinationFacts(destination: string): [string, string, string] {
  const key = destination.trim();
  return FACTS[key] ?? FACTS['_default'];
}
```

- [ ] **Step 1.4 — Run test (expect PASS)**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsx src/lib/destinationFacts.test.ts
```

Expected: `✓ getDestinationFacts — all tests passed`

- [ ] **Step 1.5 — TypeScript check**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsc --noEmit 2>&1 | grep destinationFacts | head -10
```

Expected: no output (no errors)

- [ ] **Step 1.6 — Commit**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
git add src/lib/destinationFacts.ts src/lib/destinationFacts.test.ts
git commit -m "feat: add getDestinationFacts utility with 15-city coverage"
```

---

## Task 2 — `LoadingScreen.tsx` (main component)

**Files:**
- Create: `src/components/LoadingScreen.tsx`

- [ ] **Step 2.1 — Write the full component**

Create `src/components/LoadingScreen.tsx`:

```typescript
'use client';

/**
 * LoadingScreen — Cinematic Intel Dashboard
 *
 * Shows while /api/generate or /api/generate-stream is running.
 * Receives live SSE data (places, tips, status) from plan/page.tsx.
 *
 * Features:
 * - Real percentage based on buildSignals count (capped at 95 until redirect)
 * - Destination name in cinematic editorial typography
 * - Horizontal step pills (done / active / pending states)
 * - Live place discovery cards (last 4, newest first)
 * - Rotating destination facts from getDestinationFacts()
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TripLanguage } from '@/lib/types';
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';
import { getDestinationFacts } from '@/lib/destinationFacts';

// ── SSE event types (exported so plan/page.tsx can import them) ───────────────
export type PlaceEvent = {
  name: string;
  emoji: string;
  description: string;
  slot: string;
  day: number;
  vibeLabel: string;
};
export type StatusEvent = { message: string; icon: string };

// ── Step definitions ──────────────────────────────────────────────────────────
const LOADING_STEPS = [
  { icon: '📡', label: 'Scanning travel signals' },
  { icon: '🍜', label: 'Checking food blogs' },
  { icon: '🗺️', label: 'Clustering by neighborhood' },
  { icon: '✨', label: 'Tuning to your style' },
  { icon: '💎', label: 'Filtering weak picks' },
] as const;

// ── Badge per vibeLabel ───────────────────────────────────────────────────────
type BadgeConfig = { text: string; type: 'gem' | 'local' } | null;

function resolveBadge(vibeLabel: string): BadgeConfig {
  if (vibeLabel === 'hidden-gem')     return { text: '💎 Hidden Gem', type: 'gem' };
  if (vibeLabel === 'local-favorite') return { text: '🏘 Local Pick', type: 'local' };
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface LoadingScreenProps {
  destination: string;
  lang: TripLanguage;
  streamedPlaces: PlaceEvent[];
  streamedTips: string[];
  streamStatus: StatusEvent | null;
}

export function LoadingScreen({
  destination,
  lang: _lang,
  streamedPlaces,
  streamedTips,
  streamStatus,
}: LoadingScreenProps) {
  // ── Progress maths ──────────────────────────────────────────────────────────
  const buildSignals = streamedPlaces.length + streamedTips.length + (streamStatus ? 1 : 0);
  const percent = Math.min(95, Math.round((buildSignals / 14) * 100));
  const activeStep = Math.min(LOADING_STEPS.length - 1, Math.floor(buildSignals / 2));
  const bgUrl = resolveBackgroundImage(destination, activeStep);

  // ── Rotating destination facts ──────────────────────────────────────────────
  const facts = useMemo(() => getDestinationFacts(destination), [destination]);
  const [factIndex, setFactIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFactIndex((i) => (i + 1) % facts.length), 7000);
    return () => clearInterval(id);
  }, [facts.length]);

  // ── Recent places (last 4, newest first) ────────────────────────────────────
  const recentPlaces = useMemo(
    () => [...streamedPlaces].slice(-4).reverse(),
    [streamedPlaces],
  );

  const statusText = streamStatus
    ? `${streamStatus.icon} ${streamStatus.message}`
    : 'Analyzing your preferences…';

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: '#091f36',
        backgroundImage: `linear-gradient(rgba(9,31,54,0.65), rgba(9,31,54,0.90)), url("${bgUrl}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* ── Cinematic vignette ────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: [
            'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 25%, rgba(0,0,0,0.60) 100%)',
            'linear-gradient(to bottom, rgba(0,0,0,0.50) 0%, rgba(0,0,0,0.04) 30%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.82) 100%)',
            'radial-gradient(ellipse 120% 60% at 50% 100%, rgba(158,54,58,0.20) 0%, transparent 55%)',
            'radial-gradient(ellipse 60% 40% at 80% 70%, rgba(74,123,222,0.12) 0%, transparent 50%)',
          ].join(','),
        }}
      />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="relative z-10 flex items-center justify-between px-8 pt-6">
        <span
          className="text-[11px] font-bold tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          TravelOS
        </span>
        <div className="flex items-center gap-2">
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#9e363a', boxShadow: '0 0 8px #9e363a' }}
          />
          <span
            className="text-[11px] font-bold tracking-[0.08em] uppercase"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            AI Build Live
          </span>
        </div>
      </div>

      {/* ── Main two-column layout ────────────────────────────────────── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row items-end gap-8 lg:gap-0 px-8 pb-16 lg:pb-20">

        {/* ── LEFT: Cinematic progress ─────────────────────────────── */}
        <div className="flex-1 flex flex-col justify-end pb-1 lg:pr-10">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Eyebrow */}
            <p
              className="text-[11px] font-bold tracking-[0.18em] uppercase mb-3"
              style={{ color: 'rgba(255,255,255,0.35)' }}
            >
              Building your trip to{' '}
              <span style={{ color: '#c5912a' }}>
                {destination || 'your destination'}
              </span>
            </p>

            {/* Destination name — editorial */}
            <h1
              className="font-black text-white leading-[0.9] mb-6"
              style={{
                fontSize: 'clamp(38px, 6vw, 80px)',
                letterSpacing: '-2px',
              }}
            >
              {destination || 'Your Trip'}
            </h1>

            {/* Percentage display */}
            <div className="flex items-end gap-3 mb-5">
              <motion.span
                className="font-black leading-none text-white tabular-nums"
                style={{
                  fontSize: 'clamp(64px, 9vw, 108px)',
                  letterSpacing: '-4px',
                }}
                key={percent}
                initial={{ opacity: 0.6, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                {percent}
              </motion.span>
              <div className="pb-3 flex flex-col gap-1">
                <span
                  className="font-bold"
                  style={{ fontSize: '24px', color: 'rgba(255,255,255,0.40)' }}
                >
                  %
                </span>
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: 'rgba(255,255,255,0.28)' }}
                >
                  Complete
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="w-full max-w-lg h-[3px] rounded-full mb-5 relative overflow-visible"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #9e363a 0%, #c5912a 50%, #4a7bde 100%)',
                }}
                initial={{ width: '0%' }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              >
                {/* Glowing tip */}
                <span
                  className="absolute top-1/2 right-0 w-2 h-2 rounded-full bg-white"
                  style={{
                    transform: 'translate(50%, -50%)',
                    boxShadow: '0 0 8px #fff, 0 0 16px rgba(255,255,255,0.5)',
                  }}
                />
              </motion.div>
            </div>

            {/* Step pills */}
            <div className="flex flex-wrap gap-2" aria-live="polite">
              {LOADING_STEPS.map((step, i) => {
                const done   = i < activeStep;
                const active = i === activeStep;
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.07, type: 'spring', stiffness: 400, damping: 25 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all"
                    style={
                      active
                        ? {
                            background: 'rgba(158,54,58,0.18)',
                            borderColor: 'rgba(158,54,58,0.45)',
                            color: '#fff',
                            boxShadow: '0 0 16px rgba(158,54,58,0.15)',
                          }
                        : done
                        ? {
                            background: 'rgba(255,255,255,0.02)',
                            borderColor: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.20)',
                            textDecoration: 'line-through',
                          }
                        : {
                            background: 'rgba(255,255,255,0.02)',
                            borderColor: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.16)',
                          }
                    }
                  >
                    {active && (
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse"
                        style={{ background: '#f87171', boxShadow: '0 0 6px #f87171' }}
                      />
                    )}
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── RIGHT: Live discoveries ───────────────────────────────── */}
        <motion.div
          className="w-full lg:w-80 xl:w-88 shrink-0 flex flex-col gap-2.5"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1"
            style={{ color: 'rgba(255,255,255,0.25)' }}
          >
            Live discoveries
          </p>

          {/* Place cards */}
          <AnimatePresence initial={false}>
            {recentPlaces.map((place) => {
              const badge = resolveBadge(place.vibeLabel);
              return (
                <motion.div
                  key={`${place.name}-${place.day}-${place.slot}`}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md"
                  style={{
                    background:
                      place.vibeLabel === 'hidden-gem'
                        ? 'rgba(158,54,58,0.12)'
                        : place.vibeLabel === 'local-favorite'
                        ? 'rgba(74,123,222,0.10)'
                        : 'rgba(255,255,255,0.06)',
                    borderColor:
                      place.vibeLabel === 'hidden-gem'
                        ? 'rgba(158,54,58,0.28)'
                        : place.vibeLabel === 'local-favorite'
                        ? 'rgba(74,123,222,0.22)'
                        : 'rgba(255,255,255,0.10)',
                  }}
                >
                  <span className="text-xl flex-shrink-0">{place.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold text-white truncate">{place.name}</p>
                    <p
                      className="text-[11px] truncate"
                      style={{ color: 'rgba(255,255,255,0.38)' }}
                    >
                      {place.description || place.slot}
                    </p>
                  </div>
                  {badge && (
                    <span
                      className="flex-shrink-0 text-[9px] font-black px-2 py-1 rounded-full border whitespace-nowrap"
                      style={
                        badge.type === 'gem'
                          ? {
                              background: 'rgba(197,145,42,0.20)',
                              color: '#c5912a',
                              borderColor: 'rgba(197,145,42,0.30)',
                            }
                          : {
                              background: 'rgba(74,123,222,0.20)',
                              color: '#748ffc',
                              borderColor: 'rgba(74,123,222,0.30)',
                            }
                      }
                    >
                      {badge.text}
                    </span>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Empty state */}
          {recentPlaces.length === 0 && (
            <div
              className="px-4 py-3 rounded-2xl border"
              style={{
                background: 'rgba(255,255,255,0.04)',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.22)' }}>
                Scanning for the best spots…
              </p>
            </div>
          )}

          {/* Rotating destination fact */}
          <AnimatePresence mode="wait">
            <motion.div
              key={factIndex}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35 }}
              className="flex items-start gap-3 px-4 py-3 rounded-2xl border backdrop-blur-md mt-1"
              style={{
                background: 'rgba(15,40,98,0.22)',
                borderColor: 'rgba(74,123,222,0.18)',
              }}
            >
              <span className="text-base flex-shrink-0 mt-0.5">💡</span>
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: 'rgba(255,255,255,0.48)' }}
              >
                {facts[factIndex]}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* ── Status pill ───────────────────────────────────────────────── */}
      <div
        className="absolute bottom-5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        <span
          className="w-2.5 h-2.5 rounded-full border flex-shrink-0 animate-spin"
          style={{
            borderColor: 'rgba(255,255,255,0.20)',
            borderTopColor: 'rgba(255,255,255,0.65)',
          }}
        />
        <AnimatePresence mode="wait">
          <motion.span
            key={statusText}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-medium"
          >
            {statusText}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
```

- [ ] **Step 2.2 — TypeScript check**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: zero errors

- [ ] **Step 2.3 — Commit**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
git add src/components/LoadingScreen.tsx
git commit -m "feat: add CinematicLoadingScreen with real % progress and live place cards"
```

---

## Task 3 — Update `plan/page.tsx`

**Files:**
- Modify: `src/app/plan/page.tsx`

Four surgical edits — nothing else changes.

- [ ] **Step 3.1 — Replace the inline type definitions with an import**

Find these lines (around line 40–45):
```typescript
// ── SSE streaming types ─────────────────────────────────────────────────────
type PlaceEvent = {
  name: string; emoji: string; description: string;
  slot: string; day: number; vibeLabel: string;
};
type StatusEvent = { message: string; icon: string };
```

Replace with:
```typescript
// ── SSE streaming types (defined in LoadingScreen; imported here) ────────────
import { LoadingScreen, type PlaceEvent, type StatusEvent } from '@/components/LoadingScreen';
```

> **Note:** TypeScript allows `import` statements inside a file body — but Next.js requires all imports at the top. Move this import to join the other imports at the top of the file (after line 37 `import { useOnboardingStore ...}`).

The correct edit is therefore two-step:
1. **Delete** lines 40–45 (the comment + 2 type definitions)
2. **Add** the import to the existing import block at the top of the file, after the last existing import

The final import to add (after line 37):
```typescript
import { LoadingScreen, type PlaceEvent, type StatusEvent } from '@/components/LoadingScreen';
```

- [ ] **Step 3.2 — Remove `LOADING_STEPS`**

Find and delete these lines (around line 184–190):
```typescript
const LOADING_STEPS = [
  { icon: '📡', label: 'Scanning fresh travel signals' },
  { icon: '🍜', label: 'Checking food blogs and local guides' },
  { icon: '🗺️', label: 'Clustering days by neighborhood' },
  { icon: '✨', label: 'Tuning the trip to your style' },
  { icon: '💎', label: 'Filtering tourist traps and weak picks' },
];
```

(This constant moves to `LoadingScreen.tsx`. It is no longer needed in `plan/page.tsx`.)

- [ ] **Step 3.3 — Remove `DiscoveryPanel` and the old `LoadingScreen` function**

Find and delete these lines:

**`DiscoveryPanel` function** (starting around line 362):
```typescript
function DiscoveryPanel({
  places,
  tips,
  destination,
}: {
```
Delete from `function DiscoveryPanel(` through its closing `}` (the function ends just before `// ── Loading screen ──`).

**`GENERATION_TIMER_COPY` constant** (around line 192):
```typescript
const GENERATION_TIMER_COPY = {
  en: {
```
Delete from `const GENERATION_TIMER_COPY` through its closing `} as const;`

**Old `LoadingScreen` function** (around line 457):
```typescript
function LoadingScreen({
  destination,
  lang,
```
Delete from `// ── Loading screen ──────` through the function's closing `}` (just before `// ── Main page ──────────`).

- [ ] **Step 3.4 — TypeScript check (must be zero errors)**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | head -20
```

Expected: zero errors

If TypeScript reports that `GENERATION_TIMER_COPY` is still referenced somewhere, search for it:
```bash
grep -n "GENERATION_TIMER_COPY" "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site/src/app/plan/page.tsx"
```
If found, check the usage context and remove it.

- [ ] **Step 3.5 — Verify call site is unchanged**

```bash
grep -n "LoadingScreen" "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site/src/app/plan/page.tsx"
```

Expected output (two lines — the import and the JSX use):
```
N:import { LoadingScreen, type PlaceEvent, type StatusEvent } from '@/components/LoadingScreen';
1297:      <LoadingScreen
```

- [ ] **Step 3.6 — Commit**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
git add src/app/plan/page.tsx
git commit -m "refactor(plan): extract LoadingScreen to component, remove DiscoveryPanel"
```

---

## Task 4 — Integration check & push

- [ ] **Step 4.1 — Run tests**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsx src/lib/destinationFacts.test.ts
```

Expected: `✓ getDestinationFacts — all tests passed`

- [ ] **Step 4.2 — Full TypeScript check**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npx tsc --noEmit 2>&1 | grep -E "error TS" | wc -l
```

Expected: `0`

- [ ] **Step 4.3 — Build check**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && npm run build 2>&1 | tail -20
```

Expected: successful compilation. If build fails with `Module not found`, verify the import path in `plan/page.tsx` exactly matches `@/components/LoadingScreen`.

- [ ] **Step 4.4 — Push to GitHub**

```bash
cd "/c/Users/מתן כהן/OneDrive/שולחן העבודה/travel site" && git push origin master
```

---

## What to verify manually

After `npm run dev`, start a trip generation (`/onboarding` → complete → generate):

1. The loading screen shows the **destination name** in large editorial type
2. **Percentage** increments from 0% up to ~95% as SSE events arrive
3. The **progress bar** grows left-to-right with a glowing white tip
4. **Step pills** show: done (strikethrough, dim) / active (red glow + pulsing dot) / pending (very dim)
5. **Place cards** appear one-by-one on the right as the stream delivers them
6. `hidden-gem` places show the gold `💎 Hidden Gem` badge
7. `local-favorite` places show the blue `🏘 Local Pick` badge
8. **Destination fact** rotates every 7 seconds
9. **Status text** at the bottom updates with each SSE status message
10. On completion, the redirect to `/itinerary/[id]` still fires correctly

---

## Self-Review

**Spec coverage:**
- ✅ Real percentage: `Math.min(95, Math.round(buildSignals / 14 * 100))`
- ✅ Destination name in editorial type: `clamp(38px, 6vw, 80px)`, weight 900
- ✅ Progress bar with glowing tip
- ✅ Step pills (done / active / pending)
- ✅ Live place cards, last 4, newest first
- ✅ Badge logic: hidden-gem → gold, local-favorite → blue
- ✅ Rotating facts every 7 seconds via `useEffect` timer
- ✅ `PlaceEvent` / `StatusEvent` exported from `LoadingScreen.tsx`
- ✅ Call site in `plan/page.tsx` unchanged (line 1297)
- ✅ `GENERATION_TIMER_COPY` removed (was EN/HE copy for old component)
- ✅ `DiscoveryPanel` removed (dead code after LoadingScreen extraction)
- ✅ `LOADING_STEPS` moved to `LoadingScreen.tsx`

**Type consistency:**
- `PlaceEvent` defined once in `LoadingScreen.tsx`, exported, imported in `plan/page.tsx`
- `StatusEvent` same
- `resolveBadge()` returns `BadgeConfig = { text: string; type: 'gem' | 'local' } | null` — used only locally
- `getDestinationFacts()` returns `[string, string, string]` — consumed by `useState` factIndex

**No placeholders:** All code is complete.
