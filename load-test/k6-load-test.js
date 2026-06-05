/**
 * TravelOS Load Test
 * ------------------
 * Simulates concurrent users going through the core trip-generation flow.
 * Requires MOCK_AI=true in your .env.local so no AI tokens or DB writes are used.
 *
 * Install k6:  brew install k6  (Mac)  |  choco install k6  (Windows)
 * Run:         k6 run load-test/k6-load-test.js
 * Custom load: k6 run --vus 50 --duration 60s load-test/k6-load-test.js
 *
 * Stages (default):
 *   0→10 users over 15s  — ramp up
 *   10 users for 30s     — sustained load
 *   10→0 users over 10s  — ramp down
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '15s', target: 10 },  // ramp up to 10 concurrent users
    { duration: '30s', target: 10 },  // hold
    { duration: '10s', target: 0 },   // ramp down
  ],
  thresholds: {
    http_req_failed:          ['rate<0.05'],          // <5% errors
    http_req_duration:        ['p(95)<3000'],          // 95% of requests under 3s
    generate_duration:        ['p(95)<2000'],          // generate endpoint under 2s (mock)
    transport_duration:       ['p(95)<500'],           // transport read under 500ms
  },
};

// ── Custom metrics ────────────────────────────────────────────────────────────

const generateDuration  = new Trend('generate_duration',  true);
const transportDuration = new Trend('transport_duration', true);
const errorRate         = new Rate('error_rate');

// ── Sample traveler profiles ──────────────────────────────────────────────────

const PROFILES = [
  { destination: 'Tokyo',     duration: 3, groupType: 'couple',  budget: 'mid-range',  pace: 'moderate', interests: ['food', 'culture'] },
  { destination: 'Paris',     duration: 5, groupType: 'solo',    budget: 'budget',     pace: 'relaxed',  interests: ['art', 'food'] },
  { destination: 'New York',  duration: 4, groupType: 'group',   budget: 'luxury',     pace: 'fast',     interests: ['nightlife', 'shopping'] },
  { destination: 'Barcelona', duration: 6, groupType: 'couple',  budget: 'mid-range',  pace: 'moderate', interests: ['culture', 'beach'] },
  { destination: 'Bangkok',   duration: 7, groupType: 'friends', budget: 'budget',     pace: 'fast',     interests: ['food', 'nightlife'] },
];

// ── Main virtual user flow ────────────────────────────────────────────────────

export default function () {
  const profile = PROFILES[Math.floor(Math.random() * PROFILES.length)];
  const headers = { 'Content-Type': 'application/json' };

  // ── Step 1: Generate itinerary ──────────────────────────────────────────────
  const genStart = Date.now();
  const genRes = http.post(
    `${BASE_URL}/api/generate`,
    JSON.stringify(profile),
    { headers, tags: { name: 'generate' } },
  );
  generateDuration.add(Date.now() - genStart);

  const genOk = check(genRes, {
    'generate: status 200':       (r) => r.status === 200,
    'generate: has itinerary':    (r) => {
      try { return !!JSON.parse(r.body).itinerary; } catch { return false; }
    },
  });
  errorRate.add(!genOk);

  if (!genOk) {
    console.error(`generate failed [${genRes.status}]: ${r.body?.slice(0, 200)}`);
    sleep(1);
    return;
  }

  sleep(0.5);

  // ── Step 2: Fetch cached transport for the city ─────────────────────────────
  const transStart = Date.now();
  const transRes = http.get(
    `${BASE_URL}/api/transportation?city=${encodeURIComponent(profile.destination)}`,
    { tags: { name: 'transportation' } },
  );
  transportDuration.add(Date.now() - transStart);

  check(transRes, {
    'transport: status 200': (r) => r.status === 200,
  });

  sleep(1);
}
