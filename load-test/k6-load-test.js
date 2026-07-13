/**
 * Sarto Load Test
 * ---------------
 * Simulates concurrent users across the paths that actually take load: the
 * read-heavy "bank" endpoints hit while browsing a result (restaurants /
 * attractions / landmarks), plus the generate flow.
 *
 * IMPORTANT on cost:
 *   - Set MOCK_AI=true so /api/generate uses no AI tokens.
 *   - The bank reads (/api/restaurants, /api/attractions, /api/landmarks) hit the
 *     REAL DB. Keep to the warm CITIES below so /api/landmarks doesn't trigger
 *     Google Places photo backfill (paid) for a cold city. To load-test the
 *     cold-city backfill specifically, do it deliberately against staging.
 *
 * Install k6:  brew install k6
 * Run:         k6 run load-test/k6-load-test.js
 * Ramp to 100: k6 run --stage 30s:100 --stage 60s:100 --stage 15s:0 load-test/k6-load-test.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

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
  const ok = check(genRes, {
    'generate: status 200':    (r) => r.status === 200,
    'generate: has itinerary': (r) => { try { return !!JSON.parse(r.body).itinerary; } catch { return false; } },
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
