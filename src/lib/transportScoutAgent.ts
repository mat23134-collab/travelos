/**
 * Transport Scout Agent — fills `public.transportation` when a city has no cached guide.
 * Uses Gemini JSON mode + optional web snippets (same stack as itinerary generation).
 */

import { searchWeb } from '@/lib/rag';
import type { CityTransportGuide } from '@/lib/types';
import { parseTransportGuideJson } from '@/lib/transportGuideParse';

const JSON_PREAMBLE =
  'IMPORTANT: Your output MUST be a raw JSON object only. ' +
  'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
  'Start your response immediately with { and end with }. ';

const TRANSPORT_SYSTEM =
  JSON_PREAMBLE +
  'You are TravelOS Transport Scout. Build a practical city mobility guide for visitors.\n' +
  'Return a single JSON object with this exact shape:\n' +
  '{\n' +
  '  "intro": string (1–2 sentences),\n' +
  '  "options": [ {\n' +
  '    "mode": string,\n' +
  '    "summary": string,\n' +
  '    "typicalPrice": string (optional legacy; may mirror dailyAverage),\n' +
  '    "dailyAverage": string — typical spend per day using this mode (local currency),\n' +
  '    "tripTotalEstimate": string — rough total for TRIP_DAY_COUNT days if this mode is the main way to get around,\n' +
  '    "optionUrl": string|null — https official pass/tickets page for this mode if known,\n' +
  '    "optionLinkLabel": string|null — short label for optionUrl,\n' +
  '    "tip": string|null\n' +
  '  } ],\n' +
  '  "links": [ { "label": string, "url": string (https only), "description": string|null } ]\n' +
  '}\n' +
  'Rules:\n' +
  '- 4–6 options: metro/subway, bus/tram, rail, bike share, ferry, taxi/rideshare norms as relevant.\n' +
  '- dailyAverage + tripTotalEstimate must use the SAME trip length the user prompt gives (TRIP_DAY_COUNT).\n' +
  '- Be honest bands (not exact fares); local currency symbols.\n' +
  '- links: official city/operator pass or national rail — only https URLs you trust.\n' +
  '- If unsure of a URL, omit that field or link entry.\n';

function parseAIJson(rawText: string): unknown {
  const text = rawText.trim();
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in transport scout response.');
  }
  return JSON.parse(text.slice(start, end + 1));
}

type GeminiGenerateBody = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

async function callGeminiTransport(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: TRANSPORT_SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    }),
  });

  const errBody = !res.ok ? await res.text() : '';
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 600)}`);
  }

  const data = (await res.json()) as GeminiGenerateBody;
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  }
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no candidates');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') {
    throw new Error(`Gemini finish: ${cand.finishReason}`);
  }
  const parts = cand.content?.parts ?? [];
  const raw = parts.map((p) => p.text ?? '').join('').trim();
  if (!raw) throw new Error('Gemini returned empty text');
  return raw;
}

export async function runTransportScoutAgent(
  city: string,
  opts?: { tripDays?: number },
): Promise<CityTransportGuide | null> {
  const c = city.trim();
  if (!c) return null;

  const tripDays =
    typeof opts?.tripDays === 'number' && Number.isFinite(opts.tripDays) && opts.tripDays > 0
      ? Math.min(30, Math.round(opts.tripDays))
      : 5;

  let ragBlock = '';
  try {
    const hits = await searchWeb(`${c} public transport official tickets metro bus day pass how to pay`);
    if (hits.length > 0) {
      ragBlock =
        '\n\nWEB SNIPPETS (grounding — prefer facts consistent with these):\n' +
        hits
          .slice(0, 10)
          .map((h) => `- ${h.title}: ${h.snippet}`)
          .join('\n');
    }
  } catch {
    /* optional */
  }

  const userPrompt =
    `City: ${c}\n` +
    `TRIP_DAY_COUNT: ${tripDays} (use this exact day count for every tripTotalEstimate).\n` +
    `Produce the mobility JSON described in the system message.${ragBlock}`;

  const raw = await callGeminiTransport(userPrompt);
  const parsed = parseAIJson(raw);
  return parseTransportGuideJson(parsed);
}
