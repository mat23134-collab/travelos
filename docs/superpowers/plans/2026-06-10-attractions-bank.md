# Attractions Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "בנק אטרקציות" (Attractions Bank) panel below the day map that holds unscheduled places — a mix of curated AI top-picks (from `places`) and user-added manual places — and lets users swap them into a day's timeline slots.

**Architecture:** New `attraction_bank` table (per itinerary, per user) stores unscheduled places with a `source` ('ai' | 'manual'). A populate endpoint seeds AI picks from `places.top_pick_category` for the trip's destination on first load. A React hook (`useAttractionBank`) manages fetch/add/remove/schedule. The `AttractionsBank` component renders below `ItineraryMap` in `DayDetailPanel`'s right column with tabs (All / AI picks / Yours), a manual-add input, and a "pending slot" mode triggered by "Find Alternative" that lets the user tap a bank card to swap it directly into that slot via the existing `/api/swap` endpoint.

**Tech Stack:** Next.js Route Handlers, Supabase (Postgres + RLS), React hooks, Framer Motion, existing `/api/swap` endpoint.

---

### Task 1: Database migration — `attraction_bank` table

**Files:**
- Create: `supabase/migrations/20260610_attraction_bank.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-06-10 — Attractions Bank
--
-- Holds unscheduled places for a trip: a mix of AI-curated top picks (pulled
-- from public.places.top_pick_category for the trip's destination) and
-- places the user added manually. Items live here until the user schedules
-- them into a day slot (at which point they're removed from the bank and
-- written into itinerary_items via /api/swap).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attraction_bank (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id      uuid NOT NULL REFERENCES public.itineraries(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  category_emoji    text,
  lat               double precision,
  lng               double precision,
  photo_url         text,
  website_url       text,
  source            text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  top_pick_category text CHECK (top_pick_category IS NULL OR top_pick_category IN ('sightseeing', 'history', 'food')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS attraction_bank_itinerary_idx
  ON public.attraction_bank (itinerary_id, created_at);

ALTER TABLE public.attraction_bank ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attraction_bank_select_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_select_own" ON public.attraction_bank
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "attraction_bank_insert_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_insert_own" ON public.attraction_bank
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "attraction_bank_delete_own" ON public.attraction_bank;
CREATE POLICY "attraction_bank_delete_own" ON public.attraction_bank
  FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.attraction_bank IS
  'Unscheduled places for a trip — AI top-picks plus user-added manual places. Removed when scheduled into itinerary_items.';
COMMENT ON COLUMN public.attraction_bank.source IS
  'ai = pulled from places.top_pick_category; manual = user-added via the bank input.';
```

- [ ] **Step 2: Apply the migration via Supabase MCP**

