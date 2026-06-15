// src/app/api/assistant/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { verifySession, unauthorizedResponse } from '@/lib/apiGuard';
import { findAlternativePlaces } from '@/lib/placesQuery';
import { buildCardsFromRecommendations } from '@/lib/assistantCards';
import { buildAssistantSystemPrompt } from '@/lib/prompts';
import type {
  AssistantContext, PlaceRow, SlotKey, SwapTarget,
  AssistantRecommendation, AssistantPlaceCard, AssistantChatTurn,
} from '@/lib/assistantTypes';

export const dynamic = 'force-dynamic';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'find_alternatives',
    description: 'Fetch real candidate places from the catalog for a slot. Always call before recommending; never invent places.',
    input_schema: {
      type: 'object',
      properties: {
        slot: { type: 'string', enum: ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] },
        excludeName: { type: 'string', description: 'Current place name to exclude from results' },
      },
      required: ['slot'],
    },
  },
  {
    name: 'present_recommendations',
    description: 'Present the final grounded recommendations and the resolved swap target. Call once.',
    input_schema: {
      type: 'object',
      properties: {
        dayIndex: { type: 'number' },
        slot: { type: 'string', enum: ['morning', 'afternoon', 'evening'] },
        diningField: { type: 'string', enum: ['breakfast', 'lunch', 'dinner'] },
        reply: { type: 'string' },
        recommendations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              placeId: { type: 'string' },
              reasoning: { type: 'string' },
              isTopPick: { type: 'boolean' },
            },
            required: ['placeId', 'reasoning', 'isTopPick'],
          },
        },
      },
      required: ['dayIndex', 'slot', 'reply', 'recommendations'],
    },
  },
];

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  let body: { messages: AssistantChatTurn[]; context: AssistantContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0 || !context?.city) {
    return NextResponse.json({ error: 'messages and context.city are required' }, { status: 400 });
  }

  const system = buildAssistantSystemPrompt(context);
  const convo: Anthropic.MessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  let lastRows: PlaceRow[] = [];

  try {
    for (let i = 0; i < 4; i++) {
      const resp = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system,
        tools: TOOLS,
        messages: convo,
      });

      const toolUse = resp.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');

      if (!toolUse) {
        const text = resp.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('\n')
          .trim();
        return NextResponse.json({ reply: text || 'How can I help with your itinerary?', cards: [] });
      }

      if (toolUse.name === 'find_alternatives') {
        const input = toolUse.input as { slot: SlotKey; excludeName?: string };
        lastRows = await findAlternativePlaces({
          city: context.city,
          slot: input.slot,
          excludeName: input.excludeName,
        });
        const toolResult = lastRows.map((r) => ({
          placeId: r.id,
          name: r.name,
          category: r.category,
          description: r.description,
          googleRating: r.google_rating,
          vibe: r.vibe,
          groupSuitability: r.group_suitability,
          culinaryFocus: r.culinary_focus,
        }));
        convo.push({ role: 'assistant', content: resp.content });
        convo.push({
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(toolResult) }],
        });
        continue;
      }

      if (toolUse.name === 'present_recommendations') {
        const input = toolUse.input as {
          dayIndex: number;
          slot: SwapTarget['slot'];
          diningField?: SwapTarget['diningField'];
          reply: string;
          recommendations: AssistantRecommendation[];
        };
        // Guard a model-supplied day index against the real itinerary so a
        // miscount can't produce a card that silently no-ops on swap.
        if (!Number.isInteger(input.dayIndex) || input.dayIndex < 0 || input.dayIndex >= context.daysSummary.length) {
          return NextResponse.json({ reply: "Which day did you mean? I couldn't match that to a day in your itinerary.", cards: [] });
        }
        const target: SwapTarget = { dayIndex: input.dayIndex, slot: input.slot, diningField: input.diningField };
        const cards: AssistantPlaceCard[] = buildCardsFromRecommendations(lastRows, input.recommendations ?? [], target);
        // Recommendations given but none resolved against fetched places → don't
        // show an empty stall; ask to look again instead.
        if ((input.recommendations?.length ?? 0) > 0 && cards.length === 0) {
          return NextResponse.json({ reply: "I couldn't find those places in our catalog — want me to look again?", cards: [] });
        }
        return NextResponse.json({ reply: input.reply ?? '', cards });
      }

      break; // unknown tool
    }
    return NextResponse.json({ reply: "I couldn't complete that — try rephrasing your request.", cards: [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
