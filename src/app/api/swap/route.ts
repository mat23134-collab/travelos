import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Itinerary, Activity } from '@/lib/types';
import { buildSwapPrompt } from '@/lib/prompts';

export interface SwapPayload {
  itinerary: Itinerary;
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  request?: string;
}

export interface SwapResult {
  activity: Activity;
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  summary: string;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let payload: SwapPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { itinerary, dayIndex, slot, request = 'Suggest something better' } = payload;

  if (!itinerary || dayIndex === undefined || !slot) {
    return NextResponse.json({ error: 'itinerary, dayIndex, and slot are required' }, { status: 400 });
  }
  if (dayIndex < 0 || dayIndex >= itinerary.days.length) {
    return NextResponse.json({ error: 'dayIndex out of range' }, { status: 400 });
  }

  const prompt = buildSwapPrompt({ itinerary, dayIndex, slot, request });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let parsed: { activity: Activity; summary: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'Could not parse swap result' }, { status: 500 });
      parsed = JSON.parse(match[0]);
    }

    const result: SwapResult = {
      activity: parsed.activity,
      dayIndex,
      slot,
      summary: parsed.summary,
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
