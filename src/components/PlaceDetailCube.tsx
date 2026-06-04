'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { TimelineRow } from '@/components/DayTimeline';
import { buildMapsDirectionsUrl } from '@/components/DayTimeline';

interface PlaceDetailCubeProps {
  row: TimelineRow;
  destination: string;
  onClose: () => void;
}

export function PlaceDetailCube({ row, destination, onClose }: PlaceDetailCubeProps) {
  const activity = row.activity;
  const dining = row.dining;

  const name = activity?.name ?? dining?.name ?? row.name;
  const neighborhood = activity?.neighborhood ?? dining?.neighborhood;
  const whyText = activity?.whyThis ?? activity?.description ?? 'A curated pick for your trip.';
  const duration = activity?.duration;
  const cost = activity?.estimatedCost;
  const tags = activity?.tags ?? [];
  const isHiddenGem = activity?.isHiddenGem ?? false;
  const verificationStatus = activity?.verificationStatus;
  const websiteUrl = activity?.website_url ?? dining?.website_url;
  const photoQuery = `${name} ${destination} landmark`;
  const mapsUrl = buildMapsDirectionsUrl(name, neighborhood, destination);

  const verificationBadge = (() => {
    if (verificationStatus === 'verified-open') return { text: '✓ Verified open', color: '#16a34a', bg: 'rgba(22,163,74,0.1)', border: 'rgba(22,163,74,0.2)' };
    if (verificationStatus === 'flagged-closed') return { text: '⚠ May be closed', color: '#dc2626', bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.2)' };
    if (verificationStatus === 'flagged-renovating') return { text: '🔧 Renovating', color: '#d97706', bg: 'rgba(217,119,6,0.1)', border: 'rgba(217,119,6,0.2)' };
    return null;
  })();

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] overflow-hidden z-10 flex flex-col"
          style={{ background: '#fff', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.4)', maxHeight: '88dvh' }}
          initial={{ y: '100%', scale: 0.97 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: '60%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {/* Photo header */}
          <div className="relative flex-shrink-0 h-[180px] overflow-hidden">
            <DayPhoto query={photoQuery} alt={name} height={180} dark />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={{ scale: 0.85 }}
              aria-label="Close"
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
            >
              ✕
            </motion.button>
            <div className="absolute bottom-0 left-0 right-0 p-4 z-10">
              <h3 className="text-[20px] font-black text-white leading-tight mb-1">{name}</h3>
              {neighborhood && <p className="text-[12px] text-white/75 font-semibold">📍 {neighborhood}</p>}
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 flex flex-col gap-4">
              {/* Why we chose this */}
              <div className="rounded-xl p-4" style={{ background: '#f0faf9', border: '1px solid rgba(90,173,165,0.18)' }}>
                <div className="text-[10px] font-black uppercase tracking-widest text-[#5aada5] mb-2">💡 Why we chose this</div>
                <p className="text-[13px] text-[#333] leading-relaxed">{whyText}</p>
              </div>

              {/* Meta row */}
              {(duration || cost || verificationBadge || isHiddenGem) && (
                <div className="flex flex-wrap gap-2 items-center">
                  {duration && <span className="text-[12px] font-semibold text-[#555]">⏱ {duration}</span>}
                  {cost && <span className="text-[12px] font-semibold text-[#555]">· 💰 {cost}</span>}
                  {verificationBadge && (
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ color: verificationBadge.color, background: verificationBadge.bg, border: `1px solid ${verificationBadge.border}` }}>
                      {verificationBadge.text}
                    </span>
                  )}
                  {isHiddenGem && (
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full" style={{ background: 'rgba(197,145,42,0.15)', color: '#b8860b', border: '1px solid rgba(197,145,42,0.25)' }}>
                      💎 Hidden Gem
                    </span>
                  )}
                </div>
              )}

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => (
                    <span key={tag} className="text-[11px] font-semibold px-3 py-1 rounded-full" style={{ background: '#e8f4f2', color: '#3a8a82' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 flex gap-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold"
              style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
              </svg>
              Navigate
            </a>
            {websiteUrl && (
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white"
                style={{ background: '#5aada5' }}
              >
                🌐 Official Site
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
