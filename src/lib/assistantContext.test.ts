// src/lib/assistantContext.test.ts
import assert from 'node:assert/strict';
import { anchorSlotForDining, buildAssistantContext } from './assistantContext';
import type { Itinerary, TravelerProfile } from './types';

// ── anchorSlotForDining ─────────────────────────────────────────────────────
assert.equal(anchorSlotForDining('breakfast'), 'morning');
assert.equal(anchorSlotForDining('lunch'),     'afternoon');
assert.equal(anchorSlotForDining('dinner'),    'evening');

// ── buildAssistantContext ───────────────────────────────────────────────────
const itinerary = {
  _id: 'itin-1',
  destination: 'Rome',
  days: [
    { morning: { name: 'Colosseum' }, lunch: { name: 'Felice' }, evening: { name: 'Trastevere walk' } },
    { afternoon: { name: 'Borghese' } },
  ],
} as unknown as Itinerary;

const profile = {
  groupType: 'couple', budget: 'mid-range', pace: 'moderate',
  interests: ['food', 'culture'], dietaryRestrictions: 'Vegetarian (flexible)',
} as unknown as TravelerProfile;

const ctx = buildAssistantContext(itinerary, profile);
assert.equal(ctx.itinerary_id, 'itin-1');
assert.equal(ctx.city, 'Rome');
assert.equal(ctx.daysSummary.length, 2);
assert.equal(ctx.daysSummary[0].dayNumber, 1);
assert.equal(ctx.daysSummary[0].slots.morning, 'Colosseum');
assert.equal(ctx.daysSummary[0].slots.lunch, 'Felice');
assert.equal(ctx.daysSummary[0].slots.evening, 'Trastevere walk');
assert.equal(ctx.daysSummary[0].slots.afternoon, undefined);
assert.ok(ctx.profileSummary.includes('couple'));
assert.ok(ctx.profileSummary.includes('food, culture'));
assert.ok(ctx.profileSummary.includes('Vegetarian'));

// no profile → safe string, still builds days
const ctx2 = buildAssistantContext(itinerary, null);
assert.equal(ctx2.profileSummary, 'no profile');
assert.equal(ctx2.daysSummary.length, 2);

console.log('All assistantContext tests passed ✅');
