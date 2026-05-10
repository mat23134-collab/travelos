import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import type { Activity, Itinerary, TravelerProfile } from '@/lib/types';
import { buildSwapProposalsPrompt } from '@/lib/prompts';

export interface SwapProposalAlternative {
  placeIntro: string;
  whyItFitsYou: string;
  activity: Activity;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: {
    itinerary: Itinerary;
    dayIndex: number;
    slot: 'morning' | 'afternoon' | 'evening';
    profile?: TravelerProfile | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { itinerary, dayIndex, slot, profile } = body;
  if (!itinerary?.days?.length || dayIndex === undefined || !slot) {
    return NextResponse.json({ error: 'itinerary, dayIndex, and slot are required' }, { status: 400 });
  }
  if (dayIndex < 0 || dayIndex >= itinerary.days.length) {
    return NextResponse.json({ error: 'dayIndex out of range' }, { status: 400 });
  }

  const prompt = buildSwapProposalsPrompt({ itinerary, dayIndex, slot, profile: profile ?? null });

  try {
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (response.content[0] as { type: string; text: string }).text.trim()
      .replace(/^```json\n?/, '').replace(/\n?```$/, '');

    let parsed: { alternatives?: SwapProposalAlternative[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) return NextResponse.json({ error: 'Could not parse proposals' }, { status: 500 });
      parsed = JSON.parse(match[0]);
    }

    const alts = Array.isArray(parsed.alternatives) ? parsed.alternatives : [];
    const cleaned: SwapProposalAlternative[] = [];
    for (const row of alts) {
      if (!row || typeof row !== 'object') continue;
      const act = row.activity as Activity | undefined;
      const intro = typeof row.placeIntro === 'string' ? row.placeIntro.trim() : '';
      const why = typeof row.whyItFitsYou === 'string' ? row.whyItFitsYou.trim() : '';
      if (!act?.name?.trim() || !intro || !why) continue;
      cleaned.push({ placeIntro: intro, whyItFitsYou: why, activity: act });
      if (cleaned.length >= 2) break;
    }

    if (cleaned.length < 2) {
      return NextResponse.json({ error: 'Model returned fewer than 2 valid alternatives' }, { status: 422 });
    }

    return NextResponse.json({ alternatives: cleaned });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
