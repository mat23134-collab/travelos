# SARTO-Style Results Page Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the itinerary results page from a dark vertical-scroll layout to a SARTO-inspired light-teal carousel layout, while preserving all existing functionality and refactoring ItineraryClient (2 062 lines) into focused sub-components.

**Architecture:** Extract all state and handlers from `ItineraryClient.tsx` into a `useItinerary` hook. Build 6 new focused components. Rewrite `ItineraryClient` as a ~100-line thin orchestrator. New overlay colour changes dark navy to light teal `rgba(180,228,222,0.82)` while keeping the existing rotating photo backgrounds.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS v4, Framer Motion, Zustand, `node:assert/strict` + `npx tsx` for pure-function tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/hooks/useItinerary.ts` | **CREATE** | All state + handlers extracted from ItineraryClient |
| `src/components/ItineraryHeader.tsx` | **CREATE** | Sticky teal header with trip-info chips |
| `src/components/ItineraryDayCard.tsx` | **CREATE** | Single floating day card for carousel |
| `src/components/DayCarousel.tsx` | **CREATE** | Horizontal scroll carousel + nav arrows |
| `src/components/HotelSelectionCard.tsx` | **CREATE** | Hotel options panel below carousel |
| `src/components/DayTimeline.tsx` | **CREATE** | Per-activity timeline rows with action buttons |
| `src/components/DayDetailPanel.tsx` | **CREATE** | 2-col orchestrator: DayTimeline + ItineraryMap |
| `src/components/ItineraryClient.tsx` | **REWRITE** | Thin orchestrator (~110 lines) |

**Files not touched:** `DayCard.tsx`, `DayPhoto.tsx`, `QuickEdit.tsx`, `SharePanel.tsx`, `LogisticsDashboard.tsx`, `DraftOverview.tsx`, `TrendingTicker.tsx`, `TripStoryCube.tsx`, `FeedbackSurveyModal.tsx`, `ItineraryMap.tsx`, `TransportCard.tsx`.

---

## Task 1: `useItinerary` hook

**Files:**
- Create: `src/hooks/useItinerary.ts`
- Create: `src/hooks/useItinerary.test.ts`

- [ ] **Step 1: Create the hook file with full interface and implementation**

Create `src/hooks/useItinerary.ts`:

```typescript
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Itinerary, TravelerProfile, HotelRecommendation, Activity,
  type CityTransportGuide,
} from '@/lib/types';
import { itineraryUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { type SharePanelCopy } from '@/components/SharePanel';
import { type FeedbackPayload } from '@/components/FeedbackSurveyModal';
import { type SwapResult } from '@/app/api/swap/route';
import { type ItineraryMapLabels } from '@/components/ItineraryMap';
import { hasTransportContent, type TransportCardProps } from '@/components/TransportCard';
import { parseTransportGuideJson } from '@/lib/transportGuideParse';
import { STEP_BACKGROUNDS } from '@/lib/stepBackgrounds';
import { useAuth } from '@/lib/auth-context';
import { formatTripDateRange } from '@/lib/formatTripDateRange';

// ─── Public interfaces ────────────────────────────────────────────────────────

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
  shareCopy: SharePanelCopy;
  mapLabels: ItineraryMapLabels;
  transportLoading: boolean;
  isAdmin: boolean;

  // View navigation
  viewMode: 'draft' | 'final';
  setViewMode: (m: 'draft' | 'final') => void;
  selectedDayIndex: number;          // -1 = overview, 0-based = day detail
  setSelectedDayIndex: (i: number) => void;

  // Background
  bgIdx: number;

  // Edit banner
  editBanner: string;

  // Hotel detail popover
  expandedHotel: HotelRecommendation | null;
  setExpandedHotel: (h: HotelRecommendation | null) => void;

  // Map / mobile
  focusedNeighborhood: string | undefined;
  mobileMapOpen: boolean;
  setMobileMapOpen: (v: boolean) => void;
  handleNeighborhoodClick: (neighborhood: string) => void;

  // Trip Story
  tripStoryOpen: boolean;
  setTripStoryOpen: (v: boolean) => void;

  // Feedback
  feedbackOpen: boolean;
  handleFeedbackDismiss: () => void;
  handleFeedbackSubmit: (p: FeedbackPayload) => Promise<boolean>;

  // Activity mutations
  persistAndSet: (next: Itinerary) => void;
  handleSlotSwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => Promise<void>;
  handleCommitActivitySwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => Promise<void>;
  handleQuickEditUpdate: (updated: Itinerary, summary: string) => void;
  handleDraftUpdate: (updated: Itinerary) => void;
}

// ─── Helper (also used by ItineraryClient) ────────────────────────────────────

/** Move to src/lib/formatTripDateRange.ts in Task 1 step 2 */
export { formatTripDateRange };

// ─── Hook implementation ──────────────────────────────────────────────────────

