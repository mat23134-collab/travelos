// src/lib/restaurantConcepts.test.ts
// Run: npx tsx src/lib/restaurantConcepts.test.ts
import assert from 'node:assert/strict';
import { matchesConcept, availableConcepts, conceptLabel, resolveCountry } from './restaurantConcepts';
import type { RestaurantRecommendation } from './types';

const ramen: RestaurantRecommendation = { city: 'Tokyo', name: 'AFURI', cuisineStyle: 'Yuzu shio ramen', countryCode: 'JP', description: 'A cult ramen counter.' };
const sushi: RestaurantRecommendation = { city: 'Tokyo', name: 'Sushi Saito', cuisineGenre: 'omakase-counter', countryCode: 'JP', description: 'Edomae omakase.' };
const pizza: RestaurantRecommendation = { city: 'Rome', name: 'Emma', cuisineStyle: 'Roman pizza', countryCode: 'IT', signatureDish: 'Pizza margherita' };
const pasta: RestaurantRecommendation = { city: 'Rome', name: 'Roscioli', cuisineStyle: 'Trattoria', countryCode: 'IT', signatureDish: 'Cacio e pepe' };

// ── concept matching ──────────────────────────────────────────────────────────
assert.ok(matchesConcept(ramen, 'ramen'), 'ramen cuisine matches ramen concept');
assert.ok(!matchesConcept(ramen, 'pizza'), 'ramen does not match pizza');
assert.ok(matchesConcept(sushi, 'omakase'), 'omakase genre matches');
assert.ok(matchesConcept(pizza, 'pizza'), 'pizza matches');
assert.ok(matchesConcept(pasta, 'pasta'), 'trattoria/cacio matches pasta concept');

// ── description prose must NOT create false matches ───────────────────────────
const trattoria: RestaurantRecommendation = {
  city: 'Florence', name: 'Trattoria La Burrasca', cuisineStyle: 'Modern Tuscan', countryCode: 'IT',
  description: 'A modern Tuscan twist — better than any sushi joint in town.', signatureDish: 'Peposo',
};
assert.ok(!matchesConcept(trattoria, 'sushi'), 'sushi in the description does not tag a trattoria as sushi');
assert.ok(matchesConcept(trattoria, 'pasta'), 'trattoria still matches pasta via cuisine');

// ── Hebrew keyword match (on cuisine field) ───────────────────────────────────
assert.ok(matchesConcept({ city: 'Tokyo', name: 'x', cuisineStyle: 'דלפק ראמן', countryCode: 'JP' }, 'ramen'), 'hebrew ramen matches');

// ── country gating: an Italian city never offers sushi/ramen ──────────────────
const florenceBank = [pizza, pasta, trattoria];
const itConcepts = availableConcepts(florenceBank, { country: resolveCountry(florenceBank, 'Florence') }).map((c) => c.key);
assert.ok(itConcepts.includes('pizza') && itConcepts.includes('pasta'), 'Italy surfaces pizza + pasta');
assert.ok(!itConcepts.includes('sushi') && !itConcepts.includes('ramen'), 'Italy never offers sushi/ramen');

const tokyoBank = [ramen, sushi];
const jpConcepts = availableConcepts(tokyoBank, { country: resolveCountry(tokyoBank, 'Tokyo') }).map((c) => c.key);
assert.ok(jpConcepts.includes('ramen') && jpConcepts.includes('omakase'), 'Tokyo surfaces ramen + omakase');
assert.ok(!jpConcepts.includes('pizza'), 'Tokyo does not surface pizza');

// ── country resolution: majority country_code, else city fallback ─────────────
assert.equal(resolveCountry([pizza, pasta], 'Florence'), 'IT', 'majority country_code');
assert.equal(resolveCountry([{ city: 'Rome', name: 'x' }], 'Rome'), 'IT', 'city fallback when no country_code');

// ── labels ────────────────────────────────────────────────────────────────────
assert.equal(conceptLabel('ramen', 'he'), 'ראמן');
assert.equal(conceptLabel('pizza', 'en'), 'Pizza');

console.log('✓ restaurantConcepts tests passed');
