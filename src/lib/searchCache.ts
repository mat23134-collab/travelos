/**
 * searchCache.ts — per-city, per-month cache for Tavily/Exa web search results.
 *
 * Problem: every itinerary generation fires 5-7 live web searches regardless of
 * whether 100 people just generated the same city today. Results don't change
 * day-to-day, so this is pure wasted API spend.
 *
 * Solution: cache the classified results in `public.web_search_cache` keyed by
 * `{normalised_city}_{YYYY-MM}`. Cache hit = 0 Tavily/Exa calls. Cache miss =
 * normal search, then write back so the next request is free.
 *
 * TTL is implicit: a new month produces a new key → automatic cache refresh
 * at the start of each calendar month with no cron job required.
 */

import { createClient } from '@supabase/supabase-js';
import type { ClassifiedResult, TravelerProfile } from '@/lib/types';
import { runChainOfThoughtSearch } from '@/lib/rag';

// ── Cache client (service role — bypasses RLS) ────────────────────────────────

function createCacheClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// ── Key helpers ───────────────────────────────────────────────────────────────

/**
 * Normalises a destination string into a stable cache key component.
 * "Paris, France" → "paris-france"   "New York" → "new-york"
 */
function normaliseCitySlug(destination: string): string {
  return destination
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function buildCacheKey(destination: string): string {
  return `${normaliseCitySlug(destination)}_${currentMonthKey()}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Drop-in replacement for `runChainOfThoughtSearch` that checks the DB cache
 * first. On a hit, returns immediately with 0 external API calls. On a miss,
 * runs the live search and writes results to the cache for subsequent requests.
 *
 * Falls back gracefully to the live search if the cache table is unreachable.
 */
export async function runChainOfThoughtSearchWithCache(
  profile: TravelerProfile,
): Promise<ClassifiedResult[]> {
  const destination = profile.destination?.trim() ?? '';

  // No destination = can't cache meaningfully; fall through to live search.
  if (!destination) return runChainOfThoughtSearch(profile);

  const cacheKey = buildCacheKey(destination);
  const client = createCacheClient();

  // ── Cache read ──────────────────────────────────────────────────────────────
  if (client) {
    try {
      const { data, error } = await client
        .from('web_search_cache')
        .select('results_json')
        .eq('city_key', cacheKey)
        .single();

      if (!error && data?.results_json) {
        const cached = data.results_json as ClassifiedResult[];
        console.log(
          `[searchCache] HIT ${cacheKey} — ${cached.length} results, skipping ${
            // rough estimate: phase1 has 3 queries, phase2 has 4
            7
          } web API calls`,
        );
        return cached;
      }
    } catch (e) {
      console.warn('[searchCache] read failed (non-critical):', e instanceof Error ? e.message : e);
    }
  }

  // ── Cache miss — run live search ────────────────────────────────────────────
  console.log(`[searchCache] MISS ${cacheKey} — running live web search`);
  const results = await runChainOfThoughtSearch(profile);

  // ── Write back (fire-and-forget — don't block the generation pipeline) ──────
  if (client && results.length > 0) {
    client
      .from('web_search_cache')
      .upsert(
        { city_key: cacheKey, results_json: results, cached_at: new Date().toISOString() },
        { onConflict: 'city_key' },
      )
      .then(({ error }) => {
        if (error) console.warn('[searchCache] write failed:', error.message);
        else console.log(`[searchCache] cached ${results.length} results for ${cacheKey}`);
      })
      .catch((e) => console.warn('[searchCache] write error:', e instanceof Error ? e.message : e));
  }

  return results;
}
