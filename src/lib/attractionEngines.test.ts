import assert from 'node:assert/strict';
import { findEngineOverlap } from './attractionBank';
import type { AttractionRecommendation } from './types';

function rec(over: Partial<AttractionRecommendation>): AttractionRecommendation {
  return { city: 'Rome', name: 'placeholder', source: 'scout', score: 0, ...over };
}

// No overlap: distinct places, distinct place_ids, distinct names.
const bookAheadClean = [
  rec({ name: 'Colosseum Underground Tour', googlePlaceId: 'p1' }),
  rec({ name: 'Vatican Museums', googlePlaceId: 'p2' }),
];
const walkInClean = [
  rec({ name: 'Trastevere Neighborhood', googlePlaceId: 'p3' }),
  rec({ name: 'Piazza Navona', googlePlaceId: 'p4' }),
];
assert.deepEqual(findEngineOverlap(bookAheadClean, walkInClean), [], 'clean sets must report zero overlap');

// Overlap by google_place_id (authoritative — same physical place even if named differently).
const walkInSamePlaceId = [
  rec({ name: 'Piazza Navona (exterior)', googlePlaceId: 'p2' }), // same place_id as Vatican Museums
];
const overlapById = findEngineOverlap(bookAheadClean, walkInSamePlaceId);
assert.equal(overlapById.length, 1, 'must detect overlap by matching google_place_id');
assert.equal(overlapById[0].name, 'Piazza Navona (exterior)');

// Overlap by normalized name (fallback when no place_id on either/both sides).
const walkInSameName = [
  rec({ name: 'vatican museums' }), // same name, different case, no place_id
];
const overlapByName = findEngineOverlap(bookAheadClean, walkInSameName);
assert.equal(overlapByName.length, 1, 'must detect overlap by normalized name when place_id is absent');

console.log('attractionEngines.test.ts: all assertions passed');
