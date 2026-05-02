/**
 * verification.ts — Exa-powered place status checker
 *
 * Used by:
 *   • src/app/api/generate/route.ts   (JIT Shield — runs after Claude call)
 *   • scripts/scout-agent.ts          (Janitor mode — --janitor flag)
 *
 * Required env var:  EXA_API_KEY
 *
 * Supabase migration required before janitor writes back:
 *   ALTER TABLE places ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;
 *   ALTER TABLE places ADD COLUMN IF NOT EXISTS status text DEFAULT 'unverified';
 */

export type VerificationStatus =
  | 'verified-open'
  | 'flagged-closed'
  | 'flagged-renovating'
  | 'unverified';

export interface VerificationResult {
  status: VerificationStatus;
  confidence: 'high' | 'low';
  signal?: string;   // excerpt that triggered the flag (max 120 chars)
  checkedAt: string; // ISO-8601 timestamp
}

// ── Closure signal patterns — ordered from most to least specific ─────────────
// Each entry: regex to match, resulting status, confidence level.
// Low-confidence matches are checked for false-positive opening-hours context.

const CLOSURE_PATTERNS: Array<{
  re: RegExp;
  status: 'flagged-closed' | 'flagged-renovating';
  confidence: 'high' | 'low';
}> = [
  { re: /permanently\s+closed/i,               status: 'flagged-closed',      confidence: 'high' },
  { re: /closed\s+permanently/i,               status: 'flagged-closed',      confidence: 'high' },
  { re: /closed\s+for\s+(good|ever)/i,         status: 'flagged-closed',      confidence: 'high' },
  { re: /no\s+longer\s+(open|operating|in\s+business)/i, status: 'flagged-closed', confidence: 'high' },
  { re: /has\s+closed\s+down/i,                status: 'flagged-closed',      confidence: 'high' },
  { re: /temporarily\s+closed/i,               status: 'flagged-closed',      confidence: 'high' },
  { re: /closed\s+for\s+renovation/i,          status: 'flagged-renovating',  confidence: 'high' },
  { re: /under\s+(major\s+)?renovation/i,      status: 'flagged-renovating',  confidence: 'high' },
  { re: /undergoing\s+renovation/i,            status: 'flagged-renovating',  confidence: 'high' },
  { re: /closed\s+for\s+refurb/i,              status: 'flagged-renovating',  confidence: 'high' },
  { re: /\bclosed\b/i,                         status: 'flagged-closed',      confidence: 'low'  },
  { re: /\bconstruction\b/i,                   status: 'flagged-renovating',  confidence: 'low'  },
];

// Opening-hours false-positive guard — if a low-confidence match contains one
// of these patterns it's almost certainly just closing time, not closure.
const HOURS_PATTERN = /close[sd]?\s+at\s+\d|closes?\s+\d|open\s+until|\d\s*[ap]m|\d{1,2}:\d{2}/i;

// ── Core verification call ────────────────────────────────────────────────────

export async function verifyPlaceWithExa(
  name: string,
  city: string,
  apiKey: string,
  timeoutMs = 5000,
): Promise<VerificationResult> {
  const checkedAt = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        query: `"${name}" ${city} closed renovating construction 2025 2026`,
        num_results: 5,
        type: 'keyword',
        use_autoprompt: false,
        contents: {
          highlights: {
            query: `${name} closed OR renovating OR construction OR temporarily closed`,
            numSentences: 2,
            highlightsPerUrl: 2,
          },
        },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { status: 'unverified', confidence: 'low', checkedAt };
    }

    const data = (await res.json()) as {
      results: Array<{ highlights?: string[] }>;
    };

    const highlights = data.results.flatMap((r) => r.highlights ?? []);

    for (const highlight of highlights) {
      for (const { re, status, confidence } of CLOSURE_PATTERNS) {
        if (!re.test(highlight)) continue;

        // Guard: skip low-confidence matches that look like opening hours
        if (confidence === 'low' && HOURS_PATTERN.test(highlight)) continue;

        return {
          status,
          confidence,
          signal: highlight.slice(0, 120).trim(),
          checkedAt,
        };
      }
    }

    // No closure signals found → venue appears open
    return { status: 'verified-open', confidence: 'high', checkedAt };

  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout =
      err instanceof Error && (err.name === 'AbortError' || err.message.includes('abort'));
    console.warn(
      `[verification] ${isTimeout ? 'timeout' : 'error'} for "${name}": ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return { status: 'unverified', confidence: 'low', checkedAt };
  }
}

// ── Batch helper — runs all checks in parallel with a shared wall-clock cap ──

export interface PlaceToVerify {
  name: string;
  city: string;
}

export interface BatchVerificationResult extends VerificationResult {
  name: string;
}

export async function batchVerifyPlaces(
  places: PlaceToVerify[],
  apiKey: string,
  wallClockMs = 6000,
): Promise<BatchVerificationResult[]> {
  if (places.length === 0) return [];

  const perPlaceTimeout = Math.min(4000, Math.floor(wallClockMs * 0.8));

  const settled = await Promise.allSettled(
    places.map((p) =>
      verifyPlaceWithExa(p.name, p.city, apiKey, perPlaceTimeout),
    ),
  );

  return settled.map((result, i) => ({
    name: places[i].name,
    ...(result.status === 'fulfilled'
      ? result.value
      : { status: 'unverified' as const, confidence: 'low' as const, checkedAt: new Date().toISOString() }),
  }));
}

// ── UI helper: human-readable badge label ────────────────────────────────────

export function verificationBadgeLabel(
  status: VerificationStatus | undefined,
  verifiedAt: string | undefined,
): string | null {
  if (!status || status === 'unverified') return null;
  if (status === 'flagged-closed')      return '⚠ May Be Closed';
  if (status === 'flagged-renovating')  return '🔧 Renovating';

  // verified-open — show time-relative label
  if (status === 'verified-open' && verifiedAt) {
    const ageMs  = Date.now() - new Date(verifiedAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays < 1)  return '✓ Verified Today';
    if (ageDays < 7)  return '✓ Live Update';
  }

  return null;
}
