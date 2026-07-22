/**
 * onlyHereScoutAgent — builds a per-city bank of "Only Here" hidden gems
 * (Engine C, the delight/discovery layer): experiences SPECIFIC to this city
 * that a traveler would never have thought to search for — "things you can
 * only do here and didn't know you wanted." Not a logistics layer like Engines
 * A/B — this is the "how did it know?" wow layer.
 *
 * Same pipeline shape as attractionScoutAgent/walkInScoutAgent:
 *   1. Exa/Tavily web search  → snippets leaning on hidden-gem/local-secret
 *                               query vocabulary (src/lib/rag.ts's signal bank).
 *   2. Gemini                 → structured candidates under TWO HARD FILTERS
 *                               (locally distinctive + non-obvious).
 *   3. Google Places          → verify each exists.
 *   4. Scoring                → rating × popularity × verification × "quality
 *                               of the distinctive framing" (has both a real
 *                               why-only-here tie AND a hook line, not filler).
 *
 * Curation intent — TWO HARD FILTERS (both must pass):
 *   - LOCALLY DISTINCTIVE: meaningfully tied to THIS place — not replicable in
 *     a generic big city. A themed bar chain = no. A centuries-old local
 *     ritual, a craft only made here, a region-unique dish/venue, a
 *     seasonal-local phenomenon = yes.
 *   - NON-OBVIOUS: not a top-10 TripAdvisor-list attraction for the city.
 *
 * The #1 failure mode is returning generic "hidden gems" that are actually
 * just less-famous normal attractions — see runOnlyHereEval.ts for the
 * anti-generic sample-and-review harness this agent must pass before shipping.
 */

