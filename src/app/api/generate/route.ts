import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { MOCK_ITINERARY } from '@/lib/mockData';
import { createClient } from '@supabase/supabase-js';
import { TravelerProfile, ClassifiedResult, type Activity, type DiningSpot } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch } from '@/lib/rag';
import { supabase } from '@/lib/supabase';
import { batchVerifyPlaces } from '@/lib/verification';
import {
  collectVenueSlots,
  batchVerifyPlacesOnGoogle,
  applyVerificationToItinerary,
} from '@/lib/placeVerification';
import { normalizeBasecampHotels } from '@/lib/hotelNormalize';
import { classifyActivity } from '@/lib/activityGenre';
import { resolveAuthenticatedTraveler } from '@/lib/resolveAuthUser';
import { ensureTransportationForCity, persistTripSessionRow } from '@/lib/tripTransport';
import { gatherTransportExaSnippets } from '@/lib/transportExaIntel';
import { persistVenuesToCache } from '@/lib/venueCache';
import { formatAvailableInventoryForSystemPrompt, getFilteredInventory } from '@/services/scoringEngine';
import { buildFallbackItinerary, validateItineraryOrThrow, type GenerationProvider } from '@/services/itineraryFallback';
import {
  buildAccommodationContext,
  searchAccommodations,
  travelerProfileToAccommodationInput,
} from '@/services/accommodation/router';
import {
  GENERATE_PREFETCH_PER_BRANCH_MS,
  GENERATE_LLM_FETCH_MS,
  GENERATE_LLM_MAX_ATTEMPTS,
} from '@/lib/generateBudget';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

// Seed builders, collectPlaceSeeds, persistNewPlacesFromItinerary, and
// buildSeedTagContext live in src/lib/venueCache.ts and are reached via
// persistVenuesToCache(dbWrite, itinerary, city, profile, 'generate').

// ── Gemini call (primary) ─────────────────────────────────────────────────────

type GeminiGenerateBody = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
};

