'use client';

/**
 * ClarityScript — loads Microsoft Clarity (heatmaps + session recordings) ONLY
 * after the visitor grants analytics consent. Clarity records DOM + interaction
 * data (PII-grade), so under GDPR/ePrivacy it must not run before consent.
 *
 * Mirrors CjAffiliateScript: reads the stored legal consent and re-evaluates on
 * the `travelos:legal-consent-updated` event so toggling consent takes effect
 * without a reload.
 */

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { getStoredLegalConsent } from '@/lib/legalConsent';

const CLARITY_PROJECT_ID = 'xcnbnwmi2y';

export function ClarityScript() {
  const [analyticsAllowed, setAnalyticsAllowed] = useState(false);

  useEffect(() => {
    const sync = () => setAnalyticsAllowed(getStoredLegalConsent()?.analyticsCookies === true);
    sync();
    window.addEventListener('travelos:legal-consent-updated', sync);
    return () => window.removeEventListener('travelos:legal-consent-updated', sync);
  }, []);

  if (!analyticsAllowed) return null;

  return (
    <Script id="ms-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
          c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
          t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
          y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
        })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
