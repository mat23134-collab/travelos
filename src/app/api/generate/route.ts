import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TravelerProfile, ClassifiedResult, type Activity, type DiningSpot } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';
import { queryPlacesForCity, formatPlacesForPrompt } from '@/lib/places';
import { batchVerifyPlaces } from '@/lib/verification';
import { normalizeBasecampHotels } from '@/lib/hotelNormalize';
import { classifyActivity } from '@/lib/activityGenre';
import { resolveAuthenticatedTraveler } from '@/lib/resolveAuthUser';
import { ensureTransportationForCity, persistTripSessionRow } from '@/lib/tripTransport';
import {
  GENERATE_PREFETCH_PER_BRANCH_MS,
  GENERATE_LLM_FETCH_MS,
  GENERATE_LLM_MAX_ATTEMPTS,
} from '@/lib/generateBudget';

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
      const delay = Math.min(3500, attempt * 1000);
      console.warn(`[generate] LLM transient error — retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Resolve after `ms` with `fallback` if `promise` is still pending — keeps prefetch under budget. */
function withPrefetchTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    promise.catch((err) => {
      console.warn(`[generate] ${label} failed (non-critical):`, err instanceof Error ? err.message : err);
      return fallback;
    }),
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`[generate] ${label} timed out after ${ms}ms — continuing without this block`);
        resolve(fallback);
      }, ms);
    }),
  ]);
}

function toTimeOnly(time?: string): string | null {
  if (!time) return null;
  const m = time.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}:${m[2]}:00`;
}

