'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Itinerary } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';
import { buildTripStoryDays } from '@/lib/tripStory';

interface Props {
  open: boolean;
  onClose: () => void;
  itinerary: Itinerary;
  ui: ItineraryUiStrings;
}

export function TripStoryCube({ open, onClose, itinerary, ui }: Props) {
  const blocks = useMemo(
    () => buildTripStoryDays(itinerary, ui.lang),
    [itinerary, ui.lang],
  );

  const dest = itinerary.destination?.trim() ?? '';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[56] flex items-center justify-center p-4 sm:p-6 print:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

          <div className="relative z-10 w-full max-w-md [perspective:1200px]">
            <motion.div
              className="relative w-full rounded-[1.75rem] overflow-hidden flex flex-col max-h-[88dvh]"
              style={{
                transformStyle: 'preserve-3d',
                background: 'linear-gradient(165deg, rgba(225,179,130,0.14) 0%, rgba(18,52,59,0.96) 40%, #12343b 100%)',
                border: '1px solid rgba(225,179,130,0.22)',
                boxShadow:
                  '0 0 0 1px rgba(200,150,102,0.18), 0 48px 100px -24px rgba(0,0,0,0.85), 0 0 55px rgba(45,84,94,0.35)',
              }}
              initial={{ opacity: 0, rotateX: 10, scale: 0.94, y: 14 }}
              animate={{ opacity: 1, rotateX: 0, scale: 1, y: 0 }}
              exit={{ opacity: 0, rotateX: 6, scale: 0.96, y: 10 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            >
              <div
                className="absolute top-0 inset-x-0 h-px z-20 pointer-events-none"
                style={{
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)',
                }}
              />
              <div className="absolute top-10 right-0 w-48 h-48 rounded-full bg-[#C9A84C]/22 blur-[70px] pointer-events-none" />
              <div className="absolute bottom-20 left-0 w-40 h-40 rounded-full bg-[#2d545e]/40 blur-[60px] pointer-events-none" />

              <div className="relative flex-shrink-0 px-5 pt-6 pb-3 border-b border-white/[0.07]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-3xl mb-1 leading-none select-none" aria-hidden>
                      📖
                    </p>
                    <h2 className="text-white font-black text-xl tracking-tight">{ui.tripStoryTitle}</h2>
                    <p className="text-white/45 text-xs mt-1 leading-snug">{ui.tripStorySubtitle(dest)}</p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={onClose}
                    whileTap={{ scale: 0.88 }}
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-white/55 hover:text-white/85 transition-colors text-sm"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                    aria-label={ui.tripStoryClose}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              <div className="relative overflow-y-auto flex-1 px-5 py-4 space-y-4">
                {blocks.map(({ dayNum, sentences }) => (
                  <motion.article
                    key={dayNum}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(0.04 * (dayNum - 1), 0.35), duration: 0.35 }}
                    className="rounded-2xl px-4 py-3.5"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                          background: 'rgba(200,150,102,0.22)',
                          border: '1px solid rgba(225,179,130,0.35)',
                          color: '#f5e6d6',
                        }}
                      >
                        {ui.tripStoryDayLabel(dayNum)}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {sentences.map((line, i) => (
                        <p key={i} className="text-sm leading-relaxed text-white/[0.82] text-pretty">
                          {line}
                        </p>
                      ))}
                    </div>
                  </motion.article>
                ))}
              </div>

              <div className="relative flex-shrink-0 px-5 py-3 border-t border-white/[0.06] bg-black/20">
                <p className="text-[10px] text-center text-white/30 leading-relaxed">{ui.tripStoryFooter}</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
