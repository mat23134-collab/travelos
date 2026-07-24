/**
 * /api/generate-stream  — SSE streaming version of /api/generate
 *
 * Sends a sequence of server-sent events while the itinerary is built:
 *   status   → pipeline stage updates  (icon + message)
 *   place    → one discovered place at a time (streamed after AI response)
 *   tip      → insider tip per day
 *   complete → { id, itinerary } — triggers client navigation
 *   error    → { message } — something went wrong
 *
 * The client reads these with fetch() + getReader() (not EventSource,
 * because we POST a JSON body).
 */

import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimitDurable, checkUserQuota, getClientIp, rateLimitedResponse, quotaExceededResponse, verifySessionUser } from '@/lib/apiGuard';
import { createClient } from '@supabase/supabase-js';
import { type TravelerProfile, ClassifiedResult, type Activity, type DiningSpot } from '@/lib/types';
import { TravelerProfileSchema } from '@/lib/schemas';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearchWithCache } from '@/lib/searchCache';
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
import { persistVenuesToCache, linkPlacesToUserEvents } from '@/lib/venueCache';
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
} from '@/lib/generateBudget';

export const maxDuration = 300; // 5 min — Vercel Pro/Enterprise or Railway
export const dynamic = 'force-dynamic';

// ── SSE event types ───────────────────────────────────────────────────────────

export type SseStatus   = { type: 'status';   message: string; icon: string };
export type SsePlace    = { type: 'place';    name: string; emoji: string; description: string; slot: string; day: number; vibeLabel: string };
export type SseTip      = { type: 'tip';      text: string };
export type SseComplete = { type: 'complete'; id: string; itinerary: unknown; isFallback?: boolean };
export type SseError    = { type: 'error';    message: string };
export type SseEvent    = SseStatus | SsePlace | SseTip | SseComplete | SseError;

// ── Helpers (mirrored from /api/generate/route.ts) ────────────────────────────

const JSON_PREAMBLE =
  'IMPORTANT: Your output MUST be a raw JSON object only. ' +
  'Do NOT include markdown blocks, backticks, or any text outside the curly braces. ' +
  'Start your response immediately with { and end with }. ' +
  'Your response must be a COMPLETE, valid JSON object. ' +
  'Always close every array bracket and every object brace before finishing. ';

function parseAIJson(rawText: string): unknown {
  const text = rawText.trim();
  try { return JSON.parse(text); } catch { /* fall through */ }
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found in AI response. Preview: ' + text.slice(0, 300));
  }
  return JSON.parse(text.slice(start, end + 1));
}

/** Resolve after `ms` with `fallback` if `promise` is still pending — keeps prefetch under budget. */
function withPrefetchTimeout<T>(promise: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  return Promise.race([
    promise.catch((err) => {
      console.warn(`[generate-stream] ${label} failed (non-critical):`, err instanceof Error ? err.message : err);
      return fallback;
    }),
    new Promise<T>((resolve) => {
      setTimeout(() => {
        console.warn(`[generate-stream] ${label} timed out after ${ms}ms — continuing without this block`);
        resolve(fallback);
      }, ms);
    }),
  ]);
}

function toTimeOnly(time?: string): string | null {
  if (!time) return null;
  const m = time.match(/^(\d{2}):(\d{2})/);
  return m ? `${m[1]}:${m[2]}:00` : null;
}

function toIsoDateTime(date?: string, time?: string): string | null {
  if (!date || !time) return null;
  const m = time.match(/^(\d{2}):(\d{2})/);
  return m ? `${date.slice(0, 10)}T${m[1]}:${m[2]}:00Z` : null;
}

function dropMissingColumn(row: Record<string, unknown>, errMsg: string): boolean {
  const col = errMsg.match(/Could not find the '([^']+)' column/)?.[1];
  if (!col || !(col in row)) return false;
  delete row[col];
  return true;
}

function createDbWriteClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (url && key) return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return supabase;
}

// Seed builders + warm-cache write live in src/lib/venueCache.ts.
// Use persistVenuesToCache(client, itinerary, city, profile, 'generate-stream').

// ── LLM calls ─────────────────────────────────────────────────────────────────

type GeminiBody = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } };

