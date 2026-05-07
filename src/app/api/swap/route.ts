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
const SLOT_ORDER: Record<'morning' | 'afternoon' | 'evening', number> = {
  morning: 1,
  afternoon: 3,
  evening: 5,
};

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
        const { data: ownerRow } = await supabase
          .from('itineraries')
          .select('user_id')
          .eq('id', itinerary_id)
          .maybeSingle();

        // 1. Update the specific itinerary_items row
        const { data: updatedRows } = await supabase
          .from('itinerary_items')
          .update({
            name:           newActivity.name           ?? null,
            category:       slot,
            description:    newActivity.description    ?? null,
            lat:            newActivity.latitude       != null ? Number(newActivity.latitude)  : null,
            lng:            newActivity.longitude      != null ? Number(newActivity.longitude) : null,
            website_url:    newActivity.website_url    ?? null,
            item_tags:      Array.isArray(newActivity.tags) && newActivity.tags.length > 0
                              ? newActivity.tags
                              : [],
          })
          .eq('itinerary_id', itinerary_id)
          .eq('day_number', dayNumber)
          .eq('item_order', SLOT_ORDER[slot])
          .select('id')
          .limit(1);

        // 2. Sync the JSON blob so the [id] page always reads current data
        const updatedDays = itinerary.days.map((day, i) =>
          i !== dayIndex ? day : { ...day, [slot]: newActivity }
        );
        const updatedBlob: Itinerary = { ...itinerary, days: updatedDays };
        await supabase
          .from('itineraries')
          .update({ itinerary_json: updatedBlob })
          .eq('id', itinerary_id);

        // 3. Audit trail: track who swapped which place.
        if (ownerRow?.user_id && updatedRows?.[0]?.id) {
          await supabase
            .from('user_place_events')
            .insert({
              user_id: ownerRow.user_id,
              itinerary_id: itinerary_id,
              itinerary_item_id: updatedRows[0].id,
              event_type: 'swapped',
              place_name: newActivity.name ?? 'Unknown place',
              place_category: slot,
              lat: newActivity.latitude != null ? Number(newActivity.latitude) : null,
              lng: newActivity.longitude != null ? Number(newActivity.longitude) : null,
              metadata: {
                source: 'api/swap',
                day_number: dayNumber,
                slot,
                request,
              },
            });
        }

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
