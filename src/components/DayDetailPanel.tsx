'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { DayPhoto } from '@/components/DayPhoto';
import { DaySummaryCard } from '@/components/DaySummaryCard';
import { DayTimeline, DayGlance, type TimelineRow, type SwapTarget } from '@/components/DayTimeline';
import { PlaceDetailCube } from '@/components/PlaceDetailCube';
import { AlternativePickerPanel } from '@/components/AlternativePickerPanel';
import { AttractionsBank } from '@/components/AttractionsBank';
import { useAttractionBank, type BankItem } from '@/hooks/useAttractionBank';
import { AuthGateModal } from '@/components/AuthGateModal';
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
  const [pendingSlot, setPendingSlot] = useState<SwapTarget | null>(null);
  const [showAuthGate, setShowAuthGate] = useState(false);
  const bank = useAttractionBank({ itineraryId, destination, itinerary, session });

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
    setPendingSlot(null);
  };

  const handleScheduleFromBank = async (item: BankItem, target: SwapTarget) => {
    if (!session) {
      setShowAuthGate(true);
      return;
    }
    const replacementActivity: Activity = {
      name: item.name,
      description: item.description ?? '',
      latitude: item.lat ?? undefined,
      longitude: item.lng ?? undefined,
      category_emoji: item.category_emoji ?? undefined,
      website_url: item.website_url ?? undefined,
      neighborhood: target.neighborhood,
    };

    try {
      await onCommitActivitySwap(
        dayIndex,
        target.slot,
        replacementActivity,
        `הוחלף ב${item.name} מבנק האטרקציות`,
        target.diningField,
      );
      await bank.removeItem(item.id);
      if (pendingSlot) setPendingSlot(null);
    } catch {
      // swap failed — keep the item in the bank so the user can retry
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={`day-detail-${dayIndex}`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="max-w-5xl mx-auto px-4 sm:px-6 py-4"
        >
          {/* Day navigation strip */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={onPrevDay}
              disabled={dayIndex === 0}
              className="flex items-center gap-1 text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ color: '#8f4220' }}
            >
              {dayIndex === 0 ? '← Previous' : `← Day ${dayIndex}`}
            </button>
            <span className="text-sm font-bold text-[#222]">
              Day {dayIndex + 1} — {day.theme ?? `Day ${dayIndex + 1} of ${totalDays}`}
            </span>
            <button
              type="button"
              onClick={onNextDay}
              disabled={dayIndex === totalDays - 1}
              className="flex items-center gap-1 text-sm font-semibold transition-opacity disabled:opacity-30"
              style={{ color: '#8f4220' }}
            >
              {dayIndex === totalDays - 1 ? 'Next →' : `Day ${dayIndex + 2} →`}
            </button>
          </div>

          {/* 2-col grid */}
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
            {/* Left */}
            <div className="flex flex-col gap-3">
              <div className="relative rounded-2xl overflow-hidden h-[200px]" style={{ boxShadow: '0 6px 20px rgba(0,0,0,0.12)' }}>
                <DayPhoto query={photoQuery} alt={day.theme ?? destination} height={200} />
              </div>

              <div className="flex items-center gap-4 px-4 py-3 rounded-2xl" style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}>
                <span className="text-3xl">{weatherEmoji}</span>
                <div>
                  <div className="text-[22px] font-black leading-none" style={{ color: 'var(--color-ink-warm)' }}>—°</div>
                  <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-ink-warm-mut)' }}>Typical weather · {destination}</div>
                </div>
              </div>

              <DayGlance day={day} />

              <DaySummaryCard day={day} dayIndex={dayIndex} ui={ui} />

              <DayTimeline
                day={day}
                dayIndex={dayIndex}
                destination={destination}
                ui={ui}
                onSwapSlot={onSwapSlot}
                onNeighborhoodClick={onNeighborhoodClick}
                onExplore={(row) => setActivePlace(row)}
                onFindAlternative={(target) => requireAuth(() => { setActiveSwap(target); setPendingSlot(target); })}
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

            {/* Right: Map + Attractions Bank — sticky so it stays in view while
                the (taller) activity list scrolls, filling the empty column. */}
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

              <AttractionsBank
                items={bank.items}
                loading={bank.loading}
                pendingSlot={pendingSlot}
                day={day}
                dayIndex={dayIndex}
                ui={ui}
                onAddManual={bank.addManualItem}
                onRemove={bank.removeItem}
                onSchedule={handleScheduleFromBank}
                onCancelPending={() => setPendingSlot(null)}
              />
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
          onClose={() => { setActiveSwap(null); setPendingSlot(null); }}
        />
      )}

      <AuthGateModal
        open={showAuthGate}
        onCancel={() => setShowAuthGate(false)}
        title="Sign in to edit this trip"
        message="Anyone with the link can view this trip, but you'll need to log in or create a free account to make changes."
      />
    </>
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
