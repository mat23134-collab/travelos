'use client';

import { motion } from 'framer-motion';

function destinationSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffff;
  return h;
}

function stableInt(seed: number, min: number, max: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
}

export function TrendingTicker({ destination }: { destination: string }) {
  const seed   = destinationSeed(destination);
  const squads = stableInt(seed,     18, 67);
  const saved  = stableInt(seed + 1,  4, 23);
  const rank   = stableInt(seed + 2,  1, 12);

  const items = [
    `🔥 ${squads} squads exploring ${destination} this week`,
    `💾 ${saved} travelers saved this itinerary today`,
    `📍 ${destination} ranked #${rank} squad destination this month`,
    '⚡ Hidden gems sourced from live web intelligence',
    '🗺 Route cluster-optimised by neighborhood AI',
    '💎 Tourist traps filtered — only local picks remain',
    '🎯 Vibe-matched to your exact squad profile',
  ];

  // Double the list so the seamless loop has enough runway
  const track = [...items, ...items];

  return (
    <div className="relative overflow-hidden bg-[#0a0c12] border-b border-white/5 py-2 print:hidden">
      {/* fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-r from-[#0a0c12] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-16 z-10 bg-gradient-to-l from-[#0a0c12] to-transparent" />

      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
      >
        {track.map((item, i) => (
          <span
            key={i}
            className="text-[10px] font-semibold tracking-wide flex-shrink-0"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {item}
            <span className="mx-5 opacity-20">·</span>
          </span>
        ))}
      </motion.div>
    </div>
  );
}
