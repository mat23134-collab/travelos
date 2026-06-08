import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { Itinerary, Activity } from '@/lib/types';
import { buildSwapPrompt } from '@/lib/prompts';
import { supabase } from '@/lib/supabase';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';

export interface SwapPayload {
  itinerary: Itinerary;
  /** DB UUID from itineraries table — enables targeted row-level update */
  itinerary_id?: string;
  dayIndex: number;
  slot: 'morning' | 'afternoon' | 'evening';
  request?: string;
  /** When set, skips LLM and persists this activity (smart-swap picker). */
  replacementActivity?: Activity;
  /** Short human line shown after picking a proposal (optional). */
  proposalSummary?: string;
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

async function persistSwap(
  itinerary: Itinerary,
  itinerary_id: string | undefined,
  dayIndex: number,
  slot: 'morning' | 'afternoon' | 'evening',
  rawActivity: Activity,
  requestMeta: string,
): Promise<Activity> {
  const existingItemId: string | undefined = itinerary.days[dayIndex]?.[slot]?.item_id;
  const newActivity: Activity = {
    ...rawActivity,
    item_id: existingItemId,
  };

  if (itinerary_id) {
    try {
      const dayNumber = dayIndex + 1;
      const { data: ownerRow } = await supabase
        .from('itineraries')
        .select('user_id')
        .eq('id', itinerary_id)
        .maybeSingle();

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

      const updatedDays = itinerary.days.map((day, i) =>
        i !== dayIndex ? day : { ...day, [slot]: newActivity }
      );
      const updatedBlob: Itinerary = { ...itinerary, days: updatedDays };
      await supabase
        .from('itineraries')
        .update({ itinerary_json: updatedBlob })
        .eq('id', itinerary_id);

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
              request: requestMeta,
            },
          });
      }

      console.log(`[swap] DB synced — itinerary ${itinerary_id} day${dayNumber} ${slot}`);
    } catch (dbErr) {
      console.warn('[swap] DB update failed (non-critical):', dbErr instanceof Error ? dbErr.message : dbErr);
    }
  }

  return newActivity;
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let payload: SwapPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    itinerary,
    itinerary_id,
    dayIndex,
    slot,
    request = 'Suggest something better',
    replacementActivity,
    proposalSummary,
  } = payload;

  if (!itinerary || dayIndex === undefined || !slot) {
    return NextResponse.json({ error: 'itinerary, dayIndex, and slot are required' }, { status: 400 });
  }
  if (dayIndex < 0 || dayIndex >= itinerary.days.length) {
    return NextResponse.json({ error: 'dayIndex out of range' }, { status: 400 });
  }

  try {
    let rawActivity: Activity;
    let summary: string;
    let requestMeta: string;

    if (replacementActivity && typeof replacementActivity === 'object' && replacementActivity.name?.trim()) {
      rawActivity = replacementActivity;
      summary =
        proposalSummary?.trim()
        || `Swapped to ${rawActivity.name}`;
      requestMeta = 'smart-swap';
    } else {
      const prompt = buildSwapPrompt({ itinerary, dayIndex, slot, request });
      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = (response.content[0] as { type: string; text: string }).text.trim()
        .replace(/^```json\n?/, '').replace(/\n?```$/, '');

      let parsed: { activity: Activity; summary: string };
      try {
        parsed = JSON.parse(rawText);
      } catch {
        const match = rawText.match(/\{[\s\S]*\}/);
        if (!match) return NextResponse.json({ error: 'Could not parse swap result' }, { status: 500 });
        parsed = JSON.parse(match[0]);
      }

      rawActivity = parsed.activity;
      summary = parsed.summary;
      requestMeta = request;
    }

    const merged = await persistSwap(itinerary, itinerary_id, dayIndex, slot, rawActivity, requestMeta);

    const result: SwapResult = {
      activity: merged,
      dayIndex,
      slot,
      summary,
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: m