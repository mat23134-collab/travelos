/**
 * contextSearch — real-world grounding for a neighborhood.
 *
 *   • Tavily is the FACTUAL browser: nearest metro, terrain/walkability, night
 *     safety. Three targeted queries → structured fact buckets.
 *   • Exa is the SEMANTIC browser: two targeted queries for (A) local secrets
 *     and (B) honest downsides.
 *
 * Both are best-effort and time-boxed; a failed provider returns empty buckets
 * so the Gemini step still runs (it just has less to work with).
 */

import type { NeighborhoodFacts, NeighborhoodHighlights } from './types';

const SEARCH_TIMEOUT_MS = 8_000;
const MAX_PER_BUCKET = 5;

function keyOk(v: string | undefined): boolean {
  return !!v && !v.includes('your_');
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

// ── Tavily (factual) ────────────────────────────────────────────────────────

interface TavilyHit { title?: string; url?: string; content?: string }

async function tavily(query: string): Promise<TavilyHit[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      include_answer: false,
      max_results: MAX_PER_BUCKET,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = (await res.json()) as { results?: TavilyHit[] };
  return data.results ?? [];
}

const toLines = (hits: TavilyHit[]): { lines: string[]; sources: string[] } => ({
  lines: hits.map((h) => `${h.title ?? ''}: ${(h.content ?? '').slice(0, 400)}`.trim()).filter(Boolean),
  sources: hits.map((h) => h.url ?? '').filter(Boolean),
});

export async function fetchNeighborhoodFacts(name: string, city: string): Promise<NeighborhoodFacts> {
  const empty: NeighborhoodFacts = { metroStations: [], walkabilityNotes: [], safetyNotes: [], sources: [] };
  if (!keyOk(process.env.TAVILY_API_KEY)) return empty;

  const run = (q: string) => withTimeout(tavily(q), SEARCH_TIMEOUT_MS).then(toLines).catch(() => ({ lines: [], sources: [] }));
  const [metro, walk, safety] = await Promise.all([
    run(`nearest metro / subway / train stations to ${name}, ${city} and how to get there`),
    run(`${name} ${city} neighborhood terrain walkability hills how walkable is it on foot`),
    run(`${name} ${city} how safe is it at night for tourists safety`),
  ]);

  return {
    metroStations: metro.lines.slice(0, MAX_PER_BUCKET),
    walkabilityNotes: walk.lines.slice(0, MAX_PER_BUCKET),
    safetyNotes: safety.lines.slice(0, MAX_PER_BUCKET),
    sources: [...new Set([...metro.sources, ...walk.sources, ...safety.sources])].slice(0, 8),
  };
}

// ── Exa (semantic) ────────────────────────────────────────────────────────────

interface ExaResult { title?: string; url?: string; text?: string; highlights?: string[] }

/**
 * Exa search. CRITICAL (per Exa API): content-extraction fields (text,
 * highlights) MUST nest under the top-level "contents" object — placing them at
 * the top level returns HTTP 400. We ask for highlights (the semantic snippets)
 * plus a little text as fallback.
 */
async function exa(query: string, numResults = 6): Promise<ExaResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXA_API_KEY ?? '' },
    body: JSON.stringify({
      query,
      numResults,
      type: 'auto',
      contents: {
        highlights: { numSentences: 2, highlightsPerUrl: 2, query },
        text: { maxCharacters: 500 },
      },
    }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const data = (await res.json()) as { results?: ExaResult[] };
  return data.results ?? [];
}

function collect(results: ExaResult[]): { highlights: string[]; sources: string[] } {
  const highlights: string[] = [];
  const sources: string[] = [];
  for (const r of results) {
    for (const h of r.highlights ?? []) {
      const clean = h.trim();
      if (clean) highlights.push(clean);
    }
    if ((!r.highlights || r.highlights.length === 0) && r.text) highlights.push(r.text.slice(0, 300).trim());
    if (r.url) sources.push(r.url);
  }
  return { highlights, sources };
}

export async function fetchNeighborhoodHighlights(name: string, city: string): Promise<NeighborhoodHighlights> {
  const empty: NeighborhoodHighlights = { localSecrets: [], honestDownsides: [], sources: [] };
  if (!keyOk(process.env.EXA_API_KEY)) return empty;

  const run = (q: string) => withTimeout(exa(q), SEARCH_TIMEOUT_MS).then(collect).catch(() => ({ highlights: [], sources: [] }));

  // Query A — semantic local secrets; Query B — honest downsides.
  const [secrets, downsides] = await Promise.all([
    run(`local favorite coffee shops, hidden viewpoints, and unremarkable-looking local food spots that locals love in ${name}, ${city}`),
    run(`honest downsides, steep hills, parking problems, crowded hours, and tourist traps in ${name}, ${city}`),
  ]);

  return {
    localSecrets: secrets.highlights.slice(0, MAX_PER_BUCKET),
    honestDownsides: downsides.highlights.slice(0, MAX_PER_BUCKET),
    sources: [...new Set([...secrets.sources, ...downsides.sources])].slice(0, 8),
  };
}
