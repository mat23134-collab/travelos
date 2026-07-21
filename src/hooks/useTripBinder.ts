'use client';

/**
 * useTripBinder — loads a trip's Binder data (per-stop attachments + notes/
 * status) once and exposes per-item lookups plus mutators. Mounted where stops
 * render (DayTimeline) so every stop's <StopBinder> reads from one shared fetch
 * instead of firing its own requests.
 *
 * All calls go to the ownership-gated /api/trip-documents and /api/trip-notes
 * routes with the user's bearer token; nothing here touches storage or the DB
 * directly.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  TripDocumentFile, TripItemNote, TripItemStatus, TripDocType,
  TripBudgetItem, TripBudgetItemInput,
} from '@/lib/types';

export interface StopBinderData {
  attachments: TripDocumentFile[];
  noteText: string;
  status: TripItemStatus | null;
  paidAmount: number | null;
  paidCurrency: string;
}

const EMPTY: StopBinderData = { attachments: [], noteText: '', status: null, paidAmount: null, paidCurrency: 'ILS' };

/** Planned/actual totals for one currency, plus the count of lines behind them. */
export interface BudgetCurrencyTotal {
  currency: string;
  planned: number;
  actual: number;
  lines: number;
}

export interface TripBinder {
  ready: boolean;
  enabled: boolean; // false when we lack an itineraryId or token → binder hidden
  itineraryId: string | null;
  accessToken: string | null;
  forItem: (itemId: string | null | undefined) => StopBinderData;
  uploadDocs: (itemId: string, files: File[], docType: TripDocType) => Promise<boolean>;
  deleteDoc: (name: string) => Promise<boolean>;
  saveNote: (
    itemId: string,
    patch: { noteText?: string; status?: TripItemStatus | null; paidAmount?: number | null; paidCurrency?: string },
  ) => Promise<boolean>;
  /** All trip-level attachments (itemId === null) — flights, insurance, etc. */
  tripDocs: TripDocumentFile[];
  /** Budget lines + planned/actual totals per currency (Stage 3). */
  budgetItems: TripBudgetItem[];
  budgetTotals: BudgetCurrencyTotal[];
  saveBudgetItem: (input: TripBudgetItemInput) => Promise<boolean>;
  deleteBudgetItem: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useTripBinder(
  itineraryId: string | null | undefined,
  accessToken: string | null | undefined,
): TripBinder {
  const enabled = !!itineraryId && !!accessToken;
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<TripDocumentFile[]>([]);
  const [notes, setNotes] = useState<TripItemNote[]>([]);
  const [budgetItems, setBudgetItems] = useState<TripBudgetItem[]>([]);

  const authHeaders = useCallback(
    (extra?: Record<string, string>): HeadersInit => ({
      ...(extra ?? {}),
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken],
  );

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [docRes, noteRes, budgetRes] = await Promise.all([
        fetch(`/api/trip-documents?itineraryId=${itineraryId}`, { headers: authHeaders() }),
        fetch(`/api/trip-notes?itineraryId=${itineraryId}`, { headers: authHeaders() }),
        fetch(`/api/trip-budget?itineraryId=${itineraryId}`, { headers: authHeaders() }),
      ]);
      if (docRes.ok) setFiles(((await docRes.json())?.files ?? []) as TripDocumentFile[]);
      if (noteRes.ok) setNotes(((await noteRes.json())?.notes ?? []) as TripItemNote[]);
      if (budgetRes.ok) setBudgetItems(((await budgetRes.json())?.items ?? []) as TripBudgetItem[]);
    } catch {
      /* leave whatever we have; binder degrades to empty */
    } finally {
      setReady(true);
    }
  }, [enabled, itineraryId, authHeaders]);

  useEffect(() => {
    setReady(false);
    void refresh();
  }, [refresh]);

  const forItem = useCallback(
    (itemId: string | null | undefined): StopBinderData => {
      if (!itemId) return EMPTY;
      const note = notes.find((n) => n.itemId === itemId);
      return {
        attachments: files.filter((f) => f.itemId === itemId),
        noteText: note?.noteText ?? '',
        status: note?.status ?? null,
        paidAmount: note?.paidAmount ?? null,
        paidCurrency: note?.paidCurrency ?? 'ILS',
      };
    },
    [files, notes],
  );

  const uploadDocs = useCallback(
    async (itemId: string, toUpload: File[], docType: TripDocType): Promise<boolean> => {
      if (!enabled || toUpload.length === 0) return false;
      const form = new FormData();
      form.append('itineraryId', itineraryId!);
      form.append('itemId', itemId);
      form.append('docType', docType);
      for (const f of toUpload) form.append('file', f);
      try {
        const res = await fetch('/api/trip-documents', { method: 'POST', headers: authHeaders(), body: form });
        if (!res.ok) return false;
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [enabled, itineraryId, authHeaders, refresh],
  );

  const deleteDoc = useCallback(
    async (name: string): Promise<boolean> => {
      if (!enabled) return false;
      try {
        const res = await fetch('/api/trip-documents', {
          method: 'DELETE',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ itineraryId, name }),
        });
        if (!res.ok) return false;
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [enabled, itineraryId, authHeaders, refresh],
  );

  const saveNote = useCallback(
    async (
      itemId: string,
      patch: { noteText?: string; status?: TripItemStatus | null; paidAmount?: number | null; paidCurrency?: string },
    ): Promise<boolean> => {
      if (!enabled) return false;
      // Optimistic local update so typing/status feels instant.
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.itemId === itemId);
        const base: TripItemNote = idx >= 0 ? prev[idx]
          : { itemId, noteText: '', status: null, paidAmount: null, paidCurrency: 'ILS', updatedAt: '' };
        const next: TripItemNote = {
          ...base,
          noteText: patch.noteText !== undefined ? patch.noteText : base.noteText,
          status: patch.status !== undefined ? patch.status : base.status,
          paidAmount: patch.paidAmount !== undefined ? patch.paidAmount : base.paidAmount,
          paidCurrency: patch.paidCurrency !== undefined ? patch.paidCurrency : base.paidCurrency,
          updatedAt: new Date().toISOString(),
        };
        if (idx >= 0) { const copy = prev.slice(); copy[idx] = next; return copy; }
        return [...prev, next];
      });
      try {
        const res = await fetch('/api/trip-notes', {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ itineraryId, itemId, ...patch }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [enabled, itineraryId, authHeaders],
  );

  const saveBudgetItem = useCallback(
    async (input: TripBudgetItemInput): Promise<boolean> => {
      if (!enabled) return false;
      try {
        const res = await fetch('/api/trip-budget', {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ itineraryId, ...input }),
        });
        if (!res.ok) return false;
        await refresh();
        return true;
      } catch {
        return false;
      }
    },
    [enabled, itineraryId, authHeaders, refresh],
  );

  const deleteBudgetItem = useCallback(
    async (id: string): Promise<boolean> => {
      if (!enabled) return false;
      // Optimistic drop so the row disappears immediately.
      setBudgetItems((prev) => prev.filter((b) => b.id !== id));
      try {
        const res = await fetch('/api/trip-budget', {
          method: 'DELETE',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ itineraryId, id }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [enabled, itineraryId, authHeaders],
  );

  const tripDocs = useMemo(() => files.filter((f) => f.itemId === null), [files]);

  // Planned/actual sums grouped by currency (a mixed-currency trip stays honest
  // instead of adding ₪ to $). Currencies ordered by total planned, desc.
  // Per-stop paid amounts (from notes marked 'paid') fold into ACTUAL so the
  // ledger reflects money spent at stops without a separate budget line.
  const budgetTotals = useMemo<BudgetCurrencyTotal[]>(() => {
    const byCur = new Map<string, BudgetCurrencyTotal>();
    const bump = (cur: string) => {
      const c = cur || 'ILS';
      const t = byCur.get(c) ?? { currency: c, planned: 0, actual: 0, lines: 0 };
      byCur.set(c, t);
      return t;
    };
    for (const b of budgetItems) {
      if (b.status === 'cancelled') continue; // dropped lines don't count
      const t = bump(b.currency);
      t.planned += b.plannedCost ?? 0;
      t.actual += b.actualCost ?? 0;
      t.lines += 1;
    }
    for (const n of notes) {
      if (n.status !== 'paid' || n.paidAmount == null) continue;
      bump(n.paidCurrency).actual += n.paidAmount;
    }
    return [...byCur.values()].sort((a, b) => b.planned - a.planned);
  }, [budgetItems, notes]);

  return {
    ready, enabled,
    itineraryId: itineraryId ?? null,
    accessToken: accessToken ?? null,
    forItem, uploadDocs, deleteDoc, saveNote, refresh,
    tripDocs, budgetItems, budgetTotals, saveBudgetItem, deleteBudgetItem,
  };
}
