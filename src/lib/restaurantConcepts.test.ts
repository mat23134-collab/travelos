// src/lib/restaurantConcepts.test.ts
// Run: npx tsx src/lib/restaurantConcepts.test.ts
import assert from 'node:assert/strict';
import { matchesConcept, availableConcepts, primaryConcept, conceptLabel, resolveCountry } from './restaurantConcepts';
import type { RestaurantRecommendation } from './types';

const ramen: RestaurantRecommendation = { city: 'Tokyo', name: 'AFURI', cuisineStyle: 'Yuzu shio ramen', countryCode: 'JP', description: 'A cult ramen counter.' };
// Deliberately no "sushi"/"nigiri"/"sashimi" substring anywhere — this fixture
// represents an omakase restaurant, and primaryConcept must actually land on
// 'omakase', not get preempted by a name/style that happens to mention sushi.
const sushi: RestaurantRecommendation = { city: 'Tokyo', name: 'Kanda Saito', cuisineGenre: 'omakase-counter', countryCode: 'JP', description: 'Edomae omakase.' };
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

// ── primaryConcept: one restaurant, one home ───────────────────────────────────
// The real bug this replaces: an izakaya whose signature dish mentions
// "yakitori grill" also matches meat-grill's keywords, so under the old
// any-match filtering it showed up under BOTH the "izakaya" and "בשר ועל האש"
// chips at once. primaryConcept must resolve to exactly one (catalog order —
// izakaya precedes meat-grill), and that's what chip filtering now uses.
const izakaya: RestaurantRecommendation = {
  city: 'Tokyo', name: 'Torishige', cuisineStyle: 'Izakaya', countryCode: 'JP',
  signatureDish: 'Yakitori grill skewers',
};
assert.equal(primaryConcept(izakaya, 'JP')?.key, 'izakaya', 'izakaya+grill keywords resolve to a single primary concept (izakaya)');
assert.equal(primaryConcept(ramen, 'JP')?.key, 'ramen');
assert.equal(primaryConcept(sushi, 'JP')?.key, 'omakase', 'omakase fixture is not preempted by an unrelated sushi match');
// Region gating applies to primaryConcept too — a pizza place in Japan should
// never resolve to the (IT-gated) pizza concept.
const romanPizzaInJapan: RestaurantRecommendation = { city: 'Tokyo', name: 'Napoli Pizzeria', cuisineStyle: 'Pizza', countryCode: 'JP' };
assert.notEqual(primaryConcept(romanPizzaInJapan, 'JP')?.key, 'pizza', 'pizza concept stays gated to IT even at the primaryConcept level');

// ── labels ────────────────────────────────────────────────────────────────────
assert.equal(conceptLabel('ramen', 'he'), 'ראמן');
assert.equal(conceptLabel('pizza', 'en'), 'Pizza');

console.log('✓ restaurantConcepts tests passed');
