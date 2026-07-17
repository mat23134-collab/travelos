'use client';

/**
 * CjAffiliateScript — loads CJ's page-based link tools script (am.js) only after
 * the user has granted analytics/marketing consent.
 *
 * This handles page-based IMPRESSION reporting (and CJ's own link automation).
 * Because it shares impression data with advertisers / third parties, it is
 * gated behind the `analyticsCookies` consent category and re-evaluates when
 * consent changes.
 *
 * Note: outbound click monetization does NOT depend on this script — the hotel
 * buttons already carry explicit CJ deep links (see lib/cjAffiliate), which
 * track on an intentional click regardless of analytics consent.
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