async function callGemini(userPrompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxTokens = (() => { const n = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS); return Number.isFinite(n) && n > 0 ? n : 24576; })();
  // gemini-2.5-* are "thinking" models: their reasoning tokens are billed against
  // maxOutputTokens. On long prompts thinking ate ~12k of a 16k budget, leaving the
  // JSON truncated → parse failure → generic fallback. Cap the thinking budget so the
  // full itinerary JSON always fits. Default 0 (disabled) for deterministic output;
  // override with GEMINI_THINKING_BUDGET if some reasoning is desired.
  const thinkingBudget = (() => { const n = Number(process.env.GEMINI_THINKING_BUDGET); return Number.isFinite(n) && n >= 0 ? n : 0; })();
  console.log(`[generate-stream] Gemini ${model} (maxOut ${maxTokens}, thinking ${thinkingBudget})`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: JSON_PREAMBLE + systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget },
      },
    }),
    signal, // ← shared abort signal
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${(await res.text()).slice(0, 600)}`);
  const data = (await res.json()) as GeminiBody;
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini blocked: ${data.promptFeedback.blockReason}`);
  const cand = data.candidates?.[0];
  if (!cand) throw new Error('Gemini returned no candidates');
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') throw new Error(`Gemini finish: ${cand.finishReason}`);
  const raw = (cand.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!raw) throw new Error('Gemini returned empty text');
  // MAX_TOKENS ⇒ the JSON is truncated and will never parse. Fail loudly so the
  // caller routes straight to the Claude retry instead of a doomed parse attempt.
  if (cand.finishReason === 'MAX_TOKENS') {
    throw new Error(`Gemini hit MAX_TOKENS (${raw.length} chars) — output truncated; raise GEMINI_MAX_OUTPUT_TOKENS or lower GEMINI_THINKING_BUDGET`);
  }
  console.log(`[generate-stream] Gemini: ${raw.length} chars | finishReason: ${cand.finishReason ?? 'UNKNOWN'}`);
  return raw;
}

