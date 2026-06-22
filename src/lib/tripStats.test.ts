import assert from 'node:assert/strict';
import { deriveTripStats } from './tripStats';
import type { Itinerary } from './types';

function baseItin(partial: Partial<Itinerary>): Itinerary {
  return { destination: 'Tokyo', totalDays: 0, days: [], ...partial };
}

// counts attractions across morning/afternoon/evening, ignores empty slots
const itin = baseItin({
  totalDays: 2,
  days: [
    {
      day: 1,
      morning: { name: 'Senso-ji', neighborhood: 'Asakusa' },
      afternoon: { name: 'Ueno Park', neighborhood: 'Ueno' },
      breakfast: { name: 'Cafe' },
      lunch: { name: 'Ramen' },
    },
    {
      day: 2,
      morning: { name: 'Meiji Shrine', neighborhood: 'asakusa' }, // dup neighborhood, different case
      evening: { name: 'Shibuya', neighborhood: 'Shibuya' },
      dinner: { name: 'Izakaya' },
    },
  ],
});

const stats = deriveTripStats(itin);
assert.equal(stats.days, 2, 'days');
assert.equal(stats.attractions, 4, 'attractions = 4 slots present');
assert.equal(stats.neighborhoods, 3, 'unique neighborhoods (Asakusa/asakusa merge) = Asakusa, Ueno, Shibuya');
assert.equal(stats.meals, 3, 'meals = breakfast+lunch+dinner present');

// falls back to days.length when totalDays is 0/missing
const noTotal = baseItin({ totalDays: 0, days: [{ day: 1, morning: { name: 'X' } }] });
assert.equal(deriveTripStats(noTotal).days, 1, 'days falls back to days.length');

// empty itinerary → all zeros, no throw
const empty = deriveTripStats(baseItin({}));
assert.deepEqual(empty, { days: 0, attractions: 0, neighborhoods: 0, meals: 0 }, 'empty');

console.log('✓ deriveTripStats — all tests passed');
