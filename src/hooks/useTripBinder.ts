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

import { useCallback, useEffect, useState } from 'react';
import type { TripDocumentFile, TripItemNote, TripItemStatus, TripDocType } from '@/lib/types';

export interface StopBinderData {
  attachments: TripDocumentFile[];
  noteText: string;
  status: TripItemStatus | null;
}

const EMPTY: StopBinderData = { attachments: [], noteText: '', status: null };

export interface TripBinder {
  ready: boolean;
  enabled: boolean; // false when we lack an itineraryId or token → binder hidden
  forItem: (itemId: string | null | undefined) => StopBinderData;
  uploadDocs: (itemId: string, files: File[], docType: TripDocType) => Promise<boolean>;
  deleteDoc: (name: string) => Promise<boolean>;
  saveNote: (itemId: string, patch: { noteText?: string; status?: TripItemStatus | null }) => Promise<boolean>;
}

export function useTripBinder(
  itineraryId: string | null | undefined,
  accessToken: string | null | undefined,
): TripBinder {
  const enabled = !!itineraryId && !!accessToken;
  const [ready, setReady] = useState(false);
  const [files, setFiles] = useState<TripDocumentFile[]>([]);
  const [notes, setNotes] = useState<TripItemNote[]>([]);

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
      const [docRes, noteRes] = await Promise.all([
        fetch(`/api/trip-documents?itineraryId=${itineraryId}`, { headers: authHeaders() }),
        fetch(`/api/trip-notes?itineraryId=${itineraryId}`, { headers: authHeaders() }),
      ]);
      if (docRes.ok) setFiles(((await docRes.json())?.files ?? []) as TripDocumentFile[]);
      if (noteRes.ok) setNotes(((await noteRes.json())?.notes ?? []) as TripItemNote[]);
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
    async (itemId: string, patch: { noteText?: string; status?: TripItemStatus | null }): Promise<boolean> => {
      if (!enabled) return false;
      // Optimistic local update so typing/status feels instant.
      setNotes((prev) => {
        const idx = prev.findIndex((n) => n.itemId === itemId);
        const base: TripItemNote = idx >= 0 ? prev[idx] : { itemId, noteText: '', status: null, updatedAt: '' };
        const next: TripItemNote = {
          ...base,
          noteText: patch.noteText !== undefined ? patch.noteText : base.noteText,
          status: patch.status !== undefined ? patch.status : base.status,
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

  return { ready, enabled, forItem, uploadDocs, deleteDoc, saveNote };
}
