'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BrandWordmark } from '@/components/BrandWordmark';
import { SharePanel, type SharePanelCopy } from '@/components/SharePanel';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { type ItineraryUiStrings } from '@/lib/tripUiCopy';

interface ItineraryHeaderProps {
  itinerary: Itinerary;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  shareCopy: SharePanelCopy;
  session: { access_token: string } | null;
  isAdmin: boolean;
  selectedDayIndex: number;
  onBackToOverview: () => void;
  onBackToDraft?: () => void;
  initialViewMode?: 'draft' | 'final';
  editBanner?: string;
}

export function ItineraryHeader({
  itinerary, profile, ui, shareCopy, session, isAdmin,
  selectedDayIndex, onBackToOverview, onBackToDraft, initialViewMode, editBanner,
}: ItineraryHeaderProps) {
  const dest = itinerary.destination ?? '';
  const groupLabel = profile?.groupSize ? `${profile.groupSize} ${profile.groupSize === 1 ? 'Adult' : 'Adults'}` : null;
  const hotelLabel = profile?.hotelBooked ?? itinerary.basecamp?.booked?.name ?? null;

  const dateLabel = (() => {
    if (!profile?.startDate || !profile?.endDate) return null;
    try {
      const s = new Date(`${profile.startDate.slice(0,10)}T12:00:00`);
      const e = new Date(`${profile.endDate.slice(0,10)}T12:00:00`);
      const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
      return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`;
    } catch { return null; }
  })();

  return (
    <>
      {/* Edit banner — slides in above header */}
      <AnimatePresence>
        {editBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 inset-x-0 z-[60] text-sm py-2.5 px-6 text-center shadow-lg print:hidden"
            style={{ background: '#8f4220', color: '#fff' }}
          >
            ✓ {editBanner}
          </motion.div>
        )}
      </AnimatePresence>

      <nav
  className={`sticky z-50 print:hidden transition-all ${editBanner ? 'top-10' : 'top-0'}`}
  style={{ background: '#b8552e', boxShadow: '0 2px 12px rgba(0,0,0,0.12)' }}
>
  {/* ── Row 1: Brand + Back + Actions ─────────────────────────────────── */}
  <div className="flex items-center gap-2 px-4 sm:px-6 h-12 sm:h-14">
    {/* Back to overview (day-detail only) */}
    {selectedDayIndex >= 0 && (
      <motion.button
        onClick={onBackToOverview}
        whileTap={{ scale: 0.93 }}
        className="flex items-center gap-1 text-white/80 hover:text-white text-sm font-semibold transition-colors flex-shrink-0"
      >
        ←
      </motion.button>
    )}

    {/* Brand */}
    <Link href="/" className="flex-shrink-0">
      <BrandWordmark accent="rgba(255,255,255,0.9)" className="text-base text-white" />
    </Link>

    {/* Desktop chips — inline on sm+ */}
    <div className="hidden sm:flex items-center gap-2 flex-1 overflow-x-auto scrollbar-none min-w-0">
      {dateLabel && <Chip>📅 {dateLabel}</Chip>}
      {dest && <Chip>📍 {dest}</Chip>}
      {hotelLabel && <Chip>🏨 {hotelLabel}</Chip>}
      {groupLabel && <Chip>👥 {groupLabel}</Chip>}
    </div>

    {/* Spacer on mobile (chips move to row 2) */}
    <div className="flex-1 sm:hidden" />

    {/* Actions */}
    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
      {/* Draft button — desktop only */}
      {initialViewMode !== 'final' && onBackToDraft && (
        <motion.button
          onClick={onBackToDraft}
          whileTap={{ scale: 0.92 }}
          className="hidden sm:inline-flex text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white hover:border-white/50 transition-colors"
        >
          {ui.draft}
        </motion.button>
      )}
      <SharePanel
        itinerary={itinerary}
        profile={profile}
        itineraryDbId={itinerary._id ?? null}
        accessToken={session?.access_token ?? null}
        copy={shareCopy}
      />
      {/* Scout picks — desktop only */}
      {isAdmin && dest && (
        <Link
          href={`/explore/${encodeURIComponent(dest)}`}
          className="hidden sm:inline-flex text-xs font-medium px-3 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
        >
          {ui.scoutPicks}
        </Link>
      )}
      <Link
        href="/onboarding"
        className="text-xs font-medium px-2.5 py-1.5 rounded-lg border border-white/25 text-white/70 hover:text-white transition-colors"
      >
        {ui.newTrip}
      </Link>
    </div>
  </div>

  {/* ── Row 2: Chips — mobile only ──────────────────────────────────────── */}
  <div className="sm:hidden flex items-center gap-2 px-4 pb-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
    {dateLabel && <Chip>📅 {dateLabel}</Chip>}
    {dest && <Chip>📍 {dest}</Chip>}
    {hotelLabel && <Chip>🏨 {hotelLabel}</Chip>}
    {groupLabel && <Chip>👥 {groupLabel}</Chip>}
  </div>
</nav>
    </>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap flex-shrink-0"
      style={{
        background: 'rgba(255,255,255,0.18)',
        border: '1px solid rgba(255,255,255,0.25)',
      }}
    >
      {children}
    </span>
  );
}
