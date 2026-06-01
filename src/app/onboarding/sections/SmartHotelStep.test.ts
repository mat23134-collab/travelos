import assert from 'node:assert/strict';
import { getNightlyOptionsForAccommodation } from './SmartHotelStep';
import { getHotelPersonalization } from '../../../lib/hotelPersonalization';

// ── existing tests (unchanged) ──────────────────────────────────────────────

const labels = (accommodation: Parameters<typeof getNightlyOptionsForAccommodation>[0]) =>
  getNightlyOptionsForAccommodation(accommodation).map((option) => option.label);

assert.deepEqual(labels('luxury-hotel'), ['$150 - $300', '$300+']);
assert.deepEqual(labels('resort'),       ['$150 - $300', '$300+']);
assert.deepEqual(labels('boutique-hotel'), ['$80 - $150', '$150 - $300', '$300+']);
assert.deepEqual(labels('hostel'),       ['Up to $80', '$80 - $150']);
assert.deepEqual(labels('airbnb'),       ['$80 - $150', '$150 - $300', '$300+']);

console.log('✓ getNightlyOptionsForAccommodation — all label tests passed');

// ── new personalization tests ────────────────────────────────────────────────

const defaultCfg = getHotelPersonalization('', null, '');
assert.equal(defaultCfg.contextBadge, null, 'default: no badge');
assert.equal(defaultCfg.accomOrder.length, 5, 'default: 5 options');
assert.ok(defaultCfg.amenityPreset.length > 0, 'default: some amenities');

const nomad = getHotelPersonalization('solo', { subType: 'digital-nomad' }, 'mid-range');
assert.equal(nomad.accomOrder[0], 'boutique-hotel', 'nomad: boutique first');
assert.equal(nomad.accomOrder[1], 'airbnb',         'nomad: airbnb second');
assert.ok(nomad.amenityPreset.includes('workspace'), 'nomad: workspace preset');
assert.ok(nomad.accomDimmed.includes('resort'),      'nomad: resort dimmed');
assert.ok(nomad.contextBadge !== null,               'nomad: badge shown');

const family = getHotelPersonalization('family', null, 'mid-range');
assert.equal(family.accomOrder[0], 'airbnb',  'family: airbnb first');
assert.equal(family.accomOrder[1], 'resort',  'family: resort second');
assert.ok(family.amenityPreset.includes('pool'),     'family: pool preset');
assert.ok(family.accomDimmed.includes('hostel'),     'family: hostel dimmed');

const romantic = getHotelPersonalization('couple', { subType: 'romantic' }, 'mid-range');
assert.equal(romantic.accomOrder[0], 'boutique-hotel', 'romantic: boutique first');
assert.equal(romantic.accomOrder[1], 'luxury-hotel',   'romantic: luxury second');
assert.ok(romantic.amenityPreset.includes('rooftop'),  'romantic: rooftop preset');

const budgetSolo = getHotelPersonalization('solo', { subType: 'adventure' }, 'budget');
assert.ok(budgetSolo.accomDimmed.includes('luxury-hotel'), 'budget: dims luxury');
assert.ok(budgetSolo.accomDimmed.includes('resort'),       'budget: dims resort');

const luxuryCouple = getHotelPersonalization('couple', { subType: 'romantic' }, 'luxury');
assert.ok(luxuryCouple.accomDimmed.includes('hostel'), 'luxury: dims hostel');

const workCrew = getHotelPersonalization('group', { subType: 'work-crew' }, 'mid-range');
assert.equal(workCrew.accomOrder[0], 'luxury-hotel',           'work-crew: luxury first');
assert.ok(workCrew.amenityPreset.includes('workspace'),         'work-crew: workspace preset');
assert.ok(workCrew.locationOrder[0] === 'transit',              'work-crew: transit first');

console.log('✓ getHotelPersonalization — all personalization tests passed');
console.log('All SmartHotelStep tests passed ✅');
