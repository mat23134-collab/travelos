'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { DayPhoto } from '@/components/DayPhoto';
import { DaySummaryCard } from '@/components/DaySummaryCard';
import { DayTimeline, DayGlance, type TimelineRow, type SwapTarget } from '@/components/DayTimeline';
import { DayNeighborhoodGuide } from '@/components/DayNeighborhoodGuide';
import { PlaceDetailCube } from '@/components/PlaceDetailCube';
import { AlternativePickerPanel } from '@/components/AlternativePickerPanel';
import { AuthGateModal } from '@/components/AuthGateModal';
import { ScanBookingModal } from '@/components/ScanBookingModal';
import { useTripBinder } from '@/hooks/useTripBinder';
import { useSidePanel } from '@/state/sidePanelStore';
import type { DayPlan, Itinerary, TravelerProfile, Activity } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';
import type { ItineraryMapLabels } from '@/components/ItineraryMap';
import type { Session } from '@supabase/supabase-js';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full rounded-2xl animate-pulse"
        style={{ background: 'rgba(184,85,46,0.12)', border: '1px solid rgba(184,85,46,0.2)', minHeight: 400 }}
      />
    ),
  },
);

interface DayDetailPanelProps {
  day: DayPlan;
  dayIndex: number;
  totalDays: number;
  itinerary: Itinerary;
  itineraryId: string | null;
  session: Session | null;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  mapLabels: ItineraryMapLabels;
  basecampMarker: { lat: number; lng: number; label: string } | null;
  focusedNeighborhood: string | undefined;
  onSwapSlot: (slot: 'morning' | 'afternoon' | 'evening', request?: string) => void;
  onCommitActivitySwap: (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    activity: Activity,
    summary: string,
    diningField?: 'breakfast' | 'lunch' | 'dinner',
  ) => void;
  onNeighborhoodClick: (neighborhood: string) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onBackToOverview: () => void;
  onOpenMobileMap?: () => void;
}

