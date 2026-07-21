'use client';

/**
 * SidePanel — the trip "companion drawer". Slides in from the inline-end,
 * available on every itinerary screen (unlike the overview-only Smart Toolbar).
 *
 * Two modules:
 *   • documents — the new per-trip document bank (DocumentBank)
 *   • discover  — the existing concierge (reuses <SmartToolbar> verbatim, so
 *                 restaurants / attractions / events are now reachable from
 *                 inside a day view too, with zero duplicated logic)
 *
 * Open/close is driven by the global useSidePanel store, so any button (FAB,
 * menu, context menu) can open it to a specific module without prop-drilling.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Activity, DayPlan, TripBaseLocation } from '@/lib/types';
import { useSidePanel, type PanelModule } from '@/state/sidePanelStore';
import { SmartToolbar } from '@/components/SmartToolbar';
import { DocumentBank } from './DocumentBank';
import { HotelBaseTab } from './HotelBaseTab';

type Lang = 'he' | 'en';

interface SidePanelProps {
  itineraryId: string | null;
  destination: string;
  days: DayPlan[];
  lang: Lang;
  startDate?: string | null;
  endDate?: string | null;
  accessToken: string | null;
  onLockReservation: (dayIndex: number, activity: Activity) => Promise<void>;
  recalculateDayLoading: boolean;
  /** Current trip base (itinerary.baseLocation) for the Base tab. */
  base: TripBaseLocation | null;
  onSetBase: (base: TripBaseLocation | null) => void;
}

const TABS: { key: PanelModule; label: { he: string; en: string }; emoji: string }[] = [
  { key: 'base',      label: { he: 'בסיס',    en: 'Base'      }, emoji: '🏨' },
  { key: 'documents', label: { he: 'מסמכים', en: 'Documents' }, emoji: '📎' },
  { key: 'discover',  label: { he: 'גילוי',   en: 'Discover'  }, emoji: '✨' },
];

export function SidePanel(props: SidePanelProps) {
  const { lang } = props;
  const { open, module, openPanel, closePanel } = useSidePanel();
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  // Esc to close + lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closePanel(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, closePanel]);

  // Slide from the inline-end: right edge for LTR, left edge for RTL.
  const edgeStyle = dir === 'rtl' ? { left: 0 } : { right: 0 };
  const hiddenX = dir === 'rtl' ? '-100%' : '100%';

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[110]" dir={dir}>
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(20,16,12,0.42)', backdropFilter: 'blur(4px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={closePanel}
          />
          <motion.aside
            className="absolute top-0 bottom-0 w-full max-w-md flex flex-col"
            style={{ ...edgeStyle, background: 'var(--color-paper)', boxShadow: '0 0 60px rgba(0,0,0,0.35)' }}
            initial={{ x: hiddenX }} animate={{ x: 0 }} exit={{ x: hiddenX }}
            transition={{ type: 'spring', stiffness: 320, damping: 34 }}
          >
            {/* Header: tabs + close */}
            <div
              className="flex items-center gap-2 p-3 shrink-0"
              style={{ borderBottom: '1px solid rgba(43,38,34,0.1)' }}
            >
              {TABS.map((tab) => {
                const on = module === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => openPanel(tab.key)}
                    className="px-3.5 py-2 rounded-xl text-[13px] font-semibold transition-colors"
                    style={on
                      ? { background: 'var(--color-terracotta)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.55)', color: 'var(--color-ink-warm)', border: '1px solid rgba(43,38,34,0.12)' }}
                  >
                    {tab.emoji} {tab.label[lang]}
                  </button>
                );
              })}
              <button
                onClick={closePanel}
                aria-label="Close"
                className="ms-auto w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.55)', color: 'var(--color-ink-warm)' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {module === 'base' && (
                <HotelBaseTab
                  lang={lang}
                  destination={props.destination}
                  base={props.base}
                  onSetBase={props.onSetBase}
                  itineraryId={props.itineraryId}
                  accessToken={props.accessToken}
                />
              )}
              {module === 'documents' && (
                <DocumentBank
                  itineraryId={props.itineraryId}
                  accessToken={props.accessToken}
                  lang={lang}
                />
              )}
              {module === 'discover' && (
                <SmartToolbar
                  destination={props.destination}
                  days={props.days}
                  lang={lang}
                  startDate={props.startDate}
                  endDate={props.endDate}
                  accessToken={props.accessToken}
                  onLockReservation={props.onLockReservation}
                  recalculateDayLoading={props.recalculateDayLoading}
                />
              )}
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
