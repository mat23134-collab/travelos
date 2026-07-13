'use client';

/**
 * Route error boundary for a viewed itinerary. A single malformed field that
 * slips past schema-on-read must not white-screen the whole results page —
 * show a branded recovery with retry + a way home.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function ItineraryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('[itinerary/error]', error); }, [error]);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#2b2622' }}>We couldn’t render this trip</h1>
        <p style={{ fontSize: 14, color: '#6b6358', lineHeight: 1.6, margin: '0 0 20px' }}>
          Something in this itinerary tripped us up. Try reloading — your trip is saved.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ background: '#b8552e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
          <Link href="/dashboard" style={{ background: '#fff', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            My trips
          </Link>
        </div>
      </div>
    </div>
  );
}
