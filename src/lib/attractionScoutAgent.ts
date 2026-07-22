/**
 * attractionScoutAgent — builds a per-city bank of MUST-BOOK-AHEAD attractions.
 *
 * Same pipeline shape as restaurantScoutAgent:
 *   1. Exa/Tavily web search  → snippets about timed-entry / sell-out attractions.
 *   2. Gemini                 → structured candidates, localized in every site
 *                               language (highlight badge, urgency, insider tip).
 *   3. Google Places          → verify each exists; real place_id, rating,
 *                               coords, photo, official website.
 *   4. Scoring                → rating × popularity × verification × bookable.
 *
 * Curation intent: ONLY attractions where advance booking is genuinely critical
 * — timed-entry landmarks (Colosseum, Alhambra), capped-capacity icons (Last
 * Supper, Anne Frank House), tower/dome climbs, special-access tours. Not
 * generic sightseeing you can walk into.
 */

import { AttractionRecommendation, AttractionLocaleText, SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';
import { callGeminiJson, lookupPlaceOnGoogle, mapWithConcurrency, parseJsonArray, str } from '@/lib/scoutShared';

const MAX_CANDIDATES = 12;
const PLACES_CONCURRENCY = 5;

const LANGUAGE_NAMES: Record<SiteLanguage, string> = { en: 'English', he: 'Hebrew' };

// ─── Step 1: web research ──────────────────────────────────────────────────────

async function gatherAttractionSnippets(city: string): Promise<string> {
  const queries = [
    `${city} attractions you must book tickets in advance sells out weeks`,
    `${city} timed entry skip the line tickets official booking essential`,
    `${city} famous landmark limited capacity reserve ahead tour`,
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
  bookingPlatform?: string;
  /** 0–3 book-ahead necessity, same scale as the restaurant engine. */
  bookAheadLevel?: number;
  translations?: Partial<Record<SiteLanguage, AttractionLocaleText>>;
}

function candidateSystemPrompt(): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');
  const translationsShape = SITE_LANGUAGES
    .map((l) => `"${l}": { "highlight": "…", "category": "…", "description": "…", "bookingUrgency": "…", "insiderTip": "…", "bookingLeadTime": "…" }`)
    .join(', ');

  return `You are the head concierge of a luxury travel house, curating the attractions in a city where BOOKING AHEAD IS GENUINELY CRITICAL — places that sell out days or weeks in advance, or can only be seen with a pre-reserved slot.

SELECT ONLY places where advance booking truly matters. Prioritize:
- Timed-entry landmarks and monuments (limited daily slots).
- Capped-capacity icons that notoriously sell out (small museums, famous frescoes, historic houses).
- Tower/dome/underground special-access climbs and tours.
- Blockbuster museums where skip-the-line reservations save hours.

STRICTLY EXCLUDE: open plazas, free churches with no reservation system, viewpoints, parks — anything you can simply walk into. If booking ahead isn't important, leave it out. 6–10 truly critical entries beat a long generic list.

Rules:
- Only real, currently-operating attractions you are confident exist. No invented names.
- "priceRange" is a display band like "€18–25 pp".
- "bookingPlatform" is your best guess: "official", "GetYourGuide", "Tiqets", or "tour".
- "name" and "neighborhood" stay in their original/local form (do NOT translate proper names).
- "bookAheadLevel" is 0–3: 1 = book same week is usually enough; 2 = book 1–4 weeks out (popular, weekends fill up); 3 = book 1–3 months out or a lottery/rare-slot release. Every entry here should be at least 1 — if it's truly 0 (walk-in), it doesn't belong in this list at all.

LOCALIZATION — write the following NATIVELY in EACH of these languages: ${langList} (natural, not a literal translation):
  - "highlight": punchy 2–4 word badge, e.g. "Sells out weeks ahead", "Timed entry only".
  - "category": short genre, e.g. "Ancient landmark", "Renaissance museum".
  - "description": 2–3 evocative sentences on what makes it unmissable and what the experience is like.
  - "bookingUrgency": one short sentence — why booking is critical and how far ahead.
  - "insiderTip": one practical tip (best slot, which entrance, what to combine).
  - "bookingLeadTime": ONLY the concrete typical advance-booking window as a short phrase — e.g. "2–3 weeks ahead", "1–2 months ahead". No full sentence.

Return ONLY a JSON array. Each object:
{ "name", "neighborhood", "priceRange", "bookingPlatform", "bookAheadLevel", "translations": { ${translationsShape} } }.`;
}

async function synthesizeCandidates(city: string, snippets: string): Promise<GeminiCandidate[]> {
  const userPrompt =
    `City: ${city}\n` +
    `Produce up to ${MAX_CANDIDATES} must-book-ahead attractions as described.\n\n` +
    (snippets ? `WEB SNIPPETS (grounding):\n${snippets}` : 'No web snippets available — use well-known real attractions.');

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
            bookingUrgency: str(loc.bookingUrgency) ?? null,
            insiderTip: str(loc.insiderTip) ?? null,
            bookingLeadTime: str(loc.bookingLeadTime) ?? null,
          };
        }
      }
      return {
        name: str(c.name),
        neighborhood: str(c.neighborhood),
        priceRange: str(c.priceRange),
        bookingPlatform: str(c.bookingPlatform),
        bookAheadLevel: Number.isFinite(c.bookAheadLevel)
          ? Math.min(3, Math.max(0, Math.round(c.bookAheadLevel)))
          : undefined,
        translations,
      };
    })
    .filter((c) => !!c.name)
    .slice(0, MAX_CANDIDATES);
}