import { AttractionRecommendation, AttractionLocaleText, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';
import { callGeminiJson, lookupPlaceOnGoogle, mapWithConcurrency, parseJsonArray, str } from '@/lib/scoutShared';

const MAX_CANDIDATES = 10;
const PLACES_CONCURRENCY = 5;

const LANGUAGE_NAMES: Record<SiteLanguage, string> = { en: 'English', he: 'Hebrew' };

const GROUP_TOKENS = ['solo', 'couple', 'family', 'group'];

// ─── Step 1: web research ──────────────────────────────────────────────────────

async function gatherOnlyHereSnippets(city: string): Promise<string> {
  // Leans on the same hidden-gem/local-secret vocabulary rag.ts already uses
  // to classify results, phrased as search queries here.
  const queries = [
    `${city} hidden gem local secret only locals know experience`,
    `${city} unique tradition ritual craft you can only do here`,
    `${city} underrated authentic experience not in guidebooks off the beaten path`,
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
  priceRange?: string;
  groupSuitability?: string[];
  translations?: Partial<Record<SiteLanguage, AttractionLocaleText>>;
}

function candidateSystemPrompt(): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "description": "…", "whyOnlyHere": "…", "hookLine": "…", "howToDoIt": "…" }`)
    .join(', ');

  return `You are a local insider curating experiences in this city that are SPECIFIC TO THIS PLACE and that a traveler would NEVER have thought to search for — "things you can only do here and didn't know you wanted." This is the delight/discovery layer, not the logistics layer.

Every candidate MUST pass BOTH of these hard filters, or leave it out:
1. LOCALLY DISTINCTIVE — meaningfully tied to THIS place. You could NOT replicate it in a generic big city. Good: a centuries-old local ritual, a craft or dish made only here, a venue unique to the region, a seasonal-local phenomenon. Bad: a themed bar chain, an escape room, a generic rooftop bar, an ordinary cooking class — these exist everywhere and DO NOT belong here even if a local recommended them.
2. NON-OBVIOUS — NOT something that would appear in a top-10 "Best Things To Do in [City]" TripAdvisor-style list. If it's a famous must-see landmark or a top-ranked museum, it does NOT belong here — that's a different, more obvious list. Skew toward what an insider tells a friend, not what a guidebook tells a tourist.

If you cannot think of a candidate that genuinely passes BOTH filters, it is far better to return FEWER items (even 3-4) than to pad the list with a less-famous but otherwise ordinary attraction. A generic "hidden gem" that's really just a smaller museum is a FAILURE for this list.

Rules:
- Only real, currently-operating/happening experiences you are confident exist. No invented names.
- "name" and "neighborhood" stay in their original/local form (do NOT translate proper names).
- "priceRange" is a rough cost band if there's a cost, e.g. "€5–10", or "Free" — display text.
- "groupSuitability" is an array (possibly empty) from ["solo","couple","family","group"] — who this genuinely suits best; leave empty if it suits everyone equally.

LOCALIZATION — write the following NATIVELY in EACH of these languages: ${langList} (natural, not a literal translation):
  - "highlight": punchy 2–4 word badge.
  - "description": 1-2 sentences: what it is, concretely.
  - "whyOnlyHere": one sentence — the SPECIFIC local tie that makes this impossible to replicate elsewhere. This is the most important field — be concrete and specific, not vague ("it's authentic").
  - "hookLine": ONE punchy sentence for the UI that sells the surprise — the "wait, I can do THAT here?" line.
  - "howToDoIt": practical instructions — where to go, when, how to actually access/book/join it (a phone number, a specific stall, a day of the week, etc.).

Return ONLY a JSON array. Each object:
{ "name", "neighborhood", "priceRange", "groupSuitability", "translations": { ${translationsShape} } }.`;
}

async function synthesizeCandidates(city: string, snippets: string): Promise<GeminiCandidate[]> {
  const userPrompt =
    `City: ${city}\n` +
    `Produce up to ${MAX_CANDIDATES} genuinely locally-distinctive, non-obvious experiences as described. ` +
    `Fewer excellent candidates beat padding with anything generic.\n\n` +
    (snippets ? `WEB SNIPPETS (grounding):\n${snippets}` : 'No web snippets available — use well-known real local specialties, cautiously.');

  const raw = await callGeminiJson(candidateSystemPrompt(), userPrompt, { temperature: 0.6 });

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
            description: str(loc.description) ?? null,
            whyOnlyHere: str(loc.whyOnlyHere) ?? null,
            hookLine: str(loc.hookLine) ?? null,
            howToDoIt: str(loc.howToDoIt) ?? null,
          };
        }
      }
      const groupSuitability = Array.isArray(c.groupSuitability)
        ? c.groupSuitability
            .map((g: unknown) => (typeof g === 'string' ? g.trim().toLowerCase() : ''))
            .filter((g: string) => GROUP_TOKENS.includes(g))
        : undefined;
      return {
        name: str(c.name),
        neighborhood: str(c.neighborhood),
        priceRange: str(c.priceRange),
        groupSuitability,
        translations,
      };
    })
    .filter((c) => !!c.name)
    .slice(0, MAX_CANDIDATES);
}

// ─── Step 3 + 4: verify + score ────────────────────────────────────────────────

/**
 * Same rating/popularity/verification base as Engines A/B, plus a reward for
 * the distinctive framing actually being present (whyOnlyHere + hookLine) —
 * a candidate missing either is a sign Gemini couldn't articulate a real local
 * tie, which correlates with genericness.
 */
function scoreOnlyHere(a: AttractionRecommendation): number {
  const base = a.rating ?? 3.0;
  const popularity = a.ratingCount && a.ratingCount > 0 ? Math.min(3, Math.log10(a.ratingCount)) : 0;
  const verified = a.googlePlaceId ? 1.0 : 0.5; // many genuine local specialties won't be on Google at all
  const framingQuality = (a.whyOnlyHere ? 1 : 0) + (a.hookLine ? 0.5 : 0);
  return Number((base + popularity + verified + framingQuality).toFixed(3));
}

// ─── Public entrypoint ──────────────────────────────────────────────────────────

export async function runOnlyHereScoutAgent(city: string): Promise<AttractionRecommendation[]> {
  const c = city.trim();
  if (!c) return [];

  const snippets = await gatherOnlyHereSnippets(c).catch(() => '');
  const candidates = await synthesizeCandidates(c, snippets);
  if (candidates.length === 0) return [];

  const verified = await mapWithConcurrency(candidates, PLACES_CONCURRENCY, async (cand) => {
    // Best-effort verification — many genuine local specialties (a market
    // stall, a seasonal ritual) won't resolve on Google Places at all; that's
    // expected and not itself a reason to drop the candidate.
    const v = await lookupPlaceOnGoogle(cand.name!, c);
    const website = v.website ?? null;

    const enText = cand.translations?.en ?? Object.values(cand.translations ?? {})[0] ?? {};
    const rec: AttractionRecommendation = {
      city: c,
      engine: 'only_here',
      name: v.found && v.name ? v.name : cand.name!,
      description: enText.description ?? null,
      highlight: enText.highlight ?? null,
      whyOnlyHere: enText.whyOnlyHere ?? null,
      hookLine: enText.hookLine ?? null,
      howToDoIt: enText.howToDoIt ?? null,
      groupSuitability: cand.groupSuitability ?? null,
      translations: cand.translations ?? null,
      priceRange: cand.priceRange ?? null,
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
    rec.score = scoreOnlyHere(rec);
    return rec;
  });

  return verified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
