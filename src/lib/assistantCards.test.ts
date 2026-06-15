// src/lib/assistantCards.test.ts
import assert from 'node:assert/strict';
import { buildCardsFromRecommendations } from './assistantCards';
import type { PlaceRow, AssistantRecommendation, SwapTarget } from './assistantTypes';

const rows: PlaceRow[] = [
  { id: 'a', name: 'Alpha', city: 'Rome', category: 'restaurant', description: 'A', lat: 1, lng: 2, category_emoji: '🍝', vibe: ['x'], group_suitability: [], culinary_focus: [], google_rating: 4.5, popularity_rank: 1, website_url: null, vibe_label: null },
  { id: 'b', name: 'Beta',  city: 'Rome', category: 'restaurant', description: 'B', lat: 3, lng: 4, category_emoji: '🍕', vibe: null,  group_suitability: [], culinary_focus: [], google_rating: 4.2, popularity_rank: 2, website_url: null, vibe_label: null },
];
const target: SwapTarget = { dayIndex: 1, slot: 'afternoon', diningField: 'lunch' };

// preserves order, drops unknown ids, sets whyThis from reasoning, keeps one top pick
const recs: AssistantRecommendation[] = [
  { placeId: 'b', reasoning: 'closer to your hotel', isTopPick: true },
  { placeId: 'a', reasoning: 'higher rated', isTopPick: false },
  { placeId: 'zzz', reasoning: 'ghost', isTopPick: true },
];
const cards = buildCardsFromRecommendations(rows, recs, target);
assert.equal(cards.length, 2);
assert.equal(cards[0].placeId, 'b');
assert.equal(cards[0].isTopPick, true);
assert.equal(cards[0].reasoning, 'closer to your hotel');
assert.equal(cards[0].activity.whyThis, 'closer to your hotel');
assert.equal(cards[0].activity.name, 'Beta');
assert.deepEqual(cards[0].target, target);
assert.equal(cards[1].placeId, 'a');
assert.equal(cards[1].isTopPick, false);

// only ONE top pick even if model marks several
const multiTop: AssistantRecommendation[] = [
  { placeId: 'a', reasoning: 'r1', isTopPick: true },
  { placeId: 'b', reasoning: 'r2', isTopPick: true },
];
const cards2 = buildCardsFromRecommendations(rows, multiTop, target);
assert.equal(cards2.filter((c) => c.isTopPick).length, 1);
assert.equal(cards2[0].isTopPick, true);

// none marked → first becomes top pick
const noneTop: AssistantRecommendation[] = [
  { placeId: 'a', reasoning: 'r1', isTopPick: false },
  { placeId: 'b', reasoning: 'r2', isTopPick: false },
];
const cards3 = buildCardsFromRecommendations(rows, noneTop, target);
assert.equal(cards3[0].isTopPick, true);
assert.equal(cards3.filter((c) => c.isTopPick).length, 1);

// no matching rows → empty
assert.deepEqual(buildCardsFromRecommendations([], recs, target), []);

console.log('All assistantCards tests passed ✅');
