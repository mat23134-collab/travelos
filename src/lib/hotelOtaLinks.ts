import type { OtaPriceCompareRow } from '@/lib/types';

/** Deep links to compare the same stay across major OTAs (user verifies live inventory). */

export type HotelOtaLinkOpts = {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
};

function adultsParam(adults?: number): number {
  return adults && adults > 0 ? adults : 2;
}

export function bookingHotelSearchUrl(
  hotelName: string,
  destination: string,
  opts?: HotelOtaLinkOpts,
): string {
  const params = new URLSearchParams();
  params.set('ss', `${hotelName}, ${destination}`);
  const ci = opts?.checkIn?.slice(0, 10);
  const co = opts?.checkOut?.slice(0, 10);
  if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) params.set('checkin', ci);
  if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) params.set('checkout', co);
  params.set('group_adults', String(adultsParam(opts?.adults)));
  return `https://www.booking.com/searchresults.html?${params.toString()}`;
}

export function expediaHotelSearchUrl(
  hotelName: string,
  destination: string,
  opts?: HotelOtaLinkOpts,
): string {
  const params = new URLSearchParams();
  params.set('destination', `${hotelName}, ${destination}`);
  const ci = opts?.checkIn?.slice(0, 10);
  const co = opts?.checkOut?.slice(0, 10);
  if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) params.set('startDate', ci);
  if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) params.set('endDate', co);
  params.set('adults', String(adultsParam(opts?.adults)));
  return `https://www.expedia.com/Hotel-Search?${params.toString()}`;
}

/** Airbnb is often apartments — search still helps compare alternatives near the property. */
export function airbnbHotelSearchUrl(
  hotelName: string,
  destination: string,
  opts?: HotelOtaLinkOpts,
): string {
  const params = new URLSearchParams();
  params.set('query', `${hotelName} ${destination}`);
  const ci = opts?.checkIn?.slice(0, 10);
  const co = opts?.checkOut?.slice(0, 10);
  if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) params.set('check_in', ci);
  if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) params.set('check_out', co);
  params.set('adults', String(adultsParam(opts?.adults)));
  return `https://www.airbnb.com/s/all/homes?${params.toString()}`;
}

export type OtaId = 'booking' | 'expedia' | 'airbnb';

const CANONICAL_OTAS: { id: OtaId; label: string }[] = [
  { id: 'booking', label: 'Booking.com' },
  { id: 'expedia', label: 'Expedia' },
  { id: 'airbnb', label: 'Airbnb' },
];

function matchOtaId(source: string): OtaId | null {
  const s = source.toLowerCase();
  if (s.includes('booking')) return 'booking';
  if (s.includes('expedia')) return 'expedia';
  if (s.includes('airbnb')) return 'airbnb';
  return null;
}

/** Merge model rows with canonical Booking → Expedia → Airbnb order for the UI. */
export function mergeHotelOtaRows(rows: OtaPriceCompareRow[] | null | undefined): Array<{
  id: OtaId;
  label: string;
  indicativeNightly: string | null;
  note: string | null;
}> {
  const hit = new Map<OtaId, OtaPriceCompareRow>();
  for (const r of rows ?? []) {
    const id = matchOtaId(r.source);
    if (id && !hit.has(id)) hit.set(id, r);
  }
  return CANONICAL_OTAS.map(({ id, label }) => {
    const row = hit.get(id);
    const nightly = row?.indicativeNightly?.trim();
    const note = row?.note?.trim();
    return {
      id,
      label,
      indicativeNightly: nightly || null,
      note: note || null,
    };
  });
}

export function hotelOtaSearchUrl(
  ota: OtaId,
  hotelName: string,
  destination: string,
  opts?: HotelOtaLinkOpts,
): string {
  switch (ota) {
    case 'booking':
      return bookingHotelSearchUrl(hotelName, destination, opts);
    case 'expedia':
      return expediaHotelSearchUrl(hotelName, destination, opts);
    case 'airbnb':
      return airbnbHotelSearchUrl(hotelName, destination, opts);
    default:
      return bookingHotelSearchUrl(hotelName, destination, opts);
  }
}
