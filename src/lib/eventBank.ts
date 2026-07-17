/**
 * eventBank — data-access helpers for `public.event_recommendations`.
 * Reads filter by date overlap with the trip window; writes replace the
 * city's future events with the fresh scout batch.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { EventRecommendation, SiteLanguage } from '@/lib/types';

const TABLE = 'event_recommendations';

export function normalizeCity(city: string): string {
  return city.trim().toLowerCase();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToRec(row: any): EventRecommendation {
  return {
    id: row.id,
    city: row.city,
    name: row.name,
    description: row.description,
    category: row.category,
    translations: row.translations ?? null,
    venue: row.venue,
    startDate: row.start_date,
    endDate: row.end_date,
    priceRange: row.price_range,
    ticketUrl: row.ticket_url,
    websiteUrl: row.website_url,
    sourceUrl: row.source_url,
    source: row.source,
    score: row.score,
  };
}

function recToRow(rec: EventRecommendation) {
  return {
    city: rec.city,
    city_normalized: normalizeCity(rec.city),
    name: rec.name,
    name_normalized: rec.name.trim().toLowerCase(),
    description: rec.description ?? null,
    category: rec.category ?? null,
    translations: rec.translations ?? null,
    venue: rec.venue ?? null,
    start_date: rec.startDate ?? null,
    end_date: rec.endDate ?? rec.startDate ?? null,
    price_range: rec.priceRange ?? null,
    ticket_url: rec.ticketUrl ?? null,
    website_url: rec.websiteUrl ?? null,
    source_url: rec.sourceUrl ?? null,
    source: rec.source ?? 'scout',
    score: rec.score ?? 0,
    updated_at: new Date().toISOString(),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Resolve localizable text to the requested language (English fallback). */
export function localizeEvent(rec: EventRecommendation, lang: SiteLanguage): EventRecommendation {
  const loc = rec.translations?.[lang] ?? rec.translations?.en ?? null;
  if (!loc) return rec;
  return {
    ...rec,
    description: loc.description ?? rec.description ?? null,
    category: loc.category ?? rec.category ?? null,
    highlight: loc.highlight ?? rec.highlight ?? null,
  };
}

/**
 * Events for a city overlapping [from, to] (ISO dates), best-scored first.
 * Overlap: event.start <= to AND event.end >= from.
 */
export async function fetchEventsForCity(
  sb: SupabaseClient,
  city: string,
  from: string,
  to: string,
  opts: { lang?: SiteLanguage; limit?: number } = {},
): Promise<EventRecommendation[]> {
  const { lang = 'en', limit = 10 } = opts;
  const { data, error } = await sb
    .from(TABLE)
    .select('*')
    .eq('city_normalized', normalizeCity(city))
    .lte('start_date', to)
    .gte('end_date', from)
    .order('score', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(rowToRec).map((r) => localizeEvent(r, lang));
}

/** Newest updated_at among a city's events overlapping [from, to], or null. */
export async function windowLastUpdated(
  sb: SupabaseClient,
  city: string,
  from: string,
  to: string,
): Promise<string | null> {
  const { data } = await sb
    .from(TABLE)
    .select('updated_at')
    .eq('city_normalized', normalizeCity(city))
    .lte('start_date', to)
    .gte('end_date', from)
    .order('updated_at', { ascending: false })
    .limit(1);
  return data?.[0]?.updated_at ?? null;
}

/**
 * Merge the fresh scout batch into a city's events (per-window upsert, NOT a
 * delete-all): events from different trip date windows coexist instead of
 * overwriting each other. Conflicts on (city, name, start_date) refresh the
 * existing row. Also purges events that have already ended so the table stays
 * lean over time.
 */
export async function upsertEvents(
  sb: SupabaseClient,
  recs: EventRecommendation[],
): Promise<number> {
  if (recs.length === 0) return 0;
  const cityNorm = normalizeCity(recs[0].city);

  // Purge events that are over (end_date before today) for this city.
  const today = new Date().toISOString().slice(0, 10);
  await sb.from(TABLE).delete().eq('city_normalized', cityNorm).lt('end_date', today);

  // De-dupe the batch on the same key as the unique index.
  const seen = new Set<string>();
  const rows = recs.map(recToRow).filter((r) => {
    const key = `${r.name_normalized}|${r.start_date}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const { error, count } = await sb
    .from(TABLE)
    .upsert(rows, { onConflict: 'city_normalized,name_normalized,start_date', count: 'exact' });
  if (error) {
    console.warn('[eventBank] upsert failed:', error.message);
    return 0;
  }
  return count ?? rows.length;
}
