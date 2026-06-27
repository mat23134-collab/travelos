import { NextRequest, NextResponse } from 'next/server';
import { searchAccommodations } from '@/services/accommodation/router';

/**
 * /api/booking-link — resolve a hotel name into a DIRECT Booking.com property
 * URL (booking.com/hotel/{cc}/{slug}.html) with dates + occupancy appended, so
 * the link lands straight on live availability instead of Booking's free-text
 * "searchresults" interstitial that shows "not available" until you refresh.
 *
 * GET ?name=&city=&checkin=&checkout=&adults=&children=5,8
 * Returns { url: string | null }.
 */

// Module-level cache (process lifetime) keyed by name|city — the search is the
// expensive part; dates/occupancy are appended cheaply per request.
const directUrlCache = new Map<string, string | null>();

function appendStayParams(
  base: string,
  opts: { checkin?: string; checkout?: string; adults: number; children: number[] },
): string {
  const u = new URL(base);
  const isd = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
  if (isd(opts.checkin)) u.searchParams.set('checkin', opts.checkin!);
  if (isd(opts.checkout)) u.searchParams.set('checkout', opts.checkout!);
  u.searchParams.set('group_adults', String(Math.max(1, opts.adults)));
  u.searchParams.set('group_children', String(opts.children.length));
  for (const age of opts.children) u.searchParams.append('age', String(age));
  // ~2 adults per room, ~4 guests per room.
  const total = opts.adults + opts.children.length;
  u.searchParams.set('no_rooms', String(Math.max(1, Math.ceil(opts.adults / 2), Math.ceil(total / 4))));
  return u.toString();
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const name = (sp.get('name') ?? '').trim().slice(0, 120);
  const city = (sp.get('city') ?? '').trim().slice(0, 80);
  const checkin = sp.get('checkin') ?? undefined;
  const checkout = sp.get('checkout') ?? undefined;
  const adults = Math.max(1, Math.min(20, parseInt(sp.get('adults') ?? '2', 10) || 2));
  const children = (sp.get('children') ?? '')
    .split(',').map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n) && n >= 0).slice(0, 10);

  if (!name) return NextResponse.json({ url: null });

  const cacheKey = `${name}|${city}`.toLowerCase();
  let directBase: string | null | undefined = directUrlCache.get(cacheKey);

  if (directBase === undefined) {
    directBase = null;
    try {
      const res = await searchAccommodations(
        { destination: `${name} ${city}`.trim(), accommodation: 'boutique-hotel', budget: 'mid-range' } as never,
        { providerOrder: ['booking'], skipExaFallback: true, timeoutMs: 9000 } as never,
      );
      // First Booking result is the best name match; only accept a direct hotel page.
      const first = res.hotels?.[0] as { bookingUrl?: string | null } | undefined;
      const url = first?.bookingUrl ?? null;
      if (url && /booking\.com\/hotel\//.test(url)) directBase = url;
    } catch {
      directBase = null;
    }
    directUrlCache.set(cacheKey, directBase);
  }

  if (!directBase) return NextResponse.json({ url: null }, { headers: { 'Cache-Control': 'public, s-maxage=86400' } });

  return NextResponse.json(
    { url: appendStayParams(directBase, { checkin, checkout, adults, children }) },
    { headers: { 'Cache-Control': 'public, s-maxage=86400' } },
  );
}
