// src/lib/bookAheadRanker.test.ts
// Run: npx tsx src/lib/bookAheadRanker.test.ts
import assert from 'node:assert/strict';
import { bayesRating, computeCompositeScore, cityMeanRating, computeValueScore, touristTrapPenalty } from './restaurantScoring';
import { rankBookAhead } from './bookAheadRanker';
import { routeReservation } from './platformRouter';
import { canonicalizeGenre, genreFit } from './restaurantGenre';
import type { RestaurantRecommendation } from './types';

// ── §6.1 Bayesian shrinkage: low-n high-rating must not beat high-n solid ─────
{
  const cityMean = 4.1;
  const hot = bayesRating(4.9, 40, cityMean);    // 4.9★ / 40 reviews
  const solid = bayesRating(4.6, 4000, cityMean); // 4.6★ / 4000 reviews
  assert.ok(solid > hot, `Bayesian: solid(${solid.toFixed(3)}) should beat hot(${hot.toFixed(3)})`);
}

// ── §6.2 composite score is bounded and rewards verification/bookability ──────
{
  const base: RestaurantRecommendation = { city: 'Tokyo', name: 'X', rating: 4.6, ratingCount: 2000 };
  const verified = computeCompositeScore({ ...base, googlePlaceId: 'g', reservationUrl: 'https://r', bookAheadLevel: 3 });
  const bare = computeCompositeScore(base);
  assert.ok(verified > bare, 'verified+bookable+book-ahead should outscore bare');
  assert.ok(verified <= 1 && bare >= 0, 'composite stays within [0,1]');
}

// ── cityMeanRating falls back cleanly with no rated rows ──────────────────────
assert.equal(cityMeanRating([{ city: 'A', name: 'n' }]), 4.1);

// ── §5 genre canonicalization ─────────────────────────────────────────────────
assert.equal(canonicalizeGenre('Edomae sushi omakase'), 'omakase-counter');
assert.equal(canonicalizeGenre('Roman trattoria'), 'trattoria-bistro');
assert.equal(canonicalizeGenre('completely unknown xyz'), null);
assert.ok(genreFit(['pasta'], ['pasta', 'trattoria-bistro']) > 0, 'genreFit overlaps');
assert.equal(genreFit([], ['pasta']), 0.5, 'no trip taste → neutral');

// ── §9 platform routing ───────────────────────────────────────────────────────
{
  // No googlePlaceId here on purpose — when one's present, routeReservation
  // deliberately prefers the Google Maps deep-link (with its "Reserve a
  // table" button) over the regional OTA (see platformRouter.ts's priority
  // order); this case exercises the regional-fallback branch itself.
  const jp = routeReservation({ name: 'Sukiyabashi', city: 'Tokyo', countryCode: 'JP' });
  assert.equal(jp.name, 'Tabelog', 'JP → Tabelog');
  const il = routeReservation({ name: 'Miznon', city: 'Tel Aviv', countryCode: 'IL' });
  assert.equal(il.name, 'Ontopo', 'IL → Ontopo');
  const direct = routeReservation({ name: 'X', city: 'Y', reservationUrl: 'https://book.me/x', bookingPlatform: 'website' });
  assert.equal(direct.url, 'https://book.me/x', 'direct reservation_url wins');
  const fallback = routeReservation({ name: 'X', city: 'Y', googlePlaceId: 'abc' });
  assert.match(fallback.url, /google\.com\/maps\/search/, 'no country + place_id → Google Maps deep-link');
}

// ── §6.4 diversity: five sushi counters must NOT all surface ───────────────────
{
  const mk = (i: number, genre: string, price: number, level = 2): RestaurantRecommendation => ({
    city: 'Tokyo', name: `${genre}-${i}`, cuisineGenre: genre, priceLevel: price,
    bookAheadLevel: level, rating: 4.6, ratingCount: 1500 + i, googlePlaceId: `g${i}`,
    reservationUrl: `https://r/${i}`, compositeScore: 0.8 - i * 0.001,
  });
  const bank: RestaurantRecommendation[] = [
    ...Array.from({ length: 8 }, (_, i) => mk(i, 'omakase-counter', 4, 3)),
    mk(100, 'trattoria-bistro', 2), mk(101, 'izakaya-tapas', 2),
    mk(102, 'street-casual', 1, 1), mk(103, 'seafood', 3),
  ];
  const picks = rankBookAhead(bank, { budget: 'mid-range', nights: 4, limit: 6 });
  const omakaseCount = picks.filter((p) => p.cuisineGenre === 'omakase-counter').length;
  assert.ok(omakaseCount <= 3, `MMR should limit one genre: got ${omakaseCount} omakase of ${picks.length}`);
  const genres = new Set(picks.map((p) => p.cuisineGenre));
  assert.ok(genres.size >= 3, `should span ≥3 genres, got ${genres.size}`);
}

