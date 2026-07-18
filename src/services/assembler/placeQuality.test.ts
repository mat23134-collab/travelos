// src/services/assembler/placeQuality.test.ts
// Run: npx tsx src/services/assembler/placeQuality.test.ts
import assert from 'node:assert/strict';
import {
  placeBayesRating, placeQuality, placeValueScore, placeTouristTrapPenalty, placeGoodness,
} from './placeQuality';

// ── Bayesian only kicks in when a review count is present ─────────────────────
{
  // No count → raw rating passes through unchanged (behavior preserved).
  assert.equal(placeBayesRating({ googleRating: 4.9 }), 4.9);
  // With counts, 4.9★/40 shrinks below 4.6★/4000.
  const hot = placeBayesRating({ googleRating: 4.9, ratingCount: 40 });
  const solid = placeBayesRating({ googleRating: 4.6, ratingCount: 4000 });
  assert.ok(solid > hot, `Bayesian: solid(${solid.toFixed(3)}) > hot(${hot.toFixed(3)})`);
}

// ── value-for-money: cheap+great beats expensive+mediocre ─────────────────────
{
  const cheapGreat = placeValueScore({ googleRating: 4.7, priceTier: 1 });
  const dearMeh = placeValueScore({ googleRating: 4.1, priceTier: 4 });
  assert.ok(cheapGreat > dearMeh, `value: cheap+great(${cheapGreat}) > dear+meh(${dearMeh})`);
  assert.ok(cheapGreat <= 1 && dearMeh >= 0, 'value in [0,1]');
  // Unknown price → neutral, not zero.
  assert.ok(placeValueScore({ googleRating: 4.5 }) > 0.4, 'unknown price is neutral');
}

// ── tourist-trap penalty: pricey + mediocre + on a sight; else none ───────────
{
  const trap = placeTouristTrapPenalty({ googleRating: 4.0, priceTier: 4 }, 90);
  assert.ok(trap < 1, `trap applies on a sight (${trap})`);
  assert.equal(placeTouristTrapPenalty({ googleRating: 4.0, priceTier: 4 }, 900), 1, 'far from any sight → no penalty');
  assert.equal(placeTouristTrapPenalty({ googleRating: 4.0, priceTier: 2 }, 90), 1, 'cheap place → no penalty');
  assert.equal(placeTouristTrapPenalty({ googleRating: 4.7, priceTier: 4 }, 90), 1, 'genuinely great → no penalty');
  assert.equal(placeTouristTrapPenalty({ googleRating: 4.0, priceTier: 4 }, null), 1, 'unknown distance → no penalty');
}

// ── goodness ranks a great-value spot over a trap ─────────────────────────────
{
  const gem = placeGoodness({ googleRating: 4.6, priceTier: 2 }, 400);
  const trap = placeGoodness({ googleRating: 4.0, priceTier: 4 }, 90);
  assert.ok(gem > trap, `great-value gem(${gem.toFixed(3)}) beats on-sight trap(${trap.toFixed(3)})`);
  assert.ok(placeQuality({ googleRating: 5.0 }) <= 1, 'quality capped at 1');
}

console.log('✓ placeQuality tests passed');
