'use client';

/**
 * CjAffiliateScript — loads CJ's page-based link tools script (am.js) only after
 * the user has granted analytics/marketing consent.
 *
 * The script auto-monetizes outbound links to CJ advertisers and reports
 * page-based impressions (impression data may be shared with advertisers /
 * third parties), so it is gated behind the `analyticsCookies` consent category
 * rather than loaded unconditionally. It re-evaluates when consent changes.
 *
 * Note: the manual CJ deep links on the hotel buttons (see lib/cjAffiliate) do
 * NOT depend on this script — those work regardless, since they only track on an
 * intentional outbound click.
 */

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getStoredLegalConsent } from '@/lib/legalConsent';

const CJ_AM_SRC = 'https://www.anrdoezrs.net/am/101803084/include/allCj/impressions/page/am.js';

export function CjAffiliateScript() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAnalyticsAllowed(getStoredLegalConsent()?.analyticsCookies === true);
    sync();
    window.addEventListener('travelos:legal-consent-updated', sync);
    return () => window.removeEventListener('travelos:legal-consent-updated', sync);
  }, []);

  if (!analyticsAllowed) return null;

  return <Script src={CJ_AM_SRC} strategy="afterInteractive" />;
}