Use `mcp__<supabase>__apply_migration` with name `attraction_bank` and the SQL above (or run it through the Supabase SQL editor). Verify with `list_tables` that `attraction_bank` exists with RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260610_attraction_bank.sql
git commit -m "feat: add attraction_bank table for unscheduled trip places"
```

---

### Task 2: API routes — list/add/populate/delete

**Files:**
- Create: `src/app/api/bank/route.ts`
- Create: `src/app/api/bank/[id]/route.ts`
- Create: `src/app/api/bank/populate/route.ts`

- [ ] **Step 1: `src/app/api/bank/route.ts` — GET (list) and POST (manual add)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';

export interface BankItem {
  id: string;
  itinerary_id: string;
  name: string;
  description: string | null;
  category_emoji: string | null;
  lat: number | null;
  lng: number | null;
  photo_url: string | null;
  website_url: string | null;
  source: 'ai' | 'manual';
  top_pick_category: 'sightseeing' | 'history' | 'food' | null;
  created_at: string;
}

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function GET(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const itineraryId = (req.nextUrl.searchParams.get('itinerary_id') ?? '').trim();
  if (!itineraryId) {
    return NextResponse.json({ error: 'itinerary_id query param required' }, { status: 400 });
  }

  const db = dbClient();
  const { data, error } = await db
    .from('attraction_bank')
    .select('id, itinerary_id, name, description, category_emoji, lat, lng, photo_url, website_url, source, top_pick_category, created_at')
    .eq('itinerary_id', itineraryId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) {
    console.warn('[api/bank] select failed:', error.message);
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json({ items: (data ?? []) as BankItem[] }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  let body: {
    itinerary_id?: string;
    name?: string;
    description?: string;
    category_emoji?: string;
    lat?: number;
    lng?: number;
    website_url?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const itineraryId = (body.itinerary_id ?? '').trim();
  const name = (body.name ?? '').trim();
  if (!itineraryId || !name) {
    return NextResponse.json({ error: 'itinerary_id and name are required' }, { status: 400 });
  }

  const db = dbClient();
  const { data, error } = await db
    .from('attraction_bank')
    .insert({
      itinerary_id: itineraryId,
      user_id: userId,
      name,
      description: body.description?.trim() || null,
      category_emoji: body.category_emoji?.trim() || '📍',
      lat: typeof body.lat === 'number' ? body.lat : null,
      lng: typeof body.lng === 'number' ? body.lng : null,
      website_url: body.website_url?.trim() || null,
      source: 'manual',
      top_pick_category: null,
    })
    .select('id, itinerary_id, name, description, category_emoji, lat, lng, photo_url, website_url, source, top_pick_category, created_at')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data as BankItem });
}
```

- [ ] **Step 2: `src/app/api/bank/[id]/route.ts` — DELETE**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = dbClient();
  const { error } = await db
    .from('attraction_bank')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: `src/app/api/bank/populate/route.ts` — POST (auto-fill AI picks)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import type { Itinerary } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PER_CATEGORY = 5;
const CATEGORIES = ['sightseeing', 'history', 'food'] as const;

function dbClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Names already booked into the itinerary (any day, any slot). */
function namesInItinerary(itinerary: Itinerary): Set<string> {
  const names = new Set<string>();
  for (const day of itinerary.days ?? []) {
    for (const key of ['morning', 'afternoon', 'evening'] as const) {
      const act = day[key];
      if (act?.name) names.add(act.name.trim().toLowerCase());
    }
    for (const key of ['breakfast', 'lunch', 'dinner'] as const) {
      const meal = day[key];
      if (meal?.name) names.add(meal.name.trim().toLowerCase());
    }
  }
  return names;
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  let body: { itinerary_id?: string; destination?: string; itinerary?: Itinerary };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const itineraryId = (body.itinerary_id ?? '').trim();
  const destination = (body.destination ?? '').trim();
  if (!itineraryId || !destination) {
    return NextResponse.json({ error: 'itinerary_id and destination are required' }, { status: 400 });
  }

  const db = dbClient();

  // Skip if this itinerary already has AI bank items.
  const { data: existing } = await db
    .from('attraction_bank')
    .select('id')
    .eq('itinerary_id', itineraryId)
    .eq('source', 'ai')
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ inserted: 0, reason: 'already populated' });
  }

  // City may include a country suffix ("Paris, France") — match the leading segment.
  const cityOnly = destination.split(',')[0].trim();

  const { data: places, error: placesErr } = await db
    .from('places')
    .select('name, description, category_emoji, lat, lng, photo_url, website_url, top_pick_category, popularity_rank')
    .ilike('city', cityOnly)
    .not('top_pick_category', 'is', null)
    .order('popularity_rank', { ascending: true })
    .limit(60);

  if (placesErr) {
    return NextResponse.json({ error: placesErr.message }, { status: 500 });
  }

  const skip = body.itinerary ? namesInItinerary(body.itinerary) : new Set<string>();

  const perCategoryCount: Record<string, number> = { sightseeing: 0, history: 0, food: 0 };
  const toInsert: Array<Record<string, unknown>> = [];

  for (const place of places ?? []) {
    const cat = place.top_pick_category as (typeof CATEGORIES)[number] | null;
    if (!cat || !CATEGORIES.includes(cat)) continue;
    if (perCategoryCount[cat] >= PER_CATEGORY) continue;
    if (skip.has((place.name as string).trim().toLowerCase())) continue;

    perCategoryCount[cat]++;
    toInsert.push({
      itinerary_id: itineraryId,
      user_id: userId,
      name: place.name,
      description: place.description,
      category_emoji: place.category_emoji,
      lat: place.lat,
      lng: place.lng,
      photo_url: place.photo_url,
      website_url: place.website_url,
      source: 'ai',
      top_pick_category: cat,
    });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ inserted: 0, reason: 'no curated picks for city' });
  }

  const { error: insErr } = await db.from('attraction_bank').insert(toInsert);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ inserted: toInsert.length });
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/bank
git commit -m "feat: add attraction bank API routes (list, add, delete, populate)"
```

---

### Task 3: `useAttractionBank` hook

**Files:**
- Create: `src/hooks/useAttractionBank.ts`

- [ ] **Step 1: Write the hook**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Itinerary } from '@/lib/types';
import type { BankItem } from '@/app/api/bank/route';

export type { BankItem };

interface UseAttractionBankArgs {
  itineraryId: string | null | undefined;
  destination: string;
  itinerary: Itinerary;
  session: Session | null;
}

export interface UseAttractionBankResult {
  items: BankItem[];
  loading: boolean;
  addManualItem: (name: string) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useAttractionBank({ itineraryId, destination, itinerary, session }: UseAttractionBankArgs): UseAttractionBankResult {
  const [items, setItems] = useState<BankItem[]>([]);
  const [loading, setLoading] = useState(false);
  const populateAttempted = useRef(false);

  const authHeaders = useCallback((): HeadersInit => {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!itineraryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bank?itinerary_id=${encodeURIComponent(itineraryId)}`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      // silent — bank is a non-critical enhancement
    } finally {
      setLoading(false);
    }
  }, [itineraryId, authHeaders]);

  // First-load: populate AI picks once, then fetch the bank.
  useEffect(() => {
    if (!itineraryId || !destination || populateAttempted.current) return;
    populateAttempted.current = true;

    (async () => {
      try {
        await fetch('/api/bank/populate', {
          method: 'POST',
          headers: authHeaders(),
          body: JSON.stringify({ itinerary_id: itineraryId, destination, itinerary }),
        });
      } catch {
        // non-critical
      }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itineraryId, destination]);

  const addManualItem = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || !itineraryId) return;
    try {
      const res = await fetch('/api/bank', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ itinerary_id: itineraryId, name: trimmed, category_emoji: '📍' }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.item) setItems((prev) => [...prev, data.item as BankItem]);
    } catch {
      // non-critical
    }
  }, [itineraryId, authHeaders]);

  const removeItem = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`/api/bank/${id}`, { method: 'DELETE', headers: authHeaders() });
    } catch {
      // already removed from UI; ignore
    }
  }, [authHeaders]);

  return { items, loading, addManualItem, removeItem, refresh };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAttractionBank.ts
git commit -m "feat: add useAttractionBank hook"
```

---

### Task 4: `AttractionsBank` component

**Files:**
- Create: `src/components/AttractionsBank.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { BankItem } from '@/hooks/useAttractionBank';
import type { SwapTarget } from '@/components/DayTimeline';

type Tab = 'all' | 'ai' | 'manual';