export function useItinerary({
  initialItinerary,
  initialProfile,
  initialViewMode = 'draft',
  initialTransportFromDb = null,
  initialTripSummaryUsername = null,
}: UseItineraryOptions): UseItineraryReturn {
  const { session } = useAuth();

  // ── Core data ──────────────────────────────────────────────────────────────
  const [itinerary, setItinerary] = useState<Itinerary>(initialItinerary);
  const [profile] = useState<TravelerProfile | null>(initialProfile);

  // Sync when props change (client-side navigation reuses component instance)
  useEffect(() => {
    setItinerary(initialItinerary);
    setViewMode(initialViewMode ?? 'draft');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItinerary]);

  // ── View state ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'draft' | 'final'>(initialViewMode);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(-1); // -1 = overview

  // ── Background slideshow ───────────────────────────────────────────────────
  const [bgIdx, setBgIdx] = useState(() => {
    const dest = (initialItinerary.destination ?? '').trim().toLowerCase();
    const match = STEP_BACKGROUNDS.findIndex((b) => b.city.toLowerCase() === dest);
    return match >= 0 ? match : 0;
  });
  useEffect(() => {
    const t = setInterval(() => setBgIdx((i) => (i + 1) % STEP_BACKGROUNDS.length), 8000);
    return () => clearInterval(t);
  }, []);

  // ── Transport ──────────────────────────────────────────────────────────────
  const [liveTransportFromDb, setLiveTransportFromDb] = useState<CityTransportGuide | null>(
    initialTransportFromDb ?? null,
  );
  const [transportLoading, setTransportLoading] = useState(false);
  const scoutPostedRef = useRef(false);

  useEffect(() => {
    setLiveTransportFromDb(initialTransportFromDb ?? null);
  }, [initialTransportFromDb]);

  const displayCityTransport = useMemo(() => {
    if (liveTransportFromDb && hasTransportContent(liveTransportFromDb)) return liveTransportFromDb;
    return itinerary.cityTransport ?? null;
  }, [liveTransportFromDb, itinerary.cityTransport]);

  const transportDataReady = useMemo(
    () => hasTransportContent(displayCityTransport),
    [displayCityTransport],
  );

  useEffect(() => {
    const city = itinerary.destination?.trim();
    if (!city || transportDataReady) { setTransportLoading(false); return; }
    setTransportLoading(true);
    let cancelled = false;

    const poll = async (): Promise<boolean> => {
      try {
        const res = await fetch(`/api/transportation?city=${encodeURIComponent(city)}`);
        const body = (await res.json()) as { guide?: unknown };
        const parsed = parseTransportGuideJson(body.guide ?? null);
        if (!cancelled && parsed && hasTransportContent(parsed)) {
          setLiveTransportFromDb(parsed);
          setTransportLoading(false);
          return true;
        }
      } catch { /* ignore */ }
      return false;
    };

    void (async () => {
      if (await poll()) return;
      if (cancelled) return;
      if (!scoutPostedRef.current) {
        scoutPostedRef.current = true;
        try {
          await fetch('/api/transportation/scout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ city, tripDays: itinerary.totalDays }),
          });
        } catch { /* ignore */ }
      }
      for (let i = 0; i < 20 && !cancelled; i++) {
        await new Promise<void>((r) => setTimeout(r, 2500));
        if (await poll()) return;
      }
      if (!cancelled) setTransportLoading(false);
    })();

    return () => { cancelled = true; };
  }, [itinerary.destination, itinerary.totalDays, transportDataReady]);

  // ── UI strings ─────────────────────────────────────────────────────────────
  const ui = useMemo(
    () => itineraryUi(profile?.tripLanguage === 'he' ? 'he' : 'en'),
    [profile?.tripLanguage],
  );

  // ── Edit banner ────────────────────────────────────────────────────────────
  const [editBanner, setEditBanner] = useState('');
  const showBanner = useCallback((msg: string) => {
    setEditBanner(msg);
    setTimeout(() => setEditBanner(''), 5000);
  }, []);

  // ── Hotel detail ───────────────────────────────────────────────────────────
  const [expandedHotel, setExpandedHotel] = useState<HotelRecommendation | null>(null);

  // ── Map / mobile ───────────────────────────────────────────────────────────
  const [focusedNeighborhood, setFocusedNeighborhood] = useState<string | undefined>();
  const [mobileMapOpen, setMobileMapOpen] = useState(false);

  const handleNeighborhoodClick = useCallback((neighborhood: string) => {
    setFocusedNeighborhood(neighborhood);
    setMobileMapOpen(true);
  }, []);

  // ── Trip Story ─────────────────────────────────────────────────────────────
  const [tripStoryOpen, setTripStoryOpen] = useState(false);

  // ── Feedback ───────────────────────────────────────────────────────────────
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackKey = useMemo(() => {
    const id = itinerary._id ?? (itinerary.destination ?? '').trim().toLowerCase();
    return id ? `sarto_feedback_${id}` : null;
  }, [itinerary._id, itinerary.destination]);

  useEffect(() => {
    if (!feedbackKey || typeof window === 'undefined') return;
    try { if (window.localStorage.getItem(feedbackKey)) return; } catch { /* ignore */ }
    const delay = 40_000 + Math.floor(Math.random() * 10_000);
    const t = setTimeout(() => setFeedbackOpen(true), delay);
    return () => clearTimeout(t);
  }, [feedbackKey]);

  const markFeedbackSeen = useCallback(() => {
    if (!feedbackKey) return;
    try { window.localStorage.setItem(feedbackKey, String(Date.now())); } catch { /* ignore */ }
  }, [feedbackKey]);

  const handleFeedbackDismiss = useCallback(() => {
    setFeedbackOpen(false);
    markFeedbackSeen();
  }, [markFeedbackSeen]);

  const handleFeedbackSubmit = useCallback(async (payload: FeedbackPayload): Promise<boolean> => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          itineraryId: itinerary._id ?? null,
          destination: itinerary.destination ?? null,
          ...payload,
        }),
      });
      if (!res.ok) return false;
      markFeedbackSeen();
      setTimeout(() => setFeedbackOpen(false), 2200);
      return true;
    } catch { return false; }
  }, [markFeedbackSeen, session, itinerary._id, itinerary.destination]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const basecampMarker = useMemo(() => {
    if (profile?.hotelLat != null && profile?.hotelLng != null &&
        Number.isFinite(profile.hotelLat) && Number.isFinite(profile.hotelLng)) {
      return {
        lat: profile.hotelLat,
        lng: profile.hotelLng,
        label: profile.hotelAddress || profile.hotelBooked || 'Base Camp',
      };
    }
    return null;
  }, [profile]);

  const tripDatesLabel = useMemo(
    () => formatTripDateRange(profile?.startDate, profile?.endDate, ui.lang === 'he' ? 'he-IL' : 'en-US'),
    [profile?.startDate, profile?.endDate, ui.lang],
  );

  const mapLabels = useMemo((): ItineraryMapLabels => ({
    mapDistanceTool: ui.mapDistanceTool,
    mapSelectMoreHint: ui.mapSelectMoreHint,
    mapComputingRoutes: ui.mapComputingRoutes,
    mapBetween: ui.mapBetween,
    mapDirect: ui.mapDirect,
    mapWalking: ui.mapWalking,
    mapDriving: ui.mapDriving,
    mapNa: ui.mapNa,
    mapOpenGoogleTransit: ui.mapOpenGoogleTransit,
    mapClearSelection: ui.mapClearSelection,
    cityTransportGoogleRoutesDoc: ui.cityTransportGoogleRoutesDoc,
    cityTransportGoogleRoutesDocUrl: ui.cityTransportGoogleRoutesDocUrl,
  }), [ui]);

  const shareCopy = useMemo((): SharePanelCopy => ({
    openButton: ui.shareOpenButton,
    panelTitle: ui.sharePanelTitle(ui.audienceTitle(profile?.groupType)),
    whatsapp: ui.shareWhatsApp,
    whatsappSub: ui.shareWhatsAppSub(profile?.groupType),
    copyLink: ui.shareCopyLinkCta(profile?.groupType),
    copyLinkCopied: ui.shareLinkCopied,
    copyLinkSub: ui.shareCopyLinkSub,
    pdf: ui.sharePdf,
    pdfSub: ui.sharePdfSub,
    travelOsTitle: ui.shareTravelOsTitle,
    travelOsBody: ui.shareTravelOsBody,
    travelOsHint: ui.shareTravelOsHint,
  }), [ui, profile?.groupType]);

  const isAdmin = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((c) => c.trim() === 'travelos_admin_ui=1');
  }, []);

  // ── Persistence ────────────────────────────────────────────────────────────
  const sessionPersist = initialViewMode !== 'final';

  const persistAndSet = useCallback((updated: Itinerary) => {
    setItinerary(updated);
    if (sessionPersist) {
      try { sessionStorage.setItem('travelos_itinerary', JSON.stringify(updated)); } catch { /* ignore */ }
    }
  }, [sessionPersist]);

  // ── Activity mutation handlers ─────────────────────────────────────────────
  const handleSlotSwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => {
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined,
        dayIndex,
        slot,
        request: request?.trim() || `Suggest a better ${slot} activity`,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');
    const updatedDays = itinerary.days.map((day, i) =>
      i !== dayIndex ? day : { ...day, [slot]: data.activity },
    );
    persistAndSet({ ...itinerary, days: updatedDays });
    showBanner(data.summary);
  }, [itinerary, persistAndSet, showBanner]);

  const handleCommitActivitySwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => {
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined,
        dayIndex,
        slot,
        replacementActivity,
        proposalSummary: proposalSummary.trim() || undefined,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');
    const updatedDays = itinerary.days.map((day, i) => {
      if (i !== dayIndex) return day;
      const updatedDay = { ...day, [slot]: data.activity };
      if (diningField) (updatedDay as Record<string, unknown>)[diningField] = undefined;
      return updatedDay;
    });
    persistAndSet({ ...itinerary, days: updatedDays });
    showBanner(data.summary);
  }, [itinerary, persistAndSet, showBanner]);

  const handleQuickEditUpdate = useCallback((updated: Itinerary, summary: string) => {
    persistAndSet(updated);
    showBanner(summary);
  }, [persistAndSet, showBanner]);

  const handleDraftUpdate = useCallback((updated: Itinerary) => {
    persistAndSet(updated);
  }, [persistAndSet]);

  return {
    itinerary, profile, ui, displayCityTransport, basecampMarker,
    tripDatesLabel, shareCopy, mapLabels, transportLoading, isAdmin,
    viewMode, setViewMode, selectedDayIndex, setSelectedDayIndex,
    bgIdx, editBanner, expandedHotel, setExpandedHotel,
    focusedNeighborhood, mobileMapOpen, setMobileMapOpen, handleNeighborhoodClick,
    tripStoryOpen, setTripStoryOpen,
    feedbackOpen, handleFeedbackDismiss, handleFeedbackSubmit,
    persistAndSet, handleSlotSwap, handleCommitActivitySwap,
    handleQuickEditUpdate, handleDraftUpdate,
  };
}
```

- [ ] **Step 2: Extract `formatTripDateRange` to its own file**

The function currently lives inline in `ItineraryClient.tsx` (line ~1160). Create `src/lib/formatTripDateRange.ts`:

```typescript
/** Pretty date range for trip hero subtitle. Expects ISO or YYYY-MM-DD strings. */
export function formatTripDateRange(
  start?: string | null,
  end?: string | null,
  locale = 'en-US',
): string | null {
  const s = start?.trim().slice(0, 10);
  const e = end?.trim().slice(0, 10);
  if (!s || !e || !/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
  const ds = new Date(`${s}T12:00:00`);
  const de = new Date(`${e}T12:00:00`);
  if (Number.isNaN(+ds) || Number.isNaN(+de)) return null;
  const y1 = ds.getFullYear();
  const y2 = de.getFullYear();
  const m1 = ds.getMonth();
  const d2 = de.getDate();
  const monthDay = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const full = (d: Date) => d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  if (y1 === y2 && m1 === de.getMonth()) return `${monthDay(ds)}–${d2}, ${y2}`;
  if (y1 === y2) return `${monthDay(ds)} – ${full(de)}`;
  return `${full(ds)} – ${full(de)}`;
}
```

- [ ] **Step 3: Write test for `formatTripDateRange`**

Create `src/lib/formatTripDateRange.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { formatTripDateRange } from './formatTripDateRange';

// Same month, same year → "Jun 3–10, 2026"
const r1 = formatTripDateRange('2026-06-03', '2026-06-10');
assert.ok(r1?.includes('Jun'), `expected Jun in "${r1}"`);
assert.ok(r1?.includes('2026'), `expected year in "${r1}"`);

// Different months, same year
const r2 = formatTripDateRange('2026-06-28', '2026-07-05');
assert.ok(r2 !== null, 'cross-month should not be null');

// Invalid inputs → null
assert.equal(formatTripDateRange(null, null), null);
assert.equal(formatTripDateRange('bad', '2026-06-10'), null);
assert.equal(formatTripDateRange('2026-06-03', 'bad'), null);

// Missing end → null
assert.equal(formatTripDateRange('2026-06-03', undefined), null);

console.log('✓ formatTripDateRange: all 6 assertions passed');
```

- [ ] **Step 4: Run test**

```bash
cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
npx tsx src/lib/formatTripDateRange.test.ts
```

Expected output: `✓ formatTripDateRange: all 6 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useItinerary.ts src/lib/formatTripDateRange.ts src/lib/formatTripDateRange.test.ts
git commit -m "feat(hook): extract useItinerary hook + formatTripDateRange util"
```

---

## Task 2: `ItineraryHeader`

**Files:**
- Create: `src/components/ItineraryHeader.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/ItineraryHeader.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BrandWordmark } from '@/components/BrandWordmark';
import { SharePanel } from '@/components/SharePanel';
import { type SharePanelCopy } from '@/components/SharePanel';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { type ItineraryUiStrings } from '@/lib/tripUiCopy';