async function callClaude(userPrompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
  console.log(`[generate-stream] Claude ${model}`);
  const message = await client.messages.create(
    { model, max_tokens: 16000, system: JSON_PREAMBLE + systemPrompt, messages: [{ role: 'user', content: userPrompt }] },
    { ...(signal ? { signal } : {}), timeout: GENERATE_LLM_FETCH_MS },
  );
  const block = message.content[0];
  const raw = block.type === 'text' ? block.text : '';
  console.log(`[generate-stream] Claude: ${raw.length} chars | stop: ${message.stop_reason}`);
  return raw;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const SLOT_ORDER: Record<string, number> = { breakfast: 0, morning: 1, lunch: 2, afternoon: 3, dinner: 4, evening: 5 };

async function runPipeline(
  req: NextRequest,
  profile: TravelerProfile,
  bodyUserId: string | null,
  send: (event: SseEvent) => Promise<void>,
): Promise<void> {

  await send({ type: 'status', message: 'Analyzing your trip preferences…', icon: '🧠' });

  // ── All pre-AI I/O in parallel ────────────────────────────────────────────
  // scored inventory (Supabase) + chain-of-thought web search + accommodation
  // provider router all fire simultaneously — total wait = slowest branch.
  await send({ type: 'status', message: `Scouting ${profile.destination} for hidden gems…`, icon: '🔍' });

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
      }).catch((e) => {
        console.warn('[generate-stream] scoring inventory failed (non-critical):', e);
        return [] as Awaited<ReturnType<typeof getFilteredInventory>>;
      }),
      GENERATE_PREFETCH_PER_BRANCH_MS,
      [] as Awaited<ReturnType<typeof getFilteredInventory>>,
      'inventory scoring prefetch',
    ),
    withPrefetchTimeout(
      runChainOfThoughtSearchWithCache(profile).catch(() => [] as ClassifiedResult[]),
      GENERATE_PREFETCH_PER_BRANCH_MS,
      [] as ClassifiedResult[],
      'web RAG prefetch',
    ),
    // Skip hotel search entirely when the user pre-booked OR skipped the step.
    (!profile.hotelBooked?.trim() && !profile.hotelSkipped)
      ? withPrefetchTimeout(
          searchAccommodations(travelerProfileToAccommodationInput(profile)).catch((err) => {
            console.warn('[generate-stream] accommodation router failed (non-critical):', err);
            return { provider: null, hotels: [], attempts: [], fallback: true } as Awaited<ReturnType<typeof searchAccommodations>>;
          }),
          GENERATE_PREFETCH_PER_BRANCH_MS,
          { provider: null, hotels: [], attempts: [], fallback: true } as Awaited<ReturnType<typeof searchAccommodations>>,
          'accommodation router prefetch',
        )
      : Promise.resolve({ provider: null, hotels: [], attempts: [], fallback: false } as Awaited<ReturnType<typeof searchAccommodations>>),
    withPrefetchTimeout(
      gatherTransportExaSnippets(profile.destination).catch((e) => {
        console.warn('[generate-stream] transit Exa snippets failed (non-critical):', e);
        return '';
      }),
      GENERATE_PREFETCH_PER_BRANCH_MS,
      '',
      'transit Exa prefetch',
    ),
  ]);

  const inventorySystemBlock = formatAvailableInventoryForSystemPrompt(filteredInventory);
  const inventoryLockedSystemPrompt = `${SYSTEM_PROMPT}\n${inventorySystemBlock}`;
  console.log(`[generate-stream] inventory lock: ${filteredInventory.length} scored items`);

  if (classifiedResults.length > 0) {
    await send({ type: 'status', message: `Analyzed ${classifiedResults.length} insider sources`, icon: '📚' });
  }

  let hotelContext: string | undefined;
  if (accommodationResult.hotels.length > 0) {
    await send({ type: 'status', message: 'Finding top hotel options…', icon: '🏨' });
    hotelContext = buildAccommodationContext(accommodationResult.hotels);
    console.log(
      `[generate-stream] accommodation provider=${accommodationResult.provider ?? 'none'} hotels=${accommodationResult.hotels.length}`,
    );
  } else if (accommodationResult.webContext) {
    await send({ type: 'status', message: 'Mining editorial hotel guides…', icon: '🏨' });
    hotelContext = accommodationResult.webContext;
    console.log(
      `[generate-stream] accommodation provider=exa (web fallback) — ${accommodationResult.webContext.length} chars`,
    );
  }

  // ── AI generation ──────────────────────────────────────────────────────────
  await send({ type: 'status', message: `Building your ${profile.destination} itinerary…`, icon: '✈️' });

  if (transitContext) {
    console.log(`[generate-stream] transit Exa intel: ${transitContext.length} chars injected into prompt`);
  }
  const userPrompt = buildUserPrompt(profile, classifiedResults, hotelContext, undefined, transitContext);

  // LLM HTTP budget (aligned with /api/generate + client abort on plan page).
  const aiController = new AbortController();
  const aiAbortTimer = setTimeout(() => aiController.abort(), GENERATE_LLM_FETCH_MS);

  // Heartbeat every 12s so the connection stays alive while LLM thinks
  let heartbeatTimer: ReturnType<typeof setInterval> | null = setInterval(async () => {
    try { await send({ type: 'status', message: `Crafting every detail for ${profile.destination}…`, icon: '✨' }); } catch { /* ignore */ }
  }, 12000);

  let raw = '';
  let provider: GenerationProvider = 'claude';
  let isFallback = false;
  let fallbackReason: unknown = null;
  // ── Diagnostics (written into _meta so failures are readable from the DB) ──
  const llmStart = Date.now();
  const diag: Record<string, unknown> = {
    geminiModel: process.env.GEMINI_MODEL ?? 'gemini-2.5-flash',
    geminiKeySet: !!process.env.GEMINI_API_KEY?.trim(),
    anthropicKeySet: !!process.env.ANTHROPIC_API_KEY?.trim(),
    promptChars: userPrompt.length,
    llmBudgetMs: GENERATE_LLM_FETCH_MS,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itinerary: any = null;
  try {
    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        raw = await callGemini(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
        provider = 'gemini';
        diag.geminiMs = Date.now() - llmStart;
      } catch (geminiErr) {
        diag.geminiMs = Date.now() - llmStart;
        diag.geminiError = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        // If the shared budget already expired, surface a clear timeout error
        if (aiController.signal.aborted) throw new Error('Itinerary generation timed out. Please try again.');
        console.warn('[generate-stream] Gemini failed — falling back to Claude:', geminiErr instanceof Error ? geminiErr.message : geminiErr);
        const claudeStart = Date.now();
        try {
          raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
          provider = 'claude';
          diag.claudeMs = Date.now() - claudeStart;
        } catch (claudeErr) {
          diag.claudeMs = Date.now() - claudeStart;
          diag.claudeError = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
          throw claudeErr;
        }
      }
    } else {
      raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
      provider = 'claude';
    }
  } catch (llmErr) {
    console.warn('[generate-stream] AI call failed — using fallback itinerary:', llmErr instanceof Error ? llmErr.message : llmErr);
    provider = 'fallback';
    isFallback = true;
    fallbackReason = llmErr;
    itinerary = buildFallbackItinerary(profile, filteredInventory, llmErr, accommodationResult.hotels);
  } finally {
    clearTimeout(aiAbortTimer);
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  if (!itinerary) {
    try {
      itinerary = validateItineraryOrThrow(parseAIJson(raw));
    } catch (parseErr) {
      fallbackReason = parseErr;
      // Capture WHY the primary provider's output was rejected (kept even if the
      // Claude retry later overwrites fallbackReason) — readable from the DB.
      diag.parseError = parseErr instanceof Error ? parseErr.message : String(parseErr);
      diag.rawLen = raw.length;
      diag.rawTail = raw.slice(-400);
      if (provider === 'gemini' && !aiController.signal.aborted) {
        console.warn('[generate-stream] Gemini parse/validation failed — fallback to Claude');
        // Fresh controller sized to the time actually left in the wall-clock
        // budget. The old fixed 60s aborted Claude mid-generation when Gemini had
        // already burned ~73s (60s wasn't enough for a full itinerary). Give Claude
        // every remaining second, with a 75s floor so a slow Gemini can't starve it.
        const elapsed = Date.now() - llmStart;
        const retryBudget = Math.max(75_000, GENERATE_LLM_FETCH_MS - elapsed);
        diag.claudeRetryBudgetMs = retryBudget;
        const retryController = new AbortController();
        const retryTimer = setTimeout(() => retryController.abort(), retryBudget);
        const retryStart = Date.now();
        try {
          raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, retryController.signal);
          itinerary = validateItineraryOrThrow(parseAIJson(raw));
          provider = 'claude';
          fallbackReason = null;
          diag.claudeRetryMs = Date.now() - retryStart;
        } catch (claudeErr) {
          console.warn('[generate-stream] Claude parse/validation failed — using fallback itinerary:', claudeErr instanceof Error ? claudeErr.message : claudeErr);
          diag.claudeRetryMs = Date.now() - retryStart;
          diag.claudeRetryError = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
          provider = 'fallback';
          isFallback = true;
          fallbackReason = claudeErr;
          itinerary = buildFallbackItinerary(profile, filteredInventory, claudeErr, accommodationResult.hotels);
        } finally {
          clearTimeout(retryTimer);
        }
      } else {
        console.warn('[generate-stream] AI parse/validation failed — using fallback itinerary:', parseErr instanceof Error ? parseErr.message : parseErr);
        provider = 'fallback';
        isFallback = true;
        itinerary = buildFallbackItinerary(profile, filteredInventory, parseErr, accommodationResult.hotels);
      }
    }
  }

  // Hotel step skipped → strip every hotel section regardless of what the model
  // (or the fallback builder) produced. Guarantees no recommendations/basecamp.
  if (profile.hotelSkipped) {
    delete itinerary.basecamp;
  }

  normalizeBasecampHotels(itinerary.basecamp);

  // ── Normalize coordinates (synchronous — runs before any awaits below) ─────
  for (const day of (itinerary.days ?? [])) {
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const act = day?.[slot];
      if (act) { if (act.latitude != null) act.latitude = Number(act.latitude); if (act.longitude != null) act.longitude = Number(act.longitude); }
    }
    for (const meal of ['lunch', 'dinner', 'breakfast'] as const) {
      const spot = day?.[meal] as { latitude?: unknown; longitude?: unknown } | undefined;
      if (spot) { if (spot.latitude != null) spot.latitude = Number(spot.latitude); if (spot.longitude != null) spot.longitude = Number(spot.longitude); }
    }
  }

  // ── Google Places verification (snap GPS + photo CDN URL + website) ────────
  // Optimisation: venues the AI picked from our warm-cache inventory already
  // have verified GPS, photo_url, and website_url from a previous generation.
  // We apply that cached data directly and only send AI-invented venues to
  // Google — typically cutting 50-70% of Google Places API calls per run.
  let placesVerified = 0, placesGpsCorrected = 0, placesPhotosFilled = 0, placesWebsitesFilled = 0;
  if (process.env.GOOGLE_PLACES_API_KEY) {
    try {
      await send({ type: 'status', message: 'Verifying venues on Google Maps…', icon: '📍' });

      const cityForVerify = String(itinerary.destination || profile.destination || '').trim();
      const keyFor = (s: { name: string }) => `${s.name}|${cityForVerify}`.toLowerCase();

      // Build a quick lookup: inventory_id → InventoryItem (for cached data).
      const inventoryById = new Map(
        filteredInventory.filter((item) => item.id).map((item) => [item.id!, item]),
      );

      // Walk itinerary: apply cached data for inventory hits, collect the rest for Google.
      let inventoryHits = 0;
      const inventoryHitKeys = new Set<string>();
      for (const day of (itinerary.days ?? []) as Record<string, unknown>[]) {
        for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
          const venue = day?.[slot] as Record<string, unknown> | undefined;
          if (!venue?.name) continue;
          const inventoryId = typeof venue.inventory_id === 'string' ? venue.inventory_id : null;
          const invItem = inventoryId ? inventoryById.get(inventoryId) : null;
          if (!invItem) continue;

          // GPS is already accurate (AI copied it from the inventory hint).
          // Backfill photo/website/place_id if the cached row has them.
          if (invItem.photo_url && !venue.photo_url)       venue.photo_url       = invItem.photo_url;
          if (invItem.website_url && !venue.website_url)   venue.website_url     = invItem.website_url;
          if (invItem.google_place_id && !venue.google_place_id) venue.google_place_id = invItem.google_place_id;

          inventoryHitKeys.add(keyFor({ name: String(venue.name) }));
          inventoryHits++;
        }
      }

      // Only send AI-invented venues (no inventory_id match) to Google.
      const allSlots = collectVenueSlots(itinerary);
      const slotsForGoogle = allSlots.filter((s) => !inventoryHitKeys.has(keyFor(s)));

      console.log(
        `[generate-stream] verify split: ${inventoryHits} inventory hits (cached, skipped), ` +
        `${slotsForGoogle.length}/${allSlots.length} new venues → Google Places`,
      );

      if (slotsForGoogle.length > 0) {
        const results = await batchVerifyPlacesOnGoogle(
          slotsForGoogle.map((s) => ({ key: keyFor(s), name: s.name, city: cityForVerify })),
          { concurrency: 6 },
        );
        const stats = applyVerificationToItinerary(itinerary, slotsForGoogle, results, keyFor);
        placesVerified = stats.verified + inventoryHits;
        placesGpsCorrected = stats.gpsCorrected;
        placesPhotosFilled = stats.photosFilled;
        placesWebsitesFilled = stats.websitesFilled;
        console.log(
          `[generate-stream] Places verify: ${stats.verified}/${slotsForGoogle.length} new venues verified, ` +
          `${placesGpsCorrected} GPS corrected, ${placesPhotosFilled} photos filled, ${placesWebsitesFilled} websites filled`,
        );
      } else {
        // All venues came from inventory — no Google calls needed at all.
        placesVerified = inventoryHits;
        console.log('[generate-stream] Places verify: 100% inventory hits — no Google calls needed');
      }
    } catch (err) {
      console.warn('[generate-stream] Places verify failed (non-critical):', err instanceof Error ? err.message : err);
    }
  }

  // ── Metadata (set early so main insert captures it) ────────────────────────
  // jit fields filled in later (background Exa); default to 0 for now
  itinerary._meta = {
    searchEnabled: classifiedResults.length > 0, sourcesFound: classifiedResults.length,
    hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
    trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
    contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
    provider, jitVerified: 0, jitFlagged: 0,
    placesVerified, placesGpsCorrected, placesPhotosFilled, placesWebsitesFilled,
    isFallback,
    ...(fallbackReason ? { fallbackReason: fallbackReason instanceof Error ? fallbackReason.message : String(fallbackReason) } : {}),
    llmDiag: { ...diag, totalLlmMs: Date.now() - llmStart },
  };

  // ── Kick off place streaming in background ─────────────────────────────────
  // Runs concurrently with the DB save below — user sees the discovery panel
  // populate while we write to Supabase. send() silently ignores writes after
  // the client navigates away.
  void send({ type: 'status', message: 'Discovering places & experiences…', icon: '🗺️' });
  const streamingDone: Promise<void> = (async () => {
    for (const [dayIdx, day] of ((itinerary.days ?? []) as Record<string, unknown>[]).entries()) {
      for (const slot of ['morning', 'afternoon', 'evening'] as const) {
        const act = day?.[slot] as Activity | undefined;
        if (act?.name) {
          await send({
            type: 'place',
            name: String(act.name),
            emoji: (typeof act.category_emoji === 'string' && act.category_emoji) ? act.category_emoji : '📍',
            description: String(act.description || act.whyThis || '').slice(0, 110),
            slot, day: dayIdx + 1,
            vibeLabel: (typeof act.vibeLabel === 'string' ? act.vibeLabel : '') || '',
          });
          await sleep(110);
        }
      }
      const dinner = day?.['dinner'] as DiningSpot | undefined;
      if (dinner?.name) {
        await send({ type: 'place', name: String(dinner.name), emoji: '🍽️',
          description: String(dinner.mustTry || dinner.cuisine || '').slice(0, 90),
          slot: 'dinner', day: dayIdx + 1, vibeLabel: 'dining' });
        await sleep(90);
      }
      const tip = (day as Record<string, unknown>)?.insiderTip;
      if (typeof tip === 'string' && tip.trim()) {
        await send({ type: 'tip', text: tip.trim().slice(0, 220) });
        await sleep(70);
      }
    }
  })();

  // ── Main DB save — runs while streaming is in progress ────────────────────
  await send({ type: 'status', message: 'Saving your personalized trip…', icon: '💾' });

  const dbWrite = createDbWriteClient();

  const resolved = await resolveAuthenticatedTraveler(req, dbWrite, bodyUserId);
  const userId = resolved.userId;
  const travelerUsername = resolved.username;

  const hotelInfo = profile.hotelAddress?.trim()
    ? { name: profile.hotelBooked?.trim() || profile.hotelAddress.trim(), address: profile.hotelAddress.trim(), lat: profile.hotelLat ?? null, lng: profile.hotelLng ?? null }
    : itinerary.basecamp?.booked
      ? { name: itinerary.basecamp.booked.name ?? null, neighborhood: itinerary.basecamp.booked.neighborhood ?? null }
      : itinerary.basecamp?.recommendations?.[0]
        ? { name: itinerary.basecamp.recommendations[0].name ?? null, neighborhood: itinerary.basecamp.recommendations[0].neighborhood ?? null }
        : null;

  const startDate = profile.startDate?.trim()?.slice(0, 10) ?? null;

  const insertRow: Record<string, unknown> = {
    destination: itinerary.destination || profile.destination,
    destination_city: itinerary.destination || profile.destination,
    start_date: startDate,
    hotel_info: hotelInfo,
    squad_vibe: profile.groupType ?? null,
    profile_json: profile,
    daily_start_time: toTimeOnly(profile.dailyStartTime),
    arrival_time: toIsoDateTime(profile.startDate, profile.arrivalTime),
    departure_time: toIsoDateTime(profile.endDate, profile.departureTime),
    skip_day_1: !!profile.skipDay1,
    user_id: userId,
    itinerary_json: { ...itinerary, _profile: profile },
  };

  let data: { id: string } | null = null;
  let dbErr: { message: string } | null = null;
  for (let i = 0; i < 8; i++) {
    const attempt = await dbWrite.from('itineraries').insert([insertRow]).select('id').single();
    data = attempt.data as { id: string } | null;
    dbErr = attempt.error as { message: string } | null;
    if (!dbErr) break;
    const col = dbErr.message?.match(/Could not find the '([^']+)' column/)?.[1];
    if (!col || !(col in insertRow)) break;
    delete insertRow[col];
    console.warn('[generate-stream] itineraries insert retry without column:', col);
  }
  if (dbErr || !data?.id) throw new Error('Database error: ' + (dbErr?.message ?? 'unknown'));

  const itineraryDbId = data.id;
  itinerary._id = itineraryDbId;

  // ── Navigate immediately after DB save ────────────────────────────────────
  // Fire `complete` as soon as we have the itinerary ID — don't wait for the
  // streaming panel to finish. The streaming IIFE continues in the background;
  // its send() calls silently no-op once the client disconnects.
  await send({ type: 'complete', id: itineraryDbId, itinerary, isFallback });

  // Drain the streaming promise so unhandled-rejection warnings don't fire
  streamingDone.catch(() => {});

  // ═══════════════════════════════════════════════════════════════════════════
  // Everything below runs AFTER the client has navigated to the results page.
  // send() calls silently fail once the SSE connection closes — that's fine.
  // The Supabase writes use a service-role client and complete regardless.
  // ═══════════════════════════════════════════════════════════════════════════

  // ── JIT Verification (background — enriches final blob) ───────────────────
  const exaKey = process.env.EXA_API_KEY;
  let jitChecked = 0, jitFlagged = 0;
  if (exaKey) {
    try {
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
        const results = await batchVerifyPlaces(refs.map((r) => ({ name: r.name, city: profile.destination })), exaKey, 7000);
        results.forEach((vr, i) => {
          const { dayIdx, slot } = refs[i];
          const act = itinerary.days[dayIdx]?.[slot];
          if (!act) return;
          act.verificationStatus = vr.status; act.verifiedAt = vr.checkedAt;
          if (vr.signal) act.verificationSignal = vr.signal;
          jitChecked++;
          if (vr.status === 'flagged-closed' || vr.status === 'flagged-renovating') jitFlagged++;
        });
        // Patch _meta with real Exa counts now that we have them
        if (itinerary._meta) { itinerary._meta.jitVerified = jitChecked; itinerary._meta.jitFlagged = jitFlagged; }
        console.log(`[generate-stream] JIT Shield: ${jitChecked} checked, ${jitFlagged} flagged`);
      }
    } catch (e) { console.warn('[generate-stream] JIT Shield failed (non-critical):', e); }
  }

  // ── Hotel anchors ──────────────────────────────────────────────────────────
  const hotelRows: Record<string, unknown>[] = [];
  if (profile.hotelAddress?.trim()) {
    hotelRows.push({ itinerary_id: itineraryDbId, user_id: userId, hotel_name: profile.hotelBooked?.trim() || profile.hotelAddress.trim(), address: profile.hotelAddress.trim(), lat: profile.hotelLat ?? null, lng: profile.hotelLng ?? null, source: 'selected', is_selected: true });
  }
  for (const rec of (itinerary.basecamp?.recommendations ?? [])) {
    if (!rec?.name) continue;
    hotelRows.push({ itinerary_id: itineraryDbId, user_id: userId, hotel_name: rec.name, address: rec.neighborhood ?? null, lat: profile.hotelLat ?? null, lng: profile.hotelLng ?? null, source: 'recommended', is_selected: false });
  }
  for (const row of hotelRows) {
    console.log('⏳ hotel_anchors (stream) — inserting:', JSON.stringify({ hotel_name: row.hotel_name, source: row.source, lat: row.lat, lng: row.lng }));
    for (let i = 0; i < 6; i++) {
      const { error: ae } = await dbWrite.from('hotel_anchors').insert(row);
      if (!ae) { console.log('✅ HOTEL_ANCHORS ROW SAVED (stream):', row.hotel_name); break; }
      const e = ae as unknown as { message?: string; details?: string; hint?: string; code?: string };
      console.log(`❌ SUPABASE ERROR DETECTED IN HOTEL_ANCHORS (stream, attempt ${i + 1}):`);
      console.log('  Message:', e.message);
      console.log('  Details:', e.details);
      console.log('  Hint:   ', e.hint);
      console.log('  Code:   ', e.code);
      console.log('  Row:    ', JSON.stringify(row, null, 2));
      const msg = e.message ?? '', code = e.code ?? '';
      if (dropMissingColumn(row, msg)) { console.log('  → retrying without missing column'); continue; }
      if (code === '23502' && (msg.includes('lat') || msg.includes('lng'))) {
        row.lat = 0; row.lng = 0;
        console.log('  → lat/lng NOT NULL — retrying with 0,0'); continue;
      }
      console.log('  → unrecoverable — skipping this row');
      break;
    }
  }

  // ── Trip choices ───────────────────────────────────────────────────────────
  const tcRow: Record<string, unknown> = {
    user_id: userId, itinerary_id: itineraryDbId,
    destination: profile.destination ?? null,
    start_date: profile.startDate?.slice(0, 10) ?? null,
    end_date: profile.endDate?.slice(0, 10) ?? null,
    trip_times: { dailyStartTime: profile.dailyStartTime ?? null, arrivalTime: profile.arrivalTime ?? null, departureTime: profile.departureTime ?? null, skipDay1: !!profile.skipDay1 },
    hotel_anchor: { hotelBooked: profile.hotelBooked ?? null, hotelAddress: profile.hotelAddress ?? null, hotelLat: profile.hotelLat ?? null, hotelLng: profile.hotelLng ?? null },
    group_type: profile.groupType ?? null, group_size: profile.groupSize ?? null,
    group_dynamics: profile.groupDynamics ?? null,
    budget: profile.budget ?? null, pace: profile.pace ?? null,
    interests: profile.interests ?? [], accommodation: profile.accommodation ?? null,
    hotel_nightly_budget: profile.hotelNightlyBudget ?? null,
    hotel_location_pref:  profile.hotelLocationPref ?? [],
    hotel_amenities:      profile.hotelAmenities ?? [],
    dietary_restrictions: profile.dietaryRestrictions ?? '', must_have: profile.mustHave ?? '',
  };
  const { error: tcErr } = await dbWrite.from('user_trip_choices').upsert(tcRow, { onConflict: 'itinerary_id' });
  if (tcErr) {
    const e = tcErr as unknown as { message?: string; details?: string; hint?: string; code?: string };
    console.log('❌ SUPABASE ERROR DETECTED IN USER_TRIP_CHOICES (stream):');
    console.log('  Message:', e.message);
    console.log('  Details:', e.details);
    console.log('  Hint:   ', e.hint);
    console.log('  Code:   ', e.code);
  } else {
    console.log('✅ user_trip_choices upsert OK (stream)');
  }

  const destCity = String(itinerary.destination || profile.destination || '').trim();
  if (destCity) {
    // trips row: await inline — void IIFE was killed by serverless before completing
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
      console.error('[generate-stream] trips row failed (non-critical):', tripErr instanceof Error ? tripErr.message : tripErr);
    }
    // Transportation scout: await with a 60 s cap so the serverless function
    // doesn't exit before the Gemini call + DB write complete (void was killed).
    try {
      await Promise.race([
        ensureTransportationForCity(dbWrite, destCity, profile.duration, profile.tripLanguage ?? 'en'),
        new Promise<void>((resolve) => setTimeout(resolve, 60_000)),
      ]);
    } catch (e) {
      console.warn('[generate-stream] transportation scout failed (non-critical):', e instanceof Error ? e.message : e);
    }
  }

  // ── Interest tags ──────────────────────────────────────────────────────────
  if ((profile.interests?.length ?? 0) > 0) {
    dbWrite.from('itineraries').update({ tags: profile.interests }).eq('id', itineraryDbId)
      .then(({ error: te }) => { if (te) console.warn('[generate-stream] tags update skipped:', te.message); });
  }

  // ── Itinerary items ────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const itemRows: Record<string, any>[] = [];
  for (let dayIdx = 0; dayIdx < (itinerary.days ?? []).length; dayIdx++) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const day: any = itinerary.days[dayIdx];
    if (!day) continue;
    for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
      const item = day[slot];
      if (!item?.name) continue;
      const isActivity = ['morning', 'afternoon', 'evening'].includes(slot);
      itemRows.push({
        itinerary_id: itineraryDbId, day_number: dayIdx + 1, item_order: SLOT_ORDER[slot] ?? 99,
        name: item.name ?? null, category: slot,
        description: isActivity
          ? (item.description ?? null)
          : (item.whyThis ?? (item.mustTry ? `Must try: ${item.mustTry}` : item.cuisine) ?? null),
        lat: item.latitude != null ? Number(item.latitude) : null,
        lng: item.longitude != null ? Number(item.longitude) : null,
        google_place_id: null, photo_url: null, website_url: item.website_url ?? null,
        item_tags: isActivity ? (Array.isArray(item.tags) && item.tags.length > 0 ? item.tags : []) : (item.cuisine ? [item.cuisine] : []),
      });
    }
  }

  const itemIdMap: Record<string, string> = {};
  const itemMetaMap: Record<string, { name: string | null; category: string | null; lat: number | null; lng: number | null }> = {};
  for (const row of itemRows) itemMetaMap[`day${row.day_number}-${row.item_order}`] = { name: row.name, category: row.category, lat: row.lat, lng: row.lng };

  if (itemRows.length > 0) {
    try {
      const inserted: { id: string; day_number: number; item_order: number }[] = [];
      for (const originalRow of itemRows) {
        const row = { ...originalRow };
        for (let i = 0; i < 8; i++) {
          const attempt = await dbWrite.from('itinerary_items').insert(row).select('id, day_number, item_order').single();
          if (!attempt.error && attempt.data) { inserted.push(attempt.data as { id: string; day_number: number; item_order: number }); break; }
          const msg = attempt.error?.message ?? '';
          if (dropMissingColumn(row, msg)) { console.warn('[generate-stream] items retry'); continue; }
          console.warn('[generate-stream] items row skipped:', msg); break;
        }
      }
      if (inserted.length > 0) {
        for (const row of inserted) itemIdMap[`day${row.day_number}-${row.item_order}`] = row.id;
        console.log(`[generate-stream] inserted ${inserted.length}/${itemRows.length} items`);
        if (userId) {
          const events = inserted.map((row) => {
            const key = `day${row.day_number}-${row.item_order}`;
            const meta = itemMetaMap[key];
            if (!meta?.name) return null;
            return { user_id: userId, itinerary_id: itineraryDbId, itinerary_item_id: row.id, event_type: 'created', place_name: meta.name, place_category: meta.category, lat: meta.lat, lng: meta.lng, metadata: { source: 'api/generate-stream', day_number: row.day_number, item_order: row.item_order } };
          }).filter(Boolean) as Record<string, unknown>[];
          for (const evRow of events) {
            const row = { ...evRow };
            for (let i = 0; i < 8; i++) {
              const { error: ee } = await dbWrite.from('user_place_events').insert(row);
              if (!ee) break;
              if (dropMissingColumn(row, ee.message ?? '')) { console.warn('[generate-stream] events retry'); continue; }
              console.warn('[generate-stream] events skipped:', ee.message); break;
            }
          }
        }
      }
    } catch (e) { console.warn('[generate-stream] items insert failed (non-critical):', e); }
  }

  // ── Embed item_ids into itinerary blob ─────────────────────────────────────
  if (Object.keys(itemIdMap).length > 0) {
    for (let dayIdx = 0; dayIdx < (itinerary.days ?? []).length; dayIdx++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const day: any = itinerary.days[dayIdx];
      if (!day) continue;
      for (const slot of ['breakfast', 'morning', 'lunch', 'afternoon', 'dinner', 'evening'] as const) {
        const item = day[slot];
        if (item) { const id = itemIdMap[`day${dayIdx + 1}-${SLOT_ORDER[slot] ?? 99}`]; if (id) item.item_id = id; }
      }
    }
  }

  // ── Final blob update (includes Exa verification data if it ran above) ─────
  const { error: finalErr } = await dbWrite.from('itineraries').update({ itinerary_json: { ...itinerary, _profile: profile, hotel_info: hotelInfo } }).eq('id', itineraryDbId);
  if (finalErr) console.warn('[generate-stream] final blob update failed (non-critical):', finalErr.message);

  // Warm-cache write — await so the background lambda waits for the upsert
  // before exiting. One batch upsert is ~200-400 ms.
  try {
    await persistVenuesToCache(
      dbWrite,
      itinerary as Record<string, unknown>,
      profile.destination ?? '',
      profile,
      'generate-stream',
    );
    // Back-fill place_id FK on user_place_events rows — runs after places upsert.
    await linkPlacesToUserEvents(dbWrite, itineraryDbId, profile.destination ?? '', 'generate-stream');
  } catch (e) {
    console.warn('[generate-stream] places sync failed (non-critical):', e instanceof Error ? e.message : e);
  }

  console.log('[generate-stream] background tasks done for id:', itineraryDbId);
}

