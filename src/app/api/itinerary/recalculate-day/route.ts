import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Activity, DayPlan } from '@/lib/types';
import {
  verifySession,
  unauthorizedResponse,
  checkRateLimit,
  getClientIp,
  rateLimitedResponse,
} from '@/lib/apiGuard';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecalculateDayRequest {
  /** The full day object whose activities need to be rescheduled. */
  day: DayPlan;
  /** The newly-booked activity. Must carry isFixed:true and lockedTime. */
  newActivity: Activity;
}

export interface RecalculateDayResponse {
  updatedDay: DayPlan;
  /** Which model produced the schedule — useful for debugging in the client. */
  provider: 'gemini' | 'claude';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Hard ceiling on each LLM fetch so a slow provider can't hang the request. */
const LLM_FETCH_MS = 30_000;

/**
 * Flatten a DayPlan's three activity slots into a typed array so we can
 * hand a clean list to the model and map the result back afterward.
 */
function flattenSlots(day: DayPlan): Activity[] {
  return ([day.morning, day.afternoon, day.evening] as (Activity | undefined)[])
    .filter((a): a is Activity => a != null);
}

/**
 * Map an ordered Activity array back onto a DayPlan's named slots.
 * Earliest startTime → morning, middle → afternoon, latest → evening.
 * Activities beyond three are dropped (the day only has three slots).
 */
function mapSlotsBack(original: DayPlan, activities: Activity[]): DayPlan {
  const sorted = [...activities].sort((a, b) => {
    const ta = a.startTime ?? a.lockedTime ?? '00:00';
    const tb = b.startTime ?? b.lockedTime ?? '00:00';
    return ta.localeCompare(tb);
  });

  return {
    ...original,
    morning:   sorted[0] ?? undefined,
    afternoon: sorted[1] ?? undefined,
    evening:   sorted[2] ?? undefined,
  };
}

/**
 * Extract a JSON array from a model response that may be wrapped in a
 * markdown code-fence or a `{ "activities": [...] }` object. Returns null
 * when no valid array can be parsed.
 */
function parseActivityArray(raw: string): Activity[] | null {
  const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    const parsed = JSON.parse(stripped);
    if (Array.isArray(parsed)) return parsed as Activity[];
    // Some models wrap the array under a key like { "activities": [...] }.
    const first = Object.values(parsed).find(Array.isArray);
    if (first) return first as Activity[];
    return null;
  } catch {
    return null;
  }
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

/**
 * Build the scheduling prompt. This is shared verbatim by both providers so
 * the fallback produces the same shape of output.
 *
 * Why this prompt structure works:
 *
 * 1. ROLE — Framing the model as a "master travel planner" activates its
 *    knowledge of realistic activity durations and transit times. Without this
 *    it treats the task as a pure sort and ignores physical feasibility.
 *
 * 2. HARD CONSTRAINTS block — Listed first so it sits in the model's recent
 *    context at generation time. The emphatic "MUST NOT" on isFixed activities
 *    is intentional: softer phrasing leads to occasional constraint violations.
 *
 * 3. RESOLUTION LADDER — An explicit priority order (shorten → gap → remove)
 *    stops the model from inventing a strategy that breaks a constraint.
 *
 * 4. OUTPUT CONTRACT — Asks for a raw JSON array. On Gemini we additionally
 *    enforce responseMimeType: 'application/json'; parseActivityArray() still
 *    strips markdown fences as a safety net for Claude.
 */
function buildSchedulePrompt(existing: Activity[], newActivity: Activity): string {
  const activitiesJson = JSON.stringify([...existing, newActivity], null, 2);

  return `You are a master travel planner. Your task is to reschedule a single day's activities after the traveler added a new fixed booking.

ACTIVITIES (current day + new booking):
${activitiesJson}

HARD CONSTRAINTS — follow these exactly, no exceptions:
1. Any activity where isFixed is true MUST start at exactly its lockedTime. You must not change its startTime, shorten its duration, or remove it.
2. Activities without isFixed may be shortened, reordered, or removed if needed to make the day physically possible.
3. No two activities may overlap. Allow at least 15 minutes of transit time between venues.
4. The day must end by 23:00.

RESOLUTION LADDER — when a conflict arises, try in this order:
a) Shorten a non-fixed activity's duration (minimum 30 minutes for any activity).
b) Accept a short gap between activities.
c) Remove the lowest-priority non-fixed activity entirely (prefer removing earlier activities over later ones).

RETURN FORMAT:
Return ONLY a raw JSON array of Activity objects — no prose, no markdown fences, no extra keys.
Each object in the array must include at minimum: name, startTime, endTime, duration.
Preserve all other fields from the original objects unchanged.
Sort the array by startTime ascending.`;
}

// ─── Provider: Gemini (primary) ───────────────────────────────────────────────

type GeminiGenerateBody = {
  promptFeedback?: { blockReason?: string };
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
};

/**
 * Calls Gemini with responseMimeType JSON so it returns a parseable array
 * without markdown fences. Mirrors the callGemini pattern used in
 * /api/generate and lib/transportScoutAgent.
 */
async function callGeminiSchedule(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), LLM_FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          // gemini-2.5-* thinking tokens count against maxOutputTokens; disable
          // so the activity JSON isn't truncated.
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } finally {
    clearTimeout(tid);
  }

  const errBody = !res.ok ? await res.text() : '';
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 400)}`);

  const data = (await res.json()) as GeminiGenerateBody;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);

  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no candidates');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') {
    throw new Error(`Gemini finish: ${cand.finishReason}`);
  }

  const raw = (cand.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!raw) throw new Error('Gemini returned empty text');
  return raw;
}

// ─── Provider: Claude (fallback) ──────────────────────────────────────────────

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callClaudeSchedule(prompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');

  const message = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const block = message.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response type');
  return block.text;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Auth
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  // Rate limit: 10 reschedules per IP per minute
  const ip = getClientIp(req);
  if (!checkRateLimit(`recalculate:${ip}`, 10, 60_000)) {
    return rateLimitedResponse();
  }

  // Parse body
  let body: RecalculateDayRequest;
  try {
    body = (await req.json()) as RecalculateDayRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { day, newActivity } = body;
  if (!day || !newActivity) {
    return NextResponse.json({ error: 'Both "day" and "newActivity" are required.' }, { status: 400 });
  }
  if (!newActivity.lockedTime) {
    return NextResponse.json(
      { error: '"newActivity" must include a "lockedTime" (e.g. "19:30").' },
      { status: 400 },
    );
  }

  // Force isFixed on the incoming activity so no model can ignore it.
  const fixedActivity: Activity = {
    ...newActivity,
    isFixed: true,
    startTime: newActivity.lockedTime,
  };

  const prompt = buildSchedulePrompt(flattenSlots(day), fixedActivity);

  // ── LLM: Gemini first, Claude fallback (same order as /api/generate) ────────
  let raw = '';
  let provider: 'gemini' | 'claude' = 'gemini';
  try {
    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        raw = await callGeminiSchedule(prompt);
        provider = 'gemini';
      } catch (geminiErr) {
        console.warn(
          '[recalculate-day] Gemini failed — falling back to Claude:',
          geminiErr instanceof Error ? geminiErr.message : geminiErr,
        );
        raw = await callClaudeSchedule(prompt);
        provider = 'claude';
      }
    } else {
      // No Gemini key configured — go straight to Claude.
      raw = await callClaudeSchedule(prompt);
      provider = 'claude';
    }
  } catch (err) {
    console.error('[recalculate-day] both providers failed:', err);
    return NextResponse.json({ error: 'AI scheduling failed. Please try again.' }, { status: 502 });
  }

  // Parse the model output
  let rescheduled = parseActivityArray(raw);

  // If the primary provider returned unparseable output, try Claude once.
  if ((!rescheduled || rescheduled.length === 0) && provider === 'gemini') {
    console.warn('[recalculate-day] Gemini output unparseable — retrying with Claude');
    try {
      raw = await callClaudeSchedule(prompt);
      provider = 'claude';
      rescheduled = parseActivityArray(raw);
    } catch (err) {
      console.error('[recalculate-day] Claude retry failed:', err);
    }
  }

  if (!rescheduled || rescheduled.length === 0) {
    console.error('[recalculate-day] Could not parse output:', raw.slice(0, 400));
    return NextResponse.json(
      { error: 'Could not parse the rescheduled activities. Please try again.' },
      { status: 502 },
    );
  }

  // Safety check: the fixed activity must survive at its exact lockedTime.
  const fixedInResult = rescheduled.find((a) => a.name === fixedActivity.name && a.isFixed);
  if (!fixedInResult || fixedInResult.startTime !== fixedActivity.lockedTime) {
    console.error('[recalculate-day] provider violated isFixed constraint. Raw:', raw.slice(0, 400));
    return NextResponse.json(
      { error: 'Scheduling result violated a fixed-time constraint. Please try again.' },
      { status: 502 },
    );
  }

  const updatedDay = mapSlotsBack(day, rescheduled);
  return NextResponse.json({ updatedDay, provider } satisfies RecalculateDayResponse);
}
