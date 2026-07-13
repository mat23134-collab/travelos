import type { OtaPriceCompareRow, TravelerProfile, FamilyChildAgeBand } from '@/lib/types';

/** Deep links to compare the same stay across major OTAs (user verifies live inventory). */

export type HotelOtaLinkOpts = {
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  /** Child ages (years). Drives Booking/Agoda child params + room split. */
  children?: number[];
};

// Representative age per onboarding age band — Booking wants an explicit age per child.
const AGE_BAND_TO_AGE: Record<FamilyChildAgeBand, number> = {
  '0-3': 2, '3-6': 5, '6-9': 8, '9-12': 11, '12-16': 14, '16+': 17,
};

/**
 * Smart party derivation: turn the traveler profile into an adults count and a
 * per-child age list, so the OTA link searches a realistic occupancy instead of
 * cramming everyone into one room.
 *   solo → 1 adult · couple → 2 · group → groupSize adults
 *   family → (groupSize − kids) adults + each kid's age
 */
export function otaPartyFromProfile(
  profile?: Pick<TravelerProfile, 'groupType' | 'groupSize' | 'familyKidsByAge'> | null,
): { adults: number; children: number[] } {
  if (!profile) return { adults: 2, children: [] };
  const children: number[] = [];
  for (const [band, count] of Object.entries(profile.familyKidsByAge ?? {})) {
    const age = AGE_BAND_TO_AGE[band as FamilyChildAgeBand];
    for (let i = 0; i < (count ?? 0); i++) children.push(age);
  }
  switch (profile.groupType) {
    case 'solo':   return { adults: 1, children: [] };
    case 'couple': return { adults: 2, children: [] };
    case 'family': return { adults: Math.max(1, (profile.groupSize || 2) - children.length), children };
    default:       return { adults: profile.groupSize && profile.groupSize > 0 ? profile.groupSize : 2, children: [] };
  }
}

/**
 * Smart room split — ~2 adults per room, ~4 guests per room max. A party of 6
 * adults → 3 rooms; 2 adults + 3 kids → 2 rooms; a couple → 1 room.
 */
export function roomsFor(adults: number, childrenCount: number): number {
  const total = adults + childrenCount;
  return Math.max(1, Math.ceil(adults / 2), Math.ceil(total / 4));
}

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

  const adults = adultsParam(opts?.adults);
  const children = opts?.children ?? [];
  params.set('group_adults', String(adults));
  params.set('group_children', String(children.length));
  for (const age of children) params.append('age', String(age));
  // Smart room split (and explicit occupancy) so the deep-link resolves to
  // bookable rooms instead of Booking's "not available" interstitial — and so
  // a party of 6 gets multiple rooms, not one room for six.
  params.set('no_rooms', String(roomsFor(adults, children.length)));
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
  const adults = adultsParam(opts?.adults);
  const children = opts?.children ?? [];
  params.set('adults', String(adults));
  if (children.length > 0) {
    params.set('children', String(children.length));
    params.set('childages', children.join(','));
  }
  params.set('rooms', String(roomsFor(adults, children.length)));
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
  const children = opts?.children ?? [];
  params.set('adults', String(adultsParam(opts?.adults)));
  if (children.length > 0) params.set('children', String(children.length));
  return `https://www.airbnb.com/s/all/homes?${params.toString()}`;
}

/**
 * Google Hotels — reliable "click and see availability + prices across sites"
 * link (no Booking-style deep-link interstitial). Dates aren't passed via URL
 * (Google Hotels has no stable date param); the property + live price panel
 * resolve immediately.
 */
export function googleHotelsSearchUrl(hotelName: string, destination: string): string {
  const q = encodeURIComponent(`${hotelName} ${destination}`.trim());
  return `https://www.google.com/travel/search?q=${q}`;
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
  // Only an EXPLICIT sold-out signal counts. A row with no price is UNKNOWN
  // availability (we only have live inventory for the one provider that won the
  // accommodation race), not sold out — it should stay a verify-live link, not a
  // red SOLD OUT that strips the link and buries hotels that actually have rooms.
  return isSoldOut(row.note) || isSoldOut(nightly);
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
      // Agoda has no reliable name-based deep link — its /search ignores the
      // text query (you land on Agoda's homepage), because it keys on Agoda's
      // own property ids. Route through Google Hotels, which resolves the exact
      // property and surfaces Agoda's live price alongside the others, so the
      // click actually reaches the hotel instead of a blank search.
      return googleHotelsSearchUrl(hotelName, destination);
    case 'airbnb':
      return airbnbHotelSearchUrl(hotelName, destination, opts);
    default:
      return bookingHotelSearchUrl(hotelName, destination, opts);
  }
}
