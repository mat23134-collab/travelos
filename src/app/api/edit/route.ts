import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Itinerary, DayPlan } from '@/lib/types';

interface EditPayload {
  itinerary: Itinerary;
  message: string;
}

export interface EditResult {
  changedDays: DayPlan[];
  summary: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Extract day numbers mentioned in the message (e.g. "Day 1", "day 2", "days 1 and 3")
function parseMentionedDays(message: string, totalDays: number): number[] {
  const nums: number[] = [];
  const re = /\bday[s]?\s*(\d+)(?:\s*(?:and|,|&)\s*(\d+))*/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(message)) !== null) {
    for (let i = 1; i < m.length; i++) {
      if (m[i]) {
        const n = parseInt(m[i], 10);
        if (n >= 1 && n <= totalDays) nums.push(n);
      }
    }
  }
  // Also catch bare numbers like "on 2" or "day2"
  if (nums.length === 0) {
    const bare = message.match(/\b([1-9])\b/g);
    if (bare) {
      bare.forEach((b) => {
        const n = parseInt(b, 10);
        if (n >= 1 && n <= totalDays) nums.push(n);
      });
    }
  }
  return [...new Set(nums)].sort((a, b) => a - b);
}

// Slim an Activity — keep only prompt-relevant fields, drop GPS/media/JIT
function slimActivity(a: import('@/lib/types').Activity | undefined): object | undefined {
  if (!a) return undefined;
  return {
    name: a.name,
    description: a.description,
    neighborhood: a.neighborhood,
    duration: a.duration,
    estimatedCost: a.estimatedCost,
    whyThis: a.whyThis,
    startTime: a.startTime,
    endTime: a.endTime,
    tags: a.tags,
    isHiddenGem: a.isHiddenGem,
  };
}

// Slim a DayPlan for the prompt — drop heavy/optional fields to save tokens
function slimDay(day: DayPlan): object {
  return {
    day: day.day,
    theme: day.theme,
    morning:   slimActivity(day.morning),
    afternoon: slimActivity(day.afternoon),
    evening:   slimActivity(day.evening),
    breakfast: day.breakfast,
    lunch:     day.lunch,
    dinner:    day.dinner,
    estimatedDailyCost: day.estimatedDailyCost,
    transportTip: day.transportTip,
  };
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let payload: EditPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { itinerary, message } = payload;
  if (!itinerary || !message?.trim()) {
    return NextResponse.json({ error: 'itinerary and message are required' }, { status: 400 });
  }

  // Determine which days to send — only mentioned days, or all if none specified
  const mentionedDays = parseMentionedDays(message, itinerary.totalDays);
  const targetDays = mentionedDays.length > 0
    ? itinerary.days.filter((d) => mentionedDays.includes(d.day))
    : itinerary.days;

  const daysPayload = JSON.stringify(targetDays.map(slimDay));

  const budget = itinerary.budgetSummary?.dailyAverage ?? 'mid-range';
  const prompt = `Edit a travel itinerary for ${itinerary.destination} (${itinerary.totalDays} days total). Budget: ${budget}.

USER REQUEST: "${message}"

DAYS TO POTENTIALLY EDIT:
${daysPayload}

Rules:
- Only modify what the user asked. Keep all other fields identical.
- Preserve whyThis where unchanged; update it if the activity changes.
- Return ONLY valid JSON, no markdown, no prose.

{"changedDays":[...modified day objects only, same structure as input...],"summary":"One sentence of what changed"}`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim();
    const jsonText = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let result: EditResult;
    try {
      result = JSON.parse(jsonText);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) {
        return NextResponse.json({ error: 'The AI returned an incomplete response. Please try again.' }, { status: 500 });
      }
      try {
        result = JSON.parse(match[0]);
      } catch {
        return NextResponse.json({ error: 'The AI returned an incomplete response. Please try again.' }, { status: 500 });
      }
    }

    // Merge slim changedDays back onto full original day objects
    const mergedChangedDays: DayPlan[] = result.changedDays.map((slim) => {
      const original = itinerary.days.find((d) => d.day === slim.day);
      if (!original) return slim as DayPlan;
      return { ...original, ...slim } as DayPlan;
    });

    return NextResponse.json({ changedDays: mergedChangedDays, summary: result.summary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
