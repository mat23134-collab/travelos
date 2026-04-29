import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.includes('your_')) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not configured. Add it to .env.local.' },
      { status: 500 }
    );
  }

  let profile: TravelerProfile;
  try {
    profile = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!profile.destination) {
    return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
  }

  // Three-phase chain-of-thought search: trend research → blog mining → contradiction detection
  const classifiedResults = await runChainOfThoughtSearch(profile).catch(() => []);

  // Hotel search: only runs when the user hasn't pre-booked a hotel
  let hotelContext: string | undefined;
  if (!profile.hotelBooked?.trim()) {
    try {
      const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
      const query = `best ${accommodation} ${profile.destination} ${profile.budget} neighborhood review 2025 2026`;
      const results = await searchWeb(query);
      if (results.length > 0) {
        hotelContext = results
          .slice(0, 4)
          .map((r) => `• ${r.title}: ${r.snippet.slice(0, 220)}`)
          .join('\n');
      }
    } catch { /* non-critical — fall through to AI expertise */ }
  }

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: buildUserPrompt(profile, classifiedResults, hotelContext) }],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response type from AI' }, { status: 500 });
    }

    // ── Safety clean ────────────────────────────────────────────────────────────
    // Strip all markdown fences, BOM, and surrounding whitespace before parsing.
    const raw = content.text;
    const cleaned = raw
      .replace(/^﻿/, '')                    // BOM
      .replace(/^```(?:json)?\s*/i, '')          // opening fence
      .replace(/\s*```\s*$/i, '')                // closing fence
      .replace(/```(?:json)?\s*/gi, '')          // any embedded fences
      .trim();

    // ── Extract outermost { … } block ──────────────────────────────────────────
    const start = cleaned.indexOf('{');
    const end   = cleaned.lastIndexOf('}');
    const jsonText = (start !== -1 && end > start)
      ? cleaned.slice(start, end + 1)
      : cleaned;

    // ── Parse with repair fallback ───────────────────────────────────────────────
    let itinerary;
    try {
      itinerary = JSON.parse(jsonText);
    } catch (parseErr) {
      // Log enough detail to diagnose the problem without flooding the terminal.
      const pos = (parseErr as SyntaxError).message.match(/position (\d+)/)?.[1];
      console.error(
        `[generate] JSON parse failed — raw length: ${raw.length} chars` +
        (pos ? `, error near position ${pos}` : '') +
        `\nFirst 300 chars: ${raw.slice(0, 300)}` +
        `\nLast 300 chars:  ${raw.slice(-300)}`
      );

      // Repair attempt: find the last complete top-level closing brace
      // by walking backwards until JSON.parse stops throwing.
      let repaired: unknown = null;
      for (let i = jsonText.length - 1; i > 0; i--) {
        if (jsonText[i] === '}') {
          try {
            repaired = JSON.parse(jsonText.slice(0, i + 1));
            console.warn(`[generate] Repaired JSON by truncating at position ${i}`);
            break;
          } catch { /* keep walking */ }
        }
      }

      if (!repaired) {
        return NextResponse.json(
          { error: `Malformed AI response (length ${raw.length}). Check server logs for details.` },
          { status: 500 }
        );
      }
      itinerary = repaired;
    }

    itinerary._meta = {
      searchEnabled: classifiedResults.length > 0,
      sourcesFound: classifiedResults.length,
      hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
      trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
      contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
    };

    // ── Persist to Supabase ────────────────────────────────────────────────────
    // Profile is stored inside the itinerary JSONB so the [id] route can
    // reconstruct the full view without a separate table join.
    let savedId: string | null = null;
    try {
      const hotelInfo =
        itinerary.basecamp?.booked?.name ??
        itinerary.basecamp?.recommendations?.[0]?.name ??
        null;

      const { data: saved, error: dbErr } = await supabase
        .from('itineraries')
        .insert({
          destination: itinerary.destination ?? null,
          hotel_info: hotelInfo,
          itinerary: { ...itinerary, _profile: profile },
        })
        .select('id')
        .single();

      if (!dbErr && saved) savedId = saved.id as string;
    } catch { /* non-critical — still return itinerary even if DB save fails */ }

    return NextResponse.json(savedId ? { id: savedId, ...itinerary } : itinerary);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: `AI generation failed: ${message}` }, { status: 500 });
  }
}
