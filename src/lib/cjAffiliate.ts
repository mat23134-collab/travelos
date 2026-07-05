/**
 * CJ Affiliate (Commission Junction) deep-link helpers.
 *
 * Hotels are sourced from RapidAPI, but the *outbound booking link* is routed
 * through CJ so qualifying clicks are attributed to our publisher account and
 * earn commission. Only links whose destination is a CJ advertiser we work with
 * are wrapped; everything else is returned unchanged.
 *
 * Publisher (website) id defaults to the Sarto CJ account but can be overridden
 * with NEXT_PUBLIC_CJ_PID without a code change.
 */

/** CJ publisher / website id. Screenshot value 101803084; override via env. */
export const CJ_PID = process.env.NEXT_PUBLIC_CJ_PID?.trim() || '101803084';

/** CJ tracking domain the account uses (from the page-based tools screenshot). */
const CJ_LINK_DOMAIN = 'https://www.anrdoezrs.net';

/**
 * Destination domains we route through CJ. These are the OTAs the itinerary
 * surfaces that run affiliate programs on CJ. Airbnb (own program) and Google
 * Hotels (not an advertiser) are intentionally excluded and pass through as-is.
 * Add a domain here once the CJ advertiser relationship is approved.
 */
const CJ_ADVERTISER_DOMAINS = [
  'booking.com',
  'agoda.com',
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when `url`'s host is (a subdomain of) a CJ advertiser we route. */
export function isCjAdvertiserUrl(url: string): boolean {
  const host = hostOf(url);
  if (!host) return false;
  return CJ_ADVERTISER_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

/**
 * Wrap a destination URL in a CJ deep link when it points at a CJ advertiser;
 * otherwise return it untouched. `sid` is an optional sub-id that shows up in
 * CJ reporting so we can see which surface drove the click.
 *
 * Format: {domain}/links/{pid}/type/dlg[/sid/{sid}]/{encoded destination}
 */
export function cjDeepLink(url: string, sid = 'sarto-itinerary'): string {
  if (!url || !isCjAdvertiserUrl(url)) return url;
  const sidSegment = sid ? `/sid/${encodeURIComponent(sid)}` : '';
  return `${CJ_LINK_DOMAIN}/links/${CJ_PID}/type/dlg${sidSegment}/${encodeURIComponent(url)}`;
}
