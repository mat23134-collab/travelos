import assert from 'node:assert/strict';
import { getNightlyOptionsForAccommodation } from './SmartHotelStep';

const labels = (accommodation: Parameters<typeof getNightlyOptionsForAccommodation>[0]) =>
  getNightlyOptionsForAccommodation(accommodation).map((option) => option.label);

assert.deepEqual(labels('luxury-hotel'), ['$150 - $300', '$300+']);
assert.deepEqual(labels('resort'), ['$150 - $300', '$300+']);
assert.deepEqual(labels('boutique-hotel'), ['$80 - $150', '$150 - $300', '$300+']);
assert.deepEqual(labels('hostel'), ['Up to $80', '$80 - $150']);
assert.deepEqual(labels('airbnb'), ['$80 - $150', '$150 - $300', '$300+']);

console.log('SmartHotelStep nightly budget filtering tests passed');
