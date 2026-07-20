/**
 * confirmationMatch — given a parsed booking confirmation and the loaded
 * itinerary, rank the stops it might belong to (by DATE + NAME), so the Binder
 * intake can PROPOSE a day/stop. Pure and deterministic; the user always
 * confirms or overrides the suggestion before anything is filed.
 */

import type { Itinerary, Activity, DiningSpot } from '@/lib/types';
import type { ParsedConfirmation } from '@/app/api/scan-notes/route';

export type SlotKey = 'breakfast' | 'morning' | 'lunch' | 'afternoon' | 'dinner' | 'evening';
const SLOTS: SlotKey[] = ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'];

export interface StopCandidate {
  dayIndex: number;
  dayNumber: number;
  slot: SlotKey;
  itemId: string;
  name: string;
  dayDateISO: string | null;
  score: number;
  dateMatch: boolean;
  nameMatch: boolean;
}

const norm = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'and', 'de', 'la', 'le', 'il', 'el', 'hotel', 'restaurant', 'cafe', 'bar']);

function tokens(s: string): string[] {
  return norm(s).split(' ').filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/** 0..1 token-overlap similarity between a parsed name and a stop name. */
function nameSimilarity(a: string | null, b: string): number {
  if (!a) return 0;
  const ta = tokens(a), tb = tokens(b);
  if (ta.length === 0 || tb.length === 0) return 0;
  const setB = new Set(tb);
  const hits = ta.filter((t) => setB.has(t)).length;
  if (hits === 0) {
    // Fall back to substring (handles "Artemide" vs "Hotel Artemide Roma").
    const na = norm(a), nb = norm(b);
    if (na.length >= 4 && (nb.includes(na) || na.includes(nb))) return 0.6;
    return 0;
  }
  return hits / Math.min(ta.length, tb.length);
}

/** ISO date (YYYY-MM-DD) for a 1-based day number, offset from the trip start. */
export function dayDateISO(startDate: string | null | undefined, dayNumber: number): string | null {
  if (!startDate) return null;
  const d = new Date(`${startDate.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + (dayNumber - 1));
  return d.toISOString().slice(0, 10);
}

/** Small nudge: which slot a doc type most naturally belongs to on its day. */
function slotAffinity(docType: ParsedConfirmation['docType'], slot: SlotKey): number {
  if (docType === 'reservation' && (slot === 'dinner' || slot === 'lunch')) return 1;
  if (docType === 'ticket' && (slot === 'morning' || slot === 'afternoon')) return 1;
  if ((docType === 'hotel' || docType === 'flight') && slot === 'morning') return 1;
  return 0;
}

/**
 * Rank stop candidates for a parsed confirmation. Returns them best-first;
 * an empty array means nothing to anchor to (caller offers a manual/trip-level
 * choice). A candidate with dateMatch || nameMatch is a genuine suggestion.
 */
export function rankStopCandidates(
  itinerary: Itinerary,
  startDate: string | null | undefined,
  parsed: ParsedConfirmation,
  limit = 6,
): StopCandidate[] {
  const days = itinerary.days ?? [];
  const out: StopCandidate[] = [];

  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    if (!day) continue;
    const dayNumber = day.day ?? dayIndex + 1;
    const iso = dayDateISO(startDate, dayNumber);
    const dateMatch = !!parsed.date && !!iso && iso === parsed.date;

    for (const slot of SLOTS) {
      const stop = day[slot] as (Activity | DiningSpot) | undefined;
      const itemId = stop?.item_id;
      const name = stop?.name;
      if (!itemId || !name) continue;

      const sim = nameSimilarity(parsed.placeName, name);
      const nameMatch = sim >= 0.5;
      const score = (dateMatch ? 100 : 0) + sim * 60 + slotAffinity(parsed.docType, slot) * (dateMatch ? 6 : 2);
      if (score <= 0) continue;

      out.push({ dayIndex, dayNumber, slot, itemId, name, dayDateISO: iso, score, dateMatch, nameMatch });
    }
  }

  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}

/** All stops with an item_id, for the manual "file it here instead" picker. */
export function listAllStops(itinerary: Itinerary, startDate: string | null | undefined): StopCandidate[] {
  const days = itinerary.days ?? [];
  const out: StopCandidate[] = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    if (!day) continue;
    const dayNumber = day.day ?? dayIndex + 1;
    const iso = dayDateISO(startDate, dayNumber);
    for (const slot of SLOTS) {
      const stop = day[slot] as (Activity | DiningSpot) | undefined;
      if (!stop?.item_id || !stop.name) continue;
      out.push({ dayIndex, dayNumber, slot, itemId: stop.item_id, name: stop.name, dayDateISO: iso, score: 0, dateMatch: false, nameMatch: false });
    }
  }
  return out;
}
