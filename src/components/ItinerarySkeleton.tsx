'use client';

import { motion } from 'framer-motion';

// ─── Primitive shimmer bar ────────────────────────────────────────────────────

function Bar({ w = 'w-full', h = 'h-3', delay = 0 }: { w?: string; h?: string; delay?: number }) {
  return (
    <div
      className={`skeleton-bar ${w} ${h} rounded-md`}
      style={{ animationDelay: `${delay}s` }}
    />
  );
}

function Circle({ size = 32, delay = 0 }: { size?: number; delay?: number }) {
  return (
    <div
      className="skeleton-bar flex-shrink-0 rounded-full"
      style={{ width: size, height: size, animationDelay: `${delay}s` }}
    />
  );
}

// ─── Activity row skeleton ────────────────────────────────────────────────────

function ActivityRowSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div className="flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0">
        <Circle size={32} delay={delay} />
        <div className="skeleton-bar w-px flex-1 mt-2" style={{ animationDelay: `${delay}s` }} />
      </div>
      <div className="pb-6 min-w-0 flex-1 flex flex-col gap-2">
        <div className="flex gap-2 items-center">
          <Bar w="w-16" h="h-2.5" delay={delay} />
          <Bar w="w-20" h="h-2.5" delay={delay + 0.08} />
        </div>
        <Bar w="w-3/4" h="h-4" delay={delay + 0.05} />
        <Bar w="w-full" h="h-3" delay={delay + 0.1} />
        <Bar w="w-5/6" h="h-3" delay={delay + 0.12} />
        <div className="flex gap-2 mt-1">
          <Bar w="w-20" h="h-2.5" delay={delay + 0.15} />
          <Bar w="w-16" h="h-2.5" delay={delay + 0.17} />
          <Bar w="w-24" h="h-2.5" delay={delay + 0.19} />
        </div>
      </div>
    </div>
  );
}

// ─── Single DayCard skeleton ──────────────────────────────────────────────────

function DayCardSkeleton({ index }: { index: number }) {
  const baseDelay = index * 0.15;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26, delay: baseDelay }}
      className="bg-white rounded-2xl border border-[#e5e7eb] overflow-hidden shadow-sm"
    >
      {/* Photo placeholder */}
      <div className="skeleton-photo relative" style={{ height: 200 }}>
        {/* Badge overlay simulation */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <div className="skeleton-bar w-32 h-6 rounded-full opacity-60" style={{ animationDelay: `${baseDelay}s` }} />
        </div>
      </div>

      {/* Day header */}
      <div className="px-6 py-4 border-b border-[#f3f4f6] flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Bar w="w-16" h="h-2.5" delay={baseDelay + 0.05} />
          <Bar w="w-40" h="h-4" delay={baseDelay + 0.08} />
        </div>
        <div className="flex flex-col gap-1.5 items-end">
          <Bar w="w-20" h="h-2.5" delay={baseDelay + 0.06} />
          <Bar w="w-16" h="h-4" delay={baseDelay + 0.09} />
        </div>
      </div>

      <div className="p-6">
        {/* Activity timeline — 3 slots */}
        <div className="mb-6">
          <ActivityRowSkeleton delay={baseDelay + 0.1} />
          <ActivityRowSkeleton delay={baseDelay + 0.18} />
          <ActivityRowSkeleton delay={baseDelay + 0.26} />
        </div>

        {/* Insider tips button skeleton */}
        <div className="mb-6">
          <Bar w="w-44" h="h-8" delay={baseDelay + 0.3} />
        </div>

        {/* Dining section */}
        <div className="mb-6">
          <Bar w="w-32" h="h-2.5" delay={baseDelay + 0.32} />
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {[0, 1].map((j) => (
              <div key={j} className="flex gap-3 p-3 rounded-xl bg-[#f8f7f2] border border-[#e5e7eb]">
                <Circle size={28} delay={baseDelay + 0.34 + j * 0.05} />
                <div className="flex flex-col gap-1.5 flex-1">
                  <Bar w="w-full" h="h-3" delay={baseDelay + 0.35 + j * 0.05} />
                  <Bar w="w-3/4" h="h-3" delay={baseDelay + 0.37 + j * 0.05} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Transport tip */}
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex flex-col gap-1.5">
          <Bar w="w-32" h="h-2.5" delay={baseDelay + 0.4} />
          <Bar w="w-full" h="h-3" delay={baseDelay + 0.42} />
          <Bar w="w-5/6" h="h-3" delay={baseDelay + 0.44} />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Exported skeleton — shows N day placeholders ────────────────────────────

export function ItinerarySkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="bg-[#0f1117] rounded-2xl p-6 sm:p-10 mb-8 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#ff5a5f]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 flex flex-col gap-4">
          <div className="skeleton-bar w-48 h-5 rounded-full opacity-40" />
          <div className="skeleton-bar w-72 h-9 rounded-lg opacity-40" />
          <div className="skeleton-bar w-56 h-3.5 rounded-md opacity-30" />
          <div className="mt-2 bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-2">
            <div className="skeleton-bar w-32 h-3 rounded opacity-40" />
            <div className="skeleton-bar w-full h-3 rounded opacity-30" />
            <div className="skeleton-bar w-5/6 h-3 rounded opacity-30" />
            <div className="skeleton-bar w-4/5 h-3 rounded opacity-30" />
          </div>
        </div>
      </motion.div>

      {/* Budget skeleton */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.1 }}
        className="bg-white rounded-2xl border border-[#e5e7eb] p-6 mb-8 grid sm:grid-cols-3 gap-4"
      >
        {[0, 1, 2].map((i) => (
          <div key={i} className="text-center p-4 rounded-xl bg-[#f8f7f2] flex flex-col items-center gap-2">
            <Bar w="w-24" h="h-2.5" delay={i * 0.06} />
            <Bar w="w-20" h="h-7" delay={i * 0.06 + 0.05} />
          </div>
        ))}
      </motion.div>

      {/* Day cards */}
      <div className="flex flex-col gap-6">
        {Array.from({ length: count }, (_, i) => (
          <DayCardSkeleton key={i} index={i} />
        ))}
      </div>
    </div>
  );
}