// ── §4 hero cap: short trip should not be all level-4 splurges ─────────────────
{
  const heroes = Array.from({ length: 6 }, (_, i): RestaurantRecommendation => ({
    city: 'Paris', name: `hero-${i}`, cuisineGenre: 'fine-dining', priceLevel: 4,
    bookAheadLevel: 3, rating: 4.7, ratingCount: 2000, googlePlaceId: `h${i}`,
    reservationUrl: `https://r/${i}`, compositeScore: 0.85 - i * 0.001,
  }));
  // Plenty of everyday options + varied genres so the hero cap is actually
  // exercisable (not forced by a shortage of non-hero picks).
  const everydayGenres = ['trattoria-bistro', 'izakaya-tapas', 'seafood', 'cafe-brunch', 'street-casual', 'steak-grill'];
  const everyday = Array.from({ length: 8 }, (_, i): RestaurantRecommendation => ({
    city: 'Paris', name: `everyday-${i}`, cuisineGenre: everydayGenres[i % everydayGenres.length], priceLevel: 2,
    bookAheadLevel: 1, rating: 4.5, ratingCount: 1200, googlePlaceId: `b${i}`,
    reservationUrl: `https://r/b${i}`, neighborhoodSlug: `nb-${i}`, compositeScore: 0.7 - i * 0.001,
  }));
  const picks = rankBookAhead([...heroes, ...everyday], { budget: 'mid-range', nights: 3, limit: 6 });
  const heroCount = picks.filter((p) => (p.priceLevel ?? 0) >= 4).length;
  assert.ok(heroCount <= 1, `3-night trip hero cap: expected ≤1 level-4, got ${heroCount}`);
}

// ── §6.3 dietary gate: vegetarian trip drops a meat-centric untagged place ─────
{
  const steak: RestaurantRecommendation = {
    city: 'Buenos Aires', name: 'Parrilla', cuisineGenre: 'steak-grill', priceLevel: 2,
    bookAheadLevel: 2, rating: 4.6, ratingCount: 3000, googlePlaceId: 's', reservationUrl: 'https://r', compositeScore: 0.9,
  };
  const veg: RestaurantRecommendation = {
    city: 'Buenos Aires', name: 'Green', cuisineGenre: 'vegetarian-vegan', priceLevel: 2,
    bookAheadLevel: 1, rating: 4.5, ratingCount: 900, googlePlaceId: 'v', reservationUrl: 'https://r2', compositeScore: 0.6,
  };
  const picks = rankBookAhead([steak, veg], { dietary: ['vegetarian'], limit: 6 });
  assert.ok(!picks.some((p) => p.name === 'Parrilla'), 'meat-centric untagged place gated out for vegetarian trip');
  assert.ok(picks.some((p) => p.name === 'Green'), 'veg place kept');
}

// ── §6.5 GeoFit suggestedDay + §7 book-by date ─────────────────────────────────
{
  const rec: RestaurantRecommendation = {
    city: 'Rome', name: 'Roscioli', cuisineGenre: 'trattoria-bistro', priceLevel: 3,
    bookAheadLevel: 2, bookAheadDays: 14, rating: 4.6, ratingCount: 5000, googlePlaceId: 'r',
    reservationUrl: 'https://r', latitude: 41.894, longitude: 12.472, neighborhoodSlug: 'centro-storico',
    compositeScore: 0.85,
  };
  const picks = rankBookAhead([rec], {
    days: [{ neighborhoodSlug: 'trastevere' }, { neighborhoodSlug: 'centro-storico' }],
    startDate: '2026-09-10', limit: 6,
  });
  assert.equal(picks[0].suggestedDay, 1, 'matches Day index 1 by neighborhood');
  assert.equal(picks[0].bookByDate, '2026-08-27', 'book-by = start − 14d');
}

// ── price-range selector: browsing one level up surfaces that tier ────────────
{
  const mk = (name: string, level: number, comp: number): RestaurantRecommendation => ({
    city: 'Tokyo', name, cuisineGenre: level >= 3 ? 'fine-dining' : 'trattoria-bistro',
    priceLevel: level, bookAheadLevel: level >= 3 ? 3 : 1, rating: 4.6, ratingCount: 1500,
    googlePlaceId: `g-${name}`, reservationUrl: `https://r/${name}`, neighborhoodSlug: `nb-${name}`,
    compositeScore: comp,
  });
  // Budget-tier rows score a touch higher on composite; without the view bump a
  // budget trip (target 2) keeps level-3 picks penalized/buried.
  const bank = [
    mk('b1', 2, 0.80), mk('b2', 2, 0.79), mk('b3', 2, 0.78), mk('b4', 2, 0.77),
    mk('up1', 3, 0.76), mk('up2', 3, 0.75), mk('up3', 3, 0.74),
  ];

  const atBudget = rankBookAhead(bank, { budget: 'budget', nights: 4, viewMaxLevel: 2, limit: 4 });
  assert.ok(
    atBudget.every((p) => (p.priceLevel ?? 0) <= 2) || atBudget.filter((p) => p.priceLevel === 3).length <= 1,
    'at-budget view stays budget-weighted',
  );

  const oneUp = rankBookAhead(bank, { budget: 'budget', nights: 4, viewMaxLevel: 3, limit: 4 });
  const upCount = oneUp.filter((p) => p.priceLevel === 3).length;
  assert.ok(upCount >= 2, `browsing one level up should surface level-3 picks, got ${upCount}`);
}