export function DayDetailPanel({
  day, dayIndex, totalDays, itinerary, itineraryId, session, profile, ui, mapLabels,
  basecampMarker, focusedNeighborhood,
  onSwapSlot, onCommitActivitySwap, onNeighborhoodClick,
  onPrevDay, onNextDay, onBackToOverview, onOpenMobileMap,
}: DayDetailPanelProps) {
  const destination = itinerary.destination ?? '';
  const photoQuery = `${destination} ${day.theme ?? 'travel'} landmark`;
  const weatherEmoji = getWeatherEmoji(profile?.startDate, dayIndex);

  const [activePlace, setActivePlace] = useState<TimelineRow | null>(null);
  const [activeSwap, setActiveSwap] = useState<SwapTarget | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const openSidePanel = useSidePanel((s) => s.openPanel);

  // Trip Binder — one instance shared by every stop's <StopBinder> (via
  // DayTimeline) and the scan-a-booking modal, so filing a scanned confirmation
  // instantly refreshes the stop it was filed to.
  const binder = useTripBinder(itineraryId, session?.access_token ?? null);

  // Opening a day (or switching days) should land on the hourly schedule +
  // summary at the top of this panel — not wherever the overview was scrolled
  // to. Bring the panel's top into view on every day change.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    rootRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' });
  }, [dayIndex]);

  const requireAuth = (action: () => void) => {
    if (!session) {
      setShowAuthGate(true);
      return;
    }
    action();
  };

  const handleCommit = (activity: Activity, summary: string, diningField?: 'breakfast' | 'lunch' | 'dinner') => {
    if (!activeSwap) return;
    onCommitActivitySwap(dayIndex, activeSwap.slot, activity, summary, diningField);
    setActiveSwap(null);
  };

  return (
    <>
      {/* Scroll anchor — sits just above the panel so day-open lands here. */}
      <div ref={rootRef} style={{ scrollMarginTop: 12 }} />
      <AnimatePresence mode="wait">
        <motion.div
          key={`day-detail-${dayIndex}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="max-w-5xl mx-auto px-4 sm:px-6 py-4"
        >
          {/* Day navigation strip — clear, obviously-tappable pills */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <DayNavBtn
              onClick={onPrevDay}
              disabled={dayIndex === 0}
              arrow={ui.dir === 'rtl' ? '→' : '←'}
              label={ui.dir === 'rtl' ? 'יום קודם' : 'Previous day'}
              side="start"
            />
            <span className="text-[13px] sm:text-sm font-bold text-center text-[#222] min-w-0 truncate px-1">
              {ui.dir === 'rtl' ? `יום ${dayIndex + 1}` : `Day ${dayIndex + 1}`}
              {day.theme ? ` · ${day.theme}` : ''}
            </span>
            <DayNavBtn
              onClick={onNextDay}
              disabled={dayIndex === totalDays - 1}
              arrow={ui.dir === 'rtl' ? '←' : '→'}
              label={ui.dir === 'rtl' ? 'יום הבא' : 'Next day'}
              side="end"
            />
          </div>

          {/* 2-col grid */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
            {/* Left — schedule first: opening a day lands on the hourly plan +
                summary, not on photos or the map. */}
            <div className="flex flex-col gap-3">
              <DayGlance day={day} />

              <DaySummaryCard day={day} dayIndex={dayIndex} ui={ui} />

              <div className="relative rounded-2xl overflow-hidden h-[160px]" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
                <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={160} />
                <div className="absolute bottom-2 left-3 flex items-center gap-2 px-2.5 py-1 rounded-full" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                  <span className="text-base">{weatherEmoji}</span>
                  <span className="text-[11px] font-medium text-white/90">Typical weather · {destination}</span>
                </div>
              </div>

              <DayTimeline
                day={day}
                dayIndex={dayIndex}
                destination={destination}
                ui={ui}
                binder={binder}
                onSwapSlot={onSwapSlot}
                onNeighborhoodClick={onNeighborhoodClick}
                onExplore={(row) => setActivePlace(row)}
                onFindAlternative={(target) => requireAuth(() => setActiveSwap(target))}
              />

              {/* Mobile map button */}
              {onOpenMobileMap && (
                <button
                  type="button"
                  onClick={onOpenMobileMap}
                  className="sm:hidden w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold"
                  style={{ background: '#f6e7df', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)' }}
                >
                  🗺 View Day {dayIndex + 1} on Map
                </button>
              )}
            </div>

            {/* Right: Map + concierge CTA — sticky so it stays in view while the
                (taller) schedule scrolls. */}
            <div className="flex flex-col gap-3 sm:self-start sm:sticky sm:top-20">
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)', minHeight: 380 }}
              >
                <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
                  <div>
                    <div className="text-[13px] font-bold text-[#222]">Day {dayIndex + 1} Route</div>
                    <div className="text-[11px] text-[#888]">{destination}</div>
                  </div>
                </div>
                <div style={{ height: 'calc(100% - 52px)', minHeight: 328 }}>
                  <ItineraryMap
                    days={[day]}
                    destination={destination}
                    focusedNeighborhood={focusedNeighborhood}
                    basecampMarker={basecampMarker}
                    labels={mapLabels}
                  />
                </div>
              </div>

              {/* Why this day is grouped here — the Neighborhood Profiler,
                  directly under the map. */}
              <DayNeighborhoodGuide
                day={day}
                dayIndex={dayIndex}
                destination={destination}
                session={session}
                profile={profile}
              />

              {/* Swap / add via the concierge drawer (restaurants, attractions,
                  events) — replaces the old inline attraction bank. */}
              <button
                type="button"
                onClick={() => openSidePanel('discover')}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right transition-colors"
                style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)', border: '1px solid rgba(184,85,46,0.18)' }}
              >
                <span className="text-2xl shrink-0">✨</span>
                <span className="flex-1">
                  <span className="block text-[13.5px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>
                    {ui.dir === 'rtl' ? 'להחליף או להוסיף למסלול?' : 'Swap or add to this day?'}
                  </span>
                  <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--color-ink-warm-mut)' }}>
                    {ui.dir === 'rtl'
                      ? 'פתחו את הקונסיירז׳ — מסעדות, אטרקציות ופסטיבלים'
                      : 'Open the concierge — restaurants, attractions & events'}
                  </span>
                </span>
                <span className="shrink-0" style={{ color: 'var(--color-terracotta)' }}>←</span>
              </button>

              {/* Scan a booking confirmation → propose filing it to a stop */}
              {binder.enabled && (
                <button
                  type="button"
                  onClick={() => setShowScan(true)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-right transition-colors"
                  style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)', border: '1px solid rgba(184,85,46,0.18)' }}
                >
                  <span className="text-2xl shrink-0">📸</span>
                  <span className="flex-1">
                    <span className="block text-[13.5px] font-bold" style={{ color: 'var(--color-ink-warm)' }}>
                      {ui.dir === 'rtl' ? 'סריקת אישור הזמנה' : 'Scan a booking'}
                    </span>
                    <span className="block text-[11.5px] mt-0.5" style={{ color: 'var(--color-ink-warm-mut)' }}>
                      {ui.dir === 'rtl'
                        ? 'צלמו טיסה/מלון/כרטיס — נשייך אותו ליום ולעצירה'
                        : 'Photo a flight/hotel/ticket — we file it to the right stop'}
                    </span>
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--color-terracotta)' }}>←</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="flex items-center justify-center gap-3 mt-5 flex-wrap">
            <ActionBtn onClick={onBackToOverview}>← Back to Overview</ActionBtn>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Modals — outside AnimatePresence */}
      {activePlace && (
        <PlaceDetailCube
          row={activePlace}
          destination={destination}
          onClose={() => setActivePlace(null)}
        />
      )}
      {activeSwap && (
        <AlternativePickerPanel
          target={activeSwap}
          itinerary={itinerary}
          profile={profile}
          onCommit={handleCommit}
          onClose={() => setActiveSwap(null)}
        />
      )}

      <AuthGateModal
        open={showAuthGate}
        onCancel={() => setShowAuthGate(false)}
        title="Sign in to edit this trip"
        message="Anyone with the link can view this trip, but you'll need to log in or create a free account to make changes."
      />

      {showScan && (
        <ScanBookingModal
          itinerary={itinerary}
          startDate={profile?.startDate ?? null}
          binder={binder}
          he={ui.dir === 'rtl'}
          initialDayIndex={dayIndex}
          onClose={() => setShowScan(false)}
        />
      )}
    </>
  );
}

function DayNavBtn({ onClick, disabled, arrow, label, side }: {
  onClick: () => void;
  disabled: boolean;
  arrow: string;
  label: string;
  side: 'start' | 'end';
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      whileHover={disabled ? undefined : { scale: 1.04 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-bold whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
      style={{
        background: '#f6e7df',
        color: '#8f4220',
        border: '1px solid rgba(184,85,46,0.35)',
        boxShadow: disabled ? 'none' : '0 2px 8px rgba(184,85,46,0.15)',
      }}
    >
      {side === 'start' && <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>{arrow}</span>}
      <span>{label}</span>
      {side === 'end' && <span aria-hidden="true" style={{ fontSize: '16px', lineHeight: 1 }}>{arrow}</span>}
    </motion.button>
  );
}

function ActionBtn({ children, onClick, primary = false }: { children: React.ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      className="px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all"
      style={primary
        ? { background: '#b8552e', color: '#fff', boxShadow: '0 4px 12px rgba(184,85,46,0.4)' }
        : { background: 'var(--color-paper)', color: '#8f4220', border: '1px solid rgba(184,85,46,0.3)', boxShadow: 'var(--shadow-card)' }}
    >
      {children}
    </motion.button>
  );
}

function getWeatherEmoji(startDate: string | null | undefined, dayOffset: number): string {
  if (!startDate) return '🌤';
  try {
    const d = new Date(`${startDate.slice(0, 10)}T12:00:00`);
    d.setDate(d.getDate() + dayOffset);
    const month = d.getMonth();
    if (month >= 11 || month <= 1) return '❄️';
    if (month >= 2 && month <= 4) return '🌸';
    if (month >= 5 && month <= 7) return '☀️';
    return '🍂';
  } catch { return '🌤'; }
}