interface AttractionsBankProps {
  items: BankItem[];
  loading: boolean;
  pendingSlot: SwapTarget | null;
  onAddManual: (name: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onSchedule: (item: BankItem) => void;
  onCancelPending: () => void;
}

const SLOT_LABEL: Record<'morning' | 'afternoon' | 'evening', string> = {
  morning: 'הבוקר',
  afternoon: 'אחה"צ',
  evening: 'הערב',
};

export function AttractionsBank({ items, loading, pendingSlot, onAddManual, onRemove, onSchedule, onCancelPending }: AttractionsBankProps) {
  const [tab, setTab] = useState<Tab>('all');
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = items.filter((item) => {
    if (tab === 'ai') return item.source === 'ai';
    if (tab === 'manual') return item.source === 'manual';
    return true;
  });

  const handleAdd = async () => {
    const name = draft.trim();
    if (!name || submitting) return;
    setSubmitting(true);
    try {
      await onAddManual(name);
      setDraft('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold text-[#222]">🗂️ בנק אטרקציות</div>
          <span className="text-[11px] text-[#888]">{items.length} מקומות</span>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>הכל</TabBtn>
          <TabBtn active={tab === 'ai'} onClick={() => setTab('ai')}>המלצות AI</TabBtn>
          <TabBtn active={tab === 'manual'} onClick={() => setTab('manual')}>הוספתם ידנית</TabBtn>
        </div>
      </div>

      {/* Pending-slot banner */}
      <AnimatePresence>
        {pendingSlot && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2.5 flex items-center justify-between gap-2" style={{ background: 'rgba(90,173,165,0.12)', borderBottom: '1px solid rgba(90,173,165,0.25)' }}>
              <span className="text-[12px] font-semibold" style={{ color: '#3a8a82' }}>
                בחרו מקום שיחליף את "{pendingSlot.currentName}" ({SLOT_LABEL[pendingSlot.slot]})
              </span>
              <button type="button" onClick={onCancelPending} className="text-[11px] font-bold flex-shrink-0" style={{ color: '#888' }}>
                ביטול
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Item list */}
      <div className="max-h-[340px] overflow-y-auto divide-y" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
        {loading && items.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[#888]">טוען מקומות…</div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="px-4 py-6 text-center text-[12px] text-[#888]">
            {tab === 'manual' ? 'עוד לא הוספתם מקומות בעצמכם' : 'אין מקומות זמינים כרגע'}
          </div>
        )}
        {filtered.map((item) => (
          <BankItemCard
            key={item.id}
            item={item}
            pending={!!pendingSlot}
            onRemove={() => onRemove(item.id)}
            onSchedule={() => onSchedule(item)}
          />
        ))}
      </div>

      {/* Manual add */}
      <div className="px-4 py-3 border-t flex items-center gap-2" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
          placeholder="הוסיפו מקום בעצמכם…"
          className="flex-1 text-[12px] px-3 py-2 rounded-xl border outline-none"
          style={{ borderColor: 'rgba(0,0,0,0.12)' }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!draft.trim() || submitting}
          className="text-[12px] font-bold px-3 py-2 rounded-xl disabled:opacity-40"
          style={{ background: '#5aada5', color: 'white' }}
        >
          הוספה
        </button>
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors"
      style={active
        ? { background: '#5aada5', color: 'white' }
        : { background: '#f2f2f2', color: '#888' }}
    >
      {children}
    </button>
  );
}

function BankItemCard({ item, pending, onRemove, onSchedule }: { item: BankItem; pending: boolean; onRemove: () => void; onSchedule: () => void }) {
  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <span className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] flex-shrink-0" style={{ background: '#e8f4f2', border: '1px solid rgba(90,173,165,0.25)' }}>
        {item.category_emoji ?? '📍'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[12.5px] font-bold text-[#222] truncate">{item.name}</span>
          <span
            className="text-[8px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wide"
            style={item.source === 'ai'
              ? { background: 'rgba(90,173,165,0.15)', color: '#3a8a82' }
              : { background: 'rgba(197,145,42,0.15)', color: '#b8860b' }}
          >
            {item.source === 'ai' ? 'AI' : 'שלכם'}
          </span>
        </div>
        {item.description && (
          <p className="text-[11px] text-[#888] mt-0.5 line-clamp-1">{item.description}</p>
        )}
      </div>
      {pending ? (
        <button
          type="button"
          onClick={onSchedule}
          className="text-[11px] font-bold px-2.5 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: '#5aada5', color: 'white' }}
        >
          שיבוץ →
        </button>
      ) : (
        <button
          type="button"
          onClick={onRemove}
          aria-label="הסרה מהבנק"
          className="text-[14px] flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full"
          style={{ color: '#bbb' }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AttractionsBank.tsx
git commit -m "feat: add AttractionsBank component"
```

---

### Task 5: Wire into `DayDetailPanel`

**Files:**
- Modify: `src/components/DayDetailPanel.tsx`
- Modify: `src/components/ItineraryClient.tsx` (pass `itineraryId` and `session`)
- Modify: `src/hooks/useItinerary.ts` (expose `session` if not already)

- [ ] **Step 1: Confirm `session` is available from `useItinerary`**

Run: `grep -n "session" "src/hooks/useItinerary.ts" | head -20`

If `session` (a `Session | null` from `@supabase/supabase-js`) is already returned by the hook, note its name. If not, add it to the hook's return object using the existing Supabase auth state (the hook already reads `session?.access_token` at line 235, so a `session` value exists in scope — just ensure it's part of the returned object).

- [ ] **Step 2: Pass `itineraryId` and `session` from `ItineraryClient.tsx` to `DayDetailPanel`**

In `src/components/ItineraryClient.tsx`, find the `<DayDetailPanel ... />` block (around line 1341) and add two props:

```tsx
          <DayDetailPanel
            day={selectedDay}
            dayIndex={itin.selectedDayIndex}
            totalDays={days.length}
            itinerary={itin.itinerary}
            itineraryId={itin.itinerary._id ?? null}
            session={itin.session ?? null}
            profile={itin.profile}
```

(keep all existing props below unchanged)

- [ ] **Step 3: Update `DayDetailPanelProps` and add the bank below the map**

In `src/components/DayDetailPanel.tsx`:

1. Add imports near the top:

```typescript
import type { Session } from '@supabase/supabase-js';
import { AttractionsBank } from '@/components/AttractionsBank';
import { useAttractionBank, type BankItem } from '@/hooks/useAttractionBank';
```

2. Extend `DayDetailPanelProps` (after `focusedNeighborhood`):

```typescript
  itineraryId: string | null;
  session: Session | null;
```

3. Update the function signature to destructure the two new props:

```typescript
export function DayDetailPanel({
  day, dayIndex, totalDays, itinerary, itineraryId, session, profile, ui, mapLabels,
  basecampMarker, focusedNeighborhood,
  onSwapSlot, onCommitActivitySwap, onNeighborhoodClick,
  onPrevDay, onNextDay, onBackToOverview, onOpenMobileMap,
}: DayDetailPanelProps) {
```

4. Inside the component body, after the existing `useState` calls (after `activeSwap` state), add:

```typescript
  const [pendingSlot, setPendingSlot] = useState<SwapTarget | null>(null);
  const bank = useAttractionBank({ itineraryId, destination, itinerary, session });

  const handleScheduleFromBank = async (item: BankItem) => {
    if (!pendingSlot) return;
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itineraryId ?? undefined,
        dayIndex,
        slot: pendingSlot.slot,
        replacementActivity: {
          name: item.name,
          description: item.description ?? '',
          latitude: item.lat ?? undefined,
          longitude: item.lng ?? undefined,
          category_emoji: item.category_emoji ?? undefined,
          website_url: item.website_url ?? undefined,
          neighborhood: pendingSlot.neighborhood,
        },
        proposalSummary: `הוחלף ב${item.name} מבנק האטרקציות`,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      onCommitActivitySwap(dayIndex, pendingSlot.slot, result.activity, result.summary, pendingSlot.diningField);
      await bank.removeItem(item.id);
      setPendingSlot(null);
    }
  };
```

5. Wire `onFindAlternative` on `<DayTimeline>` to also set `pendingSlot` (it already sets `activeSwap` via `onFindAlternative={(target) => setActiveSwap(target)}` at line 131 — change it so the bank can be the picking surface):

```tsx
              <DayTimeline
                day={day}
                dayIndex={dayIndex}
                destination={destination}
                ui={ui}
                onSwapSlot={onSwapSlot}
                onNeighborhoodClick={onNeighborhoodClick}
                onExplore={(row) => setActivePlace(row)}
                onFindAlternative={(target) => { setActiveSwap(target); setPendingSlot(target); }}
              />
```

This keeps the existing `AlternativePickerPanel` (AI-generated suggestions) working exactly as before, while *also* highlighting the bank below the map as a quick-pick alternative. Closing the `AlternativePickerPanel` should clear `pendingSlot` too — update its `onClose`:

```tsx
      {activeSwap && (
        <AlternativePickerPanel
          target={activeSwap}
          itinerary={itinerary}
          profile={profile}
          onCommit={handleCommit}
          onClose={() => { setActiveSwap(null); setPendingSlot(null); }}
        />
      )}
```

And in `handleCommit`, also clear `pendingSlot`:

```typescript
  const handleCommit = (activity: Activity, summary: string, diningField?: 'breakfast' | 'lunch' | 'dinner') => {
    if (!activeSwap) return;
    onCommitActivitySwap(dayIndex, activeSwap.slot, activity, summary, diningField);
    setActiveSwap(null);
    setPendingSlot(null);
  };
```

6. Add `<AttractionsBank>` below the `ItineraryMap` block, inside the right column `<div>` (after the closing `</div>` of the map's inner wrapper, still inside the `hidden sm:block` column — actually place it as a sibling block below the map column so it's visible on mobile too). Replace the right-column block:

```tsx
            {/* Right: Map + Attractions Bank */}
            <div className="flex flex-col gap-3">
              <div
                className="rounded-2xl overflow-hidden bg-white"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minHeight: 380 }}
              >
                <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <div>
                    <div className="text-[13px] font-bold text-[#222]">Day {dayIndex + 1} Route</div>
                    <div className="text-[11px] text-[#888]">{destination}</div>
                  </div>
                </div>
                <div style={{ height: 'calc(100% - 52px)', minHeight: 328 }}>
                  <ItineraryMap
                    days={[day]}
                    destination={destination}
                    focusedNeighborhood={focusedNeighborhood}
                    basecampMarker={basecampMarker}
                    labels={mapLabels}
                  />
                </div>
              </div>

              <AttractionsBank
                items={bank.items}
                loading={bank.loading}
                pendingSlot={pendingSlot}
                onAddManual={bank.addManualItem}
                onRemove={bank.removeItem}
                onSchedule={handleScheduleFromBank}
                onCancelPending={() => setPendingSlot(null)}
              />
            </div>
```

Note: the original right column had `className="hidden sm:block ..."`. The new wrapper drops `hidden sm:block` so the bank is visible on mobile too (below the timeline due to grid order); the map keeps its existing min-height behavior. Since `grid-cols-1 sm:grid-cols-2` already stacks columns on mobile, this is safe — just verify visually after the change.

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No new errors related to `DayDetailPanel.tsx`, `AttractionsBank.tsx`, `useAttractionBank.ts`, `ItineraryClient.tsx`, or `api/bank/*`.

- [ ] **Step 5: Commit**

```bash
git add src/components/DayDetailPanel.tsx src/components/ItineraryClient.tsx src/hooks/useItinerary.ts
git commit -m "feat: wire Attractions Bank into day detail panel with swap-from-bank flow"
```

---

### Self-Review Notes

- **Spec coverage:** AI source (populate endpoint), manual source (POST /api/bank), clear visual distinction (AI/שלכם badges + tabs), quality-over-quantity (5 per category cap), swap flow (pendingSlot → bank card → /api/swap), placement below map in right column. ✅
- **RLS:** all bank rows scoped to `user_id = auth.uid()`, matching `user_place_events` pattern.
- **Non-critical failures:** bank fetch/populate/add/remove all fail silently (try/catch, no UI-blocking errors) — matches the "graceful degradation" pattern used in `/api/landmarks`.
