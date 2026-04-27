import { TravelerProfile, SearchResult, ClassifiedResult, VibeScore } from './types';

// ─── Keyword signal banks ─────────────────────────────────────────────────────

const HIDDEN_GEM_SIGNALS = [
  'hidden gem', 'off the beaten', 'local secret', 'underrated', 'locals only',
  'lesser known', 'not in guidebooks', 'secret spot', 'undiscovered', 'off-beat',
  'under the radar', 'few tourists', 'authentic', 'overlooked',
];

const LOCAL_FAVORITE_SIGNALS = [
  'locals love', 'local favorite', 'neighborhood staple', 'where locals eat',
  'ask any local', 'regulars swear by', 'neighborhood gem', 'community spot',
];

const VIRAL_SIGNALS = [
  'tiktok', 'instagram', 'viral', 'trending', 'social media', 'influencer',
  'went viral', 'blew up on', 'aesthetic', 'photo spot',
];

const TOURIST_TRAP_SIGNALS = [
  'tourist trap', 'overpriced', 'avoid', 'not worth', 'disappointing',
  'crowded with tourists', 'gimmicky', 'mediocre', 'watered down',
  'for tourists only', 'tourist area',
];

const GUIDED_TOUR_SIGNALS = [
  'guided tour', 'tour bus', 'group tour', 'tour package', 'bus tour',
  'scheduled tour', 'tour operator', 'booking required', 'organized tour',
];

function countSignals(text: string, signals: string[]): number {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s)).length;
}

// ─── Vibe classifier ──────────────────────────────────────────────────────────

export function classifyVibeScore(result: SearchResult): VibeScore {
  const text = `${result.title} ${result.snippet}`.toLowerCase();

  const scores: [VibeScore, number][] = [
    ['hidden-gem',   countSignals(text, HIDDEN_GEM_SIGNALS) * 3],
    ['local-favorite', countSignals(text, LOCAL_FAVORITE_SIGNALS) * 2],
    ['viral-trend',  countSignals(text, VIRAL_SIGNALS) * 2],
    ['tourist-trap', countSignals(text, TOURIST_TRAP_SIGNALS) * 3],
    ['guided-tour',  countSignals(text, GUIDED_TOUR_SIGNALS) * 2],
  ];

  const best = scores.reduce((a, b) => (b[1] > a[1] ? b : a), ['unknown' as VibeScore, 0]);
  return best[1] > 0 ? best[0] : 'unknown';
}

// ─── Priority scorer — how relevant is this result to the profile? ─────────────

export function scorePriority(result: SearchResult, profile: TravelerProfile, vibe: VibeScore): number {
  let score = 5; // baseline

  const { groupType, interests, budget } = profile;

  // Group-type affinity
  if (groupType === 'solo' || groupType === 'group') {
    if (vibe === 'hidden-gem') score += 3;
    if (vibe === 'viral-trend') score += 2;
    if (vibe === 'local-favorite') score += 2;
    if (vibe === 'tourist-trap') score -= 4;
    if (vibe === 'guided-tour') score -= 2;
  }
  if (groupType === 'couple') {
    if (vibe === 'hidden-gem') score += 3;
    if (vibe === 'local-favorite') score += 2;
    if (vibe === 'tourist-trap') score -= 3;
  }
  if (groupType === 'family') {
    if (vibe === 'guided-tour') score += 1; // structure is fine for families
    if (vibe === 'local-favorite') score += 2;
    if (vibe === 'tourist-trap') score -= 2;
  }

  // Budget affinity — boost budget-relevant content
  const text = `${result.title} ${result.snippet}`.toLowerCase();
  if (budget === 'budget' && (text.includes('cheap') || text.includes('free') || text.includes('budget'))) score += 2;
  if (budget === 'luxury' && (text.includes('luxury') || text.includes('fine dining') || text.includes('exclusive'))) score += 2;

  // Interest match
  const interestHits = interests.filter((i) => text.includes(i.toLowerCase())).length;
  score += interestHits;

  // Freshness bonus
  if (text.includes('2026') || text.includes('2025')) score += 2;

  return Math.max(0, Math.min(10, score));
}

// ─── Contradiction detector ───────────────────────────────────────────────────

const OPEN_SIGNALS = ['open daily', 'open every day', 'open 7 days', 'open year-round', 'always open'];
const CLOSED_SIGNALS = ['closed', 'renovation', 'under construction', 'temporarily closed', 'closed on', 'not open'];
const PRICEY_SIGNALS = ['expensive', 'overpriced', 'pricey', 'costly'];
const CHEAP_SIGNALS = ['affordable', 'cheap', 'budget-friendly', 'free', 'inexpensive'];

function findCommonSubjects(results: SearchResult[]): string[] {
  const wordFreq = new Map<string, number>();
  for (const r of results) {
    const words = `${r.title} ${r.snippet}`.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? [];
    for (const w of words) {
      if (['this', 'that', 'with', 'from', 'have', 'been', 'they', 'their', 'also', 'more', 'some', 'when', 'will', 'best'].includes(w)) continue;
      wordFreq.set(w, (wordFreq.get(w) ?? 0) + 1);
    }
  }
  return [...wordFreq.entries()]
    .filter(([, count]) => count >= 2)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}

