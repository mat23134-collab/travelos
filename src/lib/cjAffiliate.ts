/**
 * CJ Affiliate (Commission Junction) deep-link helpers.
 *
 * Hotels are sourced from RapidAPI, but the *outbound booking link* is routed
 * through CJ so qualifying clicks are attributed to our publisher account and
 * earn commission. Only links whose destination is a CJ advertiser we're
 * approved for are wrapped; everything else is returned unchanged.
 *
 * IMPORTANT — link format (empirically verified against the live account):
 *   https://www.anrdoezrs.net/links/{PID}/type/dlg/{RAW destination URL}
 * The destination URL is appended RAW (NOT url-encoded) and WITHOUT an /sid/
 * segment. Encoding the destination or adding /sid/ makes CJ redirect-loop
 * (ERR_TOO_MANY_REDIRECTS). CJ resolves the advertiser from the destination
 * domain, so no advertiser id is needed in the URL. Verified 2026-07 that both
 * Booking.com and Agoda links pass through CJ tracking (cj.dotomi.com →
 * emjcd.com conversion pixel) and reach the destination with params intact.
 *
 * Publisher id defaults to the Sarto CJ account; override via NEXT_PUBLIC_CJ_PID.
 */

/** CJ publisher / website id. */
export const CJ_PID = process.env.NEXT_PUBLIC_CJ_PID?.trim() || '101803084';

/**
 * CJ is OPT-IN. Until the affiliate relationship + deep-link format are fully
 * verified, wrapping is disabled so outbound hotel links go DIRECT to the OTA
 * with the trip's dates + occupancy intact (the CJ raw-append can drop the
 * `&`-separated query params, which showed up as "Booking without dates").
 * Turn it on by setting NEXT_PUBLIC_CJ_ENABLED=true once links are validated.
 */
const CJ_ENABLED = process.env.NEXT_PUBLIC_CJ_ENABLED === 'true';

/** CJ tracking domain the account uses. */
const CJ_LINK_DOMAIN = 'https://www.anrdoezrs.net';

/**
 * Destination domains we route through CJ — the OTAs this account is approved
 * for (verified: Booking.com #4347392, Agoda both resolve with affiliate
 * attribution). Airbnb (own program) and Google Hotels (not an advertiser) are
 * intentionally excluded and pass through as-is. Add a domain here only once the
 * CJ advertiser relationship is approved.
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
 * Wrap a destination URL in a CJ deep link when it points at a CJ advertiser we
 * work with; otherwise return it untouched.
 *
 * The destination is appended raw (see the format note at the top of the file).
 */
export function cjDeepLink(url: string): string {
  if (!url || !CJ_ENABLED || !isCjAdvertiserUrl(url)) return url;
  return `${CJ_LINK_DOMAIN}/links/${CJ_PID}/type/dlg/${url}`;
}