// ── browsing luxury lifts the hero cap ────────────────────────────────────────
{
  const heroes = Array.from({ length: 6 }, (_, i): RestaurantRecommendation => ({
    city: 'Paris', name: `lux-${i}`, cuisineGenre: 'fine-dining', priceLevel: 4,
    bookAheadLevel: 3, rating: 4.7, ratingCount: 2000, googlePlaceId: `h${i}`,
    reservationUrl: `https://r/${i}`, neighborhoodSlug: `n${i}`, compositeScore: 0.85 - i * 0.001,
  }));
  const picks = rankBookAhead(heroes, { budget: 'budget', nights: 3, viewMaxLevel: 4, limit: 5 });
  const heroCount = picks.filter((p) => (p.priceLevel ?? 0) >= 4).length;
  assert.ok(heroCount >= 4, `luxury browse should lift the hero cap, got ${heroCount}`);
}

// ── value-for-money: cheap+great beats expensive+mediocre ─────────────────────
{
  const cheapGreat = computeValueScore({ city: 'x', name: 'a', rating: 4.7, ratingCount: 3000, priceLevel: 1 });
  const dearMeh = computeValueScore({ city: 'x', name: 'b', rating: 4.1, ratingCount: 3000, priceLevel: 4 });
  assert.ok(cheapGreat > dearMeh, `value: cheap+great(${cheapGreat}) > dear+meh(${dearMeh})`);
  assert.ok(cheapGreat <= 1 && dearMeh >= 0, 'value stays in [0,1]');
}

// ── tourist-trap penalty: pricey + mediocre + on-landmark drops; unknown = 1 ───
{
  const trap = touristTrapPenalty({ city: 'x', name: 't', rating: 4.0, ratingCount: 800, priceLevel: 4, nearLandmark: true });
  assert.ok(trap < 1, `trap penalty applies (${trap})`);
  const clean = touristTrapPenalty({ city: 'x', name: 'c', rating: 4.0, ratingCount: 800, priceLevel: 4 });
  assert.equal(clean, 1, 'no landmark signal → no penalty');
  const goodNearby = touristTrapPenalty({ city: 'x', name: 'g', rating: 4.7, ratingCount: 5000, priceLevel: 4, nearLandmark: true });
  assert.equal(goodNearby, 1, 'genuinely great place near a landmark is not penalized');
  // The penalty measurably lowers composite rank.
  const trapComposite = computeCompositeScore({ city: 'x', name: 't', rating: 4.0, ratingCount: 800, priceLevel: 4, nearLandmark: true, googlePlaceId: 'g', reservationUrl: 'https://r' });
  const cleanComposite = computeCompositeScore({ city: 'x', name: 'c', rating: 4.0, ratingCount: 800, priceLevel: 4, googlePlaceId: 'g', reservationUrl: 'https://r' });
  assert.ok(trapComposite < cleanComposite, 'tourist trap ranks below its clean twin');
}

// ── kosher gate: a kosher trip excludes a known non-kosher place, keeps others ─
{
  const nonKosher: RestaurantRecommendation = { city: 'x', name: 'pork', kosherStatus: 'none', priceLevel: 2, bookAheadLevel: 2, rating: 4.6, ratingCount: 2000, googlePlaceId: 'p', reservationUrl: 'https://r', compositeScore: 0.9 };
  const certified: RestaurantRecommendation = { city: 'x', name: 'kosher', kosherStatus: 'certified', priceLevel: 2, bookAheadLevel: 2, rating: 4.5, ratingCount: 1500, googlePlaceId: 'k', reservationUrl: 'https://r2', compositeScore: 0.6 };
  const unknown: RestaurantRecommendation = { city: 'x', name: 'unknown', priceLevel: 2, bookAheadLevel: 2, rating: 4.5, ratingCount: 1500, googlePlaceId: 'u', reservationUrl: 'https://r3', compositeScore: 0.55 };
  const picks = rankBookAhead([nonKosher, certified, unknown], { dietary: ['kosher'], limit: 6 });
  assert.ok(!picks.some((p) => p.name === 'pork'), 'known non-kosher excluded for kosher trip');
  assert.ok(picks.some((p) => p.name === 'kosher') && picks.some((p) => p.name === 'unknown'), 'certified + unknown kept');
}

console.log('✓ bookAheadRanker/scoring/platform/genre tests passed');
