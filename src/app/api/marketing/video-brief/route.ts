import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabaseService';
import { verifySession, unauthorizedResponse, checkRateLimit, getClientIp, rateLimitedResponse } from '@/lib/apiGuard';
import { callGeminiJson } from '@/lib/scoutShared';
import {
  buildMarketingBrief,
  buildVideoBriefUser,
  parseVideoScript,
  DEFAULT_CHARACTER,
  VIDEO_BRIEF_SYSTEM,
} from '@/lib/marketing/videoBrief';
import type { Itinerary, TravelerProfile } from '@/lib/types';

/**
 * POST /api/marketing/video-brief
 * Body: { itineraryId: string, character?: string }
 *
 * Extracts a marketing brief from a saved trip and returns a structured,
 * shot-by-shot AI video script (AdCreative.ai style, explorer character who
 * points + smiles). Uses the existing AI layer — Gemini JSON, Claude fallback.
 * The returned `script` is the render config for an image-to-video API.
 */

const isUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function callClaudeJson(system: string, user: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: `${user}\n\nReturn ONLY the JSON object.` }],
  });
  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('Unexpected Claude response');
  return block.text;
}

export async function POST(req: NextRequest) {
  const userId = await verifySession(req);
  if (!userId) return unauthorizedResponse();

  const ip = getClientIp(req);
  if (!checkRateLimit(`video-brief:${ip}`, 8, 60_000)) return rateLimitedResponse();

  const body = (await req.json().catch(() => null)) as { itineraryId?: string; character?: string } | null;
  const itineraryId = body?.itineraryId?.trim() ?? '';
  if (!isUuid(itineraryId)) {
    return NextResponse.json({ error: 'Valid itineraryId is required.' }, { status: 400 });
  }
  const character = typeof body?.character === 'string' && body.character.trim()
    ? body.character.trim().slice(0, 300)
    : DEFAULT_CHARACTER;

  const db = createServiceRoleClient();
  if (!db) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 });

  const { data, error } = await db
    .from('itineraries')
    .select('itinerary_json, profile_json')
    .eq('id', itineraryId)
    .single();
  if (error || !data?.itinerary_json) {
    return NextResponse.json({ error: 'Trip not found.' }, { status: 404 });
  }

  const brief = buildMarketingBrief(
    data.itinerary_json as Itinerary,
    (data.profile_json as TravelerProfile) ?? null,
  );
  const userPrompt = buildVideoBriefUser(brief, character);

  // Gemini first, Claude fallback — same posture as /api/generate.
  let raw = '';
  let provider: 'gemini' | 'claude' = 'gemini';
  try {
    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        raw = await callGeminiJson(VIDEO_BRIEF_SYSTEM, userPrompt, { temperature: 0.6, maxOutputTokens: 4096 });
      } catch (gErr) {
        console.warn('[video-brief] Gemini failed, falling back to Claude:', gErr instanceof Error ? gErr.message : gErr);
        raw = await callClaudeJson(VIDEO_BRIEF_SYSTEM, userPrompt);
        provider = 'claude';
      }
    } else {
      raw = await callClaudeJson(VIDEO_BRIEF_SYSTEM, userPrompt);
      provider = 'claude';
    }
  } catch (e) {
    console.error('[video-brief] both providers failed:', e);
    return NextResponse.json({ error: 'Could not generate the video brief.' }, { status: 502 });
  }

  let script = parseVideoScript(raw);
  if (!script && provider === 'gemini') {
    // Gemini returned unparseable output — one Claude retry.
    try { script = parseVideoScript(await callClaudeJson(VIDEO_BRIEF_SYSTEM, userPrompt)); provider = 'claude'; }
    catch { /* fall through */ }
  }
  if (!script) {
    return NextResponse.json({ error: 'The video brief was malformed. Please try again.' }, { status: 502 });
  }

  return NextResponse.json({ brief, script, provider });
}
