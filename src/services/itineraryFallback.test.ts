import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateItineraryOrThrow } from './itineraryFallback';

// A real Hanoi-style AI itinerary where Gemini emitted `evening` as a STRING
// on one day (it ignored the "object" instruction). The OLD strict schema threw
// on this single malformed optional slot and discarded the WHOLE trip, dumping
// the run into the generic fallback. Resilient validation must drop the bad slot
// and keep every real venue.
function buildItinerary(overrides: Record<string, unknown> = {}) {
  return {
    destination: 'Hanoi',
    totalDays: 2,
    days: [
      {
        day: 1,
        breakfast: { name: 'Pho Gia Truyen', latitude: 21.0333, longitude: 105.8501 },
        morning: { name: 'Hoan Kiem Lake', latitude: 21.0287, longitude: 105.8524 },
        lunch: { name: 'Bun Cha Huong Lien', latitude: 21.0167, longitude: 105.8497 },
        afternoon: { name: 'Temple of Literature', latitude: 21.0294, longitude: 105.8356 },
        dinner: { name: 'Cha Ca Thang Long', latitude: 21.0356, longitude: 105.8497 },
        evening: { name: 'Beer Corner Ta Hien', latitude: 21.0345, longitude: 105.8525 },
      },
      {
        day: 2,
        breakfast: { name: 'Banh Cuon Gia Truyen', latitude: 21.0341, longitude: 105.8510 },
        morning: { name: 'Ho Chi Minh Mausoleum', latitude: 21.0367, longitude: 105.8347 },
        lunch: { name: 'Quan An Ngon', latitude: 21.0245, longitude: 105.8412 },
        dinner: { name: 'Old Town Street Food', latitude: 21.0350, longitude: 105.8500 },
      },
    ],
    ...overrides,
  };
}

test('drops a malformed evening slot (string) but keeps the rest of the trip', () => {
  const raw = buildItinerary();
  // Gemini emitted evening as a plain string on day 1.
  (raw.days[0] as Record<string, unknown>).evening = 'Wander the Old Quarter night market';

  const result = validateItineraryOrThrow(raw);

  // Whole itinerary survived.
  assert.equal(result.destination, 'Hanoi');
  assert.equal(result.days.length, 2);
  // Real venues are intact.
  assert.equal(result.days[0].morning?.name, 'Hoan Kiem Lake');
  assert.equal(result.days[1].lunch?.name, 'Quan An Ngon');
  // The malformed slot was dropped, not kept as a string.
  assert.equal(result.days[0].evening, undefined);
});

test('accepts a venue with a name but no coordinates (Google Places fills GPS later)', () => {
  const raw = buildItinerary();
  (raw.days[0] as Record<string, unknown>).morning = { name: 'Hoan Kiem Lake' };

  const result = validateItineraryOrThrow(raw);

  assert.equal(result.days[0].morning?.name, 'Hoan Kiem Lake');
});

test('accepts a venue with null coordinates', () => {
  const raw = buildItinerary();
  (raw.days[0] as Record<string, unknown>).dinner = {
    name: 'Cha Ca Thang Long',
    latitude: null,
    longitude: null,
  };

  const result = validateItineraryOrThrow(raw);

  assert.equal(result.days[0].dinner?.name, 'Cha Ca Thang Long');
});

test('still throws on a fundamentally broken itinerary (no days)', () => {
  assert.throws(() => validateItineraryOrThrow({ destination: 'Hanoi', totalDays: 2, days: [] }));
});

test('still throws when destination is missing', () => {
  const raw = buildItinerary();
  delete (raw as Record<string, unknown>).destination;
  assert.throws(() => validateItineraryOrThrow(raw));
});

test('drops a venue object whose name is empty rather than failing the trip', () => {
  const raw = buildItinerary();
  (raw.days[0] as Record<string, unknown>).lunch = { name: '', latitude: 21.0, longitude: 105.8 };

  const result = validateItineraryOrThrow(raw);

  assert.equal(result.days.length, 2);
  assert.equal(result.days[0].lunch, undefined);
});
