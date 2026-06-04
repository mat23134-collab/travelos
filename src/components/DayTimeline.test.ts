import assert from 'node:assert/strict';
import { buildTimelineRows, isHotelCheckIn } from './DayTimeline';
import type { DayPlan } from '../lib/types';

// isHotelCheckIn
assert.equal(isHotelCheckIn({ name: 'Hotel Check-in' }), true);
assert.equal(isHotelCheckIn({ name: 'Hotel Indigo Check In' }), true);
assert.equal(isHotelCheckIn({ name: 'Colosseum Tour' }), false);
assert.equal(isHotelCheckIn({ name: '' }), false);

// buildTimelineRows: full day produces 5 rows (morning, lunch, afternoon, dinner, evening)
const full: DayPlan = {
  day: 1,
  morning: { name: 'Hotel Check-in', startTime: '09:00' },
  lunch: { name: 'Trattoria Da Enzo' },
  afternoon: { name: 'Roman Forum', startTime: '15:00' },
  dinner: { name: 'La Pergola' },
  evening: { name: 'Trastevere Walk', startTime: '20:00' },
};
const rows = buildTimelineRows(full);
assert.equal(rows.length, 5);
assert.equal(rows[0].type, 'activity');
assert.equal(rows[0].slot, 'morning');
assert.equal(rows[1].type, 'dining');
assert.equal(rows[1].name, 'Trattoria Da Enzo');
assert.equal(rows[4].slot, 'evening');

// buildTimelineRows: empty day → 0 rows
assert.equal(buildTimelineRows({ day: 2 }).length, 0);

// buildTimelineRows: partial day → only present slots
const partial: DayPlan = { day: 3, afternoon: { name: 'Vatican' }, dinner: { name: 'Prati Spot' } };
const partialRows = buildTimelineRows(partial);
assert.equal(partialRows.length, 2);
assert.equal(partialRows[0].slot, 'afternoon');

console.log('✓ DayTimeline helpers: all 11 assertions passed');

// ── NEW: buildMapsDirectionsUrl + slotForDining ───────────────────────────
import { buildMapsDirectionsUrl, slotForDining } from './DayTimeline';

const url1 = buildMapsDirectionsUrl('Café Sillon', 'Vieux Lyon', 'Lyon');
assert.ok(url1.startsWith('https://www.google.com/maps/dir/?api=1&destination='), `bad prefix: ${url1}`);
assert.ok(url1.includes('Lyon'), `missing city in: ${url1}`);
assert.ok(!url1.includes('undefined'), `undefined in URL: ${url1}`);

const url2 = buildMapsDirectionsUrl('Colosseum', undefined, 'Rome');
assert.ok(url2.includes('Colosseum'), `missing name: ${url2}`);
assert.ok(!url2.includes('undefined'), `undefined in URL: ${url2}`);

assert.equal(slotForDining('lunch'), 'morning');
assert.equal(slotForDining('dinner'), 'evening');

console.log('✓ buildMapsDirectionsUrl + slotForDining: all 7 new assertions passed');
