/**
 * walkInScoutAgent — builds a per-city bank of WALK-IN attractions (Engine B):
 * genuinely worthwhile places that need NO reservation — the counterpart to
 * attractionScoutAgent's book-ahead engine (Engine A). Structurally identical
 * pipeline, INVERTED curation intent.
 *
 * Pipeline (mirrors attractionScoutAgent):
 *   1. Exa/Tavily web search  → snippets about free/walk-in places.
 *   2. Gemini                 → structured candidates, localized in every site
 *                               language (why-worth-it, best-time-of-day).
 *   3. Google Places          → verify each exists; real place_id, rating,
 *                               coords, photo, official website.
 *   4. Scoring                → rating × popularity × verification × photo
 *                               quality (NOT bookability — there's no ticket).
 *
 * Curation intent: ONLY places you can simply walk into — free or pay-at-door,
 * no timed entry, no sellout risk: viewpoints, markets, parks, plazas, free
 * churches, neighborhoods to wander, street-art areas, walkable landmarks.
 * Explicitly EXCLUDES anything requiring advance tickets (that's Engine A's
 * job — zero overlap is enforced by the caller via findEngineOverlap in
 * attractionBank.ts, which the API route runs before upserting these rows).
 */

import { AttractionRecommendation, AttractionLocaleText, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';
import { callGeminiJson, lookupPlaceOnGoogle, mapWithConcurrency, parseJsonArray, str } from '@/lib/scoutShared';

const MAX_CANDIDATES = 12;
const PLACES_CONCURRENCY = 5;

const LANGUAGE_NAMES: Record<SiteLanguage, string> = { en: 'English', he: 'Hebrew' };

// ─── Step 1: web research ──────────────────────────────────────────────────────

async function gatherWalkInSnippets(city: string): Promise<string> {
  const queries = [
    `${city} best free things to do no ticket needed just show up`,
    `${city} best viewpoints parks plazas markets walk around`,
    `${city} neighborhoods to wander street art free churches`,
  ];

  const settled = await Promise.allSettled(queries.map((q) => searchWeb(q)));
  const hits = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    lines.push(`- ${h.title}: ${h.snippet}`);
    if (lines.length >= 24) break;
  }
  return lines.join('\n');
}

// ─── Step 2: Gemini candidate synthesis ────────────────────────────────────────

interface GeminiCandidate {
  name?: string;
  neighborhood?: string;
  category?: string;
  timeNeeded?: string;
  isFree?: boolean;
  translations?: Partial<Record<SiteLanguage, AttractionLocaleText>>;
}

function candidateSystemPrompt(): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "category": "…", "description": "…", "bestTimeOfDay": "…" }`)
    .join(', ');

  return `You are a local guide curating places in this city that a traveler can simply WALK INTO — no reservation, no advance ticket, no sellout risk. These fill spontaneous gaps in a day and reduce over-planning anxiety.

SELECT ONLY places you can walk into: free or pay-at-door, no timed entry. Prioritize:
- Viewpoints, lookouts, rooftops open to the public.
- Markets, plazas, squares.
- Parks and gardens (free ones — not ticketed botanical gardens with timed entry, those belong to a different list).
- Free churches/temples with no reservation system.
- Neighborhoods worth wandering, street-art areas.
- Walkable landmarks you can see/photograph without a ticket (the exterior of a monument, a famous bridge, a market street).

STRICTLY EXCLUDE anything requiring an advance ticket, timed entry, or that notoriously sells out — those belong to a SEPARATE must-book-ahead list, not this one. If you're unsure whether a place needs a reservation, leave it out rather than guess wrong.

Rules:
- Only real, currently-operating places you are confident exist. No invented names.
- "name" and "neighborhood" stay in their original/local form (do NOT translate proper names).
- "category" (scalar, English) is a short genre tag, e.g. "Viewpoint", "Market", "Park", "Plaza", "Church", "Neighborhood".
- "timeNeeded" is a rough duration a visit takes, e.g. "20–30 min", "1–2 hours". Plain text, not translated.
- "isFree" is true if entry is free, false if there's a small pay-at-door fee (never a reservation fee).

LOCALIZATION — write the following NATIVELY in EACH of these languages: ${langList} (natural, not a literal translation):
  - "highlight": punchy 2–4 word badge, e.g. "Sunset over the city", "Locals' market".
  - "category": short genre — same meaning as the scalar "category" above, phrased naturally in this language.
  - "description": 1 sentence on why it's worth the trip — vivid, specific, sells the experience.
  - "bestTimeOfDay": ONLY the concrete timing tip, e.g. "Before 10am to beat the crowds", "Sunset, ~30 min before closing", "Any time — never crowded". No full sentence, no punctuation beyond that phrase.

