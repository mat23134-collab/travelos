'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  videoUrl?: string;
  activityName: string;
}

export function VideoPreview({ videoUrl, activityName }: Props) {
  const [playing, setPlaying] = useState(false);

  // ── Actual video ─────────────────────────────────────────────────────────
  if (videoUrl) {
    return (
      <div className="my-3 rounded-2xl overflow-hidden bg-black" style={{ aspectRatio: '9/16', maxWidth: 160 }}>
        {playing ? (
          <video
            src={videoUrl}
            autoPlay
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <button
            onClick={() => setPlaying(true)}
            className="w-full h-full relative flex items-center justify-center"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff5a5f]/80 to-[#8b5cf6]/80" />
            <motion.div
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.9 }}
              className="relative z-10 w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center"
            >
              <span className="text-white text-xl ml-1">▶</span>
            </motion.div>
          </button>
        )}
      </div>
    );
  }

  // ── "Watch on Social" CTA (no video URL) ─────────────────────────────────
  return (
    <motion.a
      href={`https://www.tiktok.com/search?q=${encodeURIComponent(activityName + ' Tokyo')}`}
      target="_blank"
      rel="noopener noreferrer"
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.97, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
      className="my-3 flex items-center gap-3 px-4 py-3 rounded-2xl overflow-hidden relative group"
      style={{ background: 'linear-gradient(135deg, #010101 0%, #1a1a2e 60%, #16213e 100%)' }}
    >
      {/* Shimmer sweep */}
      <span className="absolute inset-0 animate-shimmer opacity-20 pointer-events-none" />

      {/* TikTok-style icon */}
      <span className="relative z-10 flex-shrink-0 w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-lg">
        ▶
      </span>

      <span className="relative z-10 flex flex-col">
        <span className="text-white text-xs font-bold tracking-tight leading-tight">Watch on Social</span>
        <span className="text-white/40 text-[10px] mt-0.5">TikTok · Reels · Shorts</span>
      </span>

      {/* Platform badges */}
      <div className="relative z-10 ml-auto flex items-center gap-1.5">
        {['📱', '🎵', '▶'].map((icon, i) => (
          <span
            key={i}
            className="w-6 h-6 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center text-[10px]"
          >
            {icon}
          </span>
        ))}
      </div>
    </motion.a>
  );
}
