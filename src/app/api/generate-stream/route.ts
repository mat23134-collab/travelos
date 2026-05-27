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
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TravelerProfile, ClassifiedResult, type Activity, type DiningSpot } from '@/lib/types';
import { SYSTEM_PROMPT, buildUserPrompt } from '@/lib/prompts';
import { runChainOfThoughtSearch, searchWeb } from '@/lib/rag';
import { supabase } from '@/lib/supabase';
import { batchVerifyPlaces } from '@/lib/verification';
import { normalizeBasecampHotels } from '@/lib/hotelNormalize';
import { classifyActivity } from '@/lib/activityGenre';
import { resolveAuthenticatedTraveler } from '@/lib/resolveAuthUser';
import { ensureTransportationForCity, persistTripSessionRow } from '@/lib/tripTransport';
import { formatAvailableInventoryForSystemPrompt, getFilteredInventory } from '@/services/scoringEngine';
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
export type SseComplete = { type: 'complete'; id: string; itinerary: unknown };
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

type PlaceSeed = {
  city: string; name: string; category: string; description: string;
  lat: number; lng: number; category_emoji: string;
  social_proof_url: string | null; vibe_label: string;
};

function activityToPlaceSeed(city: string, activity: Activity, slot: 'morning' | 'afternoon' | 'evening'): PlaceSeed | null {
  const name = typeof activity.name === 'string' ? activity.name.trim() : '';
  const lat = Number(activity.latitude), lng = Number(activity.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const genre = classifyActivity(activity);
  const category = genre === 'food' ? 'restaurant' : genre === 'shopping' ? 'market' : genre === 'nightlife' ? 'bar' : 'attraction';
  const desc = ((typeof activity.description === 'string' && activity.description) || (typeof activity.whyThis === 'string' && activity.whyThis) || `Suggested ${slot} ${category} in ${city}`).slice(0, 500);
  return { city, name, category, description: desc, lat, lng, category_emoji: typeof activity.category_emoji === 'string' ? activity.category_emoji : '📍', social_proof_url: null, vibe_label: typeof activity.vibeLabel === 'string' ? activity.vibeLabel : 'local-favorite' };
}

function diningToPlaceSeed(city: string, spot: DiningSpot, meal: 'breakfast' | 'lunch' | 'dinner'): PlaceSeed | null {
  const name = typeof spot.name === 'string' ? spot.name.trim() : '';
  const lat = Number(spot.latitude), lng = Number(spot.longitude);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const cuisine = typeof spot.cuisine === 'string' ? spot.cuisine.trim() : '';
  const mustTry = typeof spot.mustTry  === 'string' ? spot.mustTry.trim()  : '';
  const description = [mustTry && `Must try: ${mustTry}`, cuisine && `Cuisine: ${cuisine}`].filter(Boolean).join(' · ') || `Recommended ${meal} spot in ${city}`;
  return { city, name, category: meal === 'breakfast' ? 'cafe' : 'restaurant', description: description.slice(0, 500), lat, lng, category_emoji: meal === 'breakfast' ? '☕' : meal === 'lunch' ? '🍽️' : '🌙', social_proof_url: null, vibe_label: 'local-favorite' };
}

function collectPlaceSeeds(itineraryObj: Record<string, unknown>, city: string): PlaceSeed[] {
  const days = Array.isArray(itineraryObj.days) ? itineraryObj.days : [];
  const seeds: PlaceSeed[] = [];
  for (const d of days) {
    const day = (d ?? {}) as Record<string, unknown>;
    for (const slot of ['morning', 'afternoon', 'evening'] as const) {
      const act = day[slot];
      if (act && typeof act === 'object') { const s = activityToPlaceSeed(city, act as Activity, slot); if (s) seeds.push(s); }
    }
    for (const meal of ['breakfast', 'lunch', 'dinner'] as const) {
      const spot = day[meal];
      if (spot && typeof spot === 'object') { const s = diningToPlaceSeed(city, spot as DiningSpot, meal); if (s) seeds.push(s); }
    }
  }
  const seen = new Set<string>();
  return seeds.filter((s) => { const k = `${s.city.toLowerCase()}__${s.name.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

async function persistNewPlaces(itineraryObj: Record<string, unknown>, cityRaw: string): Promise<void> {
  const city = cityRaw.trim();
  if (!city) return;
  const seeds = collectPlaceSeeds(itineraryObj, city);
  if (seeds.length === 0) return;
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const client = url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : supabase;
  let inserted = 0, skipped = 0;
  for (const seed of seeds) {
    const { data: ex, error: se } = await client.from('places').select('id').ilike('name', seed.name).ilike('city', seed.city).maybeSingle();
    if (se) { console.warn(`[generate-stream] places select skipped "${seed.name}":`, se.message); continue; }
    if (ex) { skipped++; continue; }
    const { error: ie } = await client.from('places').insert(seed);
    if (ie) { console.warn(`[generate-stream] places insert skipped "${seed.name}":`, ie.message); continue; }
    inserted++;
  }
  console.log(`[generate-stream] places sync: inserted ${inserted}, skipped ${skipped}`);
}

// ── LLM calls ─────────────────────────────────────────────────────────────────

type GeminiBody = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>; promptFeedback?: { blockReason?: string } };

async function callGemini(userPrompt: string, systemPrompt: string, signal?: AbortSignal): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  const model = process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const maxTokens = (() => { const n = Number(process.env.GEMINI_MAX_OUTPUT_TOKENS); return Number.isFinite(n) && n > 0 ? n : 16384; })();
  console.log(`[generate-stream] Gemini ${model}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: JSON_PREAMBLE + systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: 0.35, maxOutputTokens: maxTokens, responseMimeType: 'application/json' },
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

  // ── Build hotel query early (pure string work — no I/O) ───────────────────
  const hotelQuery = !profile.hotelBooked?.trim()
    ? (() => {
        const accommodation = profile.accommodation?.replace(/-/g, ' ') ?? 'boutique hotel';
        const dates = profile.startDate?.slice(0, 10) && profile.endDate?.slice(0, 10)
          ? `${profile.startDate.slice(0, 10)} to ${profile.endDate.slice(0, 10)}`
          : '';
        return [accommodation, 'hotel', profile.destination.trim(), profile.budget, dates, 'Booking.com Expedia price per night', '2026'].filter(Boolean).join(' ');
      })()
    : null;

  // ── All pre-AI I/O in parallel ────────────────────────────────────────────
  // scored inventory (Supabase) + chain-of-thought web search + hotel search
  // all fire simultaneously — total wait = slowest branch.
  await send({ type: 'status', message: `Scouting ${profile.destination} for hidden gems…`, icon: '🔍' });

  const [filteredInventory, classifiedResults, rawHotelResults] = await Promise.all([
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

  const inventorySystemBlock = formatAvailableInventoryForSystemPrompt(filteredInventory);
  const inventoryLockedSystemPrompt = `${SYSTEM_PROMPT}\n${inventorySystemBlock}`;
  console.log(`[generate-stream] inventory lock: ${filteredInventory.length} scored items`);

  if (classifiedResults.length > 0) {
    await send({ type: 'status', message: `Analyzed ${classifiedResults.length} insider sources`, icon: '📚' });
  }

  let hotelContext: string | undefined;
  if (rawHotelResults.length > 0) {
    await send({ type: 'status', message: 'Finding top hotel options…', icon: '🏨' });
    hotelContext = rawHotelResults.slice(0, 5).map((r) => `- ${r.title}: ${r.snippet.slice(0, 280)}`).join('\n');
  }

  // ── AI generation ──────────────────────────────────────────────────────────
  await send({ type: 'status', message: `Building your ${profile.destination} itinerary…`, icon: '✈️' });

  const userPrompt = buildUserPrompt(profile, classifiedResults, hotelContext);

  // LLM HTTP budget (aligned with /api/generate + client abort on plan page).
  const aiController = new AbortController();
  const aiAbortTimer = setTimeout(() => aiController.abort(), GENERATE_LLM_FETCH_MS);

  // Heartbeat every 12s so the connection stays alive while LLM thinks
  let heartbeatTimer: ReturnType<typeof setInterval> | null = setInterval(async () => {
    try { await send({ type: 'status', message: `Crafting every detail for ${profile.destination}…`, icon: '✨' }); } catch { /* ignore */ }
  }, 12000);

  let raw: string;
  let provider: 'gemini' | 'claude';
  try {
    if (process.env.GEMINI_API_KEY?.trim()) {
      try {
        raw = await callGemini(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
        provider = 'gemini';
      } catch (geminiErr) {
        // If the shared budget already expired, surface a clear timeout error
        if (aiController.signal.aborted) throw new Error('Itinerary generation timed out. Please try again.');
        console.warn('[generate-stream] Gemini failed — falling back to Claude:', geminiErr instanceof Error ? geminiErr.message : geminiErr);
        raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
        provider = 'claude';
      }
    } else {
      raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, aiController.signal);
      provider = 'claude';
    }
  } finally {
    clearTimeout(aiAbortTimer);
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  }

  // ── Parse ──────────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let itinerary: any;
  try {
    itinerary = parseAIJson(raw);
  } catch (parseErr) {
    if (provider === 'gemini' && !aiController.signal.aborted) {
      console.warn('[generate-stream] Gemini JSON parse failed — fallback to Claude');
      // Reuse a fresh controller for the one-shot retry (original may be aborted)
      const retryController = new AbortController();
      const retryTimer = setTimeout(() => retryController.abort(), 30_000);
      try {
        raw = await callClaude(userPrompt, inventoryLockedSystemPrompt, retryController.signal);
      } finally {
        clearTimeout(retryTimer);
      }
      provider = 'claude';
      itinerary = parseAIJson(raw);
    } else { throw parseErr; }
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

  // ── Metadata (set early so main insert captures it) ────────────────────────
  // jit fields filled in later (background Exa); default to 0 for now
  itinerary._meta = {
    searchEnabled: classifiedResults.length > 0, sourcesFound: classifiedResults.length,
    hiddenGems: classifiedResults.filter((r) => r.vibeScore === 'hidden-gem').length,
    trapsFiltered: classifiedResults.filter((r) => r.vibeScore === 'tourist-trap').length,
    contradictionsFound: classifiedResults.filter((r) => r.contradictionNote).length,
    provider, jitVerified: 0, jitFlagged: 0,
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
  await send({ type: 'complete', id: itineraryDbId, itinerary });

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
    // Transportation scout: intentionally fire-and-forget (can take 10-30 s)
    void ensureTransportationForCity(dbWrite, destCity, profile.duration).catch((e) => {
      console.warn('[generate-stream] transportation scout failed (non-critical):', e instanceof Error ? e.message : e);
    });
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
        description: isActivity ? (item.description ?? null) : ((item.mustTry ? `Must try: ${item.mustTry}` : item.cuisine) ?? null),
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

  // Best-effort: do not block background completion on places sync.
  void persistNewPlaces(itinerary as Record<string, unknown>, profile.destination ?? '').catch((e) =>
    console.warn('[generate-stream] places sync background:', e instanceof Error ? e.message : e),
  );

  console.log('[generate-stream] background tasks done for id:', itineraryDbId);
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const bodyObj = body as TravelerProfile & { userId?: string | null };
  const bodyUserId: string | null = bodyObj.userId ?? null;
  const { userId: _u, ...profile } = bodyObj;

  if (!profile.destination) {
    return new Response(JSON.stringify({ error: 'Destination is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
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