Return ONLY a JSON array. Each object:
{ "name", "neighborhood", "category", "timeNeeded", "isFree", "translations": { ${translationsShape} } }.`;
}

async function synthesizeCandidates(city: string, snippets: string): Promise<GeminiCandidate[]> {
  const userPrompt =
    `City: ${city}\n` +
    `Produce up to ${MAX_CANDIDATES} genuinely worthwhile walk-in places as described.\n\n` +
    (snippets ? `WEB SNIPPETS (grounding):\n${snippets}` : 'No web snippets available — use well-known real places.');

  const raw = await callGeminiJson(candidateSystemPrompt(), userPrompt);

  return parseJsonArray(raw)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .filter((c): c is any => !!c && typeof c === 'object')
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .map((c: any): GeminiCandidate => {
      const translations: Partial<Record<SiteLanguage, AttractionLocaleText>> = {};
      const src = c.translations && typeof c.translations === 'object' ? c.translations : {};
      for (const lang of SITE_LANGUAGES) {
        const loc = src[lang];
        if (loc && typeof loc === 'object') {
          translations[lang] = {
            highlight: str(loc.highlight) ?? null,
            category: str(loc.category) ?? null,
            description: str(loc.description) ?? null,
            bestTimeOfDay: str(loc.bestTimeOfDay) ?? null,
          };
        }
      }
      return {
        name: str(c.name),
        neighborhood: str(c.neighborhood),
        category: str(c.category),
        timeNeeded: str(c.timeNeeded),
        isFree: typeof c.isFree === 'boolean' ? c.isFree : undefined,
        translations,
      };
    })
    .filter((c) => !!c.name)
    .slice(0, MAX_CANDIDATES);
}

// ─── Step 3 + 4: verify + score ────────────────────────────────────────────────

/**
 * Same rating/popularity/verification base as Engine A, but NO bookability
 * reward (there's no ticket link here) — instead reward a resolved photo
 * (good photos matter more when there's no booking urgency to sell the click)
 * and having concrete best-time info (a real, useful tip vs. a generic one).
 */
function scoreWalkIn(a: AttractionRecommendation): number {
  const base = a.rating ?? 3.2;
  const popularity = a.ratingCount && a.ratingCount > 0 ? Math.min(4, Math.log10(a.ratingCount)) : 0;
  const verified = a.googlePlaceId ? 1.5 : 0;
  const hasPhoto = a.photoUrl ? 0.75 : 0;
  const hasTiming = a.bestTimeOfDay ? 0.75 : 0;
  return Number((base + popularity + verified + hasPhoto + hasTiming).toFixed(3));
}

// ─── Public entrypoint ──────────────────────────────────────────────────────────

export async function runWalkInScoutAgent(city: string): Promise<AttractionRecommendation[]> {
  const c = city.trim();
  if (!c) return [];

  const snippets = await gatherWalkInSnippets(c).catch(() => '');
  const candidates = await synthesizeCandidates(c, snippets);
  if (candidates.length === 0) return [];

  const verified = await mapWithConcurrency(candidates, PLACES_CONCURRENCY, async (cand) => {
    const v = await lookupPlaceOnGoogle(cand.name!, c);
    const website = v.website ?? null;

    const enText = cand.translations?.en ?? Object.values(cand.translations ?? {})[0] ?? {};
    const rec: AttractionRecommendation = {
      city: c,
      engine: 'walk_in',
      name: v.found && v.name ? v.name : cand.name!,
      description: enText.description ?? null,
      category: enText.category ?? cand.category ?? null,
      highlight: enText.highlight ?? null,
      bestTimeOfDay: enText.bestTimeOfDay ?? null,
      timeNeeded: cand.timeNeeded ?? null,
      isFree: cand.isFree ?? null,
      translations: cand.translations ?? null,
      neighborhood: cand.neighborhood ?? null,
      websiteUrl: website,
      latitude: typeof v.latitude === 'number' ? v.latitude : null,
      longitude: typeof v.longitude === 'number' ? v.longitude : null,
      googlePlaceId: v.placeId ?? null,
      rating: v.rating ?? null,
      ratingCount: v.ratingCount ?? null,
      photoUrl: v.photoUrl ?? null,
      source: 'scout',
      score: 0,
    };
    rec.score = scoreWalkIn(rec);
    return rec;
  });

  return verified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
