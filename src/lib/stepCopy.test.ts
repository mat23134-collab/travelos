import assert from 'node:assert/strict';
import { getStepCopy, spellNights } from './stepCopy';

// ── spellNights ──────────────────────────────────────────────────────────────
assert.equal(spellNights(1),  'One night');
assert.equal(spellNights(5),  'Five nights');
assert.equal(spellNights(12), 'Twelve nights');
assert.equal(spellNights(13), '13 nights');

// ── static fallbacks (nothing answered yet) ─────────────────────────────────
const empty = { cityName: null, nights: null, groupType: null };
assert.equal(getStepCopy(0, empty).headline, 'Where to?');
assert.equal(getStepCopy(1, empty).headline, 'When are you traveling?');
assert.equal(getStepCopy(2, empty).headline, "What's the budget?");
assert.equal(getStepCopy(3, empty).headline, 'How do you travel?');
assert.equal(getStepCopy(4, empty).headline, 'Where will you stay?');
assert.equal(getStepCopy(5, empty).headline, 'Any dining rules?');
assert.equal(getStepCopy(6, empty).headline, 'Last touch');

// every step has a non-empty sub line
for (let i = 0; i <= 6; i++) {
  assert.ok(getStepCopy(i, empty).sub.length > 0, `step ${i}: sub present`);
}

// ── dynamic variants ─────────────────────────────────────────────────────────
const rome = { cityName: 'Rome', nights: 5, groupType: null };
assert.equal(getStepCopy(1, rome).headline, 'When does Rome happen?');
assert.equal(getStepCopy(2, rome).headline, "Five nights in Rome — what's the budget?");
assert.equal(getStepCopy(3, rome).headline, 'How fast do you want Rome to move?');
assert.equal(getStepCopy(4, rome).headline, 'Where will you sleep in Rome?');
assert.equal(getStepCopy(5, rome).headline, 'Eating your way through Rome — any rules?');
assert.equal(getStepCopy(6, rome).headline, "Last touch — what can't you miss in Rome?");

// city known but dates not yet → step 2 falls back to city-only phrasing
const romeNoDates = { cityName: 'Rome', nights: null, groupType: null };
assert.equal(getStepCopy(2, romeNoDates).headline, "Rome — what's the budget?");

// out-of-range step → safe generic
assert.equal(getStepCopy(99, empty).headline, 'Almost there');

console.log('All stepCopy tests passed ✅');
