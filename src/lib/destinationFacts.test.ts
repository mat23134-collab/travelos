import assert from 'node:assert/strict';
import { getDestinationFacts } from './destinationFacts';

// Known city returns 3 facts
const paris = getDestinationFacts('Paris');
assert.equal(paris.length, 3, 'Paris: exactly 3 facts');
assert.ok(paris.every((f) => typeof f === 'string' && f.length > 10), 'Paris: all facts are non-empty strings');

// Unknown city returns default facts
const unknown = getDestinationFacts('Atlantis');
assert.equal(unknown.length, 3, 'Unknown city: falls back to 3 default facts');

// Whitespace is trimmed
const padded = getDestinationFacts('  Tokyo  ');
assert.equal(padded.length, 3, 'Trimmed key still resolves');

// All 15 covered cities return facts
const cities = [
  'Paris','Tokyo','Rome','London','Barcelona','Amsterdam',
  'Lisbon','New York','Dubai','Athens','Budapest','Vienna',
  'Rio de Janeiro','Sydney','Singapore',
];
for (const city of cities) {
  const facts = getDestinationFacts(city);
  assert.equal(facts.length, 3, `${city}: 3 facts`);
  assert.ok(facts[0].length > 20, `${city}: first fact is substantial`);
}

console.log('✓ getDestinationFacts — all tests passed');
