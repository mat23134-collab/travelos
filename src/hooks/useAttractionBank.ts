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
