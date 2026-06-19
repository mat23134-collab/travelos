import assert from 'node:assert/strict';
import { deriveDayBullets } from './ItineraryDayCard';
import type { DayPlan } from '../lib/types';

// Activities only (no meals) → activity names in order
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

// Dining shown (with emoji) even alongside no activities
const diningOnly: DayPlan = {
  day: 4,
  lunch: { name: 'Trattoria Da Enzo' },
  dinner: { name: 'La Pergola' },
};
assert.deepEqual(deriveDayBullets(diningOnly), ['🍽️ Trattoria Da Enzo', '🍷 La Pergola']);

// Full day with meals → chronological mix incl. restaurants, capped at 4
const fullWithMeals: DayPlan = {
  day: 5,
  breakfast: { name: 'Soy Milk King' },
  morning: { name: 'Temple' },
  lunch: { name: 'Din Tai Fung' },
  afternoon: { name: 'Market' },
  dinner: { name: 'Night Market' },
  evening: { name: 'Rooftop Bar' },
};
assert.deepEqual(
  deriveDayBullets(fullWithMeals),
  ['☕ Soy Milk King', 'Temple', '🍽️ Din Tai Fung', 'Market'],
);

console.log('✓ deriveDayBullets: all 5 assertions passed');
