import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { TravelerProfile, ClassifiedResult } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';

// ── JSON instruction prepended to every system prompt ────────────────────────

const JSON_PREAMBLE =
  'IMPORTANT: Your output MUST be a raw JSON object only. ' +
  'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
  'Start your response immediately with { and end with }. ' +
  'Your response must be a COMPLETE, valid JSON object. ' +
  'Always close every array bracket and every object brace before finishing. ';

// ── JSON parser ───────────────────────────────────────────────────────────────

function parseAIJson(rawText: string): unknown {
  const text = rawText.trim();
  // Fast path — already clean JSON
  try { return JSON.parse(text); } catch { /* fall through */ }
  // Strict extraction: first { to last } (handles any preamble / postamble
  // that Claude occasionally emits before the opening brace, and any trailing
  // prose after the closing brace — common with large payloads).
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in AI response. Preview: ' + text.slice(0, 300));
  }
  return JSON.parse(text.slice(start, end + 1));
}

// ── Retry helper (handles 529 overload / 529 / rate-limit) ───────────────────

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('529') ||
    msg.includes('503') ||
    msg.includes('429') ||
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('service unavailable') ||
    msg.toLowerCase().includes('rate limit')
  );
}

async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const delay = attempt * 2000;
      console.warn(`[generate] Claude transient error — retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── Claude call ───────────────────────────────────────────────────────────────

async function callClaude(
  profile: TravelerProfile,
  classifiedResults: ClassifiedResult[],
  hotelContext: string | undefined,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to Railway Variables');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  console.log(`[generate] Claude ${modelName} — key prefix: ${process.env.ANTHROPIC_API_KEY.slice(0, 8)}`);

  const message = await client.messages.create({
    model: modelName,
    max_tokens: 16000,
    system: JSON_PREAMBLE + SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: buildUserPrompt(profile, classifiedResults, hotelContext) },
    ],
  });

  const block = message.content[0];
  const raw = block.type === 'text' ? block.text : '';
  console.log(`[generate] Claude response: ${raw.length} chars | stop_reason: ${message.stop_reason}`);
  return raw;
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const profile: TravelerProfile = await req.json();

    if (!profile.destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    // ── RAG search ──────────────────────────────────────────────────────────────
    const classifiedResults = await runChainOfThoughtSearch(profile).catch(() => []);

    let hotelContext: string | undefined;
    if (!profile.hotelBooked?.trim()) {
      try {
        const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
        const query = 'best ' + accommodation + ' ' + profile.destination + ' ' + profile.budget + ' neighborhood review 2025 2026';
        const results = await searchWeb(query);
        if (results.length > 0) {
          hotelContext = results
            .slice(0, 4)
            .map((r) => '- ' + r.title + ': ' + r.snippet.slice(0, 220))
            .join('\n');
        }
      } catch { /* non-critical */ }
    }

    // ── Generate itinerary ──────────────────────────────────────────────────────
    const raw = await withRetry(() => callClaude(profile, classifiedResults, hotelContext));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const itinerary: any = parseAIJson(raw);

    // ── Metadata ────────────────────────────────────────────────────────────────
    itinerary._meta = {
      searchEnabled: classifiedResults.length > 0,
      sourcesFound: classifiedResults.length,
      hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
      trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
      contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
      provider: 'claude',
    };

    // ── Save to Supabase ────────────────────────────────────────────────────────
    const hotelInfo =
      itinerary.basecamp?.booked?.name ??
      itinerary.basecamp?.recommendations?.[0]?.name ??
      null;

    // Normalise start_date: accept ISO string or "YYYY-MM-DD", coerce to date-only
    const rawDate = profile.startDate?.trim();
    const startDate = rawDate ? rawDate.slice(0, 10) : null;   // "YYYY-MM-DD" or null

    const { data, error: dbErr } = await supabase
      .from('itineraries')
      .insert([{
        destination:      itinerary.destination || profile.destination,
        destination_city: itinerary.destination || profile.destination,
        start_date:       startDate,
        hotel_info:       hotelInfo,
        itinerary_json:   { ...itinerary, _profile: profile },
      }])
      .select('id')
      .single();

    if (dbErr) {
      console.error('[generate] Supabase insert error:', dbErr.message);
      return NextResponse.json({ error: 'Database error: ' + dbErr.message }, { status: 500 });
    }

    console.log('[generate] saved row id:', data.id);
    return NextResponse.json({ id: data.id, itinerary });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] error:', msg);
    return NextResponse.json({ error: 'Generation failed', details: msg }, { status: 500 });
  }
}
