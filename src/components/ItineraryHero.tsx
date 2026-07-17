'use client';

import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';

interface Props {
  destination: string;
  dateRange?: string | null;
  totalDays: number;
}

export function ItineraryHero({ destination, dateRange, totalDays }: Props) {
  return (
    <div className="mx-0 sm:mx-6 mb-2">
      <div className="relative sm:rounded-[28px] overflow-hidden" style={{ boxShadow: 'var(--shadow-soft)' }}>
        {/* Cinematic photo with a slow Ken Burns drift */}
        <div className="kenburns">
          <DayPhoto query={`${destination} skyline golden hour`} alt={destination} ratio="16/9" focus="50% 40%" dark />
        </div>

        {/* Extra bottom gradient for drama / legibility */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(20,12,8,0.74) 0%, rgba(20,12,8,0.18) 44%, transparent 72%)' }}
        />

        {/* Eyebrow pill — top start */}
        <div className="absolute top-5 start-5">
          <span
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ background: 'rgba(0,0,0,0.30)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.20)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#e08a3e' }} />
            Your journey
          </span>
        </div>

        {/* Headline + dates — bottom, over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.6 }}
            className="font-display italic text-white/85 text-lg sm:text-2xl leading-none"
          >
            Your escape to
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 24, delay: 0.12 }}
            className="font-display italic text-white text-4xl sm:text-6xl leading-[1.04] mt-1 drop-shadow-lg"
          >
            {destination}
          </motion.h1>
          <p className="mt-3 text-white/85 text-sm sm:text-base font-medium">
            {[dateRange, `${totalDays} ${totalDays === 1 ? 'day' : 'days'}`].filter(Boolean).join('  ·  ')}
          </p>
        </div>
      </div>
    </div>
  );
}
