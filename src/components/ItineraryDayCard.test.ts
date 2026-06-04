import assert from 'node:assert/strict';
import { deriveDayBullets } from './ItineraryDayCard';
import type { DayPlan } from '../lib/types';

// Full day → 3 bullets from morning/afternoon/evening
const full: DayPlan = {
  day: 1,
  theme: 'Welcome',
  morning: { name: 'Hotel Check-in' },
  afternoon: { name: 'Colosseum Tour' },
  evening: { name: 'Trastevere Dinner' },
};
assert.deepEqual(deriveDayBullets(full), ['Hotel Check-in', 'Colosseum Tour', 'Trastevere Dinner']);

// Partial day — only present slots
const partial: DayPlan = {
  day: 2,
  morning: { name: 'Vatican' },
  evening: { name: 'Aperitivo' },
};
assert.deepEqual(deriveDayBullets(partial), ['Vatican', 'Aperitivo']);

// Empty day → []
const empty: DayPlan = { day: 3 };
assert.deepEqual(deriveDayBullets(empty), []);

// Falls back to lunch/dinner names when morning/afternoon/evening missing
const diningOnly: DayPlan = {
  day: 4,
  lunch: { name: 'Trattoria Da Enzo' },
  dinner: { name: 'La Pergola' },
};
assert.deepEqual(deriveDayBullets(diningOnly), ['Trattoria Da Enzo', 'La Pergola']);

console.log('✓ deriveDayBullets: all 4 assertions passed');