export function detectContradictions(results: ClassifiedResult[]): ClassifiedResult[] {
  if (results.length < 2) return results;

  const subjects = findCommonSubjects(results);
  const enriched = results.map((r) => ({ ...r }));

  for (const subject of subjects) {
    const mentioning = enriched.filter((r) =>
      `${r.title} ${r.snippet}`.toLowerCase().includes(subject)
    );
    if (mentioning.length < 2) continue;

    const hasOpen  = mentioning.some((r) => countSignals(r.snippet, OPEN_SIGNALS) > 0);
    const hasClosed = mentioning.some((r) => countSignals(r.snippet, CLOSED_SIGNALS) > 0);
    const hasPricey = mentioning.some((r) => countSignals(r.snippet, PRICEY_SIGNALS) > 0);
    const hasCheap  = mentioning.some((r) => countSignals(r.snippet, CHEAP_SIGNALS) > 0);

    if (hasOpen && hasClosed) {
      for (const r of mentioning) {
        r.contradictionNote = `⚠️ Conflicting info about "${subject}": sources disagree on whether it's currently open — verify before visiting.`;
      }
    }
    if (hasPricey && hasCheap) {
      for (const r of mentioning) {
        r.contradictionNote = (r.contradictionNote ? r.contradictionNote + ' | ' : '') +
          `⚠️ Sources disagree on price level for "${subject}" — check current rates.`;
      }
    }
  }

  return enriched;
}

// ─── Chain-of-thought query builder ──────────────────────────────────────────

export function buildChainOfThoughtQueries(profile: TravelerProfile): { phase1: string[]; phase2: string[] } {
  const { destination, interests, budget, groupType, pace } = profile;
  const topInterest = interests[0] ?? 'culture';
  const secondInterest = interests[1] ?? 'food';

  return {
    // Phase 1: broad trend research — what's NEW and current
    phase1: [
      `${destination} travel 2026 what's new emerging neighborhood local trends`,
      `${destination} best ${topInterest} spots hidden underrated locals recommend 2025 2026`,
    ],
    // Phase 2: deep blog mining + group/budget-specific tips
    phase2: [
      `${destination} ${secondInterest} blog review authentic local guide 2025 2026`,
      `${destination} ${groupType} ${budget} budget travel tips insider advice 2026`,
      `${destination} avoid tourist traps vs must-visit genuine experiences ${pace} pace`,
    ],
  };
}

// ─── Classify and rank a batch of raw search results ─────────────────────────

export function classifyAndRank(results: SearchResult[], profile: TravelerProfile): ClassifiedResult[] {
  const classified: ClassifiedResult[] = results.map((r) => {
    const vibeScore = classifyVibeScore(r);
    return {
      ...r,
      vibeScore,
      priority: scorePriority(r, profile, vibeScore),
    };
  });

  // Sort: highest priority first, tourist-traps last
  classified.sort((a, b) => {
    if (a.vibeScore === 'tourist-trap' && b.vibeScore !== 'tourist-trap') return 1;
    if (b.vibeScore === 'tourist-trap' && a.vibeScore !== 'tourist-trap') return -1;
    return b.priority - a.priority;
  });

  return detectContradictions(classified);
}

// ─── Web search helpers (Tavily / Exa fallback) ───────────────────────────────

async function searchTavily(query: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      include_answer: false,
      max_results: 5,
    }),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
    title: r.title,
    url: r.url,
    snippet: r.content?.slice(0, 700) ?? '',
  }));
}

async function searchExa(query: string): Promise<SearchResult[]> {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.EXA_API_KEY ?? '' },
    body: JSON.stringify({ query, numResults: 5, contents: { text: { maxCharacters: 700 } } }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map((r: { title: string; url: string; text: string }) => ({
    title: r.title,
    url: r.url,
    snippet: r.text?.slice(0, 700) ?? '',
  }));
}

export async function searchWeb(query: string): Promise<SearchResult[]> {
  if (process.env.TAVILY_API_KEY && !process.env.TAVILY_API_KEY.includes('your_')) {
    try { return await searchTavily(query); } catch { /* fall through */ }
  }
  if (process.env.EXA_API_KEY && !process.env.EXA_API_KEY.includes('your_')) {
    try { return await searchExa(query); } catch { /* fall through */ }
  }
  return [];
}

// ─── Three-phase chain-of-thought search ─────────────────────────────────────

export async function runChainOfThoughtSearch(profile: TravelerProfile): Promise<ClassifiedResult[]> {
  const { phase1, phase2 } = buildChainOfThoughtQueries(profile);

  // Phase 1 & 2 run in parallel within each phase; phases run sequentially so
  // phase-2 queries can theoretically use phase-1 insight (future improvement).
  const [p1Results, p2Results] = await Promise.all([
    Promise.allSettled(phase1.map(searchWeb)),
    Promise.allSettled(phase2.map(searchWeb)),
  ]);

  const raw: SearchResult[] = [
    ...p1Results.flatMap((r) => r.status === 'fulfilled' ? r.value : []),
    ...p2Results.flatMap((r) => r.status === 'fulfilled' ? r.value : []),
  ];

  // Deduplicate by URL
  const seen = new Set<string>();
  const unique = raw.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  return classifyAndRank(unique, profile);
}
