'use client';

/**
 * CjAffiliateScript — loads CJ's page-based link tools script (am.js) only after
 * the user has granted analytics/marketing consent.
 *
 * This is CJ's own page-based automation: on click, it rewrites outbound links
 * to CJ advertisers (e.g. Booking.com) into correctly-formatted CJ deep links
 * and reports page-based impressions. We rely on it for monetization rather than
 * hand-building deep-link URLs (which is error-prone — a wrong format causes
 * redirect loops).
 *
 * Because it shares impression data with advertisers / third parties, it is
 * gated behind the `analyticsCookies` consent category and re-evaluates when
 * consent changes.
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
