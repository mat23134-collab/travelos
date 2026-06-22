'use client';

import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Itinerary } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  itinerary: Itinerary;
}

function mapsUrl(name: string, lat?: number | null, lng?: number | null, dest = '') {
  if (lat && lng && !(lat === 0 && lng === 0)) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${dest}`)}`;
}

function dayRouteUrl(
  stops: Array<{ lat?: number | null; lng?: number | null; name: string }>,
  dest: string,
) {
  const parts = stops.map((s) =>
    s.lat && s.lng && !(s.lat === 0 && s.lng === 0)
      ? `${s.lat},${s.lng}`
      : `${s.name}, ${dest}`,
  );
  return `https://www.google.com/maps/dir/${parts.map(encodeURIComponent).join('/')}`;
}

const SLOT_LABEL: Record<string, string> = {
  morning: '🌅 Morning',
  afternoon: '☀️ Afternoon',
  evening: '🌙 Evening',
  breakfast: '☕ Breakfast',
  lunch: '🥪 Lunch',
  dinner: '🍽️ Dinner',
};

export function TripMapsListModal({ open, onClose, itinerary }: Props) {
  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalEl(document.body); }, []);
  const dest = itinerary.destination ?? '';

  if (!portalEl) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="maps-list-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)' }}
        >
          {/* Backdrop dismiss */}
          <div className="absolute inset-0" onClick={onClose} />

          <motion.div
            key="maps-list-panel"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="relative z-10 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            style={{
              background: 'rgba(12,18,30,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              maxHeight: '85dvh',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0"
              style={{ borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <div>
                <h2 className="text-white font-bold text-sm tracking-tight">All stops · {dest}</h2>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Tap any place to open it in Google Maps
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/20 transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            {/* Scrollable list */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-5">
              {itinerary.days.map((day) => {
                const activitySlots = (
                  ['morning', 'afternoon', 'evening'] as const
                )
                  .map((k) => ({ key: k, item: day[k] }))
                  .filter((s) => !!s.item?.name);

                const mealSlots = (
                  ['breakfast', 'lunch', 'dinner'] as const
                )
                  .map((k) => ({ key: k, item: day[k] }))
                  .filter((s) => !!s.item?.name);

                const allStops = activitySlots.map((s) => ({
                  name: s.item!.name,
                  lat: s.item!.latitude,
                  lng: s.item!.longitude,
                }));

                if (activitySlots.length === 0 && mealSlots.length === 0) return null;

                return (
                  <div key={day.day}>
                    {/* Day header */}
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest"
                          style={{ color: '#C9A84C' }}
                        >
                          Day {day.day}
                        </span>
                        {day.theme && (
                          <span className="text-[10px] ml-1.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                            — {day.theme}
                          </span>
                        )}
                      </div>
                      {allStops.length >= 2 && (
                        <a
                          href={dayRouteUrl(allStops, dest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-semibold px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
                          style={{
                            color: '#34d399',
                            border: '1px solid rgba(52,211,153,0.3)',
                            background: 'rgba(52,211,153,0.08)',
                          }}
                        >
                          Route Day {day.day} →
                        </a>
                      )}
                    </div>

                    {/* Activity rows */}
                    <div className="space-y-1.5">
                      {activitySlots.map(({ key, item }) => (
                        <a
                          key={key}
                          href={mapsUrl(item!.name, item!.latitude, item!.longitude, dest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-3 p-2.5 rounded-xl transition-colors group"
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                        >
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 whitespace-nowrap"
                            style={{ color: 'rgba(201,168,76,0.75)', minWidth: 72 }}
                          >
                            {SLOT_LABEL[key]}
                          </span>
                          <span className="text-white text-xs font-medium leading-snug flex-1">
                            {item!.name}
                          </span>
                          <span
                            className="text-[10px] flex-shrink-0 mt-0.5 transition-opacity opacity-40 group-hover:opacity-80"
                            style={{ color: '#34d399' }}
                          >
                            📍
                          </span>
                        </a>
                      ))}

                      {mealSlots.length > 0 && (
                        <div
                          className="mt-1.5 pt-1.5 space-y-1.5 border-t"
                          style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                        >
                          {mealSlots.map(({ key, item }) => (
                            <a
                              key={key}
                              href={mapsUrl(item!.name ?? '', item!.latitude, item!.longitude, dest)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-3 p-2.5 rounded-xl transition-colors group"
                              style={{
                                background: 'rgba(255,255,255,0.02)',
                                border: '1px solid rgba(255,255,255,0.04)',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                            >
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider mt-0.5 whitespace-nowrap"
                                style={{ color: 'rgba(255,255,255,0.3)', minWidth: 72 }}
                              >
                                {SLOT_LABEL[key]}
                              </span>
                              <span className="text-xs font-medium leading-snug flex-1" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                {item!.name}
                              </span>
                              <span
                                className="text-[10px] flex-shrink-0 mt-0.5 transition-opacity opacity-30 group-hover:opacity-70"
                                style={{ color: '#34d399' }}
                              >
                                📍
                              </span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalEl,
  );
}
