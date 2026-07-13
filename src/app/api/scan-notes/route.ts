/**
 * /api/scan-notes — Vision-powered extraction of trip ideas from an uploaded photo.
 *
 *   POST { image: "data:image/<type>;base64,<...>", destination?: string }
 *
 * Lets a traveler photograph a handwritten list, screenshot, or note of things
 * they want to do, and returns a short list of concrete travel items (place
 * names, neighborhoods, dishes, activities) extracted from it. The client adds
 * the ones the traveler keeps to their "Our Picks" must-haves, so the itinerary
 * generator weaves them in alongside its own recommendations where they fit.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitDurable, getClientIp, rateLimitedResponse } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';

const SCAN_RATE_LIMIT  = 10;
const SCAN_RATE_WINDOW = 10 * 60 * 1000;

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB, matches Anthropic's per-image cap

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

function buildExtractionPrompt(destination: string): string {
  const place = destination.trim() || 'their upcoming trip';
  return [
    `A traveler photographed a personal note (handwritten list, screenshot, or similar) of things they're hoping to do on a trip to ${place}.`,
    'Read the image and pull out the concrete, bookable items it mentions — place names, neighborhoods, restaurants or dishes, markets, museums, shops, experiences, etc.',
    'Skip anything illegible, generic, or not a real place/activity (e.g. "don\'t forget passport").',
    'Reply with ONLY a JSON array of short strings, each one item, in the same language as the note. No commentary, no markdown fences. Example: ["Mala Strana", "Kosher trdelník", "Havel\'s Market"]',
    'If nothing usable is found, reply with [].',
  ].join('\n');
}

function parseItems(raw: string): string[] {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!(await checkRateLimitDurable(`scan:${ip}`, SCAN_RATE_LIMIT, SCAN_RATE_WINDOW))) {
      return rateLimitedResponse();
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Image scanning is not configured.' }, { status: 503 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { image, destination } = (body ?? {}) as { image?: unknown; destination?: unknown };
    if (typeof image !== 'string' || !image) {
      return NextResponse.json({ error: 'Missing "image".' }, { status: 400 });
    }

    const match = image.match(DATA_URL_RE);
    if (!match) {
      return NextResponse.json({ error: 'Image must be a base64 data URL (jpeg, png, webp, or gif).' }, { status: 400 });
    }
    const [, mediaType, base64Data] = match;
    if (!ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return NextResponse.json({ error: 'Unsupported image type.' }, { status: 400 });
    }
    // Rough byte-size check from base64 length (each 4 chars ≈ 3 bytes).
    if (base64Data.length * 0.75 > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image is too large (max 8 MB).' }, { status: 413 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

    const message = await client.messages.create({
      model: modelName,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64Data },
            },
            {
              type: 'text',
              text: buildExtractionPrompt(typeof destination === 'string' ? destination : ''),
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    const raw = block?.type === 'text' ? block.text : '';
    const items = parseItems(raw);

    return NextResponse.json({ items });
  } catch (err) {
    console.error('[scan-notes] failed:', err);
    return NextResponse.json({ error: 'Could not read that image — try a clearer photo.' }, { status: 500 });
  }
}
