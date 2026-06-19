'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { DayPhoto } from '@/components/DayPhoto';

interface Props {
  destination: string;
  dateRange?: string | null;
  totalDays: number;
  /** Optional CTA target; defaults to /onboarding. */
  ctaHref?: string;
  ctaLabel?: string;
}

export function ItineraryHero({
  destination,
  dateRange,
  totalDays,
  ctaHref = '/onboarding',
  ctaLabel = 'Plan another trip',
}: Props) {
  return (
    <div className="mx-3 sm:mx-12 mb-2">
      <div className="relative rounded-[28px] overflow-hidden" style={{ boxShadow: 'var(--shadow-soft)' }}>
        {/* Background photo (DayPhoto provides scrim + lazy load) */}
        <DayPhoto query={`${destination} skyline`} alt={destination} height={380} dark />

        {/* Category pill — top start */}
        <div className="absolute top-4 start-4">
          <span
            className="inline-block px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.18)' }}
          >
            Your Itinerary
          </span>
        </div>

        {/* Headline + dates — bottom, over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
            className="font-display italic text-white text-3xl sm:text-5xl leading-tight drop-shadow"
          >
            {destination}
          </motion.h1>
          <p className="mt-1.5 text-white/80 text-sm sm:text-base font-medium">
            {[dateRange, `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`].filter(Boolean).join(' · ')}
          </p>

          {/* Glass CTA card — bottom end */}
          <div className="mt-4 flex justify-end">
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white"
              style={{ background: 'rgba(0,0,0,0.34)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              {ctaLabel}
              <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