interface ItineraryHeaderProps {
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  shareCopy: SharePanelCopy;
  session: { access_token: string } | null;
  isAdmin: boolean;
  selectedDayIndex: number;
  onBackToOverview: () => void;
  onBackToDraft?: () => void;
  initialViewMode?: 'draft' | 'final';
  editBanner: string;
}

export function ItineraryHeader({
  itinerary, profile, ui, shareCopy, session, isAdmin,
  selectedDayIndex, onBackToOverview, onBackToDraft, initialViewMode, editBanner,
}: ItineraryHeaderProps) {
  const dest = itinerary.destination ?? '';
  const groupLabel = profile?.groupSize ? `${profile.groupSize} ${profile.groupSize === 1 ? 'Adult' : 'Adults'}` : null;
  const hotelLabel = profile?.hotelBooked ?? itinerary.basecamp?.ai?.hotels?.[0]?.name ?? null;

  const dateLabel = (() => {
    if (!profile?.startDate || !profile?.endDate) return null;
    try {
      const s = new Date(`${profile.startDate.slice(0,10)}T12:00:00`);
      const e = new Date(`${profile.endDate.slice(0,10)}T12:00:00`);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    } catch { return null; }
  })();

  return (
    <>
      {/* Edit banner — slides in above header */}
      {editBanner && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed top-0 inset-x-0 z-[60] text-sm py-2.5 px-6 text-center shadow-lg print:hidden"
          style={{ background: '#3a8a82', color: '#fff' }}
        >
          ✓ {editBanner}
        </motion.div>
      )}

      <nav
        className={`sticky z-50 print:hidden transition-all ${editBanner ? 'top-10' : 'top-0'}`}
        style={{ background: '#5aada5', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
      >
        <div className="flex items-center gap-3 px-4 sm:px-6 h-14">
          {/* Back to overview (only in day-detail view) */}
          {selectedDayIndex >= 0 && (
            <motion.button
              onClick={onBackToOverview}
              whileTap={{ scale: 0.93 }}
              className="flex items-center gap-1.5 text-white/80 hover:text-white text-sm font-semibold transition-colors flex-shrink-0"
            >
              ← Overview
            </motion.button>
          )}

          {/* Brand */}
          <Link href="/" className="flex-shrink-0">
            <BrandWordmark accent="rgba(255,255,255,0.9)" className="text-base text-white" />
          </Link>

          {/* Trip chips */}
          <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none min-w-0">
            {dateLabel && <Chip>📅 {dateLabel}</Chip>}
            {dest && <Chip>📍 {dest}</Chip>}
            {hotelLabel && <Chip>🏨 {hotelLabel}</Chip>}
            {groupLabel && <Chip>👥 {groupLabel}</Chip>}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {initialViewMode !== 'final' && onBackToDraft && (
              <motion.button
                onClick={onBackToDraft}
                whileTap={{ scale: 0.92 }}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white hover:border-white/50 transition-colors"
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
            {isAdmin && (
              <Link
                href={`/explore/${encodeURIComponent(dest)}`}
                className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
              >
                {ui.scoutPicks}
              </Link>
            )}
            <Link
              href="/onboarding"
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
            >
              {ui.newTrip}
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-600 text-white whitespace-nowrap flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Smoke test — build check**

```bash
cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "ItineraryHeader" | head -5
```

Expected: no errors referencing `ItineraryHeader.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ItineraryHeader.tsx
git commit -m "feat(ui): add ItineraryHeader with trip chips"
```

---

## Task 3: `ItineraryDayCard` + `deriveDayBullets` test

**Files:**
- Create: `src/components/ItineraryDayCard.tsx`
- Create: `src/components/ItineraryDayCard.test.ts`

- [ ] **Step 1: Write the test first**

Create `src/components/ItineraryDayCard.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { deriveDayBullets } from './ItineraryDayCard';
import type { DayPlan } from '../lib/types';

// Full day → 3 bullets
const full: DayPlan = {
  day: 1,
  theme: 'Welcome',
  morning: { name: 'Hotel Check-in' },
  afternoon: { name: 'Colosseum Tour' },
  evening: { name: 'Trastevere Dinner' },
};
assert.deepEqual(deriveDayBullets(full), ['Hotel Check-in', 'Colosseum Tour', 'Trastevere Dinner']);

// Partial day — only present slots
const partial: DayPlan = {
  day: 2,
  morning: { name: 'Vatican' },
  evening: { name: 'Aperitivo' },
};
assert.deepEqual(deriveDayBullets(partial), ['Vatican', 'Aperitivo']);

// Empty day → []
const empty: DayPlan = { day: 3 };
assert.deepEqual(deriveDayBullets(empty), []);

// Falls back to lunch/dinner names when morning/afternoon/evening missing
const diningOnly: DayPlan = {
  day: 4,
  lunch: { name: 'Trattoria Da Enzo' },
  dinner: { name: 'La Pergola' },
};
assert.deepEqual(deriveDayBullets(diningOnly), ['Trattoria Da Enzo', 'La Pergola']);

console.log('✓ deriveDayBullets: all 4 assertions passed');
```

- [ ] **Step 2: Run test — confirm it fails**

```bash
npx tsx src/components/ItineraryDayCard.test.ts
```

Expected: `Error: Cannot find module './ItineraryDayCard'`

- [ ] **Step 3: Create the component with `deriveDayBullets` exported**

Create `src/components/ItineraryDayCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { DayPlan } from '@/lib/types';

// ── Pure helper (exported for tests) ─────────────────────────────────────────

export function deriveDayBullets(day: DayPlan): string[] {
  const activityNames = [
    day.morning?.name,
    day.afternoon?.name,
    day.evening?.name,
  ].filter(Boolean) as string[];

  if (activityNames.length > 0) return activityNames.slice(0, 3);

  // Fallback: use dining spot names
  return [day.lunch?.name, day.dinner?.name].filter(Boolean) as string[];
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ItineraryDayCardProps {
  day: DayPlan;
  dayNumber: number;   // 1-based display number
  isActive: boolean;
  totalDays: number;
  destination: string;
  onClick: () => void;
}

export function ItineraryDayCard({
  day,
  dayNumber,
  isActive,
  totalDays,
  destination,
  onClick,
}: ItineraryDayCardProps) {
  const bullets = deriveDayBullets(day);
  const photoQuery = `${destination} ${day.theme ?? 'travel'} landmark`;

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.16)' }}
      whileTap={{ scale: 0.98 }}
      className="flex-shrink-0 cursor-pointer rounded-[20px] overflow-hidden bg-white"
      style={{
        minWidth: 340,
        maxWidth: 360,
        scrollSnapAlign: 'center',
        boxShadow: isActive
          ? '0 8px 32px rgba(90,173,165,0.35), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
        border: isActive ? '2px solid rgba(90,173,165,0.4)' : '2px solid transparent',
      }}
    >
      {/* Card header */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'rgba(0,0,0,0.06)' }}
      >
        <span className="text-[20px] font-black text-[#222] tracking-tight">
          DAY {dayNumber}
        </span>
        <span className="text-[15px] font-700 text-[#333] truncate ml-3 flex-1 text-right">
          {day.theme ?? `Day ${dayNumber} of ${totalDays}`}
        </span>
      </div>

      {/* Destination photo */}
      <div className="relative h-[190px] overflow-hidden">
        <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={190} />
      </div>

      {/* Activity bullets */}
      {bullets.length > 0 && (
        <ul
          className="px-4 py-3 border-b space-y-1.5"
          style={{ borderColor: 'rgba(0,0,0,0.06)' }}
        >
          {bullets.map((b, i) => (
            <li key={i} className="flex items-center gap-2 text-[13px] text-[#444]">
              <span className="text-[#5aada5] text-base leading-none flex-shrink-0">•</span>
              {b}
            </li>
          ))}
        </ul>
      )}

      {/* Footer: dot indicator + prev/next arrows */}
      <div className="flex items-center justify-between px-4 py-3">
        <DotIndicator current={dayNumber - 1} total={totalDays} />
        <div className="flex gap-2">
          <ArrowBtn disabled={dayNumber <= 1}>←</ArrowBtn>
          <ArrowBtn disabled={dayNumber >= totalDays}>→</ArrowBtn>
        </div>
      </div>
    </motion.div>
  );
}

function DotIndicator({ current, total }: { current: number; total: number }) {
  const MAX_DOTS = 7;
  const count = Math.min(total, MAX_DOTS);
  return (
    <div className="flex gap-[5px] items-center">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="rounded-full transition-all"
          style={{
            width: i === current % count ? 10 : 7,
            height: i === current % count ? 10 : 7,
            background: i === current % count ? '#5aada5' : 'rgba(0,0,0,0.15)',
          }}
        />
      ))}
    </div>
  );
}

function ArrowBtn({ children, disabled }: { children: string; disabled: boolean }) {
  return (
    <span
      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
      style={{
        border: '1px solid rgba(0,0,0,0.15)',
        color: disabled ? 'rgba(0,0,0,0.2)' : '#555',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npx tsx src/components/ItineraryDayCard.test.ts
```

Expected: `✓ deriveDayBullets: all 4 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/ItineraryDayCard.tsx src/components/ItineraryDayCard.test.ts
git commit -m "feat(ui): add ItineraryDayCard with deriveDayBullets"
```

---

## Task 4: `DayCarousel`

**Files:**
- Create: `src/components/DayCarousel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/DayCarousel.tsx`:

```tsx
'use client';

import { useRef } from 'react';
import { ItineraryDayCard } from '@/components/ItineraryDayCard';
import type { DayPlan } from '@/lib/types';

interface DayCarouselProps {
  days: DayPlan[];
  selectedDayIndex: number;  // -1 = none selected
  destination: string;
  onSelectDay: (index: number) => void;
}

export function DayCarousel({ days, selectedDayIndex, destination, onSelectDay }: DayCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 368, behavior: 'smooth' });
  };

  return (
    <div className="relative px-12 py-2">
      {/* Left arrow */}
      <NavArrow dir="left" onClick={() => scroll(-1)} />

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {days.map((day, i) => (
          <ItineraryDayCard
            key={`day-${day.day}-${i}`}
            day={day}
            dayNumber={i + 1}
            isActive={selectedDayIndex === i}
            totalDays={days.length}
            destination={destination}
            onClick={() => onSelectDay(i)}
          />
        ))}
      </div>

      {/* Right arrow */}
      <NavArrow dir="right" onClick={() => scroll(1)} />
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition-all hover:scale-110"
      style={{
        [dir === 'left' ? 'left' : 'right']: 4,
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(90,173,165,0.3)',
        color: '#5aada5',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "DayCarousel" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayCarousel.tsx
git commit -m "feat(ui): add DayCarousel horizontal scroll"
```

---

## Task 5: `HotelSelectionCard`

**Files:**
- Create: `src/components/HotelSelectionCard.tsx`

- [ ] **Step 1: Check Basecamp type for required fields**

```bash
grep -n "interface Basecamp\|ai:\|booked:\|hotels" "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site/src/lib/types.ts" | head -20
```

Note the exact field names — use them in the component.

- [ ] **Step 2: Create the component**

Create `src/components/HotelSelectionCard.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { Basecamp, HotelRecommendation, TravelerProfile } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

interface HotelSelectionCardProps {
  basecamp: Basecamp;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  onExpandHotel: (hotel: HotelRecommendation) => void;
}

export function HotelSelectionCard({
  basecamp, destination, profile, ui, onExpandHotel,
}: HotelSelectionCardProps) {
  // Collect hotels: AI recommendations or the booked hotel
  const hotels: HotelRecommendation[] =
    basecamp.type === 'ai-recommended'
      ? (basecamp.ai?.hotels ?? []).slice(0, 3)
      : basecamp.type === 'booked' && basecamp.booked
        ? [{ name: basecamp.booked.name ?? 'Your Hotel', neighborhood: basecamp.booked.neighborhood }]
        : [];

  if (hotels.length === 0) return null;

  const bookedName =
    basecamp.type === 'booked' ? (basecamp.booked?.name ?? null) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
      className="mx-12 mb-6 rounded-2xl overflow-hidden"
      style={{
        background: '#fff',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: '#5aada5' }}
      >
        <span className="text-[14px] font-800 text-white">🏨 {ui.basecampTitle ?? 'Your Accommodation'}</span>
        <span
          className="text-[10px] font-700 text-white px-3 py-1 rounded-full"
          style={{ background: 'rgba(255,255,255,0.25)' }}
        >
          {hotels.length} {hotels.length === 1 ? 'option' : 'options'}
        </span>
      </div>

      {/* Hotel columns */}
      <div className={`grid divide-x`} style={{ gridTemplateColumns: `repeat(${hotels.length}, 1fr)`, borderColor: 'rgba(0,0,0,0.07)' }}>
        {hotels.map((hotel, i) => {
          const isBooked = bookedName ? hotel.name === bookedName : i === 0;
          return (
            <HotelColumn
              key={hotel.name ?? i}
              hotel={hotel}
              isSelected={isBooked}
              destination={destination}
              onExpand={() => onExpandHotel(hotel)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function HotelColumn({
  hotel, isSelected, destination, onExpand,
}: {
  hotel: HotelRecommendation;
  isSelected: boolean;
  destination: string;
  onExpand: () => void;
}) {
  const stars = hotel.ratingStars ? Math.round(hotel.ratingStars) : null;
  const nightlyRate = hotel.indicativeNightly ?? null;

  return (
    <button
      type="button"
      onClick={onExpand}
      className="text-left p-4 transition-colors group"
      style={{
        background: isSelected ? '#e8f4f2' : 'transparent',
      }}
    >
      {isSelected && (
        <span
          className="inline-block text-[10px] font-800 px-2 py-0.5 rounded-full mb-2"
          style={{ background: '#5aada5', color: '#fff' }}
        >
          ✓ Selected
        </span>
      )}
      <div className="text-[13px] font-700 text-[#222] mb-0.5 group-hover:text-[#3a8a82] transition-colors">
        {hotel.name ?? 'Hotel'}
      </div>
      {stars && (
        <div className="text-[11px] text-[#f59e0b] mb-0.5">
          {'★'.repeat(stars)}{'☆'.repeat(Math.max(0, 5 - stars))}
        </div>
      )}
      {hotel.neighborhood && (
        <div className="text-[11px] text-[#888] mb-1">{hotel.neighborhood}</div>
      )}
      {nightlyRate && (
        <div className="text-[12px] font-700 text-[#5aada5]">{nightlyRate} / night</div>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "HotelSelectionCard" | head -5
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/HotelSelectionCard.tsx
git commit -m "feat(ui): add HotelSelectionCard"
```

---

## Task 6: `DayTimeline` + `buildTimelineRows` test

**Files:**
- Create: `src/components/DayTimeline.tsx`
- Create: `src/components/DayTimeline.test.ts`

- [ ] **Step 1: Write the test first**

Create `src/components/DayTimeline.test.ts`:

```typescript
import assert from 'node:assert/strict';
import { buildTimelineRows, isHotelCheckIn } from './DayTimeline';
import type { DayPlan } from '../lib/types';

// isHotelCheckIn
assert.equal(isHotelCheckIn({ name: 'Hotel Check-in' }), true);
assert.equal(isHotelCheckIn({ name: 'Hotel Indigo Check In' }), true);
assert.equal(isHotelCheckIn({ name: 'Colosseum Tour' }), false);
assert.equal(isHotelCheckIn({ name: '' }), false);

// buildTimelineRows: full day produces 5 rows (morning, lunch, afternoon, dinner, evening)
const full: DayPlan = {
  day: 1,
  morning: { name: 'Hotel Check-in', startTime: '09:00' },
  lunch: { name: 'Trattoria Da Enzo' },
  afternoon: { name: 'Roman Forum', startTime: '15:00' },
  dinner: { name: 'La Pergola' },
  evening: { name: 'Trastevere Walk', startTime: '20:00' },
};
const rows = buildTimelineRows(full);
assert.equal(rows.length, 5);
assert.equal(rows[0].type, 'activity');
assert.equal(rows[0].slot, 'morning');
assert.equal(rows[1].type, 'dining');
assert.equal(rows[1].name, 'Trattoria Da Enzo');
assert.equal(rows[4].slot, 'evening');

// buildTimelineRows: empty day → 0 rows
assert.equal(buildTimelineRows({ day: 2 }).length, 0);

// buildTimelineRows: partial day → only present slots
const partial: DayPlan = { day: 3, afternoon: { name: 'Vatican' }, dinner: { name: 'Prati Spot' } };
const partialRows = buildTimelineRows(partial);
assert.equal(partialRows.length, 2);
assert.equal(partialRows[0].slot, 'afternoon');

console.log('✓ DayTimeline helpers: all 11 assertions passed');
```

- [ ] **Step 2: Run test — confirm fail**

```bash
npx tsx src/components/DayTimeline.test.ts
```

Expected: `Error: Cannot find module './DayTimeline'`

- [ ] **Step 3: Create the component**

Create `src/components/DayTimeline.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import type { DayPlan, Activity, DiningSpot } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

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
  /** Only for activity rows */
  activity?: Activity;
  /** Only for dining rows */
  dining?: DiningSpot;
}

/** Build ordered timeline rows from a DayPlan. Order: morning, lunch, afternoon, dinner, evening. */
export function buildTimelineRows(day: DayPlan): TimelineRow[] {
  const rows: TimelineRow[] = [];

  if (day.morning) {
    rows.push({
      type: 'activity', slot: 'morning',
      name: day.morning.name ?? 'Morning activity',
      time: day.morning.startTime ?? day.morning.time_slot?.split('–')[0]?.trim() ?? 'Morning',
      emoji: day.morning.category_emoji ?? (isHotelCheckIn(day.morning) ? '🏨' : '☀️'),
      activity: day.morning,
    });
  }
  if (day.lunch) {
    rows.push({
      type: 'dining', slot: 'lunch',
      name: day.lunch.name ?? 'Lunch',
      time: 'Lunch',
      emoji: '🍽️',
      dining: day.lunch,
    });
  }
  if (day.afternoon) {
    rows.push({
      type: 'activity', slot: 'afternoon',
      name: day.afternoon.name ?? 'Afternoon activity',
      time: day.afternoon.startTime ?? day.afternoon.time_slot?.split('–')[0]?.trim() ?? 'Afternoon',
      emoji: day.afternoon.category_emoji ?? '🌤',
      activity: day.afternoon,
    });
  }
  if (day.dinner) {
    rows.push({
      type: 'dining', slot: 'dinner',
      name: day.dinner.name ?? 'Dinner',
      time: 'Dinner',
      emoji: '🍷',
      dining: day.dinner,
    });
  }
  if (day.evening) {
    rows.push({
      type: 'activity', slot: 'evening',
      name: day.evening.name ?? 'Evening activity',
      time: day.evening.startTime ?? day.evening.time_slot?.split('–')[0]?.trim() ?? 'Evening',
      emoji: day.evening.category_emoji ?? '🌙',
      activity: day.evening,
    });
  }

  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface DayTimelineProps {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  ui: ItineraryUiStrings;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
}

export function DayTimeline({
  day, dayIndex, destination, ui, onSwapSlot, onNeighborhoodClick,
}: DayTimelineProps) {
  const rows = buildTimelineRows(day);

  if (rows.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-[#888]">
        No activities planned for this day yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {rows.map((row, i) => (
        <TimelineItem
          key={`${row.slot}-${i}`}
          row={row}
          isLast={i === rows.length - 1}
          onSwap={() => {
            if (row.type === 'activity' && (row.slot === 'morning' || row.slot === 'afternoon' || row.slot === 'evening')) {
              onSwapSlot(row.slot as 'morning' | 'afternoon' | 'evening');
            }
          }}
          onNeighborhoodClick={onNeighborhoodClick}
        />
      ))}
    </div>
  );
}

function TimelineItem({
  row, isLast, onSwap, onNeighborhoodClick,
}: {
  row: TimelineRow;
  isLast: boolean;
  onSwap: () => void;
  onNeighborhoodClick: (n: string) => void;
}) {
  const isCheckIn = row.type === 'activity' && row.activity && isHotelCheckIn(row.activity);
  const neighborhood = row.activity?.neighborhood ?? row.dining?.neighborhood;

  return (
    <div
      className="flex items-start gap-3 px-4 py-3.5"
      style={{ borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Time */}
      <span
        className="text-[13px] font-700 flex-shrink-0 w-[52px] pt-0.5"
        style={{ color: '#5aada5' }}
      >
        {row.time}
      </span>

      {/* Emoji icon */}
      <span
        className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5"
        style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}
      >
        {row.emoji}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap mb-1.5">
          <span className="text-[13px] font-700 text-[#222]">{row.name}</span>
          {row.activity?.isHiddenGem && (
            <span
              className="text-[9px] font-800 px-2 py-0.5 rounded-full flex-shrink-0"
              style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}
            >
              💎 Hidden Gem
            </span>
          )}
        </div>

        {/* Neighborhood link */}
        {neighborhood && (
          <button
            type="button"
            onClick={() => onNeighborhoodClick(neighborhood)}
            className="text-[11px] text-[#5aada5] hover:underline mb-2 block text-left"
          >
            📍 {neighborhood}
          </button>
        )}

        {/* Action buttons */}
        <div className="flex flex-wrap gap-1.5">
          {isCheckIn ? (
            <>
              <TlBtn onClick={() => {}}>Hotel Details</TlBtn>
              <TlBtn onClick={onSwap}>Change Hotel</TlBtn>
            </>
          ) : row.type === 'dining' ? (
            <>
              <TlBtn onClick={() => {}}>View Menu</TlBtn>
              <TlBtn onClick={() => {}}>Reservation</TlBtn>
              <TlBtn onClick={onSwap} primary>Find Alternative</TlBtn>
            </>
          ) : (
            <>
              <TlBtn onClick={() => {}}>Explore Details</TlBtn>
              <TlBtn onClick={onSwap} primary>Modify</TlBtn>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TlBtn({
  children, onClick, primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.93 }}
      className="text-[11px] font-600 px-2.5 py-1 rounded-lg transition-colors"
      style={
        primary
          ? { background: '#5aada5', color: '#fff', border: '1px solid #5aada5' }
          : { background: '#e8f4f2', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)' }
      }
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx tsx src/components/DayTimeline.test.ts
```

Expected: `✓ DayTimeline helpers: all 11 assertions passed`

- [ ] **Step 5: Commit**

```bash
git add src/components/DayTimeline.tsx src/components/DayTimeline.test.ts
git commit -m "feat(ui): add DayTimeline with buildTimelineRows + tests"
```

---

## Task 7: `DayDetailPanel`

**Files:**
- Create: `src/components/DayDetailPanel.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/DayDetailPanel.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import { DayPhoto } from '@/components/DayPhoto';
import { DayTimeline } from '@/components/DayTimeline';
import type { DayPlan, Itinerary, TravelerProfile } from '@/lib/types';
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
  onNeighborhoodClick: (neighborhood: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onBackToOverview: () => void;
  onShare: () => void;
}

export function DayDetailPanel({
  day, dayIndex, totalDays, itinerary, profile, ui, mapLabels,
  basecampMarker, focusedNeighborhood,
  onSwapSlot, onNeighborhoodClick, onPrevDay, onNextDay, onBackToOverview,
}: DayDetailPanelProps) {
  const destination = itinerary.destination ?? '';
  const photoQuery = `${destination} ${day.theme ?? 'travel'} landmark`;

  // Static weather placeholder — real API can be added later
  const weatherEmoji = getWeatherEmoji(profile?.startDate, dayIndex);

  return (
    <motion.div
      key={`day-detail-${dayIndex}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="max-w-5xl mx-auto px-4 sm:px-6 py-4"
    >
      {/* Day navigation strip */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={onPrevDay}
          disabled={dayIndex === 0}
          className="flex items-center gap-1 text-sm font-600 transition-opacity disabled:opacity-30"
          style={{ color: '#3a8a82' }}
        >
          ← Day {dayIndex}
        </button>
        <span className="text-sm font-700 text-[#222]">
          Day {dayIndex + 1} — {day.theme ?? `Day ${dayIndex + 1} of ${totalDays}`}
        </span>
        <button
          type="button"
          onClick={onNextDay}
          disabled={dayIndex === totalDays - 1}
          className="flex items-center gap-1 text-sm font-600 transition-opacity disabled:opacity-30"
          style={{ color: '#3a8a82' }}
        >
          Day {dayIndex + 2} →
        </button>
      </div>

      {/* 2-col grid */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>

        {/* Left: photo + weather + timeline */}
        <div className="flex flex-col gap-3">
          {/* Destination photo */}
          <div className="relative rounded-2xl overflow-hidden h-[200px]" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
            <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={200} />
          </div>

          {/* Weather widget (static) */}
          <div
            className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white"
            style={{ boxShadow: '0 3px 12px rgba(0,0,0,0.08)' }}
          >
            <span className="text-3xl">{weatherEmoji}</span>
            <div>
              <div className="text-[22px] font-800 text-[#222] leading-none">—°C</div>
              <div className="text-[11px] text-[#888] mt-0.5">
                Typical weather · {destination}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <DayTimeline
            day={day}
            dayIndex={dayIndex}
            destination={destination}
            ui={ui}
            onSwapSlot={onSwapSlot}
            onNeighborhoodClick={onNeighborhoodClick}
          />
        </div>

        {/* Right: Map */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            minHeight: 480,
          }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between border-b bg-white"
            style={{ borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <div>
              <div className="text-[13px] font-700 text-[#222]">Day {dayIndex + 1} Route</div>
              <div className="text-[11px] text-[#888]">{destination}</div>
            </div>
            <div className="flex gap-1.5">
              {['+', '−', '⤢'].map((c) => (
                <span
                  key={c}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-[13px] cursor-pointer"
                  style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.3)', color: '#5aada5' }}
                >
                  {c}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white" style={{ height: 'calc(100% - 52px)', minHeight: 380 }}>
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
        <ActionBtn onClick={() => {}} primary>Share Itinerary ↗</ActionBtn>
      </div>
    </motion.div>
  );
}

function ActionBtn({
  children, onClick, primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="px-5 py-2.5 rounded-xl text-[13px] font-700 transition-all"
      style={
        primary
          ? { background: '#5aada5', color: '#fff', boxShadow: '0 4px 12px rgba(90,173,165,0.4)' }
          : { background: '#fff', color: '#3a8a82', border: '1px solid rgba(90,173,165,0.3)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }
      }
    >
      {children}
    </motion.button>
  );
}

/** Very simple weather emoji heuristic — Northern Hemisphere seasons. */
function getWeatherEmoji(startDate: string | null | undefined, dayOffset: number): string {
  if (!startDate) return '🌤';
  try {
    const d = new Date(`${startDate.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + dayOffset);
    const month = d.getMonth(); // 0-based
    if (month >= 11 || month <= 1) return '❄️'; // Dec–Feb
    if (month >= 2 && month <= 4) return '🌸';   // Mar–May
    if (month >= 5 && month <= 7) return '☀️';   // Jun–Aug
    return '🍂';                                   // Sep–Nov
  } catch { return '🌤'; }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep "DayDetailPanel" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayDetailPanel.tsx
git commit -m "feat(ui): add DayDetailPanel (timeline + map 2-col)"
```

---

## Task 8: Rewrite `ItineraryClient` as thin orchestrator

**Files:**
- Modify: `src/components/ItineraryClient.tsx`

- [ ] **Step 1: Read the current ItineraryClient to know what to keep**

Open `src/components/ItineraryClient.tsx`. The functions/components defined in it that stay there (as inner helpers) are:
- `HotelDetailCube` (lines ~69–503) — keep, used by `expandedHotel` state
- `HotelCard` (lines ~505–...) — keep (used by `BasecampSection`)
- `BasecampSection` — keep (still rendered in overview for non-hotel-card content)
- `BookedHotelAroundSection` — keep
- `MobileMapOverlay` — keep
- `TripIntelligenceButton` — keep
- `formatTripDateRange` — **delete** (now in `src/lib/formatTripDateRange.ts`)
- All `useState`/`useEffect`/`useCallback` at the top of `ItineraryClient` — **delete** (now in `useItinerary`)

- [ ] **Step 2: Write the new thin ItineraryClient**

Replace the entire `export function ItineraryClient(…)` function (from line 1274 to end) with the following. Keep all the helper component definitions above it unchanged.

```tsx
// ─── Props interface (unchanged) ─────────────────────────────────────────────

interface Props {
  initialItinerary: Itinerary;
  initialProfile: TravelerProfile | null;
  initialViewMode?: ViewMode;
  initialTransportFromDb?: CityTransportGuide | null;
  initialTripSummaryUsername?: string | null;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ItineraryClient({
  initialItinerary,
  initialProfile,
  initialViewMode = 'draft',
  initialTransportFromDb = null,
  initialTripSummaryUsername = null,
}: Props) {
  const { session } = useAuth();
  const itin = useItinerary({
    initialItinerary,
    initialProfile,
    initialViewMode,
    initialTransportFromDb,
    initialTripSummaryUsername,
  });

  // ── Draft mode ───────────────────────────────────────────────────────────────
  if (itin.viewMode === 'draft') {
    return (
      <DraftOverview
        itinerary={itin.itinerary}
        onUpdate={itin.handleDraftUpdate}
        onFinalize={() => itin.setViewMode('final')}
        ui={itin.ui}
      />
    );
  }

  const days = itin.itinerary.days ?? [];
  const selectedDay = itin.selectedDayIndex >= 0 ? days[itin.selectedDayIndex] ?? null : null;

  return (
    <div className="min-h-screen relative" dir={itin.ui.dir} lang={itin.ui.htmlLang}>

      {/* ── Rotating destination photo background ─────────────────────────── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={itin.bgIdx}
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -2,
            backgroundImage: `url("${STEP_BACKGROUNDS[itin.bgIdx].imageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* ── Light teal overlay (replaces old dark gradient) ───────────────── */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{ zIndex: -1, background: 'rgba(180,228,222,0.82)' }}
      />

      {/* ── Film grain ────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url(${ITIN_RESULTS_NOISE_DATA_URL})`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'multiply',
        }}
      />

      <div className="relative z-[1]">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <ItineraryHeader
          itinerary={itin.itinerary}
          profile={itin.profile}
          ui={itin.ui}
          shareCopy={itin.shareCopy}
          session={session}
          isAdmin={itin.isAdmin}
          selectedDayIndex={itin.selectedDayIndex}
          editBanner={itin.editBanner}
          onBackToOverview={() => itin.setSelectedDayIndex(-1)}
          onBackToDraft={() => itin.setViewMode('draft')}
          initialViewMode={initialViewMode}
        />

        {/* ── Trending ticker ──────────────────────────────────────────────── */}
        <TrendingTicker destination={itin.itinerary.destination} groupType={itin.profile?.groupType} />

        {selectedDay !== null ? (
          /* ══ DAY DETAIL VIEW ══════════════════════════════════════════════ */
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
            onShare={() => {}}
          />
        ) : (
          /* ══ OVERVIEW ════════════════════════════════════════════════════ */
          <div className="max-w-5xl mx-auto py-4">
            {/* Section label */}
            <p
              className="text-center text-[11px] font-700 uppercase tracking-[0.12em] py-3"
              style={{ color: 'rgba(60,120,114,0.7)' }}
            >
              Your {days.length}-Day Itinerary — click a day to explore
            </p>

            {/* Day carousel */}
            <DayCarousel
              days={days}
              selectedDayIndex={itin.selectedDayIndex}
              destination={itin.itinerary.destination ?? ''}
              onSelectDay={(i) => itin.setSelectedDayIndex(i)}
            />

            {/* Hotel selection card */}
            {itin.itinerary.basecamp && (
              <HotelSelectionCard
                basecamp={itin.itinerary.basecamp}
                destination={itin.itinerary.destination ?? ''}
                profile={itin.profile}
                ui={itin.ui}
                onExpandHotel={itin.setExpandedHotel}
              />
            )}

            {/* Budget summary */}
            {itin.itinerary.budgetSummary && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 26 }}
                className="mx-12 mb-6 rounded-3xl p-5 grid sm:grid-cols-3 gap-3 bg-white"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}
              >
                <BudgetCell label={itin.ui.budgetDailyLine(itin.itinerary.budgetSummary.dailyAverage ?? '')} />
                <BudgetCell label={itin.ui.budgetTotalLine(itin.itinerary.budgetSummary.totalEstimate ?? '')} accent />
                <BudgetCell label={itin.ui.budgetIncludesLine(itin.itinerary.budgetSummary.includes ?? '')} />
              </motion.div>
            )}

            {/* Full trip map */}
            <section className="mx-12 mb-6 hidden sm:block print:hidden">
              <ItineraryMap
                days={itin.itinerary.days}
                destination={itin.itinerary.destination}
                focusedNeighborhood={itin.focusedNeighborhood}
                basecampMarker={itin.basecampMarker}
                labels={itin.mapLabels}
              />
            </section>

            {/* Transport card */}
            <div className="mx-12 mb-6">
              <TransportCard
                destination={itin.itinerary.destination}
                guide={itin.displayCityTransport}
                ui={itin.ui}
                totalDays={itin.itinerary.totalDays}
                isLoading={itin.transportLoading}
                hotelAnchor={itin.basecampMarker ? { lat: itin.basecampMarker.lat, lng: itin.basecampMarker.lng } : null}
              />
            </div>

            {/* Packing tips */}
            {(itin.itinerary.packingTips?.length ?? 0) > 0 && (
              <div className="mx-12 mb-6 rounded-2xl p-5 bg-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.07)' }}>
                <h3 className="font-700 text-[#222] mb-3 flex items-center gap-2 text-[14px]">
                  🎒 {itin.ui.packingTitle(itin.ui.audienceTitle(itin.profile?.groupType))}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {(itin.itinerary.packingTips ?? []).map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[13px] text-[#555]">
                      <span className="flex-shrink-0 mt-0.5 text-[#5aada5]">✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Logistics + footer */}
            <div className="mx-12 mb-6">
              {itin.profile && <LogisticsDashboard profile={itin.profile} />}
            </div>

            <div className="text-center py-8 mx-12 print:hidden" style={{ borderTop: '1px solid rgba(90,173,165,0.2)' }}>
              <p className="text-sm mb-4 text-[#3a8a82]">{itin.ui.footerPrompt(itin.profile?.groupType)}</p>
              <motion.a
                href="/onboarding"
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-600 text-sm"
                style={{ background: '#5aada5', boxShadow: '0 6px 24px -4px rgba(90,173,165,0.5)' }}
              >
                {itin.ui.planNewTripButton}
              </motion.a>
            </div>
          </div>
        )}

        {/* ── Mobile map FAB ────────────────────────────────────────────────── */}
        <motion.button
          onClick={() => itin.setMobileMapOpen(true)}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 26 }}
          whileTap={{ scale: 0.90 }}
          className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-600 shadow-xl print:hidden"
          style={{ background: 'rgba(90,173,165,0.92)', border: '1px solid rgba(255,255,255,0.25)' }}
        >
          <span>🗺</span> {itin.ui.mapFab}
        </motion.button>

        {/* ── Existing modals — unchanged ────────────────────────────────── */}
        {itin.mobileMapOpen && (
          <MobileMapOverlay
            days={itin.itinerary.days}
            destination={itin.itinerary.destination}
            focusedNeighborhood={itin.focusedNeighborhood}
            basecampMarker={itin.basecampMarker}
            mapTitle={itin.ui.mapOpenMobile}
            mapLabels={itin.mapLabels}
            onClose={() => { itin.setMobileMapOpen(false); }}
          />
        )}

        <TripStoryCube
          open={itin.tripStoryOpen}
          onClose={() => itin.setTripStoryOpen(false)}
          itinerary={itin.itinerary}
          ui={itin.ui}
        />

        <AnimatePresence>
          {itin.expandedHotel && (
            <HotelDetailCube
              hotel={itin.expandedHotel}
              destination={itin.itinerary.destination ?? ''}
              profile={itin.profile}
              ui={itin.ui}
              onClose={() => itin.setExpandedHotel(null)}
            />
          )}
        </AnimatePresence>

        <div className="print:hidden">
          <QuickEdit itinerary={itin.itinerary} onUpdate={itin.handleQuickEditUpdate} />
        </div>

        <div className="print:hidden">
          <FeedbackSurveyModal
            open={itin.feedbackOpen}
            onSubmit={itin.handleFeedbackSubmit}
            onDismiss={itin.handleFeedbackDismiss}
          />
        </div>
      </div>
    </div>
  );
}

// ── Small inline helper ───────────────────────────────────────────────────────

function BudgetCell({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <div
      className="text-center p-3 rounded-xl"
      style={accent
        ? { background: 'rgba(90,173,165,0.1)', border: '1px solid rgba(90,173,165,0.2)' }
        : { background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      <p className="text-[13px] leading-snug" style={{ color: accent ? '#3a8a82' : '#444', fontWeight: accent ? 700 : 400 }}>
        {label || '—'}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Update the imports at the top of ItineraryClient.tsx**

At the top of the file, add these new imports after the existing ones:

```typescript
import { useItinerary } from '@/hooks/useItinerary';
import { ItineraryHeader } from '@/components/ItineraryHeader';
import { DayCarousel } from '@/components/DayCarousel';
import { DayDetailPanel } from '@/components/DayDetailPanel';
import { HotelSelectionCard } from '@/components/HotelSelectionCard';
```

Remove the inline `formatTripDateRange` function from ItineraryClient.tsx (now in `src/lib/formatTripDateRange.ts`) and add this import:

```typescript
import { formatTripDateRange } from '@/lib/formatTripDateRange';
```

Remove all the `useState`, `useEffect`, `useMemo`, `useCallback`, `useRef` state declarations that are now handled by `useItinerary`. Keep only the helper component function definitions (`HotelDetailCube`, `HotelCard`, `BasecampSection`, `BookedHotelAroundSection`, `MobileMapOverlay`, `TripIntelligenceButton`).

- [ ] **Step 4: Type-check everything**

```bash
cd "C:/Users/מתן כהן/OneDrive/שולחן העבודה/travel site"
npx tsc --noEmit 2>&1 | head -30
```

Expected: 0 errors. Fix any that appear before proceeding.

- [ ] **Step 5: Start dev server and smoke-test**

```bash
npm run dev
```

Open `http://localhost:3000/onboarding` → complete a trip → observe:
1. ✅ Loading screen still works
2. ✅ Overview shows day cards carousel with light teal background
3. ✅ Header shows trip metadata chips
4. ✅ Clicking a day card opens Day Detail view
5. ✅ Day Detail shows timeline on left + map on right
6. ✅ "← Overview" in header returns to carousel
7. ✅ Hotel card appears below carousel
8. ✅ "Modify" and "Find Alternative" buttons open QuickEdit
9. ✅ Share button still works
10. ✅ Background photos still crossfade every 8 s

Also test a saved itinerary: `http://localhost:3000/itinerary/<any-uuid>`

- [ ] **Step 6: Run all existing tests**

```bash
npx tsx src/lib/formatTripDateRange.test.ts
npx tsx src/components/ItineraryDayCard.test.ts
npx tsx src/components/DayTimeline.test.ts
```

Expected: all 3 test files print ✓ passed.

- [ ] **Step 7: Commit**

```bash
git add src/components/ItineraryClient.tsx
git commit -m "refactor(itinerary): rewrite ItineraryClient as thin orchestrator

- Extract all state/handlers to useItinerary hook
- New SARTO-style light teal layout: day carousel + day detail panel
- ItineraryHeader with trip metadata chips
- HotelSelectionCard replaces BasecampSection in overview
- DayDetailPanel: timeline left + map right
- Colour overlay changed from dark navy to rgba(180,228,222,0.82)
- All existing modals and functionality preserved"
```

- [ ] **Step 8: Push to remote**

```bash
git push origin master
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `useItinerary` hook with all state + handlers → Task 1
- [x] `ItineraryHeader` with trip chips → Task 2
- [x] `ItineraryDayCard` + `deriveDayBullets` → Task 3
- [x] `DayCarousel` + nav arrows → Task 4
- [x] `HotelSelectionCard` → Task 5
- [x] `DayTimeline` + `buildTimelineRows` → Task 6
- [x] `DayDetailPanel` with weather widget → Task 7
- [x] `ItineraryClient` rewrite with light teal overlay → Task 8
- [x] `formatTripDateRange` extracted → Task 1 step 2
- [x] All existing modals preserved in Task 8
- [x] Draft mode preserved in Task 8
- [x] Background photo crossfade preserved in Task 8
- [x] Prev/Next day navigation in `DayDetailPanel` → Task 7

**Type consistency:**
- `useItinerary` returns `UseItineraryReturn` — all fields consumed by `ItineraryClient` in Task 8 ✓
- `DayDetailPanel` accepts `onSwapSlot: (slot, request?) => void` — matches `handleSlotSwap` signature ✓
- `HotelSelectionCard` uses `Basecamp` type from `@/lib/types` ✓
- `buildTimelineRows` returns `TimelineRow[]` — consumed by `DayTimeline` ✓
