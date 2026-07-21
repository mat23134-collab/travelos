/**
 * /api/scan-notes — Vision-powered extraction from an uploaded photo. Two modes:
 *
 *   POST { image, destination?, mode?: 'ideas' }  (default)
 *     → { items: string[] } — trip ideas from a handwritten list / screenshot,
 *       fed into "Our Picks" must-haves. (Original behavior, unchanged.)
 *
 *   POST { image, mode: 'confirmation' }
 *     → { confirmation: {...} } — structured fields parsed from a flight/hotel/
 *       ticket confirmation (type, date, time, confirmation number, place name)
 *       so the Trip Binder can PROPOSE filing it to the matching day/stop. The
 *       client always shows the parse for confirmation before filing — this
 *       route never files anything itself.
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

const CONFIRMATION_DOC_TYPES = new Set(['flight', 'hotel', 'ticket', 'reservation', 'other']);

export interface ParsedConfirmation {
  docType: 'flight' | 'hotel' | 'ticket' | 'reservation' | 'other';
  title: string;
  placeName: string | null;   // hotel / restaurant / attraction / airline — used for day+name matching
  date: string | null;        // ISO YYYY-MM-DD (the single most relevant date)
  time: string | null;        // HH:MM 24h
  confirmationNumber: string | null;
  vendor: string | null;      // airline / hotel chain / booking platform
  totalPrice: number | null;  // total amount charged (whole stay / booking), if shown
  currency: string | null;    // ISO code for totalPrice, e.g. "ILS", "JPY", "EUR"
}

function buildConfirmationPrompt(): string {
  return [
    'This image is a travel booking confirmation — a flight, hotel, attraction ticket, restaurant/tour reservation, or similar (screenshot, email, or PDF page).',
    'Extract its key details as ONE JSON object with EXACTLY these keys:',
    '{',
    '  "docType": one of "flight" | "hotel" | "ticket" | "reservation" | "other",',
    '  "title": a short human label, e.g. "El Al LY383 TLV→FCO" or "Hotel Artemide, Rome",',
    '  "placeName": the name to match against an itinerary — hotel name, restaurant, attraction, or destination CITY for a flight (arrival city); null if unknown,',
    '  "date": the single most relevant date as "YYYY-MM-DD" (flight: departure date; hotel: check-in date; ticket/reservation: the visit date); null if not shown,',
    '  "time": start/departure/check-in time as 24h "HH:MM"; null if not shown,',
    '  "confirmationNumber": the booking/PNR/reservation code exactly as printed; null if none,',
    '  "vendor": airline, hotel chain, or platform name; null if unknown,',
    '  "totalPrice": the TOTAL amount charged for the whole booking as a plain number (no currency symbol, no thousands separators); null if not shown,',
    '  "currency": the ISO 4217 code for totalPrice, e.g. "ILS" | "JPY" | "EUR" | "USD"; null if unknown',
    '}',
    'Rules: infer the year from context; if only day+month appear, use the nearest sensible future year. For totalPrice use the grand total (whole stay / entire booking), not a per-night rate. Do NOT invent a confirmation number or a price. Reply with ONLY the JSON object — no markdown, no commentary.',
  ].join('\n');
}

function parseConfirmation(raw: string): ParsedConfirmation | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try { obj = JSON.parse(m[0]); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const dt = str(o.docType)?.toLowerCase() ?? 'other';
  const docType = (CONFIRMATION_DOC_TYPES.has(dt) ? dt : 'other') as ParsedConfirmation['docType'];
  // Normalize the date to strict YYYY-MM-DD if it parses; else keep null.
  let date = str(o.date);
  if (date) {
    const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    date = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  }
  let time = str(o.time);
  if (time) {
    const m = time.match(/^(\d{1,2}):(\d{2})/);
    time = m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
  }
  const rawPrice = typeof o.totalPrice === 'number' ? o.totalPrice
    : typeof o.totalPrice === 'string' ? Number(o.totalPrice.replace(/[^\d.]/g, ''))
    : NaN;
  const totalPrice = Number.isFinite(rawPrice) && rawPrice > 0 ? Math.round(rawPrice * 100) / 100 : null;
  const currency = (() => {
    const c = str(o.currency);
    return c && /^[A-Za-z]{3}$/.test(c) ? c.toUpperCase() : null;
  })();
  return {
    docType,
    title: str(o.title) ?? 'Booking confirmation',
    placeName: str(o.placeName),
    date,
    time,
    confirmationNumber: str(o.confirmationNumber),
    vendor: str(o.vendor),
    totalPrice,
    currency,
  };
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

    const { image, destination, mode } = (body ?? {}) as { image?: unknown; destination?: unknown; mode?: unknown };
    if (typeof image !== 'string' || !image) {
      return NextResponse.json({ error: 'Missing "image".' }, { status: 400 });
    }
    const isConfirmation = mode === 'confirmation';

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
              text: isConfirmation
                ? buildConfirmationPrompt()
                : buildExtractionPrompt(typeof destination === 'string' ? destination : ''),
            },
          ],
        },
      ],
    });

    const block = message.content[0];
    const raw = block?.type === 'text' ? block.text : '';

    if (isConfirmation) {
      const confirmation = parseConfirmation(raw);
      if (!confirmation) {
        return NextResponse.json({ error: "Couldn't read a booking from that image — try a clearer shot." }, { status: 422 });
      }
      return NextResponse.json({ confirmation });
    }

    const items = parseItems(raw);
    return NextResponse.json({ items });
  } catch (err) {
    console.error('[scan-notes] failed:', err);
    return NextResponse.json({ error: 'Could not read that image — try a clearer photo.' }, { status: 500 });
  }
}
