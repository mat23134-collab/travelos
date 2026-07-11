/**
 * recStaleness — shared TTL policy for the Smart Toolbar recommendation banks.
 *
 * We cache scouted recommendations per city in the DB so the first visitor pays
 * the scout cost and everyone after reads instantly. To keep that cache from
 * going stale forever, the GET routes flag data older than the TTL as `stale`;
 * the client then shows the cached data immediately AND kicks off a background
 * re-scout (stale-while-revalidate), so the NEXT visitor gets fresh data without
 * the current one ever waiting.
 */

/** Restaurants & attractions change slowly — refresh roughly every 3 months. */
export const REC_TTL_DAYS = 90;

/** Events/festivals turn over fast (new line-ups, dates) — refresh sooner. */
export const EVENT_TTL_DAYS = 21;

const DAY_MS = 86_400_000;

/** True when `lastUpdatedIso` is missing or older than `ttlDays`. */
export function isStale(lastUpdatedIso: string | null | undefined, ttlDays: number): boolean {
  if (!lastUpdatedIso) return true;
  const t = new Date(lastUpdatedIso).getTime();
  if (!Number.isFinite(t)) return true;
  return Date.now() - t > ttlDays * DAY_MS;
}
