import assert from 'node:assert/strict';
import { formatTripDateRange } from './formatTripDateRange';

// Same month, same year
const r1 = formatTripDateRange('2026-06-03', '2026-06-10');
assert.ok(r1?.includes('Jun'), `expected Jun in "${r1}"`);
assert.ok(r1?.includes('2026'), `expected year in "${r1}"`);

// Different months, same year
const r2 = formatTripDateRange('2026-06-28', '2026-07-05');
assert.ok(r2 !== null, 'cross-month should not be null');

// Cross-year
const r3 = formatTripDateRange('2025-12-28', '2026-01-05');
assert.ok(r3 !== null, 'cross-year should not be null');
assert.ok(r3?.includes('2025'), `expected 2025 in "${r3}"`);

// Invalid inputs
assert.equal(formatTripDateRange(null, null), null);
assert.equal(formatTripDateRange('bad', '2026-06-10'), null);
assert.equal(formatTripDateRange('2026-06-03', 'bad'), null);
assert.equal(formatTripDateRange('2026-06-03', undefined), null);

console.log('✓ formatTripDateRange: all 9 assertions passed');
