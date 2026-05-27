import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAccommodationProviderOrder,
  normalizeAccommodationHotel,
  searchAccommodations,
  type AccommodationEnv,
  type AccommodationSearchInput,
} from './router';

const baseInput: AccommodationSearchInput = {
  destination: 'Vienna',
  lat: 48.2082,
  lng: 16.3738,
  radiusKm: 10,
  startDate: '2026-07-10',
  endDate: '2026-07-14',
  adults: 2,
  accommodation: 'luxury-hotel',
  budget: 'luxury',
};

const env: AccommodationEnv = {
  RAPIDAPI_KEY: 'test-key',
  RAPIDAPI_BOOKING_HOST: 'booking-tipsters.test',
  RAPIDAPI_BOOKING_SEARCH_PATH: '/booking/search',
  RAPIDAPI_PRICELINE_HOST: 'priceline-tipsters.test',
  RAPIDAPI_PRICELINE_SEARCH_PATH: '/priceline/search',
  RAPIDAPI_EXPEDIA_HOST: 'expedia-apiheya.test',
  RAPIDAPI_EXPEDIA_SEARCH_PATH: '/expedia/search',
  RAPIDAPI_AIRBNB_HOST: 'airbnb-vibepro.test',
  RAPIDAPI_AIRBNB_SEARCH_PATH: '/airbnb/search',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('prioritizes Airbnb for apartment and local-stay intent', () => {
  assert.deepEqual(
    buildAccommodationProviderOrder({ ...baseInput, accommodation: 'airbnb' }),
    ['airbnb', 'priceline', 'expedia', 'booking'],
  );
});

test('prioritizes Booking for premium and luxury hotel intent', () => {
  assert.deepEqual(
    buildAccommodationProviderOrder(baseInput),
    ['booking', 'priceline', 'expedia', 'airbnb'],
  );
});

test('normalizes common raw hotel shapes into one internal Hotel type', () => {
  const hotel = normalizeAccommodationHotel(
    {
      hotel_id: 123,
      hotel_name: 'Hotel Sacher Wien',
      address: { addressLine1: 'Philharmoniker Strasse 4' },
      location: { latitude: '48.2039', longitude: '16.3697' },
      priceBreakdown: { grossPrice: { value: 420, currency: 'EUR' } },
      review_score: '9.4',
      url: 'https://example.com/sacher',
    },
    'booking',
  );

  assert.equal(hotel?.id, 'booking-123');
  assert.equal(hotel?.provider, 'booking');
  assert.equal(hotel?.name, 'Hotel Sacher Wien');
  assert.equal(hotel?.address, 'Philharmoniker Strasse 4');
  assert.equal(hotel?.lat, 48.2039);
  assert.equal(hotel?.lng, 16.3697);
  assert.equal(hotel?.nightlyRate?.amount, 420);
  assert.equal(hotel?.nightlyRate?.currency, 'EUR');
  assert.equal(hotel?.rating, 9.4);
  assert.equal(hotel?.bookingUrl, 'https://example.com/sacher');
});

test('falls back from Booking 429 to Priceline and returns normalized hotels', async () => {
  const hosts: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    hosts.push(new URL(String(url)).host);
    assert.equal((init?.headers as Record<string, string>)['x-rapidapi-key'], 'test-key');

    if (hosts.length === 1) return jsonResponse({ message: 'quota exceeded' }, 429);
    return jsonResponse({
      hotels: [
        {
          id: 'pl-1',
          name: 'Priceline Grand Vienna',
          address: 'Ringstrasse',
          latitude: 48.21,
          longitude: 16.37,
          price: 250,
          currency: 'EUR',
        },
      ],
    });
  };

  const result = await searchAccommodations(baseInput, { env, fetchImpl, timeoutMs: 1000 });

  assert.equal(result.provider, 'priceline');
  assert.deepEqual(hosts, ['booking-tipsters.test', 'priceline-tipsters.test']);
  assert.equal(result.hotels[0]?.provider, 'priceline');
  assert.equal(result.hotels[0]?.name, 'Priceline Grand Vienna');
});

test('returns null provider when every RapidAPI fails AND Exa fallback is skipped', async () => {
  const fetchImpl: typeof fetch = async () => {
    throw new Error('provider unreachable');
  };
  const result = await searchAccommodations(
    baseInput,
    { env, fetchImpl, timeoutMs: 500, skipExaFallback: true },
  );
  assert.equal(result.provider, null);
  assert.equal(result.hotels.length, 0);
  assert.equal(result.webContext, undefined);
  assert.equal(result.attempts.length, 4);
  assert.ok(result.attempts.every((a) => !a.ok));
});

test('cascades through empty and failed providers to Expedia', async () => {
  const hosts: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    hosts.push(new URL(String(url)).host);
    if (hosts.length === 1) return jsonResponse({ hotels: [] });
    if (hosts.length === 2) throw new Error('provider timed out');
    return jsonResponse({
      data: [
        {
          propertyId: 'ex-1',
          name: 'Expedia Palace',
          neighborhood: 'Innere Stadt',
          coordinates: { lat: 48.2, lng: 16.36 },
          rate: { amount: 300, currency: 'EUR' },
        },
      ],
    });
  };

  const result = await searchAccommodations(baseInput, { env, fetchImpl, timeoutMs: 1000 });

  assert.equal(result.provider, 'expedia');
  assert.deepEqual(hosts, ['booking-tipsters.test', 'priceline-tipsters.test', 'expedia-apiheya.test']);
  assert.equal(result.hotels[0]?.provider, 'expedia');
  assert.equal(result.hotels[0]?.name, 'Expedia Palace');
});
