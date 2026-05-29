import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isOtaSoldOut,
  hasBookableOtaRate,
  mergeHotelOtaRows,
} from './hotelOtaLinks';

// ── isOtaSoldOut ─────────────────────────────────────────────────────────────
// The OTA buttons are verify-live SEARCH links. We only ever have real per-hotel
// inventory for the ONE provider that won the accommodation race (usually
// Booking), so Agoda rows arrive with no price. "No price" means UNKNOWN, not
// sold out — marking it SOLD OUT (red, link stripped) wrongly buries hotels that
// actually have rooms. Only an EXPLICIT sold-out signal counts.

test('a row with data but no price is NOT sold out (unknown availability)', () => {
  // This is the Agoda false-positive: the model emitted a row but had no live
  // Agoda rate to cite.
  assert.equal(
    isOtaSoldOut({ indicativeNightly: null, note: null, hasData: true }),
    false,
  );
});

test('a row with data, no price, but a neutral note is NOT sold out', () => {
  assert.equal(
    isOtaSoldOut({ indicativeNightly: null, note: 'Verify live rates for your dates', hasData: true }),
    false,
  );
});

test('an explicit SOLD OUT note IS sold out', () => {
  assert.equal(
    isOtaSoldOut({ indicativeNightly: null, note: 'SOLD OUT for these dates', hasData: true }),
    true,
  );
});

test('a SOLD OUT string in the price field IS sold out', () => {
  assert.equal(
    isOtaSoldOut({ indicativeNightly: 'SOLD OUT', note: null, hasData: true }),
    true,
  );
});

test('a row with a real price and no sold-out note is NOT sold out', () => {
  assert.equal(
    isOtaSoldOut({ indicativeNightly: '€265/night', note: null, hasData: true }),
    false,
  );
});

// ── hasBookableOtaRate ───────────────────────────────────────────────────────

test('a row with a real price is bookable', () => {
  assert.equal(
    hasBookableOtaRate({ indicativeNightly: '€265/night', note: null, hasData: true }),
    true,
  );
});

test('a row with no price is not "bookable" but also not sold out', () => {
  const row = { indicativeNightly: null, note: null, hasData: true };
  assert.equal(hasBookableOtaRate(row), false);
  assert.equal(isOtaSoldOut(row), false);
});

// ── mergeHotelOtaRows: end-to-end Agoda-unknown scenario ─────────────────────

test('Agoda row with no price renders as unknown (not sold out) while Booking is bookable', () => {
  const rows = mergeHotelOtaRows([
    { source: 'Booking.com', indicativeNightly: 'VND 1,040,000/night', note: null },
    { source: 'Agoda', indicativeNightly: null, note: null },
    { source: 'Airbnb', indicativeNightly: null, note: null },
  ]);
  const booking = rows.find((r) => r.id === 'booking')!;
  const agoda = rows.find((r) => r.id === 'agoda')!;

  assert.equal(hasBookableOtaRate(booking), true);
  assert.equal(isOtaSoldOut(agoda), false);
  assert.equal(agoda.hasData, true);
});
