'use client';

/**
 * global-error — last-resort boundary for errors thrown in the root layout.
 * Must render its own <html>/<body>. Keeps users on a branded recovery screen
 * (with a retry) instead of the browser's default error page or a blank tab.
 */

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface to the browser console; a monitoring hook (e.g. Sentry) can attach here later.
    console.error('[global-error]', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#efe3cd', fontFamily: 'system-ui, sans-serif', color: '#2b2622' }}>
        <div style={{ textAlign: 'center', padding: '2rem', maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🧭</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>Something went off-route</h1>
          <p style={{ fontSize: 14, color: '#6b6358', lineHeight: 1.6, margin: '0 0 20px' }}>
            An unexpected error interrupted the page. Try again — it usually recovers.
          </p>
          <button
            onClick={reset}
            style={{ background: '#b8552e', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