function toIsoDateTime(date?: string, time?: string): string | null {
  if (!date || !time) return null;
  const d = date.slice(0, 10);
  const m = time.match(/^(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${d}T${m[1]}:${m[2]}:00Z`;
}

function dropMissingColumnFromRow(row: Record<string, unknown>, errorMessage: string): boolean {
  const missingCol = errorMessage.match(/Could not find the '([^']+)' column/)?.[1];
  if (!missingCol || !(missingCol in row)) return false;
  delete row[missingCol];
  return true;
}

/** Prefer service-role client so POST /api/generate is not blocked by RLS (anon has no JWT). */
function createDbWriteClient() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (supabaseUrl && serviceKey) {
    return createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}

type PlaceSeed = {
  city: string;
  name: string;
  category: string;
  description: string;
  lat: number;
  lng: number;
  category_emoji: string;
  social_proof_url: string | null;
  vibe_label: string;
};

function activityToPlaceSeed(
  city: string,
  activity: Activity,
  slot: 'morning' | 'afternoon' | 'evening',
): PlaceSeed | null {
  const name = typeof activity.name === 'string' ? activity.name.trim() : '';
  const lat = Number(activity.latitude);
  const lng = Number(activity.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const genre = classifyActivity(activity);
  const category =
    genre === 'food'
      ? 'restaurant'
      : genre === 'shopping'
        ? 'market'
        : genre === 'nightlife'
          ? 'bar'
          : 'attraction';

  const descriptionRaw =
    (typeof activity.description === 'string' && activity.description) ||
    (typeof activity.whyThis === 'string' && activity.whyThis) ||
    `Suggested ${slot} ${category} in ${city}`;

  return {
    city,
    name,
    category,
    description: descriptionRaw.slice(0, 500),
    lat,
    lng,
    category_emoji: typeof activity.category_emoji === 'string' ? activity.category_emoji : '📍',
    social_proof_url: null,
    vibe_label: typeof activity.vibeLabel === 'string' ? activity.vibeLabel : 'local-favorite',
  };
}

function diningToPlaceSeed(
  city: string,
  spot: DiningSpot,
  meal: 'breakfast' | 'lunch' | 'dinner',
): PlaceSeed | null {
  const name = typeof spot.name === 'string' ? spot.name.trim() : '';
  const lat = Number(spot.latitude);
  const lng = Number(spot.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const cuisine = typeof spot.cuisine === 'string' ? spot.cuisine.trim() : '';
  const mustTry = typeof spot.mustTry === 'string' ? spot.mustTry.trim() : '';
  const description = [mustTry && `Must try: ${mustTry}`, cuisine && `Cuisine: ${cuisine}`]
    .filter(Boolean)
    .join(' · ') || `Recommended ${meal} spot in ${city}`;

  return {
    city,
    name,
    category: meal === 'breakfast' ? 'cafe' : 'restaurant',
    description: description.slice(0, 500),
    lat,
    lng,
    category_emoji: meal === 'breakfast' ? '☕' : meal === 'lunch' ? '🍽️' : '🌙',
    social_proof_url: null,
    vibe_label: 'local-favorite',
  };
}

function collectPlaceSeeds(itineraryObj: Record<string, unknown>, city: string): PlaceSeed[] {
  const days = Array.isArray(itineraryObj.days) ? itineraryObj.days : [];
  const seeds: PlaceSeed[] = [];

  for (const d of days) {
    const day = (d ?? {}) as Record<string, unknown>;
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const act = day[slot];
      if (act && typeof act === 'object') {
        const seed = activityToPlaceSeed(city, act as Activity, slot);
        if (seed) seeds.push(seed);
      }
    }
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const spot = day[meal];
      if (spot && typeof spot === 'object') {
        const seed = diningToPlaceSeed(city, spot as DiningSpot, meal);
        if (seed) seeds.push(seed);
      }
    }
  }

  const seen = new Set<string>();
  return seeds.filter((s) => {
    const key = `${s.city.toLowerCase()}__${s.name.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function persistNewPlacesFromItinerary(itineraryObj: Record<string, unknown>, cityRaw: string): Promise<void> {
  const city = cityRaw.trim();
  if (!city) return;
  const placeSeeds = collectPlaceSeeds(itineraryObj, city);
  if (placeSeeds.length === 0) return;

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const writeClient = supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : supabase;
  if (!serviceKey) {
    console.warn('[generate] places sync using anon client (no SUPABASE_SERVICE_ROLE_KEY)');
  }

  let inserted = 0;
  let skipped = 0;
  for (const seed of placeSeeds) {
    const { data: existing, error: selErr } = await writeClient
      .from('places')
      .select('id')
      .ilike('name', seed.name)
      .ilike('city', seed.city)
      .maybeSingle();

    if (selErr) {
      console.warn(`[generate] places select skipped for "${seed.name}": ${selErr.message}`);
      continue;
    }
    if (existing) {
      skipped++;
      continue;
    }

    const { error: insErr } = await writeClient.from('places').insert(seed);
    if (insErr) {
      console.warn(`[generate] places insert skipped for "${seed.name}": ${insErr.message}`);
      continue;
    }
    inserted++;
  }
  console.log(`[generate] places sync: inserted ${inserted}, skipped ${skipped}`);
}

// ── Gemini call (primary) ─────────────────────────────────────────────────────

type GeminiGenerateBody = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

async function callGemini(userPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemText = JSON_PREAMBLE + SYSTEM_PROMPT;
  console.log(`[generate] Gemini ${modelName} — key prefix: ${apiKey.slice(0, 8)}`);

  const ac = new AbortController();
  const tid = setTimeout(() => ac.abort(), GENERATE_LLM_FETCH_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemText }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.35,
          maxOutputTokens: (() => {
            const n = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS);
            return Number.isFinite(n) && n > 0 ? n : 16384;
          })(),
          responseMimeType: 'application/json',
        },
      }),
    });
  } finally {
    clearTimeout(tid);
  }

  const errBody = !res.ok ? await res.text() : '';
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${errBody.slice(0, 600)}`);
  }

  const data = (await res.json()) as GeminiGenerateBody;

  if (data.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  }

  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no candidates');

  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') {
    throw new Error(`Gemini finish: ${cand.finishReason}`);
  }

  const parts = cand.content?.parts ?? [];
  const raw = parts.map((p) => p.text ?? '').join('').trim();
  if (!raw) throw new Error('Gemini returned empty text');

  console.log(
    `[generate] Gemini response: ${raw.length} chars | finishReason: ${cand.finishReason ?? 'UNKNOWN'}`,
  );
  return raw;
}

// ── Claude call (fallback) ───────────────────────────────────────────────────

async function callClaude(userPrompt: string): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set — add it to Railway Variables');
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const modelName = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  console.log(`[generate] Claude ${modelName} — key prefix: ${process.env.ANTHROPIC_API_KEY.slice(0, 8)}`);

  const message = await client.messages.create(
    {
      model: modelName,
      max_tokens: 16000,
      system: JSON_PREAMBLE + SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    },
    { timeout: GENERATE_LLM_FETCH_MS },
  );

  const block = message.content[0];
  const raw = block.type === 'text' ? block.text : '';
  console.log(`[generate] Claude response: ${raw.length} chars | stop_reason: ${message.stop_reason}`);
  return raw;
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const bodyObj = body as TravelerProfile & { userId?: string | null };
    let userId: string | null = bodyObj.userId ?? null;
    const { userId: _u, ...profile } = bodyObj;

    if (!profile.destination) {
      return NextResponse.json({ error: 'Destination is required' }, { status: 400 });
    }

    // ── All pre-AI I/O in parallel ──────────────────────────────────────────────
    // queryPlacesForCity (Supabase) + runChainOfThoughtSearch (Tavily/Exa)
    // + hotel searchWeb all fire simultaneously — total wait = slowest of
    // the three, not the sum. Saves ~20-30s vs the prior sequential version.
    const hotelQuery = !profile.hotelBooked?.trim()
      ? (() => {
          const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
          const dest = profile.destination.trim();
          const dates =
            profile.startDate?.slice(0, 10) && profile.endDate?.slice(0, 10)
              ? `${profile.startDate.slice(0, 10)} to ${profile.endDate.slice(0, 10)}`
              : '';
          return [
            accommodation, 'hotel', dest, profile.budget, dates,
            'Booking.com Expedia price per night availability',
            dates ? 'rooms available' : '', '2026',
          ].filter(Boolean).join(' ');
        })()
      : null;

    const [scoutedPlaces, classifiedResults, rawHotelResults] = await Promise.all([
      withPrefetchTimeout(
        queryPlacesForCity(profile.destination).catch((err) => {
          console.warn('[generate] Hybrid RAG query failed (non-critical):', err);
          return [] as Awaited<ReturnType<typeof queryPlacesForCity>>;
        }),
        GENERATE_PREFETCH_PER_BRANCH_MS,
        [] as Awaited<ReturnType<typeof queryPlacesForCity>>,
        'places prefetch',
      ),
      withPrefetchTimeout(
        runChainOfThoughtSearch(profile).catch(() => [] as ClassifiedResult[]),
        GENERATE_PREFETCH_PER_BRANCH_MS,
        [] as ClassifiedResult[],
        'web RAG prefetch',
      ),
      hotelQuery
        ? withPrefetchTimeout(
            searchWeb(hotelQuery).catch(() => []),
            GENERATE_PREFETCH_PER_BRANCH_MS,
            [] as Awaited<ReturnType<typeof searchWeb>>,
            'hotel search prefetch',
          )
        : Promise.resolve([]),
    ]);

    let internalPlaces: string | undefined;
    if (scoutedPlaces.length > 0) {
      internalPlaces = formatPlacesForPrompt(scoutedPlaces);
      console.log(`[generate] Hybrid RAG: injecting ${scoutedPlaces.length} scouted places for ${profile.destination}`);
    } else {
      console.log(`[generate] Hybrid RAG: no pre-scouted places found for ${profile.destination}`);
    }

    let hotelContext: string | undefined;
    if (rawHotelResults.length > 0) {
      hotelContext = rawHotelResults
        .slice(0, 5)
        .map((r) => '- ' + r.title + ': ' + r.snippet.slice(0, 280))
        .join('\n');
    }

    // ── Generate itinerary: Gemini first, Claude fallback ───────────────────────
    const userPrompt = buildUserPrompt(profile, classifiedResults, hotelContext, internalPlaces);

    let raw: string;
    let provider: 'gemini' | 'claude';

    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        raw = await withRetry(() => callGemini(userPrompt), GENERATE_LLM_MAX_ATTEMPTS);
        provider = 'gemini';
      } catch (geminiErr) {
        console.warn(
          '[generate] Gemini failed — falling back to Claude:',
          geminiErr instanceof Error ? geminiErr.message : geminiErr,
        );
        raw = await withRetry(() => callClaude(userPrompt), GENERATE_LLM_MAX_ATTEMPTS);
        provider = 'claude';
      }
    } else {
      console.log('[generate] GEMINI_API_KEY not set — using Claude only');
      raw = await withRetry(() => callClaude(userPrompt), GENERATE_LLM_MAX_ATTEMPTS);
      provider = 'claude';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itinerary: any;
    try {
      itinerary = parseAIJson(raw);
    } catch (parseErr) {
      if (provider === 'gemini') {
        console.warn(
          '[generate] Gemini JSON parse failed — falling back to Claude:',
          parseErr instanceof Error ? parseErr.message : parseErr,
        );
        raw = await withRetry(() => callClaude(userPrompt), GENERATE_LLM_MAX_ATTEMPTS);
        provider = 'claude';
        itinerary = parseAIJson(raw);
      } else {
        throw parseErr;
      }
    }

    normalizeBasecampHotels(itinerary.basecamp);

    // ── JIT Verification Shield ─────────────────────────────────────────────────
    // Run Exa highlights checks on every selected activity in parallel.
    // Non-blocking: errors are caught per-place; shield never fails the request.
    const exaKey = process.env.EXA_API_KEY;
    let jitChecked = 0;
    let jitFlagged = 0;

    if (exaKey) {
      try {
        // Collect all (day, slot, activity) triples that have a name
        type ActivityRef = { dayIdx: number; slot: 'morning' | 'afternoon' | 'evening'; name: string };
        const refs: ActivityRef[] = [];

        for (let di = 0; di < (itinerary.days ?? []).length; di++) {
          const day = itinerary.days[di];
          for (const slot of ['morning', 'afternoon', 'evening'] as const) {
            const act = day?.[slot];
            if (act?.name) refs.push({ dayIdx: di, slot, name: act.name });
          }
        }

        if (refs.length > 0) {
          const results = await batchVerifyPlaces(
            refs.map((r) => ({ name: r.name, city: profile.destination })),
            exaKey,
            7000, // 7-second wall-clock cap for the whole batch
          );

          results.forEach((vr, i) => {
            const { dayIdx, slot } = refs[i];
            const act = itinerary.days[dayIdx]?.[slot];
            if (!act) return;
            act.verificationStatus = vr.status;
            act.verifiedAt         = vr.checkedAt;
            if (vr.signal) act.verificationSignal = vr.signal;
            jitChecked++;
            if (vr.status === 'flagged-closed' || vr.status === 'flagged-renovating') jitFlagged++;
          });

          console.log(`[generate] JIT Shield: ${jitChecked} checked, ${jitFlagged} flagged`);
        }
      } catch (err) {
        console.warn('[generate] JIT Shield failed (non-critical):', err instanceof Error ? err.message : err);
      }
    } else {
      console.log('[generate] JIT Shield: skipped (EXA_API_KEY not set)');
    }

    // ── Normalise coordinates → always store as numbers ─────────────────────────
    // Claude occasionally returns lat/lng as JSON strings ("41.9028") instead of
    // floats. Coerce every coordinate field so stored data is always numeric.
    for (const day of (itinerary.days ?? [])) {
      // Activity slots
      for (const slot of ['morning', 'afternoon', 'evening'] as const) {
        const act = day?.[slot];
        if (act) {
          if (act.latitude  != null) act.latitude  = Number(act.latitude);
          if (act.longitude != null) act.longitude = Number(act.longitude);
        }
      }
      // Dining spots (lunch / dinner have coords as of v1.10.6)
      for (const meal of ['lunch', 'dinner', 'breakfast'] as const) {
        const spot = day?.[meal] as { latitude?: unknown; longitude?: unknown } | undefined;
        if (spot) {
          if (spot.latitude  != null) spot.latitude  = Number(spot.latitude);
          if (spot.longitude != null) spot.longitude = Number(spot.longitude);
        }
      }
    }

    // ── Metadata ────────────────────────────────────────────────────────────────
    itinerary._meta = {
      searchEnabled: classifiedResults.length > 0,
      sourcesFound: classifiedResults.length,
      hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
      trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
      contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
      provider,
      jitVerified: jitChecked,
      jitFlagged,
    };

    const dbWrite = createDbWriteClient();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      console.warn(
        '[generate] SUPABASE_SERVICE_ROLE_KEY unset — DB writes use anon key; strict RLS may block INSERT/UPDATE. Add service role key (server-only) to env.',
      );
    }

    const resolved = await resolveAuthenticatedTraveler(req, dbWrite, userId);
    userId = resolved.userId;
    const travelerUsername = resolved.username;

    // ── Save to Supabase ────────────────────────────────────────────────────────
    const hotelInfo = profile.hotelAddress?.trim()
      ? {
          name: profile.hotelBooked?.trim() || profile.hotelAddress.trim(),
          address: profile.hotelAddress.trim(),
          lat: profile.hotelLat ?? null,
          lng: profile.hotelLng ?? null,
        }
      : itinerary.basecamp?.booked
        ? {
            name: itinerary.basecamp.booked.name ?? null,
            neighborhood: itinerary.basecamp.booked.neighborhood ?? null,
          }
        : itinerary.basecamp?.recommendations?.[0]
          ? {
              name: itinerary.basecamp.recommendations[0].name ?? null,
              neighborhood: itinerary.basecamp.recommendations[0].neighborhood ?? null,
            }
          : null;

    // Normalise start_date: accept ISO string or "YYYY-MM-DD", coerce to date-only
    const rawDate = profile.startDate?.trim();
    const startDate = rawDate ? rawDate.slice(0, 10) : null;   // "YYYY-MM-DD" or null

    // Some deployed DBs may lag behind schema migrations.
    // Retry insert by stripping unknown columns reported by PostgREST.
    const insertRow: Record<string, unknown> = {
      destination:      itinerary.destination || profile.destination,
      destination_city: itinerary.destination || profile.destination,
      start_date:       startDate,
      hotel_info:       hotelInfo,
      squad_vibe:       profile.groupType ?? null,
      profile_json:     profile,
      daily_start_time: toTimeOnly(profile.dailyStartTime),
      arrival_time:     toIsoDateTime(profile.startDate, profile.arrivalTime),
      departure_time:   toIsoDateTime(profile.endDate, profile.departureTime),
      skip_day_1:       !!profile.skipDay1,
      user_id:          userId,   // null when generated anonymously
      itinerary_json:   { ...itinerary, _profile: profile },
    };

    let data: { id: string } | null = null;
    let dbErr: { message: string } | null = null;
    for (let i = 0; i < 8; i++) {
      const attempt = await dbWrite
        .from('itineraries')
        .insert([insertRow])
        .select('id')
        .single();

      data = attempt.data as { id: string } | null;
      dbErr = attempt.error as { message: string } | null;
      if (!dbErr) break;

      const msg = dbErr.message || '';
      const missingCol = msg.match(/Could not find the '([^']+)' column/)?.[1];
      if (!missingCol || !(missingCol in insertRow)) break;
      delete insertRow[missingCol];
      console.warn(`[generate] itineraries insert retry without missing column: ${missingCol}`);
    }

    if (dbErr || !data?.id) {
      console.error('[generate] Supabase insert error:', dbErr?.message ?? 'unknown');
      return NextResponse.json({ error: 'Database error: ' + (dbErr?.message ?? 'unknown') }, { status: 500 });
    }

    const itineraryDbId: string = data.id;

    // Persist hotel anchors for BOTH selected hotel and recommendations.
    // Insert row-by-row so one schema mismatch doesn't drop all rows.
    const hotelAnchorRows: Record<string, unknown>[] = [];
    if (profile.hotelAddress?.trim()) {
      hotelAnchorRows.push({
        itinerary_id: itineraryDbId,
        user_id: userId,
        hotel_name: profile.hotelBooked?.trim() || profile.hotelAddress.trim(),
        address: profile.hotelAddress.trim(),
        lat: profile.hotelLat ?? null,
        lng: profile.hotelLng ?? null,
        source: 'selected',
        is_selected: true,
      });
    }
    const recs = itinerary.basecamp?.recommendations ?? [];
    for (const rec of recs) {
      if (!rec?.name) continue;
      hotelAnchorRows.push({
        itinerary_id: itineraryDbId,
        user_id: userId,
        hotel_name: rec.name,
        address: rec.neighborhood ?? null,
        // Keep coordinates best-effort for legacy schemas where lat/lng are NOT NULL.
        lat: profile.hotelLat ?? null,
        lng: profile.hotelLng ?? null,
        source: 'recommended',
        is_selected: false,
      });
    }
    for (const row of hotelAnchorRows) {
      for (let i = 0; i < 6; i++) {
        const { error: anchorErr } = await dbWrite.from('hotel_anchors').insert(row);
        if (!anchorErr) break;

        const msg  = anchorErr.message ?? '';
        const hint = (anchorErr as { hint?: string }).hint ?? '';
        const code = (anchorErr as { code?: string }).code ?? '';

        // Missing column in schema → strip and retry
        if (dropMissingColumnFromRow(row, msg)) {
          console.warn('[generate] hotel_anchors retry without missing column');
          continue;
        }

        // NOT NULL violation (23502) on lat/lng — null out the offending coordinate
        // and retry. The migration makes lat/lng nullable, but a legacy schema may not.
        if (code === '23502' && (msg.includes('lat') || msg.includes('lng'))) {
          row.lat = 0;
          row.lng = 0;
          console.warn('[generate] hotel_anchors lat/lng NOT NULL — using 0,0 as fallback');
          continue;
        }

        console.warn(
          '[generate] hotel_anchors insert failed (non-critical):',
          msg,
          hint ? `hint: ${hint}` : '',
          code ? `code: ${code}` : '',
        );
        break;
      }
    }

    // Persist step-by-step profile choices for full auditability.
    // Persist one wide row per trip for easy analytics/UI browsing.
    const tripChoiceRow: Record<string, unknown> = {
      user_id: userId,
      itinerary_id: itineraryDbId,
      destination: profile.destination ?? null,
      start_date: profile.startDate ? profile.startDate.slice(0, 10) : null,
      end_date: profile.endDate ? profile.endDate.slice(0, 10) : null,
      trip_times: {
        dailyStartTime: profile.dailyStartTime ?? null,
        arrivalTime: profile.arrivalTime ?? null,
        departureTime: profile.departureTime ?? null,
        skipDay1: !!profile.skipDay1,
      },
      hotel_anchor: {
        hotelBooked: profile.hotelBooked ?? null,
        hotelAddress: profile.hotelAddress ?? null,
        hotelLat: profile.hotelLat ?? null,
        hotelLng: profile.hotelLng ?? null,
      },
      group_type: profile.groupType ?? null,
      group_size: profile.groupSize ?? null,
      budget: profile.budget ?? null,
      pace: profile.pace ?? null,
      interests: profile.interests ?? [],
      accommodation: profile.accommodation ?? null,
      hotel_nightly_budget: profile.hotelNightlyBudget ?? null,
      hotel_location_pref:  profile.hotelLocationPref ?? [],
      hotel_amenities:      profile.hotelAmenities ?? [],
      dietary_restrictions: profile.dietaryRestrictions ?? '',
      must_have: profile.mustHave ?? '',
    };
    const { error: tripChoicesErr } = await dbWrite
      .from('user_trip_choices')
      .upsert(tripChoiceRow, { onConflict: 'itinerary_id' });
    if (tripChoicesErr) {
      console.warn('[generate] user_trip_choices upsert skipped (non-critical):', tripChoicesErr.message);
    }

    const destCity = String(itinerary.destination || profile.destination || '').trim();
    if (destCity) {
      // ── trips row: await inline so it completes before the response is sent.
      // The void IIFE pattern previously caused serverless functions to kill
      // this write before it finished (lambda terminates with the HTTP response).
      try {
        await persistTripSessionRow(dbWrite, {
          itineraryId: itineraryDbId,
          userId,
          cityName: destCity,
          username: travelerUsername,
          startDate: profile.startDate ?? null,
          endDate: profile.endDate ?? null,
        });
      } catch (tripErr) {
        // Non-critical: itinerary is already saved; log but don't block.
        console.error('[generate] trips row failed (non-critical):', tripErr instanceof Error ? tripErr.message : tripErr);
      }

      // ── transportation scout: intentionally fire-and-forget (can take 10-30 s).
      // It will be populated on the NEXT read if this background task is killed.
      void ensureTransportationForCity(dbWrite, destCity, profile.duration).catch((e) => {
        console.warn('[generate] transportation scout failed (non-critical):', e instanceof Error ? e.message : e);
      });
    }

    // ── Optional: write tags column (non-critical — column may not exist yet) ───
    // Tags are derived from profile.interests; we try a PATCH and silently ignore
    // "column does not exist" errors so the app works even without the migration.
    const interestTags: string[] = profile.interests && profile.interests.length > 0
      ? profile.interests
      : [];
    if (interestTags.length > 0) {
      dbWrite
        .from('itineraries')
        .update({ tags: interestTags })
        .eq('id', itineraryDbId)
        .then(({ error: tagsErr }) => {
          if (tagsErr) console.warn('[generate] tags update skipped (non-critical):', tagsErr.message);
        });
    }
    console.log('[generate] saved row id:', itineraryDbId);

    // ── Atomic item insertion → itinerary_items ─────────────────────────────────
    // Each activity/dining slot becomes an independent row keyed by
    // (itinerary_id, day_number, item_order).  This enables targeted row-level swaps
    // without re-generating the whole trip.
    const SLOT_ORDER: Record<string, number> = {
      breakfast: 0, morning: 1, lunch: 2, afternoon: 3, dinner: 4, evening: 5,
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type ItemRow = Record<string, any>;
    const itemRows: ItemRow[] = [];

    for (let dayIdx = 0; dayIdx < (itinerary.days ?? []).length; dayIdx++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const day: any = itinerary.days[dayIdx];
      if (!day) continue;

      for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
        const item = day[slot];
        if (!item || !item.name) continue;

        const isActivity = ['morning', 'afternoon', 'evening'].includes(slot);
        itemRows.push({
          itinerary_id:   itineraryDbId,
          day_number:     dayIdx + 1,
          item_order:     SLOT_ORDER[slot] ?? 99,
          name:           item.name            ?? null,
          category:       slot,
          description:    isActivity
                            ? (item.description ?? null)
                            : ((item.mustTry ? `Must try: ${item.mustTry}` : item.cuisine) ?? null),
          lat:            item.latitude        != null ? Number(item.latitude)  : null,
          lng:            item.longitude       != null ? Number(item.longitude) : null,
          google_place_id: null,
          photo_url:      null,
          website_url:    item.website_url     ?? null,
          item_tags:      isActivity
                            ? (Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : [])
                            : (item.cuisine ? [item.cuisine] : []),
        });
      }
    }

    // Bulk-insert items and collect returned IDs to embed back into the blob
    const itemIdMap: Record<string, string> = {}; // key: "day{n}-{item_order}" → UUID
    const itemMetaMap: Record<string, { name: string | null; category: string | null; lat: number | null; lng: number | null }> = {};
    for (const row of itemRows) {
      itemMetaMap[`day${row.day_number}-${row.item_order}`] = {
        name: row.name ?? null,
        category: row.category ?? null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
      };
    }

    if (itemRows.length > 0) {
      try {
        const insertedItems: { id: string; day_number: number; item_order: number }[] = [];
        for (const originalRow of itemRows) {
          const row = { ...originalRow };
          for (let i = 0; i < 8; i++) {
            const attempt = await dbWrite
              .from('itinerary_items')
              .insert(row)
              .select('id, day_number, item_order')
              .single();
            if (!attempt.error && attempt.data) {
              insertedItems.push(attempt.data as { id: string; day_number: number; item_order: number });
              break;
            }
            const msg = attempt.error?.message ?? '';
            const dropped = dropMissingColumnFromRow(row, msg);
            if (dropped) {
              console.warn('[generate] itinerary_items retry without missing column');
              continue;
            }
            console.warn('[generate] itinerary_items row insert skipped (non-critical):', msg);
            break;
          }
        }

        if (insertedItems.length > 0) {
          for (const row of insertedItems) {
            itemIdMap[`day${row.day_number}-${row.item_order}`] = row.id;
          }
          console.log(`[generate] inserted ${insertedItems.length}/${itemRows.length} items to itinerary_items`);

          // Audit trail: connect users to places they created.
          if (userId) {
            const events = insertedItems
              .map((row) => {
                const key = `day${row.day_number}-${row.item_order}`;
                const meta = itemMetaMap[key];
                if (!meta?.name) return null;
                return {
                  user_id: userId,
                  itinerary_id: itineraryDbId,
                  itinerary_item_id: row.id,
                  event_type: 'created',
                  place_name: meta.name,
                  place_category: meta.category,
                  lat: meta.lat,
                  lng: meta.lng,
                  metadata: {
                    source: 'api/generate',
                    day_number: row.day_number,
                    item_order: row.item_order,
                  },
                };
              })
              .filter(Boolean) as Record<string, unknown>[];

            for (const eventRow of events) {
              const row = { ...eventRow };
              for (let i = 0; i < 8; i++) {
                const { error: eventsErr } = await dbWrite.from('user_place_events').insert(row);
                if (!eventsErr) break;
                const dropped = dropMissingColumnFromRow(row, eventsErr.message ?? '');
                if (dropped) {
                  console.warn('[generate] user_place_events retry without missing column');
                  continue;
                }
                console.warn('[generate] user_place_events row insert skipped (non-critical):', eventsErr.message);
                break;
              }
            }
          }
        }
      } catch (err) {
        console.warn('[generate] itinerary_items insert failed (non-critical):', err instanceof Error ? err.message : err);
      }
    }

    // ── Embed item_ids + DB UUID back into the itinerary blob ───────────────────
    // This lets the client perform targeted row-level swaps without extra lookups.
    const hasEmbeds = Object.keys(itemIdMap).length > 0;
    if (hasEmbeds) {
      for (let dayIdx = 0; dayIdx < (itinerary.days ?? []).length; dayIdx++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const day: any = itinerary.days[dayIdx];
        if (!day) continue;
        for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
          const item = day[slot];
          if (item) {
            const itemId = itemIdMap[`day${dayIdx + 1}-${SLOT_ORDER[slot] ?? 99}`];
            if (itemId) item.item_id = itemId;
          }
        }
      }
    }
    itinerary._id = itineraryDbId;

    // Persist the updated blob (with embedded item_ids and _id)
    const { error: finalBlobErr } = await dbWrite
      .from('itineraries')
      .update({ itinerary_json: { ...itinerary, _profile: profile, hotel_info: hotelInfo } })
      .eq('id', itineraryDbId);
    if (finalBlobErr) {
      console.warn('[generate] itinerary_json final update failed (non-critical):', finalBlobErr.message);
    }

    // Best-effort: do not block the HTTP response on places sync (saves tail latency vs 90s budget).
    void persistNewPlacesFromItinerary(itinerary as Record<string, unknown>, profile.destination ?? '').catch((e) =>
      console.warn('[generate] places sync background:', e instanceof Error ? e.message : e),
    );

    return NextResponse.json({ id: itineraryDbId, itinerary });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] error:', msg);
    return NextResponse.json({ error: 'Generation failed', details: msg }, { status: 500 });
  }
}
