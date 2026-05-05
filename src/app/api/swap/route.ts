import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Itinerary, Activity } from '@/lib/types';
import { buildSwapPrompt } from '@/lib/prompts';
import { supabase } from '@/lib/supabase';

export interface SwapPayload {
  itinerary: Itinerary;
  /** DB UUID from itineraries table — enables targeted row-level update */
  itinerary_id?: string;
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

  const { itinerary, itinerary_id, dayIndex, slot, request = 'Suggest something better' } = payload;

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

    // ── Relational DB update: targeted row-level swap ────────────────────────
    // Preserve the existing item_id so the row identity is stable across swaps.
    const existingItemId: string | undefined = itinerary.days[dayIndex]?.[slot]?.item_id;
    const newActivity: Activity = {
      ...parsed.activity,
      item_id: existingItemId, // carry forward so UI doesn't lose the row reference
    };

    if (itinerary_id) {
      try {
        const dayNumber = dayIndex + 1;

        // 1. Update the specific itinerary_items row
        await supabase
          .from('itinerary_items')
          .update({
            name:           newActivity.name           ?? null,
            neighborhood:   newActivity.neighborhood   ?? null,
            latitude:       newActivity.latitude       != null ? Number(newActivity.latitude)  : null,
            longitude:      newActivity.longitude      != null ? Number(newActivity.longitude) : null,
            estimated_cost: newActivity.estimatedCost  ?? null,
            website_url:    newActivity.website_url    ?? null,
            tags:           Array.isArray(newActivity.tags) && newActivity.tags.length > 0
                              ? newActivity.tags
                              : null,
            item_json:      newActivity,
          })
          .eq('itinerary_id', itinerary_id)
          .eq('day_number', dayNumber)
          .eq('slot', slot);

        // 2. Sync the JSON blob so the [id] page always reads current data
        const updatedDays = itinerary.days.map((day, i) =>
          i !== dayIndex ? day : { ...day, [slot]: newActivity }
        );
        const updatedBlob: Itinerary = { ...itinerary, days: updatedDays };
        await supabase
          .from('itineraries')
          .update({ itinerary_json: updatedBlob })
          .eq('id', itinerary_id);

        console.log(`[swap] DB synced — itinerary ${itinerary_id} day${dayNumber} ${slot}`);
      } catch (dbErr) {
        // Non-critical: in-memory swap still succeeds even if DB write fails
        console.warn('[swap] DB update failed (non-critical):', dbErr instanceof Error ? dbErr.message : dbErr);
      }
    }

    const result: SwapResult = {
      activity: newActivity,
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
