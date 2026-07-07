/**
 * eventScoutAgent — finds festivals & events in a city that overlap the
 * traveler's dates.
 *
 * Unlike the restaurant/attraction scouts this one is DATE-AWARE and heavily
 * grounded: web snippets are numbered and passed with their URLs, and Gemini
 * may only return events it can tie to a snippet (echoing that snippet's URL
 * as sourceUrl). Events with no grounding are dropped — a hallucinated
 * festival is worse than an empty list.
 *
 * No Google Places verification (events aren't stable places); the grounding
 * requirement plays that role instead.
 */

import { EventRecommendation, EventLocaleText, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';
import { callGeminiJson, parseJsonArray, str } from '@/lib/scoutShared';

const MAX_EVENTS = 10;

const LANGUAGE_NAMES: Record<SiteLanguage, string> = { en: 'English', he: 'Hebrew' };

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-08-19".."2026-08-22" → "August 2026" (or "August–September 2026"). */
function windowLabel(from: string, to: string): string {
  const f = new Date(from);
  const t = new Date(to);
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const a = fmt(f);
  const b = fmt(t);
  return a === b ? a : `${a} – ${b}`;
}

// ─── Step 1: date-aware web research ──────────────────────────────────────────

interface NumberedSnippet {
  n: number;
  url: string;
  line: string;
}

async function gatherEventSnippets(city: string, from: string, to: string): Promise<NumberedSnippet[]> {
  const period = windowLabel(from, to);
  const queries = [
    `${city} festivals events ${period} what's on`,
    `${city} concerts exhibitions markets ${period} calendar`,
    `things happening in ${city} ${period} events guide`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => searchWeb(q)));
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set<string>();
  const out: NumberedSnippet[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    const n = out.length + 1;
    out.push({ n, url: h.url, line: `[${n}] (${h.url}) ${h.title}: ${h.snippet}` });
    if (out.length >= 20) break;
  }
  return out;
}

// ─── Step 2: grounded Gemini synthesis ────────────────────────────────────────

function eventSystemPrompt(from: string, to: string): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "category": "…", "description": "…" }`)
    .join(', ');

  return `You are a local culture editor for a premium travel concierge. From the numbered web snippets, extract festivals and events in the city that overlap the traveler's window ${from} to ${to}.

GROUNDING — the cardinal rule:
- Return ONLY events you can tie to one of the numbered snippets. Copy that snippet's URL into "sourceUrl" EXACTLY as given.
- If the snippets don't support any real event in the window, return an empty array []. NEVER invent an event, a date, or a venue.
- Annual events mentioned without an explicit year are acceptable ONLY if the snippet clearly implies they run during this period.

Selection: prefer distinctive, worth-planning-around happenings — music/food/arts festivals, major exhibitions, seasonal markets, open-air cinema, city celebrations. Skip weekly pub quizzes and generic club nights.

Fields:
- "startDate" / "endDate": ISO YYYY-MM-DD. Single-day event → same date twice. If only a month is known, use its first and last day within the window.
- "venue": place name if known, else null.
- "priceRange": e.g. "Free", "€20–60", or null.
- "ticketUrl": ONLY if a snippet gives one; else null.
- "name" and "venue" stay in their original form.

LOCALIZATION — write these NATIVELY in EACH of: ${langList}:
  - "highlight": punchy 2–4 word badge, e.g. "Once a year", "Free & open-air".
  - "category": short genre, e.g. "Music festival", "Food fair".
  - "description": 2 sentences — what it is and why it's worth planning around.

Return ONLY a JSON array. Each object:
{ "name", "venue", "startDate", "endDate", "priceRange", "ticketUrl", "sourceUrl", "translations": { ${translationsShape} } }.`;
}

function scoreEvent(e: EventRecommendation): number {
  let s = 5;
  if (e.sourceUrl) s += 2;
  if (e.ticketUrl) s += 1;
  if (e.startDate && e.endDate) s += 1;
  if (e.venue) s += 0.5;
  return Number(s.toFixed(2));
}

// ─── Public entrypoint ──────────────────────────────────────────────────────────

export async function runEventScoutAgent(
  city: string,
  from: string,
  to: string,
): Promise<EventRecommendation[]> {
  const c = city.trim();
  if (!c || !ISO_DATE_RE.test(from) || !ISO_DATE_RE.test(to)) return [];

  const snippets = await gatherEventSnippets(c, from, to).catch(() => [] as NumberedSnippet[]);
  // No grounding material → nothing trustworthy to extract.
  if (snippets.length === 0) return [];

  const knownUrls = new Set(snippets.map((s) => s.url));
  const userPrompt =
    `City: ${c}\nTraveler window: ${from} → ${to}\n` +
    `Extract up to ${MAX_EVENTS} grounded events.\n\n` +
    `WEB SNIPPETS:\n${snippets.map((s) => s.line).join('\n')}`;

  const raw = await callGeminiJson(eventSystemPrompt(from, to), userPrompt, { temperature: 0.2 });

  const events = parseJsonArray(raw)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .filter((e): e is any => !!e && typeof e === 'object')
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .map((e: any): EventRecommendation | null => {
      const name = str(e.name);
      const sourceUrl = str(e.sourceUrl);
      // Hard grounding gate: name + a sourceUrl that really came from our search.
      if (!name || !sourceUrl || !knownUrls.has(sourceUrl)) return null;

      const startDate = str(e.startDate);
      const endDate = str(e.endDate) ?? startDate;
      if (!startDate || !ISO_DATE_RE.test(startDate)) return null;

      const translations: Partial<Record<SiteLanguage, EventLocaleText>> = {};
      const src = e.translations && typeof e.translations === 'object' ? e.translations : {};
      for (const lang of SITE_LANGUAGES) {
        const loc = src[lang];
        if (loc && typeof loc === 'object') {
          translations[lang] = {
            highlight: str(loc.highlight) ?? null,
            category: str(loc.category) ?? null,
            description: str(loc.description) ?? null,
          };
        }
      }

      const enText = translations.en ?? Object.values(translations)[0] ?? {};
      const rec: EventRecommendation = {
        city: c,
        name,
        description: enText.description ?? null,
        category: enText.category ?? null,
        highlight: enText.highlight ?? null,
        translations,
        venue: str(e.venue) ?? null,
        startDate,
        endDate: endDate && ISO_DATE_RE.test(endDate) ? endDate : startDate,
        priceRange: str(e.priceRange) ?? null,
        ticketUrl: str(e.ticketUrl) ?? null,
        websiteUrl: null,
        sourceUrl,
        source: 'scout',
        score: 0,
      };
      rec.score = scoreEvent(rec);
      return rec;
    })
    .filter((e): e is EventRecommendation => e !== null)
    .slice(0, MAX_EVENTS);

  return events.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