// ─── Step 3 + 4: verify + score ────────────────────────────────────────────────

/**
 * Same shape as the restaurant scorer: real-world signal (rating, review
 * volume) + actionability (verified, has a ticket link).
 */
function scoreAttraction(a: AttractionRecommendation): number {
  const base = a.rating ?? 3.2;
  const popularity = a.ratingCount && a.ratingCount > 0 ? Math.min(4, Math.log10(a.ratingCount)) : 0;
  const verified = a.googlePlaceId ? 1.5 : 0;
  const bookable = a.ticketUrl || a.websiteUrl ? 1.0 : 0;
  return Number((base + popularity + verified + bookable).toFixed(3));
}

function guessTicketUrl(cand: GeminiCandidate, website: string | null, city: string): string | null {
  if (website) return website;
  const q = `${cand.name} ${city}`;
  if (cand.bookingPlatform === 'Tiqets') {
    return `https://www.tiqets.com/en/search/?q=${encodeURIComponent(q)}`;
  }
  // GetYourGuide search resolves reliably and always shows bookable slots.
  return `https://www.getyourguide.com/s/?q=${encodeURIComponent(q)}`;
}

// ─── Public entrypoint ──────────────────────────────────────────────────────────

export async function runAttractionScoutAgent(city: string): Promise<AttractionRecommendation[]> {
  const c = city.trim();
  if (!c) return [];

  const snippets = await gatherAttractionSnippets(c).catch(() => '');
  const candidates = await synthesizeCandidates(c, snippets);
  if (candidates.length === 0) return [];

  const verified = await mapWithConcurrency(candidates, PLACES_CONCURRENCY, async (cand) => {
    const v = await lookupPlaceOnGoogle(cand.name!, c);
    const website = v.website ?? null;

    const enText = cand.translations?.en ?? Object.values(cand.translations ?? {})[0] ?? {};
    const rec: AttractionRecommendation = {
      city: c,
      name: v.found && v.name ? v.name : cand.name!,
      description: enText.description ?? null,
      category: enText.category ?? null,
      highlight: enText.highlight ?? null,
      bookingUrgency: enText.bookingUrgency ?? null,
      insiderTip: enText.insiderTip ?? null,
      bookingLeadTime: enText.bookingLeadTime ?? null,
      bookAheadLevel: cand.bookAheadLevel ?? null,
      translations: cand.translations ?? null,
      priceRange: cand.priceRange ?? null,
      neighborhood: cand.neighborhood ?? null,
      websiteUrl: website,
      ticketUrl: guessTicketUrl(cand, website, c),
      bookingPlatform: cand.bookingPlatform ?? (website ? 'official' : 'GetYourGuide'),
      latitude: typeof v.latitude === 'number' ? v.latitude : null,
      longitude: typeof v.longitude === 'number' ? v.longitude : null,
      googlePlaceId: v.placeId ?? null,
      rating: v.rating ?? null,
      ratingCount: v.ratingCount ?? null,
      photoUrl: v.photoUrl ?? null,
      source: 'scout',
      score: 0,
    };
    rec.score = scoreAttraction(rec);
    return rec;
  });

  return verified.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
