'use client';

/**
 * AttractionDetailModal — the "explain everything" sheet for a bank attraction,
 * mirroring the daily-timeline detail cube: a photo, the description, and quick
 * links to Google Maps, Instagram and TikTok. The "add to itinerary" CTA lives
 * here — only after the traveler taps it do we ask for a day + time (handled by
 * the caller's ConfirmReservation), so browsing never forces a scheduling step.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import { buildMapsDirectionsUrl } from '@/components/DayTimeline';
import { tiktokSearchUrl, instagramSearchUrl } from '@/lib/socialSearch';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { Landmark } from '@/app/api/landmarks/route';

type Lang = 'he' | 'en';

const T = {
  he: { seeOn: 'צפו ברשת', navigate: 'ניווט', add: '+ הוספה למסלול', about: 'על המקום' },
  en: { seeOn: 'See it on', navigate: 'Navigate', add: '+ Add to itinerary', about: 'About' },
} as const;

export function AttractionDetailModal({
  landmark, destination, lang, onAdd, onClose,
}: {
  landmark: Landmark;
  destination: string;
  lang: Lang;
  onAdd: () => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const t = T[lang];
  const name = landmark.name;
  const mapsUrl = buildMapsDirectionsUrl(name, undefined, destination);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        dir={dir}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

        <motion.div
          className="relative w-full sm:max-w-md rounded-t-[28px] sm:rounded-[24px] overflow-hidden z-10 flex flex-col"
          style={{ background: 'var(--color-paper)', boxShadow: '0 32px 80px -16px rgba(0,0,0,0.4)', maxHeight: '88dvh' }}
          initial={{ y: '100%', scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: '60%', opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        >
          {/* Photo header */}
          <div className="relative flex-shrink-0 h-[180px] overflow-hidden">
            {landmark.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={landmark.photo_url} alt={name} className="w-full h-full object-cover" />
            ) : (
              <DayPhoto query={`${name} ${destination}`} alt={name} height={180} dark />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
            <motion.button
              type="button" onClick={onClose} whileTap={{ scale: 0.85 }} aria-label="Close"
              className="absolute top-3 end-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
              style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)' }}
            >
              ✕
            </motion.button>
            <div className="absolute bottom-0 inset-x-0 p-4 z-10">
              <h3 className="text-[20px] font-black text-white leading-tight">
                {landmark.category_emoji ? `${landmark.category_emoji} ` : ''}{name}
              </h3>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-5 flex flex-col gap-4">
              {landmark.description && (
                <div className="rounded-xl p-4" style={{ background: 'var(--color-paper)', border: '1px solid rgba(184,85,46,0.18)' }}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#b8552e] mb-2">💡 {t.about}</div>
                  <p className="text-[13.5px] text-[#333] leading-relaxed">{landmark.description}</p>
                </div>
              )}

              {/* Social */}
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: '#8f4220' }}>🎥 {t.seeOn}</div>
                <div className="flex gap-2">
                  <a
                    href={tiktokSearchUrl(name, destination, { mobile: isMobile })}
                    target="_blank" rel="noopener noreferrer" aria-label={`TikTok — ${name}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold text-white"
                    style={{ background: '#000' }}
                  >
                    🎵 TikTok
                  </a>
                  <a
                    href={instagramSearchUrl(name, destination, { mobile: isMobile })}
                    target="_blank" rel="noopener noreferrer" aria-label={`Instagram — ${name}`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[13px] font-bold text-white"
                    style={{ background: 'linear-gradient(135deg,#f9ce34 0%,#ee2a7b 50%,#6228d7 100%)' }}
                  >
                    📷 Instagram
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Footer — navigate + add */}
          <div className="flex-shrink-0 px-5 pb-5 pt-3 flex gap-3 border-t" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
            <a
              href={mapsUrl}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-bold"
              style={{ background: '#fff', border: '1px solid rgba(66,133,244,0.35)', color: '#4285f4' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#4285f4"/>
              </svg>
              {t.navigate}
            </a>
            <button
              type="button" onClick={onAdd}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-bold text-white"
              style={{ background: '#b8552e' }}
            >
              {t.add}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
