// src/lib/placesQuery.test.ts
import assert from 'node:assert/strict';
import { categoriesForSlot, placeRowToActivity } from './placesQuery';
import type { PlaceRow } from './assistantTypes';

// ── categoriesForSlot ───────────────────────────────────────────────────────
assert.deepEqual(categoriesForSlot('breakfast'), ['cafe', 'restaurant']);
assert.deepEqual(categoriesForSlot('lunch'),     ['restaurant', 'cafe', 'bar']);
assert.deepEqual(categoriesForSlot('dinner'),    ['restaurant', 'cafe', 'bar']);
assert.deepEqual(categoriesForSlot('morning'),   ['attraction', 'tourism_site', 'nature', 'market']);
assert.deepEqual(categoriesForSlot('afternoon'), ['attraction', 'tourism_site', 'nature', 'market']);
assert.deepEqual(categoriesForSlot('evening'),   ['attraction', 'tourism_site', 'bar', 'nightlife']);

// ── placeRowToActivity ──────────────────────────────────────────────────────
const row: PlaceRow = {
  id: 'p1', name: 'Felice a Testaccio', city: 'Rome', category: 'restaurant',
  description: 'Cacio e pepe institution', lat: 41.1, lng: 12.5, category_emoji: '🍝',
  vibe: ['cozy', 'local'], group_suitability: ['couple'], culinary_focus: ['pasta'],
  google_rating: 4.6, popularity_rank: 3, website_url: 'https://felice.example', vibe_label: null,
};
const act = placeRowToActivity(row);
assert.equal(act.name, 'Felice a Testaccio');
assert.equal(act.description, 'Cacio e pepe institution');
assert.equal(act.latitude, 41.1);
assert.equal(act.longitude, 12.5);
assert.equal(act.website_url, 'https://felice.example');
assert.equal(act.category_emoji, '🍝');
assert.deepEqual(act.tags, ['cozy', 'local']);
assert.equal(act.inventory_id, 'p1');
assert.equal(act.inventory_source_table, 'places');

// null vibe → empty tags, null fields → undefined
const sparse: PlaceRow = { ...row, id: 'p2', description: null, lat: null, lng: null, website_url: null, category_emoji: null, vibe: null };
const act2 = placeRowToActivity(sparse);
assert.deepEqual(act2.tags, []);
assert.equal(act2.description, undefined);
assert.equal(act2.latitude, undefined);
assert.equal(act2.website_url, undefined);

console.log('All placesQuery pure tests passed ✅');
