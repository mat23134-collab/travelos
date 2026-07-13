'use client';

/**
 * Route error boundary for the generation page. A throw here (mid-generation
 * render, a bad stream event) must not blank the screen — offer a retry and a
 * restart of the wizard.
 */

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Link from 'next/link';

export default function PlanError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { Sentry.captureException(error); console.error('[plan/error]', error); }, [error]);

  return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✈️</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 8px', color: '#2b2622' }}>Trip building hit a snag</h1>
        <p style={{ fontSize: 14, color: '#6b6358', lineHeight: 1.6, margin: '0 0 20px' }}>
          Something interrupted the plan. Try again, or restart from the beginning.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} style={{ background: '#b8552e', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
            Try again
          </button>
          <Link href="/onboarding" style={{ background: '#fff', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)', borderRadius: 12, padding: '10px 20px', fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Start over
          </Link>
        </div>
      </div>
    </div>
  );
}
