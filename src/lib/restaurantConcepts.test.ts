// src/lib/restaurantConcepts.test.ts
// Run: npx tsx src/lib/restaurantConcepts.test.ts
import assert from 'node:assert/strict';
import { matchesConcept, availableConcepts, conceptLabel } from './restaurantConcepts';
import type { RestaurantRecommendation } from './types';

const ramen: RestaurantRecommendation = { city: 'Tokyo', name: 'AFURI', cuisineStyle: 'Yuzu shio ramen', description: 'A cult ramen counter.' };
const sushi: RestaurantRecommendation = { city: 'Tokyo', name: 'Sushi Saito', cuisineGenre: 'omakase-counter', description: 'Edomae omakase.' };
const pizza: RestaurantRecommendation = { city: 'Rome', name: 'Emma', cuisineStyle: 'Roman pizza', signatureDish: 'Pizza margherita' };
const pasta: RestaurantRecommendation = { city: 'Rome', name: 'Roscioli', cuisineStyle: 'Trattoria', signatureDish: 'Cacio e pepe' };

// ── concept matching ──────────────────────────────────────────────────────────
assert.ok(matchesConcept(ramen, 'ramen'), 'ramen text matches ramen concept');
assert.ok(!matchesConcept(ramen, 'pizza'), 'ramen does not match pizza');
assert.ok(matchesConcept(sushi, 'omakase'), 'omakase genre/desc matches');
assert.ok(matchesConcept(pizza, 'pizza'), 'pizza matches');
assert.ok(matchesConcept(pasta, 'pasta'), 'trattoria/cacio matches pasta concept');

// ── Hebrew keyword match ──────────────────────────────────────────────────────
assert.ok(matchesConcept({ city: 'Tokyo', name: 'x', description: 'דלפק ראמן מעולה' }, 'ramen'), 'hebrew ramen matches');

// ── availableConcepts is data-driven (only present concepts show) ─────────────
const tokyo = availableConcepts([ramen, sushi]).map((c) => c.key);
assert.ok(tokyo.includes('ramen') && tokyo.includes('omakase'), 'Tokyo surfaces ramen + omakase');
assert.ok(!tokyo.includes('pizza'), 'Tokyo does not surface pizza');
const rome = availableConcepts([pizza, pasta]).map((c) => c.key);
assert.ok(rome.includes('pizza') && rome.includes('pasta'), 'Rome surfaces pizza + pasta');
assert.ok(!rome.includes('ramen'), 'Rome does not surface ramen');

// ── labels ────────────────────────────────────────────────────────────────────
assert.equal(conceptLabel('ramen', 'he'), 'ראמן');
assert.equal(conceptLabel('pizza', 'en'), 'Pizza');

console.log('✓ restaurantConcepts tests passed');
