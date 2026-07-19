/**
 * topSightsScoutAgent — builds the "Our Picks" curated bank for a city
 * (public.places rows with top_pick_category set), the data source behind
 * onboarding Step 7 (/api/landmarks).
 *
 * Until now this bank was 100% hand-seeded for 4 marquee cities (migration
 * 20260527g) — every other destination hit the "we don't have curated picks
 * yet" empty state. Same pipeline shape as restaurantScoutAgent /
 * attractionScoutAgent:
 *
 *   1. Exa/Tavily web search  → snippets about iconic sights/history/food.
 *   2. Gemini                 → up to 4 candidates PER category (sightseeing,
 *                               history, food), localized per site language.
 *   3. Google Places          → verify each exists; real coords, photo, rating.
 *   4. Rank                   → within each category, by rating × review volume.
 *
 * Curation intent mirrors the original hand-seed: real, iconic, photogenic
 * picks a first-time visitor would recognize — not an exhaustive list.
 */

import { SITE_LANGUAGES, SiteLanguage } from '@/lib/types';
import { searchWeb } from '@/lib/rag';
import { callGeminiJson, lookupPlaceOnGoogle, mapWithConcurrency, parseJsonArray, str } from '@/lib/scoutShared';

const PER_CATEGORY = 4;
const PLACES_CONCURRENCY = 5;

const LANGUAGE_NAMES: Record<SiteLanguage, string> = { en: 'English', he: 'Hebrew' };

export type TopSightCategory = 'sightseeing' | 'history' | 'food';
const CATEGORIES: TopSightCategory[] = ['sightseeing', 'history', 'food'];

export interface TopSightRecord {
  city: string;
  name: string;
  category: 'attraction' | 'restaurant';
  topPickCategory: TopSightCategory;
  popularityRank: number;
  description: string | null;
  descriptionHe: string | null;
  categoryEmoji: string | null;
  vibeLabel: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  websiteUrl: string | null;
  googlePlaceId: string | null;
  googleRating: number | null;
}

// ─── Step 1: web research ──────────────────────────────────────────────────────

const CATEGORY_QUERY: Record<TopSightCategory, (city: string) => string> = {
  sightseeing: (c) => `${c} top tourist attractions must-see landmarks first time visitors`,
  history:     (c) => `${c} best historical sites museums ancient landmarks`,
  food:        (c) => `${c} iconic local food spots famous market best restaurant locals recommend`,
};

async function gatherSnippets(city: string): Promise<string> {
  const queries = CATEGORIES.map((cat) => CATEGORY_QUERY[cat](city));
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
  topPickCategory?: TopSightCategory;
  isFood?: boolean; // true → maps to category 'restaurant' in places, else 'attraction'
  categoryEmoji?: string;
  vibeLabel?: string;
  translations?: Partial<Record<SiteLanguage, { description?: string }>>;
}

function systemPrompt(): string {
  const langList = SITE_LANGUAGES.map((l) => `"${l}" (${LANGUAGE_NAMES[l]})`).join(', ');

  return `You are curating the "Our Picks" welcome card for a travel app — the handful of ICONIC, instantly-recognizable picks a first-time visitor to a city would want to see, split into three buckets:
  - "sightseeing": iconic landmarks, viewpoints, squares, markets (NOT museums/historical sites).
  - "history": museums, ancient ruins, palaces, cathedrals, historical monuments.
  - "food": one or two truly iconic, famous local food spots or food markets — not generic restaurants.

Return exactly ${PER_CATEGORY} candidates per bucket (${PER_CATEGORY * 3} total), ordered most-iconic-first within each bucket.

Rules:
- Only real, currently-operating, well-known places. No invented names, no obscure picks — these are the "greatest hits" a first-timer expects.
- "categoryEmoji": one emoji matching the place (🏛️ 🗼 ⛲ 🖼️ 🏰 ⛪ 🍕 🥐 ☕ etc.)
- "vibeLabel": one of "classic" | "hidden-gem" | "local-favorite" | "viral-trend" | "luxury-pick" | "budget-pick" — most should be "classic" since these are the iconic picks.
- "isFood": true only for the "food" bucket entries.

LOCALIZATION — write "description" NATIVELY in EACH of these languages: ${langList} (natural, not literal translation) — one punchy sentence (max 20 words) on what makes it worth visiting.

Return ONLY a JSON array. Each object:
{ "name", "topPickCategory": "sightseeing"|"history"|"food", "isFood": boolean, "categoryEmoji", "vibeLabel", "translations": { ${SITE_LANGUAGES.map((l) => `"${l}": { "description": "…" }`).join(', ')} } }`;
}

