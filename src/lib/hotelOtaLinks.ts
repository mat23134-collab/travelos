import type { OtaPriceCompareRow } from '@/lib/types';

/** Deep links to compare the same stay across major OTAs (user verifies live inventory). */

export type HotelOtaLinkOpts = {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
};

export type MergedOtaRow = {
  id: OtaId;
  label: string;
  indicativeNightly: string | null;
  note: string | null;
  /** true = the AI returned a row for this OTA; false = not mentioned at all */
  hasData: boolean;
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

export function agodaHotelSearchUrl(
  hotelName: string,
  destination: string,
  opts?: HotelOtaLinkOpts,
): string {
  // Agoda's public search resolves a free-text `text` query and uses `checkIn`
  // plus `los` (length of stay, in nights) rather than an explicit checkout.
  const params = new URLSearchParams();
  params.set('text', `${hotelName}, ${destination}`);
  const ci = opts?.checkIn?.slice(0, 10);
  const co = opts?.checkOut?.slice(0, 10);
  if (ci && /^\d{4}-\d{2}-\d{2}$/.test(ci)) {
    params.set('checkIn', ci);
    if (co && /^\d{4}-\d{2}-\d{2}$/.test(co)) {
      const nights = Math.round(
        (new Date(co).getTime() - new Date(ci).getTime()) / 86_400_000,
      );
      if (Number.isFinite(nights) && nights > 0) params.set('los', String(nights));
    }
  }
  params.set('adults', String(adultsParam(opts?.adults)));
  params.set('rooms', '1');
  return `https://www.agoda.com/search?${params.toString()}`;
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

export type OtaId = 'booking' | 'agoda' | 'airbnb';

const CANONICAL_OTAS: { id: OtaId; label: string }[] = [
  { id: 'booking', label: 'Booking.com' },
  { id: 'agoda', label: 'Agoda' },
  { id: 'airbnb', label: 'Airbnb' },
];

function matchOtaId(source: string): OtaId | null {
  const s = source.toLowerCase();
  if (s.includes('booking')) return 'booking';
  if (s.includes('agoda')) return 'agoda';
  if (s.includes('airbnb')) return 'airbnb';
  return null;
}

/**
 * Returns true when an OTA note explicitly signals no availability for the
 * requested dates (sold out, fully booked, etc.).
 */
export function isSoldOut(note: string | null | undefined): boolean {
  if (!note) return false;
  const n = note.toLowerCase();
  return (
    n.includes('sold out') ||
    n.includes('fully booked') ||
    n.includes('no availability') ||
    n.includes('not available') ||
    n.includes('unavailable') ||
    n.includes('no rooms') ||
    n.includes('closed')
  );
}

export function isOtaSoldOut(row: Pick<MergedOtaRow, 'indicativeNightly' | 'note' | 'hasData'>): boolean {
  const nightly = row.indicativeNightly?.trim().toLowerCase() ?? '';
  return (
    isSoldOut(row.note) ||
    isSoldOut(nightly) ||
    (row.hasData && !nightly)
  );
}

export function hasBookableOtaRate(row: Pick<MergedOtaRow, 'indicativeNightly' | 'note' | 'hasData'>): boolean {
  return row.hasData && Boolean(row.indicativeNightly?.trim()) && !isOtaSoldOut(row);
}

/** Merge model rows with canonical Booking → Agoda → Airbnb order for the UI. */
export function mergeHotelOtaRows(rows: OtaPriceCompareRow[] | null | undefined): MergedOtaRow[] {
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
      hasData: hit.has(id),
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
    case 'agoda':
      return agodaHotelSearchUrl(hotelName, destination, opts);
    case 'airbnb':
      return airbnbHotelSearchUrl(hotelName, destination, opts);
    default:
      return bookingHotelSearchUrl(hotelName, destination, opts);
  }
}