// ── Route handler ─────────────────────────────────────────────────────────────

// Rate limit: 10 generations per 10 minutes per IP
const STREAM_RATE_LIMIT  = 10;
const STREAM_RATE_WINDOW = 10 * 60 * 1000;

/** Logged-in users get a daily cap on itinerary generations (§ cost control) —
 *  mirrors /api/generate. Guests stay on the IP-only limiter above. */
const GENERATE_DAILY_QUOTA = 1;

export async function POST(req: NextRequest) {
  // ── Rate limiting ───────────────────────────────────────────────────────────
  const ip = getClientIp(req);
  if (!(await checkRateLimitDurable(`gen-stream:${ip}`, STREAM_RATE_LIMIT, STREAM_RATE_WINDOW))) {
    return rateLimitedResponse();
  }

  let rawBody: unknown;
  try { rawBody = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  // ── Zod validation ──────────────────────────────────────────────────────────
  const { userId: _u, ...bodyWithoutUserId } = rawBody as Record<string, unknown>;
  const parsed = TravelerProfileSchema.safeParse(bodyWithoutUserId);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: 'Invalid request.', details: parsed.error.flatten().fieldErrors }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  const profile = parsed.data;

  // ── userId: trust JWT only, never the request body ──────────────────────────
  const sessionUser = await verifySessionUser(req);
  const bodyUserId: string | null = sessionUser?.id ?? null;

  // ── Per-user daily quota (logged-in users only — guests stay IP-limited) ────
  if (sessionUser && !(await checkUserQuota(sessionUser.id, sessionUser.email, 'generate', GENERATE_DAILY_QUOTA))) {
    return quotaExceededResponse();
  }

  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const send = async (event: SseEvent): Promise<void> => {
    try {
      await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Client disconnected — ignore write failure; pipeline continues to DB write
    }
  };

  void runPipeline(req, profile, bodyUserId, send)
    .then(() => writer.close().catch(() => {}))
    .catch(async (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[generate-stream] pipeline error:', msg);
      await send({ type: 'error', message: msg });
      await writer.close().catch(() => {});
    });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable Nginx response buffering
    },
  });
}
