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

  const prompt = `You are editing an existing travel itinerary based on a user request.

USER REQUEST: "${message}"

CURRENT ITINERARY (${itinerary.totalDays} days in ${itinerary.destination}):
${JSON.stringify(itinerary.days, null, 2)}

Instructions:
- Identify which day(s) the request applies to. If no day is mentioned, apply to the most relevant day(s).
- Modify only what the user asked for — do not change unrelated days or activities.
- Keep the same JSON structure as the existing days.
- Preserve whyThis citations where possible; update them if the activity changes.
- Keep costs within the existing budget tier of the itinerary.

Return ONLY a JSON object — no markdown, no prose:
{
  "changedDays": [ ...full day objects with the same structure as the input, only for days that changed... ],
  "summary": "One sentence describing what was changed and why"
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
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
      if (!match) return NextResponse.json({ error: 'Could not parse edit result' }, { status: 500 });
      result = JSON.parse(match[0]);
    }

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
