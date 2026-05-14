/**
 * Parallel Exa searches for transport scout — fares, official tickets, mobile apps, payment.
 */

import type { SearchResult } from '@/lib/types';
import { searchExaOnly } from '@/lib/rag';

function dedupeByUrl(rows: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const u = r.url?.trim();
    if (!u || seen.has(u)) return false;
    seen.add(u);
    return true;
  });
}

/** Collate Exa snippets for Gemini transport scout (grounding block). */
export async function gatherTransportExaSnippets(city: string): Promise<string> {
  const c = city.trim();
  if (!c) return '';

  const queries = [
    `${c} public transport single ticket price official 2026`,
    `${c} transit day pass 24 hour price official`,
    `${c} public transport 7 day pass weekly ticket price official`,
    `${c} official public transport mobile app iOS Android App Store Google Play`,
    `${c} public transport pay contactless tap bank card NFC how to pay visitors`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => searchExaOnly(q, 5)));
  const merged = dedupeByUrl(
    settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : [])),
  );

  if (merged.length === 0) return '';

  return (
    '\n\nEXA RESEARCH (grounding — extract fares & URLs only when supported by these snippets):\n' +
    merged
      .slice(0, 22)
      .map((h) => `- (${h.url}) ${h.title}: ${h.snippet}`)
      .join('\n')
  );
}
