/**
 * geminiOrchestrator — synthesizes the personalized, Hebrew-first neighborhood
 * guide from the day's POIs + Tavily facts + Exa semantic highlights.
 *
 * Safe JSON: Gemini is asked for a raw JSON object, but we still strip any
 * ```json … ``` fences (and any stray prose around the object) before
 * JSON.parse to prevent a parsing crash.
 */

import type {
  AnchorNeighborhood, NeighborhoodFacts, NeighborhoodGuideContent, NeighborhoodHighlights,
  ProfilerPoi, ProfilerTripContext,
} from './types';

const GEMINI_FETCH_MS = 30_000;

/** Strip Markdown fences / surrounding prose and parse the first JSON object. */
export function safeParseJsonObject(raw: string): Record<string, unknown> | null {
  let s = raw.trim();
  // Remove ```json … ``` or ``` … ``` fences.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  // If there's still prose around it, grab the outermost {...}.
  if (!s.startsWith('{')) {
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
  }
  try {
    const parsed = JSON.parse(s);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v.trim() : fallback);
const asStrArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean) : [];

function systemPrompt(): string {
  return `You are a sharp, honest local-travel editor writing for ISRAELI travelers in fluent, natural Hebrew (not translated-sounding). You explain WHY a day's plan is grouped in one neighborhood, and give real, street-level context — never generic Wikipedia phrasing.

Return ONE raw JSON object, no Markdown, with EXACTLY these keys:
{
  "name_hebrew": string,             // the neighborhood name in Hebrew
  "name_english": string,            // the neighborhood name in English
  "the_hook_hebrew": string,         // one sharp, realistic vibe sentence — what this place actually FEELS like. No clichés.
  "personal_relevance_hebrew": string, // why WE placed this traveler here today, tied to their trip profile (interests/group/budget/pace/day number)
  "local_secrets_hebrew": string[],  // 2-3 specific spots to notice/stop at while walking between the POIs (from the Exa highlights when real; otherwise a safe, plausible local tip)
  "honest_downsides_hebrew": string[], // 1-2 real warnings: parking, steep hills, early closures, crowded hours, tourist-trap streets
  "commute_and_safety_hebrew": string  // metro/station reality + walking reality + night-safety, in one tight paragraph
}

Rules:
- Hebrew must be natural and specific. Prefer concrete details (a station name, a street, an hour) over vague adjectives.
- Ground claims in the provided facts/highlights. Do NOT invent metro lines or specific place names that aren't supported — keep unsupported tips generic ("שווה לחפש בית קפה שכונתי ברחוב הצדדי").
- Be honest in honest_downsides — this builds trust. Never say "there are no downsides".
- Keep each field tight; this is a guide chip, not an essay.`;
}

function userPrompt(
  neighborhood: AnchorNeighborhood,
  pois: ProfilerPoi[],
  trip: ProfilerTripContext,
  facts: NeighborhoodFacts,
  highlights: NeighborhoodHighlights,
): string {
  const poiList = pois.map((p) => `- ${p.name}${p.category ? ` (${p.category})` : ''}`).join('\n');
  const tripLines = [
    trip.dayNumber ? `Day number: ${trip.dayNumber}` : '',
    trip.interests?.length ? `Interests: ${trip.interests.join(', ')}` : '',
    trip.groupType ? `Group: ${trip.groupType}` : '',
    trip.budget ? `Budget: ${trip.budget}` : '',
    trip.pace ? `Pace: ${trip.pace}` : '',
  ].filter(Boolean).join('\n');

  return `NEIGHBORHOOD: ${neighborhood.nameEnglish}${neighborhood.nameHebrew ? ` (${neighborhood.nameHebrew})` : ''}
${neighborhood.matched}/${neighborhood.total} of the day's stops fall inside this neighborhood.

TODAY'S STOPS (POIs):
${poiList || '(none)'}

TRAVELER PROFILE:
${tripLines || '(not provided)'}

TAVILY FACTS — METRO/STATIONS:
${facts.metroStations.join('\n') || '(none)'}
TAVILY FACTS — WALKABILITY/TERRAIN:
${facts.walkabilityNotes.join('\n') || '(none)'}
TAVILY FACTS — NIGHT SAFETY:
${facts.safetyNotes.join('\n') || '(none)'}

EXA — LOCAL SECRETS:
${highlights.localSecrets.join('\n') || '(none)'}
EXA — HONEST DOWNSIDES:
${highlights.honestDownsides.join('\n') || '(none)'}

Write the JSON now.`;
}

export async function synthesizeGuide(
  neighborhood: AnchorNeighborhood,
  pois: ProfilerPoi[],
  trip: ProfilerTripContext,
  facts: NeighborhoodFacts,
  highlights: NeighborhoodHighlights,
): Promise<NeighborhoodGuideContent> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), GEMINI_FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt(neighborhood, pois, trip, facts, highlights) }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 2048,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } finally {
    clearTimeout(tid);
  }

  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);

  const rawText = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  const obj = safeParseJsonObject(rawText);
  if (!obj) throw new Error('Gemini returned unparseable JSON');

  return {
    name_hebrew: asStr(obj.name_hebrew, neighborhood.nameHebrew ?? neighborhood.nameEnglish),
    name_english: asStr(obj.name_english, neighborhood.nameEnglish),
    the_hook_hebrew: asStr(obj.the_hook_hebrew),
    personal_relevance_hebrew: asStr(obj.personal_relevance_hebrew),
    local_secrets_hebrew: asStrArray(obj.local_secrets_hebrew).slice(0, 3),
    honest_downsides_hebrew: asStrArray(obj.honest_downsides_hebrew).slice(0, 2),
    commute_and_safety_hebrew: asStr(obj.commute_and_safety_hebrew),
  };
}
