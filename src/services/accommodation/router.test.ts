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

test('Booking driver does the 2-step locations → search flow and maps results', async () => {
  const paths: string[] = [];
  const fetchImpl: typeof fetch = async (url) => {
    const u = new URL(String(url));
    paths.push(u.pathname);
    if (u.pathname === '/v1/hotels/locations') {
      assert.equal(u.searchParams.get('name'), 'Vienna');
      return jsonResponse([
        { dest_id: '-1995499', dest_type: 'city', name: 'Vienna' },
      ]);
    }
    if (u.pathname === '/v1/hotels/search') {
      assert.equal(u.searchParams.get('dest_id'), '-1995499');
      assert.equal(u.searchParams.get('checkin_date'), '2026-07-10');
      assert.equal(u.searchParams.get('checkout_date'), '2026-07-14');
      return jsonResponse({
        result: [
          {
            hotel_id: 99,
            hotel_name: 'Hotel Sacher Wien',
            latitude: 48.2039,
            longitude: 16.3697,
            review_score: 9.4,
            url: 'https://booking.com/sacher',
            main_photo_url: 'https://img/sacher.jpg',
            min_total_price: 1680, // 4 nights → 420/night
            composite_price_breakdown: { gross_amount: { value: 1680, currency: 'EUR' } },
            city: 'Vienna',
          },
        ],
      });
    }
    throw new Error(`unexpected path ${u.pathname}`);
  };

  const result = await searchAccommodations(baseInput, {
    env: { RAPIDAPI_BOOKING_HOST: 'booking-com.p.rapidapi.com', RAPIDAPI_KEY: 'test-key' },
    fetchImpl,
    timeoutMs: 1000,
    providerOrder: ['booking'],
  });

  assert.deepEqual(paths, ['/v1/hotels/locations', '/v1/hotels/search']);
  assert.equal(result.provider, 'booking');
  assert.equal(result.hotels.length, 1);
  assert.equal(result.hotels[0].name, 'Hotel Sacher Wien');
  assert.equal(result.hotels[0].nightlyRate?.amount, 420); // 1680 / 4 nights
  assert.equal(result.hotels[0].nightlyRate?.currency, 'EUR');
  assert.equal(result.hotels[0].rating, 9.4);
  assert.equal(result.hotels[0].bookingUrl, 'https://booking.com/sacher');
});

test('falls back from Booking 429 to Priceline (same Tipsters 2-step contract)', async () => {
  const hosts: string[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const u = new URL(String(url));
    hosts.push(u.host);
    assert.equal((init?.headers as Record<string, string>)['x-rapidapi-key'], 'test-key');

    // Booking's first call (locations) is rate-limited → whole provider fails.
    if (u.host === 'booking-tipsters.test') return jsonResponse({ message: 'quota exceeded' }, 429);

    // Priceline uses the identical /v1/hotels/locations → /v1/hotels/search flow.
    if (u.pathname === '/v1/hotels/locations') {
      return jsonResponse([{ dest_id: '42', dest_type: 'city', name: 'Vienna' }]);
    }
    return jsonResponse({
      result: [
        {
          hotel_id: 'pl-1',
          hotel_name: 'Priceline Grand Vienna',
          city: 'Vienna',
          latitude: 48.21,
          longitude: 16.37,
          min_total_price: 1000, // 4 nights → 250/night
          currencycode: 'EUR',
          review_score: 8.8,
        },
      ],
    });
  };

  const result = await searchAccommodations(baseInput, { env, fetchImpl, timeoutMs: 1000 });

  assert.equal(result.provider, 'priceline');
  assert.equal(result.hotels[0]?.provider, 'priceline');
  assert.equal(result.hotels[0]?.name, 'Priceline Grand Vienna');
  assert.equal(result.hotels[0]?.nightlyRate?.amount, 250);
  // booking(429) then priceline locations + search
  assert.deepEqual(hosts, ['booking-tipsters.test', 'priceline-tipsters.test', 'priceline-tipsters.test']);
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
