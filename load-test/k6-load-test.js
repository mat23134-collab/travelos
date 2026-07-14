/**
 * Sarto Load Test
 * ---------------
 * Simulates concurrent users across the paths that actually take load: the
 * read-heavy "bank" endpoints hit while browsing a result (restaurants /
 * attractions / landmarks), plus the generate flow.
 *
 * IMPORTANT on cost:
 *   - The SERVER (not this script) must have MOCK_AI=true set so /api/generate
 *     uses no AI tokens — this script cannot set that env var for you.
 *   - setup() below makes a single preflight call to /api/generate and ABORTS
 *     the whole run if the server isn't actually in mock mode. Without this,
 *     forgetting to set MOCK_AI=true server-side meant the full VU ramp would
 *     silently hit the REAL AI provider — the load test would look "green" in
 *     the terminal while quietly running up a real API bill.
 *   - The bank reads (/api/restaurants, /api/attractions, /api/landmarks) hit the
 *     REAL DB. Keep to the warm CITIES below so /api/landmarks doesn't trigger
 *     Google Places photo backfill (paid) for a cold city. To load-test the
 *     cold-city backfill specifically, do it deliberately against staging.
 *
 * Install k6:  brew install k6
 * Run:         MOCK_AI=true npm run dev   # in another terminal, then:
 *              k6 run load-test/k6-load-test.js
 * Ramp to 100: k6 run --stage 30s:100 --stage 60s:100 --stage 15s:0 load-test/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const MOCK_ITINERARY_ID = 'mock-itinerary-id'; // must match src/app/api/generate/route.ts

export const options = {
  stages: [
    { duration: '15s', target: 20 },
    { duration: '45s', target: 20 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed:     ['rate<0.05'],
    http_req_duration:   ['p(95)<3000'],
    generate_duration:   ['p(95)<2500'],
    bank_read_duration:  ['p(95)<800'],   // warm-cache bank reads should be fast
  },
};

const generateDuration = new Trend('generate_duration', true);
const bankReadDuration = new Trend('bank_read_duration', true);
const errorRate        = new Rate('error_rate');

// Warm cities only (already pre-warmed banks) — avoids paid cold-city backfill.
const CITIES = ['Tokyo', 'Paris', 'Rome', 'Barcelona', 'Lisbon', 'Amsterdam', 'New York'];
const LANGS  = ['en', 'he'];

const PROFILES = [
  { destination: 'Tokyo',     duration: 3, groupType: 'couple',  budget: 'mid-range', pace: 'moderate', interests: ['food', 'culture'] },
  { destination: 'Paris',     duration: 5, groupType: 'solo',    budget: 'budget',    pace: 'relaxed',  interests: ['art', 'food'] },
  { destination: 'Barcelona', duration: 6, groupType: 'couple',  budget: 'mid-range', pace: 'moderate', interests: ['culture', 'beach'] },
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// ── Cost-safety preflight ────────────────────────────────────────────────────
// Runs ONCE before any VU starts. If the server isn't actually mocking AI,
// abort here instead of ramping 20+ concurrent VUs into the real provider.
export function setup() {
  const res = http.post(
    `${BASE_URL}/api/generate`,
    JSON.stringify(PROFILES[0]),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'setup_preflight' } },
  );

  let parsed = null;
  try { parsed = JSON.parse(res.body); } catch { /* handled by the check below */ }

  const mockActive = parsed?.id === MOCK_ITINERARY_ID;
  if (!mockActive) {
    throw new Error(
      `Refusing to load-test: /api/generate did not return the mock response ` +
      `(status ${res.status}, id=${parsed?.id ?? 'n/a'}). Set MOCK_AI=true on the ` +
      `SERVER before running this test, or you will hit the real AI provider at load concurrency.`,
    );
  }
}

// A browsing user: opens a result and the concierge banks read from the DB.
function browse() {
  const city = pick(CITIES);
  const lang = pick(LANGS);
  for (const kind of ['restaurants', 'attractions', 'landmarks']) {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/${kind}?city=${encodeURIComponent(city)}&lang=${lang}`,
      { tags: { name: `bank_${kind}` } },
    );
    bankReadDuration.add(Date.now() - start);
    const ok = check(res, { [`${kind}: status 200`]: (r) => r.status === 200 });
    errorRate.add(!ok);
    sleep(0.3);
  }
}

// A converting user: runs generation (mock AI).
function generate() {
  const profile = PROFILES[Math.floor(Math.random() * PROFILES.length)];
  const start = Date.now();
  const genRes = http.post(
    `${BASE_URL}/api/generate`,
    JSON.stringify(profile),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'generate' } },
  );
  generateDuration.add(Date.now() - start);

  // The original single combined check ('has itinerary') only verified that
  // SOME itinerary came back — but a REAL (non-mocked) /api/generate call also
  // returns a well-formed `.itinerary`. So if MOCK_AI silently wasn't active on
  // some instance (multi-instance deploy, env drift, restart mid-run), those
  // requests hit the real AI provider and the check still reported "pass",
  // masking the real-cost run entirely instead of failing it loudly. Parse the
  // body once and check the mock marker (`id === MOCK_ITINERARY_ID`) as its own
  // assertion, separate from "has itinerary", so a real-AI response fails the
  // run visibly instead of blending into a green checkmark.
  let parsed = null;
  if (typeof genRes.body === 'string') {
    try { parsed = JSON.parse(genRes.body); } catch { /* left null — reported as invalid JSON below */ }
  }

  const ok = check(genRes, {
    'generate: status 200':      (r) => r.status === 200,
    'generate: valid JSON body': () => parsed !== null,
    'generate: is mock response': () => parsed?.id === MOCK_ITINERARY_ID,
    'generate: has itinerary':    () => !!parsed?.itinerary,
  });
  errorRate.add(!ok);
  if (!ok) console.error(`generate failed [${genRes.status}]: ${String(genRes.body).slice(0, 200)}`);
}

export default function () {
  // ~80% browse, ~20% generate — reflects real traffic (most people look, some build).
  if (Math.random() < 0.8) browse();
  else generate();
  sleep(1);
}