async function callGemini(userPrompt: string, systemPrompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const modelName = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;

  const systemText = JSON_PREAMBLE + systemPrompt;
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

async function callClaude(userPrompt: string, systemPrompt: string): Promise<string> {
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
      system: JSON_PREAMBLE + systemPrompt,
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

    // ── Mock mode — set MOCK_AI=true to skip all AI + DB writes for load testing ─
    if (process.env.MOCK_AI === 'true') {
      await new Promise((r) => setTimeout(r, 300)); // simulate minimal latency
      return NextResponse.json({ id: 'mock-itinerary-id', itinerary: MOCK_ITINERARY, isFallback: false });
    }

    // ── All pre-AI I/O in parallel ──────────────────────────────────────────────
    // Scoring inventory (Supabase) + runChainOfThoughtSearch (Tavily/Exa)
    // + multi-provider accommodation router all fire simultaneously.
    const [filteredInventory, classifiedResults, accommodationResult, transitContext] = await Promise.all([
      withPrefetchTimeout(
        getFilteredInventory({
          userTripChoices: {
            destination: profile.destination,
            group_type: profile.groupType,
            budget: profile.budget,
            pace: profile.pace,
            interests: profile.interests,
            dietary_restrictions: profile.dietaryRestrictions,
            must_have: profile.mustHave,
          },
          groupDynamics: profile.groupDynamics ?? null,
        }).catch((err) => {
          console.warn('[generate] scoring inventory query failed (non-critical):', err);
          return [] as Awaited<ReturnType<typeof getFilteredInventory>>;
        }),
        GENERATE_PREFETCH_PER_BRANCH_MS,
        [] as Awaited<ReturnType<typeof getFilteredInventory>>,
        'inventory scoring prefetch',
      ),
      withPrefetchTimeout(
        runChainOfThoughtSearch(profile).catch(() => [] as ClassifiedResult[]),
        GENERATE_PREFETCH_PER_BRANCH_MS,
        [] as ClassifiedResult[],
        'web RAG prefetch',
      ),
      !profile.hotelBooked?.trim()
        ? withPrefetchTimeout(
            searchAccommodations(travelerProfileToAccommodationInput(profile)).catch((err) => {
              console.warn('[generate] accommodation router failed (non-critical):', err);
              return { provider: null, hotels: [], attempts: [], fallback: true } as Awaited<ReturnType<typeof searchAccommodations>>;
            }),
            GENERATE_PREFETCH_PER_BRANCH_MS,
            { provider: null, hotels: [], attempts: [], fallback: true } as Awaited<ReturnType<typeof searchAccommodations>>,
            'accommodation router prefetch',
          )
        : Promise.resolve({ provider: null, hotels: [], attempts: [], fallback: false } as Awaited<ReturnType<typeof searchAccommodations>>),
      withPrefetchTimeout(
        gatherTransportExaSnippets(profile.destination).catch((err) => {
          console.warn('[generate] transit Exa snippets failed (non-critical):', err);
          return '';
        }),
        GENERATE_PREFETCH_PER_BRANCH_MS,
        '',
        'transit Exa prefetch',
      ),
    ]);

    const inventorySystemBlock = formatAvailableInventoryForSystemPrompt(filteredInventory);
    const inventoryLockedSystemPrompt = `${SYSTEM_PROMPT}\n${inventorySystemBlock}`;
    if (filteredInventory.length > 0) {
      console.log(`[generate] inventory lock: injecting ${filteredInventory.length} scored items for ${profile.destination}`);
    } else {
      console.log(`[generate] inventory lock: no scored inventory found for ${profile.destination}`);
    }

    let hotelContext: string | undefined;
    if (accommodationResult.hotels.length > 0) {
      hotelContext = buildAccommodationContext(accommodationResult.hotels);
      console.log(
        `[generate] accommodation provider=${accommodationResult.provider ?? 'none'} hotels=${accommodationResult.hotels.length}`,
      );
    } else if (accommodationResult.webContext) {
      hotelContext = accommodationResult.webContext;
      console.log(
        `[generate] accommodation provider=exa (web fallback) — ${accommodationResult.webContext.length} chars of editorial research`,
      );
    }

    // ── Generate itinerary: Gemini first, Claude fallback ───────────────────────
    if (transitContext) {
      console.log(`[generate] transit Exa intel: ${transitContext.length} chars injected into prompt`);
    }
    const userPrompt = buildUserPrompt(profile, classifiedResults, hotelContext, undefined, transitContext);

    let raw = '';
    let provider: GenerationProvider = 'claude';
    let isFallback = false;
    let fallbackReason: unknown = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let itinerary: any = null;
    try {
      if (process.env.GEMINI_API_KEY?.trim()) {
        try {
          raw = await withRetry(() => callGemini(userPrompt, inventoryLockedSystemPrompt), GENERATE_LLM_MAX_ATTEMPTS);
          provider = 'gemini';
        } catch (geminiErr) {
          console.warn(
            '[generate] Gemini failed — falling back to Claude:',
            geminiErr instanceof Error ? geminiErr.message : geminiErr,
          );
          raw = await withRetry(() => callClaude(userPrompt, inventoryLockedSystemPrompt), GENERATE_LLM_MAX_ATTEMPTS);
          provider = 'claude';
        }
      } else {
        console.log('[generate] GEMINI_API_KEY not set — using Claude only');
        raw = await withRetry(() => callClaude(userPrompt, inventoryLockedSystemPrompt), GENERATE_LLM_MAX_ATTEMPTS);
        provider = 'claude';
      }

      itinerary = validateItineraryOrThrow(parseAIJson(raw));
    } catch (aiOrParseErr) {
      fallbackReason = aiOrParseErr;
      if (provider === 'gemini') {
        console.warn(
          '[generate] Gemini parse/validation failed — falling back to Claude:',
          aiOrParseErr instanceof Error ? aiOrParseErr.message : aiOrParseErr,
        );
        try {
          raw = await withRetry(() => callClaude(userPrompt, inventoryLockedSystemPrompt), GENERATE_LLM_MAX_ATTEMPTS);
          provider = 'claude';
          itinerary = validateItineraryOrThrow(parseAIJson(raw));
          fallbackReason = null;
        } catch (claudeErr) {
          console.warn('[generate] Claude parse/validation failed — using fallback itinerary:', claudeErr instanceof Error ? claudeErr.message : claudeErr);
          provider = 'fallback';
          isFallback = true;
          fallbackReason = claudeErr;
          itinerary = buildFallbackItinerary(profile, filteredInventory, claudeErr, accommodationResult.hotels);
        }
      } else if (!itinerary) {
        console.warn('[generate] AI failed — using fallback itinerary:', aiOrParseErr instanceof Error ? aiOrParseErr.message : aiOrParseErr);
        provider = 'fallback';
        isFallback = true;
        itinerary = buildFallbackItinerary(profile, filteredInventory, aiOrParseErr, accommodationResult.hotels);
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

    // ── Google Places verification ──────────────────────────────────────────────
    // Best-effort post-LLM enrichment: every named activity + dining spot is
    // run through Google Places Text Search to confirm existence, snap GPS to
    // the real venue location, fetch a photo CDN URL, and surface the official
    // website when AI didn't have one. Silent no-op when GOOGLE_PLACES_API_KEY
    // is absent.
    let placesVerified = 0;
    let placesGpsCorrected = 0;
    let placesPhotosFilled = 0;
    let placesWebsitesFilled = 0;
    if (process.env.GOOGLE_PLACES_API_KEY) {
      try {
        const slots = collectVenueSlots(itinerary);
        const cityForVerify = String(itinerary.destination || profile.destination || '').trim();
        const keyFor = (s: { name: string }) => `${s.name}|${cityForVerify}`.toLowerCase();

        const results = await batchVerifyPlacesOnGoogle(
          slots.map((s) => ({ key: keyFor(s), name: s.name, city: cityForVerify })),
          { concurrency: 6 },
        );

        const stats = applyVerificationToItinerary(itinerary, slots, results, keyFor);
        placesVerified = stats.verified;
        placesGpsCorrected = stats.gpsCorrected;
        placesPhotosFilled = stats.photosFilled;
        placesWebsitesFilled = stats.websitesFilled;
        console.log(
          `[generate] Places verify: ${placesVerified}/${slots.length} verified, ` +
          `${placesGpsCorrected} GPS corrected, ${placesPhotosFilled} photos filled, ` +
          `${placesWebsitesFilled} websites filled`,
        );
      } catch (err) {
        console.warn('[generate] Places verify failed (non-critical):', err instanceof Error ? err.message : err);
      }
    } else {
      console.log('[generate] Places verify: skipped (GOOGLE_PLACES_API_KEY not set)');
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
      placesVerified,
      placesGpsCorrected,
      placesPhotosFilled,
      placesWebsitesFilled,
      isFallback,
      ...(fallbackReason ? { fallbackReason: fallbackReason instanceof Error ? fallbackReason.message : String(fallbackReason) } : {}),
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
      console.log('⏳ hotel_anchors — inserting row:', JSON.stringify({ hotel_name: row.hotel_name, source: row.source, lat: row.lat, lng: row.lng }));
      for (let i = 0; i < 6; i++) {
        const { error: anchorErr } = await dbWrite.from('hotel_anchors').insert(row);
        if (!anchorErr) {
          console.log('✅ HOTEL_ANCHORS ROW SAVED:', row.hotel_name, '(source:', row.source + ')');
          break;
        }

        const e = anchorErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
        console.log(`❌ SUPABASE ERROR DETECTED IN HOTEL_ANCHORS (attempt ${i + 1}):`);
        console.log('  Message:', e.message);
        console.log('  Details:', e.details);
        console.log('  Hint:   ', e.hint);
        console.log('  Code:   ', e.code);
        console.log('  Row:    ', JSON.stringify(row, null, 2));

        const msg  = e.message ?? '';
        const code = e.code ?? '';

        // Missing column in schema → strip and retry
        if (dropMissingColumnFromRow(row, msg)) {
          console.log('  → retrying without missing column');
          continue;
        }

        // NOT NULL violation (23502) on lat/lng
        if (code === '23502' && (msg.includes('lat') || msg.includes('lng'))) {
          row.lat = 0;
          row.lng = 0;
          console.log('  → lat/lng NOT NULL violation — retrying with 0,0');
          continue;
        }

        console.log('  → unrecoverable — skipping this row');
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
      group_type:    profile.groupType    ?? null,
      group_size:    profile.groupSize    ?? null,
      group_dynamics: profile.groupDynamics ?? null,
      budget:        profile.budget       ?? null,
      pace:          profile.pace         ?? null,
      interests:     profile.interests    ?? [],
      accommodation: profile.accommodation ?? null,
      hotel_nightly_budget: profile.hotelNightlyBudget ?? null,
      hotel_location_pref:  profile.hotelLocationPref  ?? [],
      hotel_amenities:      profile.hotelAmenities     ?? [],
      dietary_restrictions: profile.dietaryRestrictions ?? '',
      must_have:     profile.mustHave ?? '',
    };
    const { error: tripChoicesErr } = await dbWrite
      .from('user_trip_choices')
      .upsert(tripChoiceRow, { onConflict: 'itinerary_id' });
    if (tripChoicesErr) {
      const e = tripChoicesErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
      console.log('❌ SUPABASE ERROR DETECTED IN USER_TRIP_CHOICES:');
      console.log('  Message:', e.message);
      console.log('  Details:', e.details);
      console.log('  Hint:   ', e.hint);
      console.log('  Code:   ', e.code);
    } else {
      console.log('✅ user_trip_choices upsert OK');
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

    // Warm-cache write: await inline (one batch upsert ≈ 200-400ms) so the
    // lambda doesn't terminate before the write completes. The previous
    // void-IIFE pattern killed these writes in production (same bug as 64e5524).
    try {
      await persistVenuesToCache(
        dbWrite,
        itinerary as Record<string, unknown>,
        profile.destination ?? '',
        profile,
        'generate',
      );
    } catch (e) {
      console.warn('[generate] places sync failed (non-critical):', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ id: itineraryDbId, itinerary, isFallback });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate] error:', msg);
    return NextResponse.json({ error: 'Generation failed', details: msg }, { status: 500 });
  }
}
