'use client';

/**
 * AnonymousViewerCTA — shown on a shared itinerary to anyone who isn't the owner
 * (logged-out visitors, or a different signed-in user). A friend looking at a
 * real trip is the highest-intent cold lead, so turn every shared view into a
 * funnel entry: "make your own trip for {destination}" → the wizard, seeded with
 * the destination. Dismissible; never shown to the owner.
 */

import { useState } from 'react';
import Link from 'next/link';

export function AnonymousViewerCTA({ destination, lang }: { destination: string; lang: 'he' | 'en' }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || !destination) return null;

  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const href = `/onboarding?destination=${encodeURIComponent(destination)}`;
  const t = lang === 'he'
    ? { lead: `אהבתם את הטיול ל${destination}?`, sub: 'בנו טיול משלכם — חינם, בכמה דקות', cta: 'בנו טיול משלכם' }
    : { lead: `Love this ${destination} trip?`, sub: 'Build your own — free, in minutes', cta: 'Make your own' };

  return (
    <div
      dir={dir}
      className="fixed bottom-3 inset-x-3 sm:inset-x-auto sm:start-4 sm:max-w-md z-[55] print:hidden"
    >
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: '#0d2b27', color: '#F5EFE6', boxShadow: '0 12px 32px -8px rgba(0,0,0,0.45)' }}
      >
        <div className="flex-1 min-w-0">
          <div className="text-[13.5px] font-bold leading-tight">{t.lead}</div>
          <div className="text-[11.5px] opacity-75 leading-tight mt-0.5">{t.sub}</div>
        </div>
        <Link
          href={href}
          className="shrink-0 px-3.5 py-2 rounded-xl text-[13px] font-bold whitespace-nowrap"
          style={{ background: 'var(--color-terracotta, #b8552e)', color: '#fff' }}
        >
          {t.cta} →
        </Link>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[13px]"
          style={{ background: 'rgba(255,255,255,0.12)', color: '#F5EFE6' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