async function synthesizeCandidates(city: string, snippets: string): Promise<GeminiCandidate[]> {
  const userPrompt =
    `City: ${city}\n` +
    `Produce ${PER_CATEGORY} picks for EACH of sightseeing / history / food (${PER_CATEGORY * 3} total).\n\n` +
    (snippets ? `WEB SNIPPETS (grounding):\n${snippets}` : 'No web snippets available — use well-known real places.');

  const raw = await callGeminiJson(systemPrompt(), userPrompt);

  return parseJsonArray(raw)
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .filter((c): c is any => !!c && typeof c === 'object')
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    .map((c: any): GeminiCandidate => ({
      name: str(c.name),
      topPickCategory: CATEGORIES.includes(c.topPickCategory) ? c.topPickCategory : undefined,
      isFood: typeof c.isFood === 'boolean' ? c.isFood : c.topPickCategory === 'food',
      categoryEmoji: str(c.categoryEmoji),
      vibeLabel: str(c.vibeLabel),
      translations: c.translations && typeof c.translations === 'object' ? c.translations : {},
    }))
    .filter((c) => !!c.name && !!c.topPickCategory);
}

// ─── Step 3 + 4: verify against Google Places, then rank within bucket ─────────

function scoreForRanking(rating: number | null, ratingCount: number | null): number {
  const base = rating ?? 3.5;
  const popularity = ratingCount && ratingCount > 0 ? Math.min(4, Math.log10(ratingCount)) : 0;
  return base + popularity;
}

export async function runTopSightsScoutAgent(city: string): Promise<TopSightRecord[]> {
  const c = city.trim();
  if (!c) return [];

  const snippets = await gatherSnippets(c).catch(() => '');
  const candidates = await synthesizeCandidates(c, snippets);
  if (candidates.length === 0) return [];

  const verified = await mapWithConcurrency(candidates, PLACES_CONCURRENCY, async (cand) => {
    const v = await lookupPlaceOnGoogle(cand.name!, c);
    const enDesc = cand.translations?.en?.description ?? Object.values(cand.translations ?? {})[0]?.description ?? null;
    const heDesc = cand.translations?.he?.description ?? null;

    return {
      name: v.found && v.name ? v.name : cand.name!,
      topPickCategory: cand.topPickCategory!,
      category: (cand.isFood ? 'restaurant' : 'attraction') as 'attraction' | 'restaurant',
      description: enDesc,
      descriptionHe: heDesc,
      categoryEmoji: cand.categoryEmoji ?? null,
      vibeLabel: cand.vibeLabel ?? null,
      latitude: typeof v.latitude === 'number' ? v.latitude : null,
      longitude: typeof v.longitude === 'number' ? v.longitude : null,
      photoUrl: v.photoUrl ?? null,
      websiteUrl: v.website ?? null,
      googlePlaceId: v.placeId ?? null,
      googleRating: v.rating ?? null,
      ratingCount: v.ratingCount ?? null,
    };
  });

  // Rank within each bucket by rating × review volume, cap at PER_CATEGORY, assign 1-based rank.
  const out: TopSightRecord[] = [];
  for (const cat of CATEGORIES) {
    const bucket = verified
      .filter((r) => r.topPickCategory === cat)
      .sort((a, b) => scoreForRanking(b.googleRating, b.ratingCount) - scoreForRanking(a.googleRating, a.ratingCount))
      .slice(0, PER_CATEGORY);
    bucket.forEach((r, i) => {
      out.push({
        city: c,
        name: r.name,
        category: r.category,
        topPickCategory: cat,
        popularityRank: i + 1,
        description: r.description,
        descriptionHe: r.descriptionHe,
        categoryEmoji: r.categoryEmoji,
        vibeLabel: r.vibeLabel,
        latitude: r.latitude,
        longitude: r.longitude,
        photoUrl: r.photoUrl,
        websiteUrl: r.websiteUrl,
        googlePlaceId: r.googlePlaceId,
        googleRating: r.googleRating,
      });
    });
  }
  return out;
}
