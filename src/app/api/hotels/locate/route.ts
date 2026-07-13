/**
 * POST /api/hotels/locate — resolve a hotel to coordinates for "Hotel as base".
 *
 * Body: { near: string, query?: string, image?: dataURL }
 *   - query: a typed hotel name / address.
 *   - image: a photo of the hotel (sign, booking screenshot) — we read the name
 *     off it with vision, then resolve that.
 *
 * Resolution prefers Google Places Find Place (it knows hotels by their branded
 * names, which OSM/Nominatim usually doesn't), falling back to Nominatim scoped
 * to the trip city when no Google key is configured.
 *
 * Returns { result: { name, address, lat, lng, photoUrl } | null, from?: string }.
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPlaceOnGoogle } from '@/lib/placeVerification';
import { checkRateLimitDurable, getClientIp, rateLimitedResponse } from '@/lib/apiGuard';

export const dynamic = 'force-dynamic';

const RATE_LIMIT = 20;
const RATE_WINDOW = 10 * 60 * 1000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const DATA_URL_RE = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$/;

interface LocateResult {
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  photoUrl?: string | null;
}

/** Read the hotel/accommodation name off an uploaded photo via vision. */
async function nameFromImage(mediaType: string, base64: string, near: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  const msg = await client.messages.create({
    model,
    max_tokens: 80,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif', data: base64 } },
        {
          type: 'text',
          text: `This photo shows a hotel or accommodation${near ? ` in ${near}` : ''} (a sign, facade, or booking screenshot). Reply with ONLY the hotel's name as plain text — no quotes, no extra words. If you can't read a hotel name, reply with exactly NONE.`,
        },
      ],
    }],
  });
  const block = msg.content[0];
  const text = block?.type === 'text' ? block.text.trim() : '';
  if (!text || /^none$/i.test(text)) return null;
  return text.replace(/^["']|["']$/g, '').slice(0, 120);
}

/** Nominatim fallback (only used when Google Places isn't configured). */
async function nominatimLocate(query: string, near: string): Promise<LocateResult | null> {
  const q = near ? `${query}, ${near}` : query;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Sarto-Travel-App/1.0 (contact@sarto.app)', 'Accept-Language': 'en' } });
    if (!res.ok) return null;
    const rows = await res.json();
    const r = Array.isArray(rows) ? rows[0] : null;
    if (!r) return null;
    const lat = parseFloat(r.lat); const lng = parseFloat(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { name: String(r.display_name).split(',')[0]?.trim() || query, address: r.display_name ?? null, lat, lng, photoUrl: null };
  } catch {
    return null;
  }
}

async function locate(query: string, near: string): Promise<LocateResult | null> {
  if (process.env.GOOGLE_PLACES_API_KEY) {
    const g = await verifyPlaceOnGoogle(query, near);
    if (g.found && typeof g.latitude === 'number' && typeof g.longitude === 'number') {
      return {
        name: g.name ?? query,
        address: g.formattedAddress ?? null,
        lat: g.latitude,
        lng: g.longitude,
        photoUrl: g.photoUrl ?? null,
      };
    }
  }
  return nominatimLocate(query, near);
}

export async function POST(req: NextRequest) {
  if (!(await checkRateLimitDurable(`hotel-locate:${getClientIp(req)}`, RATE_LIMIT, RATE_WINDOW))) return rateLimitedResponse();

  let body: { near?: unknown; query?: unknown; image?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const near = typeof body.near === 'string' ? body.near.trim() : '';
  let query = typeof body.query === 'string' ? body.query.trim() : '';
  let from: string | undefined;

  // Photo path — read the hotel name off the image first.
  if (!query && typeof body.image === 'string') {
    const m = body.image.match(DATA_URL_RE);
    if (!m) return NextResponse.json({ error: 'Image must be a base64 data URL.' }, { status: 400 });
    const [, mediaType, base64] = m;
    if (base64.length * 0.75 > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image too large (max 8 MB).' }, { status: 413 });
    const name = await nameFromImage(mediaType, base64, near).catch(() => null);
    if (!name) return NextResponse.json({ result: null, from: null });
    query = name;
    from = name;
  }

  if (!query || query.length < 2) return NextResponse.json({ error: 'query or image required.' }, { status: 400 });

  const result = await locate(query, near);
  return NextResponse.json({ result, from });
}
