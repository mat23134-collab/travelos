'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile, Basecamp, HotelRecommendation, type BookedHotelAround, type Activity, type CityTransportGuide } from '@/lib/types';
import { DayCard } from '@/components/DayCard';
import { DayPhoto } from '@/components/DayPhoto';
import { QuickEdit } from '@/components/QuickEdit';
import { SharePanel, type SharePanelCopy } from '@/components/SharePanel';
import { LogisticsDashboard } from '@/components/LogisticsDashboard';
import { DraftOverview } from '@/components/DraftOverview';
import { TrendingTicker } from '@/components/TrendingTicker';
import { TripStoryCube } from '@/components/TripStoryCube';
import { FeedbackSurveyModal, type FeedbackPayload } from '@/components/FeedbackSurveyModal';
import { itineraryUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { hotelOtaSearchUrl, mergeHotelOtaRows, isOtaSoldOut, hasBookableOtaRate, otaPartyFromProfile, googleHotelsSearchUrl, type HotelOtaLinkOpts } from '@/lib/hotelOtaLinks';

/** Strip trailing "/night" variants the AI sometimes appends to indicativeNightly
 *  so we don't double-up when we add our own "· /night (est.)" suffix. */
function cleanNightlyRate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.replace(/\s*\/\s*night\b.*/i, '').trim() || null;
}
import type { SwapResult } from '@/app/api/swap/route';
import { useAuth } from '@/lib/auth-context';
import { ITIN_RESULTS_NOISE_DATA_URL, ITIN_PALETTE } from '@/lib/itineraryResultsPalette';
import { STEP_BACKGROUNDS } from '@/lib/stepBackgrounds';
import { BrandWordmark } from '@/components/BrandWordmark';
import { TransportCard, hasTransportContent } from '@/components/TransportCard';
import type { ItineraryMapLabels } from '@/components/ItineraryMap';
import { parseTransportGuideJson } from '@/lib/transportGuideParse';
import { useItinerary } from '@/hooks/useItinerary';
import { ItineraryHeader } from '@/components/ItineraryHeader';
import { DayCarousel } from '@/components/DayCarousel';
import { ItineraryHero } from '@/components/ItineraryHero';
import { TripStats } from '@/components/TripStats';
import { deriveTripStats, deriveTripStatLists } from '@/lib/tripStats';
import { budgetToUsd } from '@/lib/currency';
import { DayDetailPanel } from '@/components/DayDetailPanel';
import { HotelSelectionCard } from '@/components/HotelSelectionCard';
import { AssistantChat } from '@/components/AssistantChat';
import { formatTripDateRange } from '@/lib/formatTripDateRange';
import { TripCollaborators, type TripCollaborator } from '@/components/TripCollaborators';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  { ssr: false, loading: () => <div className="w-full rounded-2xl animate-pulse" style={{ height: 380, background: 'rgba(45,84,94,0.28)', border: '1px solid rgba(255,255,255,0.07)' }} /> }
);

type ViewMode = 'draft' | 'final';

// ─── Basecamp section ─────────────────────────────────────────────────────────

const HOTEL_DETAIL_SPRING = { type: 'spring' as const, stiffness: 380, damping: 30 };

function starRow(score?: number | null): string | null {
  if (score == null || !Number.isFinite(score)) return null;
  const clamped = Math.max(0, Math.min(5, score));
  const full = Math.floor(clamped);
  const half = clamped - full >= 0.5 ? 1 : 0;
  const empty = Math.max(0, 5 - full - half);
  return `${'★'.repeat(full)}${half ? '½' : ''}${'☆'.repeat(empty)}`;
}

const ACTIVE_OTA_IDS = new Set(['booking', 'agoda'] as const);

function activeOtaRowsForHotel(hotel: HotelRecommendation) {
  return mergeHotelOtaRows(hotel.otaPriceCompare).filter((r) =>
    ACTIVE_OTA_IDS.has(r.id as 'booking' | 'agoda'),
  );
}

/** At least one OTA channel with date-available inventory. Official site alone is not enough. */
function hasAnyBookableChannel(hotel: HotelRecommendation): boolean {
  return activeOtaRowsForHotel(hotel).some(hasBookableOtaRate);
}

function HotelDetailCube({
  hotel,
  destination,
  profile,
  onClose,
  ui,
}: {
  hotel: HotelRecommendation;
  destination: string;
  profile: TravelerProfile | null;
  onClose: () => void;
  ui: ItineraryUiStrings;
}) {
  const checkIn = profile?.startDate?.slice(0, 10);
  const checkOut = profile?.endDate?.slice(0, 10);
  const party = otaPartyFromProfile(profile);
  const otaOpts = { checkIn, checkOut, adults: party.adults, children: party.children };
  const otaRows = activeOtaRowsForHotel(hotel);
  const reviewsHref = `https://www.google.com/search?q=${encodeURIComponent(`${hotel.name} hotel ${destination} reviews`)}`;
  const stars = starRow(hotel.ratingStars);
  const photoQuery = `${hotel.name} ${destination}`.trim();

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      <motion.div
        className="relative w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] overflow-hidden flex flex-col z-10"
        style={{
          background: '#12343b',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 40px 100px -20px rgba(0,0,0,0.85)',
          maxHeight: '92dvh',
        }}
        initial={{ y: '100%', scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: '60%', opacity: 0, scale: 0.94 }}
        transition={HOTEL_DETAIL_SPRING}
      >
        <div className="relative flex-shrink-0">
          <DayPhoto query={photoQuery} alt={hotel.name} height={220} dark />
          <motion.button
            type="button"
            onClick={onClose}
            whileTap={{ scale: 0.85 }}
            aria-label="Close hotel details"
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
            style={{ background: 'rgba(18,52,59,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            ✕
          </motion.button>
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wide z-10"
            style={{ background: 'rgba(18,52,59,0.82)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {ui.hotelModalBadge}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-6">
          <h3 className="text-white font-bold text-xl tracking-tight leading-tight">{hotel.name}</h3>
          <p className="text-white/45 text-sm mt-1">📍 {hotel.neighborhood}</p>

          <div className="flex flex-wrap gap-2 mt-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#a89254] bg-[#a89254]/12 px-2 py-0.5 rounded-full">
              {hotel.neighborhoodVibe}
            </span>
            <span className="text-[10px] text-white/45 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              {hotel.priceRange}
            </span>
            {stars && hotel.ratingStars != null && Number.isFinite(hotel.ratingStars) && (
              <span
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{
                  color: 'rgba(212,200,168,0.95)',
                  background: 'rgba(201,168,76,0.12)',
                  borderColor: 'rgba(201,168,76,0.22)',
                }}
              >
                {stars} {hotel.ratingStars.toFixed(1)}/5
                {hotel.ratingSource ? ` · ${hotel.ratingSource}` : ''}
              </span>
            )}
            {hotel.reviewCountHint && (
              <span className="text-[10px] text-white/35 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                {hotel.reviewCountHint}
              </span>
            )}
          </div>

          {(checkIn || checkOut) && (
            <div className="mb-3 text-[11px] text-white/40">
              {ui.hotelYourDates}{' '}
              <span className="text-white/70 font-mono">
                {checkIn ?? '—'} → {checkOut ?? '—'}
              </span>
            </div>
          )}

          {hotel.estimatedPriceRangeTripDates && (
            <div
              className="mb-3 rounded-xl px-3 py-2.5 border"
              style={{
                background: 'rgba(201,168,76,0.08)',
                borderColor: 'rgba(201,168,76,0.22)',
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'rgba(201,168,76,0.92)' }}>
                {ui.hotelPriceBand}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(212,200,168,0.9)' }}>
                {hotel.estimatedPriceRangeTripDates}
              </p>
            </div>
          )}

          {hotel.availabilitySummary && (
            <div
              className="mb-3 rounded-xl px-3 py-2.5 border border-sky-500/20"
              style={{ background: 'rgba(56,189,248,0.06)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-sky-200/80 mb-1">{ui.hotelAvailability}</p>
              <p className="text-xs text-sky-100/80 leading-relaxed">{hotel.availabilitySummary}</p>
            </div>
          )}

          <div className="mb-4 rounded-xl px-3 py-2.5 border border-white/10 bg-white/[0.03]">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/45 mb-1.5">{ui.hotelFitSummary}</p>
            <p className="text-xs text-white/75 leading-relaxed">
              {hotel.fitSummary?.trim() || hotel.whyItFits}
            </p>
          </div>

          {hotel.fitSummary?.trim() && (
            <p className="text-[11px] text-white/45 leading-relaxed mb-4">{hotel.whyItFits}</p>
          )}

          <div
            className="mb-4 rounded-xl overflow-hidden border"
            style={{ background: 'rgba(201,168,76,0.07)', borderColor: 'rgba(201,168,76,0.24)' }}
          >
            <p
              className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2.5 pb-2 border-b mb-0"
              style={{ color: 'rgba(212,200,168,0.95)', borderColor: 'rgba(201,168,76,0.16)' }}
            >
              {ui.hotelOtaCompareTitle}
            </p>
            <ul className="divide-y divide-white/8">
              {otaRows.filter((r) => r.hasData).map((row) => {
                const soldOut = isOtaSoldOut(row);
                const nightly = cleanNightlyRate(row.indicativeNightly);
                return (
                  <li key={row.id} className="px-3 py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold text-white/90">{row.label}</p>
                        {soldOut && (
                          <span
                            className="text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.20)', color: '#f87171', border: '1px solid rgba(239,68,68,0.32)' }}
                          >
                            {ui.hotelStatusSoldOut}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-mono mt-0.5" style={{ color: soldOut ? '#f87171' : 'rgba(212,200,168,0.88)' }}>
                        {soldOut
                          ? ui.hotelNoAvailabilityDates
                          : nightly
                            ? `${nightly} · ${ui.hotelOtaPerNight}`
                            : ui.hotelOtaNoPrice}
                      </p>
                      {row.note && !soldOut && (
                        <p className="text-[10px] text-white/40 leading-snug mt-1">{row.note}</p>
                      )}
                    </div>

                    {/* Sold-out rows: no link, just a disabled label */}
                    {soldOut ? (
                      <span
                        className="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-bold border select-none"
                        style={{ color: '#f87171', borderColor: 'rgba(239,68,68,0.28)', background: 'rgba(239,68,68,0.08)', opacity: 0.7, cursor: 'default' }}
                      >
                        {ui.hotelStatusSoldOut}
                      </span>
                    ) : (
                      <a
                        href={hotelOtaSearchUrl(row.id, hotel.name, destination, otaOpts)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-bold border transition-colors hover-bg-surface"
                        style={{ color: 'white', borderColor: 'rgba(255,255,255,0.15)', background: 'transparent' }}
                      >
                        {ui.hotelOtaOpen}
                      </a>
                    )}
                  </li>
                );
              })}
              {otaRows.every((r) => !r.hasData) && (
                <li className="px-3 py-4 text-center text-[11px] text-white/30">
                  No OTA pricing data available for this hotel
                </li>
              )}
            </ul>
          </div>

          <div
            className="rounded-xl px-3 py-2 mb-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">{ui.hotelNeighborhoodEdge}</p>
            <p className="text-[11px] text-white/60 leading-relaxed">{hotel.neighborhoodInsight}</p>
          </div>

          <div className="flex flex-col gap-2">
            {/* Google Hotels — reliable availability + price comparison (no Booking interstitial) */}
            <a
              href={googleHotelsSearchUrl(hotel.name, destination)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl text-sm font-bold text-center text-white transition-opacity hover:opacity-95"
              style={{ background: '#1a73e8', boxShadow: '0 4px 18px rgba(26,115,232,0.28)' }}
            >
              {ui.dir === 'rtl' ? 'זמינות ומחירים ב-Google' : 'Availability & prices on Google'}
            </a>
            {hotel.websiteUrl && (
              <a
                href={hotel.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-bold text-center text-white transition-opacity hover:opacity-95"
                style={{ background: '#a89254', boxShadow: '0 4px 18px rgba(201,168,76,0.28)' }}
              >
                {ui.hotelOfficialSite}
              </a>
            )}
            <a
              href={reviewsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-center text-white/45 hover:text-white/70 border border-white/10"
            >
              {ui.hotelReviews}
            </a>
          </div>

          <p className="text-[10px] text-white/25 mt-4 leading-relaxed text-center">
            {ui.hotelDisclaimer}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── OTA brand icon components ─────────────────────────────────────────────────

function BookingDotIcon({ size = 10 }: { size?: number }) {
  // Stylised "B." in Booking.com blue
  return (
    <svg width={size} height={size + 2} viewBox="0 0 10 12" fill="none" aria-hidden>
      <path d="M1.5 1.5h3.2c1.15 0 2.1.95 2.1 2.1s-.95 2.1-2.1 2.1H1.5V1.5z" fill="#0071c2" fillOpacity="0.95" />
      <path d="M1.5 5.7h3.5c1.27 0 2.3 1.03 2.3 2.3s-1.03 2.3-2.3 2.3H1.5V5.7z" fill="#0071c2" fillOpacity="0.95" />
    </svg>
  );
}

function AgodaMarkIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" aria-hidden>
      <circle cx="5" cy="5" r="4.2" fill="#d6213d" fillOpacity="0.9" />
      <circle cx="5" cy="5" r="1.7" fill="#fff" fillOpacity="0.95" />
    </svg>
  );
}

function AirbnbFlameIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size + 2} viewBox="0 0 10 12" fill="none" aria-hidden>
      <path
        d="M5 1C5 1 2 4.5 2 7a3 3 0 006 0C8 4.5 5 1 5 1z"
        fill="#FF385C"
        fillOpacity="0.92"
      />
      <circle cx="5" cy="7" r="1.2" fill="white" fillOpacity="0.85" />
    </svg>
  );
}

// OTA icon map — used in both card footer and popover
const OTA_ICON: Record<string, (size: number) => React.ReactNode> = {
  booking: (s) => <BookingDotIcon size={s} />,
  agoda:   (s) => <AgodaMarkIcon size={s} />,
  airbnb:  (s) => <AirbnbFlameIcon size={s} />,
};

// OTA color theme map
const OTA_THEME: Record<string, { bg: string; border: string; color: string }> = {
  booking: { bg: 'rgba(0,113,194,0.13)',  border: 'rgba(0,113,194,0.28)',  color: '#4da3e8'  },
  agoda:   { bg: 'rgba(214,33,61,0.11)',  border: 'rgba(214,33,61,0.26)',  color: '#e8657c'  },
  airbnb:  { bg: 'rgba(255,56,92,0.11)',  border: 'rgba(255,56,92,0.26)',  color: '#ff6b87'  },
};

// ── TravelOS Index interactive badge ──────────────────────────────────────────

/** Inline popover rendered into document.body via portal — escapes backdrop-filter stacking contexts. */
function TosPopoverPortal({
  hotel,
  destination,
  profile,
  coords,
  onClose,
}: {
  hotel: HotelRecommendation;
  destination: string;
  profile: TravelerProfile | null;
  coords: { top: number; right: number };
  onClose: () => void;
}) {
  const otaRows = activeOtaRowsForHotel(hotel);
  const soldOutLabel = profile?.tripLanguage === 'he' ? 'אזל' : 'SOLD OUT';
  const tosScore = hotel.ratingStars != null && Number.isFinite(hotel.ratingStars)
    ? Math.round(hotel.ratingStars * 20)
    : null;

  // Inline brand badge inside popover rows
  const brandBadge = (id: 'booking' | 'agoda' | 'airbnb') => {
    const map = {
      booking: { bg: '#003580', color: '#fff',  label: 'B.' },
      agoda:   { bg: '#d6213d', color: '#fff',  label: 'Ag' },
      airbnb:  { bg: '#ff385c', color: '#fff',  label: 'A' },
    };
    const { bg, color, label } = map[id];
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-black leading-none flex-shrink-0"
        style={{ background: bg, color }}
      >
        {label}
      </span>
    );
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[98]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: -8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: -8 }}
        transition={{ type: 'spring', stiffness: 500, damping: 34 }}
        style={{
          position: 'fixed',
          top: coords.top,
          right: coords.right,
          zIndex: 99,
          width: 228,
        }}
      >
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'rgba(5, 14, 30, 0.97)',
            backdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.11)',
            boxShadow: '0 28px 80px -12px rgba(0,0,0,0.88), 0 0 0 1px rgba(201,168,76,0.10) inset',
          }}
        >
          {/* Header — composite score */}
          <div className="px-4 pt-4 pb-3.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <p
              className="text-[9px] font-bold uppercase tracking-[0.18em] mb-2"
              style={{ color: 'rgba(201,168,76,0.60)' }}
            >
              TravelOS Index
            </p>
            <div className="flex items-end gap-1.5">
              <span className="text-4xl font-black text-white leading-none">{tosScore ?? '—'}</span>
              <span className="text-base pb-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>/100</span>
            </div>
            {(hotel.ratingSource || hotel.reviewCountHint) && (
              <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {[hotel.ratingSource, hotel.reviewCountHint].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>

          {/* Per-OTA nightly price rows — only OTAs the AI returned data for */}
          <div className="px-3 py-3 flex flex-col gap-1.5">
            {otaRows.filter((r) => r.hasData).map((row) => {
              const soldOut = isOtaSoldOut(row);
              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between px-2.5 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.038)' }}
                >
                  <div className="flex items-center gap-2">
                    {brandBadge(row.id)}
                    <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.58)' }}>
                      {row.label}
                    </span>
                    {soldOut && (
                      <span
                        className="text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded"
                        style={{ background: 'rgba(239,68,68,0.20)', color: '#f87171', border: '1px solid rgba(239,68,68,0.30)' }}
                      >
                        {soldOutLabel}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{ color: soldOut ? '#f87171' : row.indicativeNightly ? '#d4b96a' : 'rgba(255,255,255,0.22)' }}
                  >
                    {soldOut ? '—' : (row.indicativeNightly ?? '—')}
                  </span>
                </div>
              );
            })}
            {otaRows.every((r) => !r.hasData) && (
              <p className="text-[11px] text-center py-2" style={{ color: 'rgba(255,255,255,0.25)' }}>
                No live pricing data available
              </p>
            )}
          </div>

          <p
            className="px-4 pb-3.5 text-[10px] text-center"
            style={{ color: 'rgba(255,255,255,0.18)' }}
          >
            Indicative rates · verify live pricing
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

// ── Premium HotelCard ─────────────────────────────────────────────────────────

function HotelCard({
  hotel,
  onOpen,
  destination,
  profile,
  ui,
}: {
  hotel: HotelRecommendation;
  onOpen: () => void;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
}) {
  const [tosOpen, setTosOpen] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState({ top: 0, right: 0 });
  const [mounted, setMounted] = useState(false);
  const badgeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Pricing helpers ──
  const checkIn  = profile?.startDate?.slice(0, 10);
  const checkOut = profile?.endDate?.slice(0, 10);
  const party    = otaPartyFromProfile(profile);

  const nights = useMemo(() => {
    if (!checkIn || !checkOut) return null;
    const diff = Math.round(
      (new Date(`${checkOut}T12:00:00`).getTime() - new Date(`${checkIn}T12:00:00`).getTime()) / 86_400_000,
    );
    return diff > 0 ? diff : null;
  }, [checkIn, checkOut]);

  const otaRows = activeOtaRowsForHotel(hotel);

  // Prefer the first OTA row with a price; fall back to the AI-generated band
  const perNightStr: string | null =
    otaRows.find(hasBookableOtaRate)?.indicativeNightly ??
    hotel.estimatedPriceRangeTripDates ??
    null;

  // Try to extract a leading $ figure for total calculation
  const perNightNum = useMemo(() => {
    if (!perNightStr) return null;
    const m = /\$(\d[\d,]*)/.exec(perNightStr);
    return m ? parseInt(m[1].replace(/,/g, ''), 10) : null;
  }, [perNightStr]);

  const totalPrice =
    nights != null && perNightNum != null
      ? `$${(nights * perNightNum).toLocaleString()}`
      : null;

  // TravelOS score — 5-star scale → /100
  const tosScore =
    hotel.ratingStars != null && Number.isFinite(hotel.ratingStars)
      ? Math.round(hotel.ratingStars * 20)
      : null;

  // OTA deep-link URLs (dates + party size pre-filled)
  const otaOpts = { checkIn, checkOut, adults: party.adults, children: party.children };

  // Only render links for OTAs that the AI actually returned data for
  const activeOtaRows = otaRows.filter((r) => r.hasData);
  const hotelAvailable = hasAnyBookableChannel(hotel);

  // Badge click — position popover near the badge, then toggle
  const handleBadgeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (badgeRef.current) {
      const r = badgeRef.current.getBoundingClientRect();
      setPopoverCoords({
        top: r.bottom + 8,                    // viewport-relative; fixed positioning, no scrollY needed
        right: window.innerWidth - r.right,   // distance from right viewport edge
      });
    }
    setTosOpen((v) => !v);
  };

  return (
    <>
      {/* ── Card shell ──────────────────────────────────────────── */}
      <motion.div
        onClick={onOpen}
        whileHover={{ y: -5, boxShadow: '0 24px 64px -10px rgba(0,0,0,0.72), 0 0 0 1px rgba(168,146,84,0.30)' }}
        whileTap={{ scale: 0.984 }}
        transition={{
          y:         { type: 'spring', stiffness: 360, damping: 28 },
          boxShadow: { duration: 0.22, ease: 'easeOut' },
          scale:     { type: 'spring', stiffness: 560, damping: 30 },
        }}
        className="relative rounded-3xl cursor-pointer flex flex-col group"
        style={{
          background:     'rgba(10, 24, 44, 0.74)',
          border:         '1px solid rgba(255,255,255,0.09)',
          boxShadow:      '0 8px 32px -8px rgba(0,0,0,0.50)',
          backdropFilter: 'blur(14px)',
        }}
      >
        {/* Top shimmer line */}
        <div className="absolute top-0 inset-x-0 h-px rounded-t-3xl bg-gradient-to-r from-transparent via-[#a89254]/38 to-transparent pointer-events-none" />

        {/* ── Image zone ──────────────────────────────────────────── */}
        <div className="relative h-40 rounded-t-3xl overflow-hidden flex-shrink-0">
          <DayPhoto
            query={`${hotel.name} ${destination} hotel exterior luxury`}
            alt={hotel.name}
            height={220}
            dark
          />
          {/* Cinematic gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a1828]/90 via-[#0a1828]/15 to-transparent pointer-events-none" />

          {/* TravelOS Index badge — top-right corner */}
          {tosScore != null && (
            <button
              ref={badgeRef}
              type="button"
              onClick={handleBadgeClick}
              className="absolute top-2.5 right-2.5 w-[42px] h-[42px] rounded-xl flex flex-col items-center justify-center z-10 transition-transform hover:scale-105 active:scale-95"
              style={{
                background:     'rgba(5, 13, 28, 0.90)',
                backdropFilter: 'blur(16px)',
                border:         '1px solid rgba(201,168,76,0.42)',
                boxShadow:      '0 4px 20px rgba(0,0,0,0.55)',
              }}
              title="TravelOS Index — tap for source breakdown"
            >
              <span
                className="text-[14px] font-black leading-none"
                style={{ color: '#C9A84C' }}
              >
                {tosScore}
              </span>
              <span
                className="text-[7px] font-bold uppercase tracking-wider mt-0.5"
                style={{ color: 'rgba(201,168,76,0.50)' }}
              >
                TOS
              </span>
            </button>
          )}

          {/* Neighborhood vibe pill — bottom-left of image */}
          {hotel.neighborhoodVibe && (
            <div
              className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest z-10"
              style={{
                background:     'rgba(201,168,76,0.20)',
                border:         '1px solid rgba(201,168,76,0.34)',
                color:          '#d4b96a',
                backdropFilter: 'blur(8px)',
              }}
            >
              {hotel.neighborhoodVibe}
            </div>
          )}
        </div>

        {/* ── Content zone ────────────────────────────────────────── */}
        <div className="flex flex-col gap-3 p-4 flex-1">

          {/* Name + location */}
          <div>
            <p className="font-bold text-white text-[15px] leading-tight tracking-tight">
              {hotel.name}
            </p>
            <p
              className="text-[11px] mt-0.5 flex items-center gap-1"
              style={{ color: 'rgba(255,255,255,0.36)' }}
            >
              <span className="text-[10px]">📍</span>
              {hotel.neighborhood}
            </p>
            <p className="mt-1">
              <span
                className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wide"
                style={
                  hotelAvailable
                    ? { color: '#86efac', background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.35)' }
                    : { color: '#fca5a5', background: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.35)' }
                }
              >
                {hotelAvailable ? ui.hotelStatusAvailable : ui.hotelStatusSoldOut}
              </span>
            </p>
          </div>

          {/* Price block */}
          <div>
            {totalPrice ? (
              <>
                <p className="text-xl font-black text-white leading-none tracking-tight">
                  {totalPrice}
                </p>
                <p className="text-[11px] mt-1 leading-snug" style={{ color: 'rgba(255,255,255,0.34)' }}>
                  {perNightStr} · {nights} night{nights !== 1 ? 's' : ''}
                </p>
              </>
            ) : perNightStr ? (
              <>
                <p className="text-base font-bold text-white leading-none">
                  {perNightStr}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.34)' }}>
                  per night
                </p>
              </>
            ) : hotel.priceRange ? (
              <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.48)' }}>
                {hotel.priceRange}
              </p>
            ) : null}
          </div>

          {/* Fit summary — airy, 2-line cap */}
          {(hotel.fitSummary?.trim() || hotel.whyItFits) && (
            <p
              className="text-[12px] leading-relaxed line-clamp-2"
              style={{ color: 'rgba(255,255,255,0.50)' }}
            >
              {hotel.fitSummary?.trim() || hotel.whyItFits}
            </p>
          )}

          {/* ── Footer: OTA icon links (only OTAs with AI data) + hint ── */}
          <div
            className="flex items-center justify-between mt-auto pt-3"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeOtaRows.map((row) => {
                const soldOut    = isOtaSoldOut(row);
                const theme      = OTA_THEME[row.id] ?? OTA_THEME.booking;
                const icon       = OTA_ICON[row.id]?.(9) ?? null;
                const shortLabel = row.label.replace('.com', '').replace('booking', 'Booking').split('.')[0];

                // Sold-out OTAs: no link, just a disabled chip
                if (soldOut) {
                  return (
                    <span
                      key={row.id}
                      title={`${row.label}: no availability for your dates`}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold select-none"
                      style={{
                        background: 'rgba(239,68,68,0.10)',
                        border: '1px solid rgba(239,68,68,0.28)',
                        color: '#f87171',
                        cursor: 'default',
                        opacity: 0.75,
                      }}
                    >
                      {icon}
                      <span>{shortLabel}</span>
                      <span
                        className="text-[8px] font-black uppercase tracking-wide px-1 py-0.5 rounded ml-0.5"
                        style={{ background: 'rgba(239,68,68,0.22)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.32)' }}
                      >
                        {ui.hotelStatusSoldOut}
                      </span>
                    </span>
                  );
                }

                return (
                  <a
                    key={row.id}
                    href={hotelOtaSearchUrl(row.id, hotel.name, destination, otaOpts)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title={`Search on ${row.label} — dates & hotel pre-filled`}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                    style={{ background: theme.bg, border: `1px solid ${theme.border}`, color: theme.color }}
                  >
                    {icon}
                    <span>{shortLabel}</span>
                  </a>
                );
              })}
              {/* Always-on Google Hotels chip — reliable availability + prices */}
              <a
                href={googleHotelsSearchUrl(hotel.name, destination)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="Availability & prices on Google Hotels"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:scale-105"
                style={{ background: 'rgba(26,115,232,0.14)', border: '1px solid rgba(26,115,232,0.4)', color: '#1a73e8' }}
              >
                <span>Google</span>
              </a>
            </div>

            {/* Tap hint */}
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              Explore →
            </p>
          </div>
        </div>
      </motion.div>

      {/* ── TravelOS popover (portal — escapes backdrop-filter stacking context) ── */}
      {mounted && tosOpen && (
        <TosPopoverPortal
          hotel={hotel}
          destination={destination}
          profile={profile}
          coords={popoverCoords}
          onClose={() => setTosOpen(false)}
        />
      )}
    </>
  );
}

function RecommendationsBasecampInner({
  recommendations,
  title,
  target,
  destination,
  profile,
  ui,
}: {
  recommendations: HotelRecommendation[];
  title: string;
  target: string;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
}) {
  const [selected, setSelected] = useState<HotelRecommendation | null>(null);

  // Show only hotels that have at least one bookable channel for these dates.
  const visibleHotels = recommendations.filter((h) => h.availability !== false && hasAnyBookableChannel(h));
  if (!visibleHotels.length) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-3xl overflow-hidden mb-8"
        style={{ background: '#12343b', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.55)' }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#a89254]/08 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#2d545e]/25 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#a89254]">{ui.basecampBadge}</span>
            <span className="text-[10px] text-white/30">{ui.basecampApprovedPicks(title)}</span>
          </div>
          <h3 className="text-base font-bold text-white mb-4">{ui.basecampWhereStay(target)}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {visibleHotels.map((hotel, i) => (
              <HotelCard
                key={`${hotel.name}-${hotel.neighborhood}-${i}`}
                hotel={hotel}
                onOpen={() => setSelected(hotel)}
                destination={destination}
                profile={profile}
                ui={ui}
              />
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-4 text-center">
            {ui.basecampFooter}
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {selected && (
          <HotelDetailCube
            key={`${selected.name}|${selected.neighborhood}`}
            hotel={selected}
            destination={destination}
            profile={profile}
            ui={ui}
            onClose={() => setSelected(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function BasecampSection({
  basecamp,
  groupType,
  destination,
  profile,
  ui,
}: {
  basecamp: Basecamp;
  groupType?: TravelerProfile['groupType'] | null;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
}) {
  const title = ui.audienceTitle(groupType);
  const target = ui.audienceTarget(groupType);
  if (basecamp.type === 'booked' && basecamp.booked) {
    const { name, neighborhood, neighborhoodInsight } = basecamp.booked;
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-3xl overflow-hidden mb-8"
        style={{ background: '#12343b', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px -12px rgba(0,0,0,0.55)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#a89254]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-[#C9A84C]/12 rounded-full blur-[60px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#a89254]">{ui.basecampYour}</span>
            <span className="text-[10px] text-white/30 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">{ui.basecampPreBooked}</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{name}</h3>
          <p className="text-sm text-white/45 mt-0.5">📍 {neighborhood}</p>
          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-1">{ui.basecampNeighborhoodStrategy}</p>
            <p className="text-sm text-white/75 leading-relaxed">{neighborhoodInsight}</p>
          </div>
        </div>
      </motion.div>
    );
  }

  if (basecamp.type === 'recommendations' && basecamp.recommendations?.length) {
    return (
      <RecommendationsBasecampInner
        recommendations={basecamp.recommendations}
        title={title}
        target={target}
        destination={destination}
        profile={profile}
        ui={ui}
      />
    );
  }

  return null;
}

function hasAroundHotelContent(a?: BookedHotelAround | null): boolean {
  if (!a) return false;
  return !!(
    (a.areaHeadline && a.areaHeadline.trim()) ||
    (a.vibes && a.vibes.length > 0) ||
    (a.walkableHighlights && a.walkableHighlights.length > 0) ||
    (a.transitNearHotel && a.transitNearHotel.length > 0) ||
    (a.signatureMove && a.signatureMove.trim())
  );
}

function BookedHotelAroundSection({
  around,
  neighborhood,
  ui,
}: {
  around: BookedHotelAround;
  neighborhood: string;
  ui: ItineraryUiStrings;
}) {
  if (!hasAroundHotelContent(around)) return null;

  return (
    <motion.div
      dir={ui.dir}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14, type: 'spring', stiffness: 280, damping: 26 }}
      className="relative rounded-3xl overflow-hidden mb-8"
      style={{
        background: 'linear-gradient(145deg, rgba(225,179,130,0.12) 0%, rgba(18,52,59,0.96) 42%, #12343b 100%)',
        border: '1px solid rgba(139,92,246,0.22)',
        boxShadow: '0 0 0 1px rgba(201,168,76,0.12) inset, 0 24px 64px -12px rgba(0,0,0,0.60)',
      }}
    >
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-[#4a7bde]/15 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-[#a89254]/10 blur-[70px] pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#a89254]">{ui.aroundHotelBadge}</span>
          <span className="text-[10px] text-white/35 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.04]">
            {ui.aroundHotelPerkChip}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight mb-1">{ui.aroundHotelTitle}</h3>
        <p className="text-xs text-white/45 mb-4">{ui.aroundHotelSub(neighborhood)}</p>
        {around.areaHeadline && (
          <p className="text-sm text-white/85 leading-relaxed mb-5 border-l-2 border-[#a89254] pl-3">{around.areaHeadline}</p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {!!around.vibes?.length && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-2">{ui.aroundHotelVibes}</p>
              <div className="flex flex-wrap gap-1.5">
                {around.vibes.map((v, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: 'rgba(201,168,76,0.18)',
                      color: '#f0d0d4',
                      border: '1px solid rgba(201,168,76,0.35)',
                    }}
                  >
                    {v}
                  </span>
                ))}
              </div>
            </div>
          )}
          {!!around.transitNearHotel?.length && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-2">{ui.aroundHotelTransit}</p>
              <ul className="space-y-2">
                {around.transitNearHotel.map((t, i) => (
                  <li key={i} className="text-xs text-white/70 leading-snug">
                    <span className="text-white/90 font-semibold">{t.modeLabel}</span>
                    {' · '}
                    <span>{t.lineOrRoute}</span>
                    {t.walkMinutes && <span className="text-white/40"> · {t.walkMinutes}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {!!around.walkableHighlights?.length && (
          <div
            className="mt-4 rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#C9A84C] mb-2">{ui.aroundHotelWalk}</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {around.walkableHighlights.map((h, i) => (
                <li key={i} className="text-xs text-white/72 leading-relaxed flex gap-2">
                  <span className="text-[#a89254] shrink-0">▸</span>
                  <span>{h}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {around.signatureMove && (
          <div
            className="mt-4 rounded-xl p-4 relative overflow-hidden"
            style={{
              background: 'linear-gradient(120deg, rgba(201,168,76,0.2) 0%, rgba(45,84,94,0.35) 100%)',
              border: '1px solid rgba(201,168,76,0.35)',
            }}
          >
            <div className="absolute top-2 right-3 text-lg opacity-30 select-none" aria-hidden>
              ✦
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-white/60 mb-1">{ui.aroundHotelSignature}</p>
            <p className="text-sm text-white/92 leading-relaxed pr-6">{around.signatureMove}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Trip Intelligence modal ──────────────────────────────────────────────────

function TripIntelligenceButton({ meta, ui }: { meta: NonNullable<Itinerary['_meta']>; ui: ItineraryUiStrings }) {
  const [open, setOpen] = useState(false);

  if (!meta.searchEnabled) return null;

  const stats = [
    { icon: '🔍', label: ui.intelSources, value: meta.sourcesFound, color: 'text-white' },
    { icon: '💎', label: ui.intelGems, value: meta.hiddenGems ?? 0, color: 'text-purple-400' },
    { icon: '⚠️', label: ui.intelTraps, value: meta.trapsFiltered ?? 0, color: 'text-amber-400' },
    { icon: '🔴', label: ui.intelContradictions, value: meta.contradictionsFound ?? 0, color: 'text-red-400' },
  ];

  return (
    <>
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.93, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/70 hover:bg-white/15 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#a89254] animate-pulse" />
        {ui.tripIntel}
        <span className="text-white/40 ml-0.5">↗</span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-sm bg-[#12343b] rounded-2xl border border-white/10 p-6 shadow-2xl"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#a89254]/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-white font-bold text-base tracking-tight">{ui.tripIntel}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{ui.tripIntelSub}</p>
                  </div>
                  <motion.button
                    onClick={() => setOpen(false)}
                    whileTap={{ scale: 0.85 }}
                    aria-label="Close Trip Intelligence"
                    className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/50 hover:bg-white/15 transition-colors text-xs"
                  >
                    ✕
                  </motion.button>
                </div>
                <div className="flex flex-col gap-2.5">
                  {stats.map(({ icon, label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2.5 px-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{icon}</span>
                        <span className="text-white/60 text-xs">{label}</span>
                      </div>
                      <span className={`font-bold text-sm tabular-nums ${color}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <p className="text-white/25 text-[10px] mt-4 leading-relaxed text-center">
                  {ui.tripIntelFooter(meta.sourcesFound)}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Hero animation ───────────────────────────────────────────────────────────

const heroVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

// ─── Mobile map overlay ───────────────────────────────────────────────────────

function MobileMapOverlay({
  days,
  destination,
  focusedNeighborhood,
  basecampMarker,
  onClose,
  mapTitle,
  mapLabels,
}: {
  days: Itinerary['days'];
  destination: string;
  focusedNeighborhood?: string;
  basecampMarker?: { lat: number; lng: number; label?: string } | null;
  onClose: () => void;
  mapTitle: string;
  mapLabels: ItineraryMapLabels;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex flex-col"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative mt-auto rounded-t-3xl overflow-hidden"
          style={{ height: '85dvh', background: '#12343b', border: '1px solid rgba(255,255,255,0.10)' }}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
            <h3 className="font-bold text-white text-sm tracking-tight">{mapTitle}</h3>
            <motion.button
              onClick={onClose}
              whileTap={{ scale: 0.88, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
              aria-label="Close map"
              className="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors hover-bg-card-h"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
            >
              ✕
            </motion.button>
          </div>
          <div className="h-full pb-14">
            <ItineraryMap
              days={days}
              destination={destination}
              focusedNeighborhood={focusedNeighborhood}
              basecampMarker={basecampMarker}
              labels={mapLabels}
            />
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main client component ────────────────────────────────────────────────────

interface Props {
  initialItinerary: Itinerary;
  initialProfile: TravelerProfile | null;
  initialViewMode?: ViewMode;
  /** When set, overrides itinerary JSON for the transport card (from `public.transportation`). */
  initialTransportFromDb?: CityTransportGuide | null;
  /** From `public.trips.username` — personalized trip summary welcome. */
  initialTripSummaryUsername?: string | null;
  /** Owner of the saved itinerary row — used to detect "Join this trip". */
  ownerUserId?: string | null;
  ownerUsername?: string | null;
  /** Everyone who joined this trip via the share link. */
  collaborators?: TripCollaborator[];
}

export function ItineraryClient({
  initialItinerary,
  initialProfile,
  initialViewMode = 'draft',
  initialTransportFromDb = null,
  initialTripSummaryUsername = null,
  ownerUserId = null,
  ownerUsername = null,
  collaborators = [],
}: Props) {
  const { session } = useAuth();
  const itin = useItinerary({
    initialItinerary,
    initialProfile,
    initialViewMode,
    initialTransportFromDb,
    initialTripSummaryUsername,
  });

  // Draft mode — unchanged
  if (itin.viewMode === 'draft') {
    return (
      <DraftOverview
        itinerary={itin.itinerary}
        onUpdate={itin.handleDraftUpdate}
        onFinalize={() => itin.setViewMode('final')}
        ui={itin.ui}
      />
    );
  }

  const days = itin.itinerary.days ?? [];
  const tripStats = deriveTripStats(itin.itinerary);
  const statLists = deriveTripStatLists(itin.itinerary);
  const selectedDay = itin.selectedDayIndex >= 0 ? days[itin.selectedDayIndex] ?? null : null;

  return (
    <div className="min-h-screen relative" dir={itin.ui.dir} lang={itin.ui.htmlLang}>

      {/* ── Rotating destination photo background ─────────────────────────── */}
      <AnimatePresence initial={false}>
        <motion.div
          key={itin.bgIdx}
          aria-hidden
          className="fixed inset-0 pointer-events-none"
          style={{
            zIndex: -2,
            backgroundImage: `url("${STEP_BACKGROUNDS[itin.bgIdx].imageUrl}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </AnimatePresence>

      {/* ── Clean warm-paper background (near-opaque — hides the busy photo for
             a calm, professional, editorial surface) ───────────────────────── */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: -1,
          background:
            'linear-gradient(180deg, #f2e7d2 0%, #e9dcc2 52%, #efe3cd 100%)',
        }}
      />

      {/* ── Film grain ─────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-[0.025]"
        style={{
          backgroundImage: `url(${ITIN_RESULTS_NOISE_DATA_URL})`,
          backgroundSize: '180px 180px',
          mixBlendMode: 'multiply',
        }}
      />

      <div className="relative z-[1]">

        {/* ── Teal header with trip chips ─────────────────────────────────── */}
        <ItineraryHeader
          itinerary={itin.itinerary}
          profile={itin.profile}
          ui={itin.ui}
          shareCopy={itin.shareCopy}
          session={session}
          isAdmin={itin.isAdmin}
          selectedDayIndex={itin.selectedDayIndex}
          editBanner={itin.editBanner}
          onBackToOverview={() => itin.setSelectedDayIndex(-1)}
          onBackToDraft={initialViewMode !== 'final' ? () => itin.setViewMode('draft') : undefined}
          initialViewMode={initialViewMode}
        />

        {/* ── Shared-trip collaborators / join CTA ─────────────────────────── */}
        <TripCollaborators
          itineraryId={itin.itinerary._id ?? null}
          ownerUserId={ownerUserId}
          ownerUsername={ownerUsername}
          collaborators={collaborators}
          session={session}
        />

        {/* ── Trending ticker ─────────────────────────────────────────────── */}
        <TrendingTicker destination={itin.itinerary.destination} groupType={itin.profile?.groupType} />

        {selectedDay !== null ? (
          /* ══ DAY DETAIL VIEW ══════════════════════════════════════════════ */
          <DayDetailPanel
            day={selectedDay}
            dayIndex={itin.selectedDayIndex}
            totalDays={days.length}
            itinerary={itin.itinerary}
            itineraryId={itin.itinerary._id ?? null}
            session={itin.session ?? null}
            profile={itin.profile}
            ui={itin.ui}
            mapLabels={itin.mapLabels}
            basecampMarker={itin.basecampMarker}
            focusedNeighborhood={itin.focusedNeighborhood}
            onSwapSlot={(slot, req) => itin.handleSlotSwap(itin.selectedDayIndex, slot, req)}
            onCommitActivitySwap={(dayIdx, slot, activity, summary, diningField) =>
              itin.handleCommitActivitySwap(dayIdx, slot, activity, summary, diningField)
            }
            onNeighborhoodClick={itin.handleNeighborhoodClick}
            onPrevDay={() => itin.setSelectedDayIndex(Math.max(0, itin.selectedDayIndex - 1))}
            onNextDay={() => itin.setSelectedDayIndex(Math.min(days.length - 1, itin.selectedDayIndex + 1))}
            onBackToOverview={() => itin.setSelectedDayIndex(-1)}
            onOpenMobileMap={() => itin.setMobileMapOpen(true)}
          />
        ) : (
          /* ══ OVERVIEW ════════════════════════════════════════════════════ */
          <div className="max-w-5xl mx-auto py-4">
            <ItineraryHero
              destination={itin.itinerary.destination}
              dateRange={formatTripDateRange(itin.profile?.startDate, itin.profile?.endDate)}
              totalDays={days.length}
            />

            <TripStats
              photoQuery={`${itin.itinerary.destination} skyline golden hour`}
              items={[
                { value: tripStats.days, label: 'Days', icon: '📅' },
                {
                  value: tripStats.attractions,
                  label: 'Attractions',
                  icon: '🏛️',
                  detail: { title: 'Attractions', rows: statLists.attractions },
                },
                {
                  value: tripStats.neighborhoods,
                  label: 'Neighborhoods',
                  icon: '🧭',
                  detail: { title: 'Neighborhoods', rows: statLists.neighborhoods },
                },
                {
                  value: tripStats.meals,
                  label: 'Meals',
                  icon: '🍴',
                  detail: { title: 'Meals', rows: statLists.meals },
                },
              ]}
            />

            <SectionLabel>{itin.ui.dir === 'rtl' ? 'הימים שלך' : 'Your days'}</SectionLabel>

            <DayCarousel
              days={days}
              selectedDayIndex={itin.selectedDayIndex}
              destination={itin.itinerary.destination ?? ''}
              onSelectDay={(i) => itin.setSelectedDayIndex(i)}
            />

            {itin.itinerary.basecamp && (
              <HotelSelectionCard
                basecamp={itin.itinerary.basecamp}
                destination={itin.itinerary.destination ?? ''}
                profile={itin.profile}
                ui={itin.ui}
                onExpandHotel={itin.setExpandedHotel}
              />
            )}

            {/* Budget summary */}
            {itin.itinerary.budgetSummary && (
              <>
              <SectionLabel>{itin.ui.dir === 'rtl' ? 'תקציב' : 'Budget'}</SectionLabel>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 26 }}
                className="mx-3 sm:mx-12 mb-2 rounded-3xl p-1 grid sm:grid-cols-3 gap-3"
                style={{ background: 'transparent' }}
              >
                <BudgetCell label={itin.itinerary.budgetSummary.dailyAverage ? itin.ui.budgetDailyLine(itin.itinerary.budgetSummary.dailyAverage) : '—'} />
                <BudgetCell label={itin.itinerary.budgetSummary.totalEstimate ? itin.ui.budgetTotalLine(itin.itinerary.budgetSummary.totalEstimate) : '—'} accent />
                <BudgetCell label={itin.itinerary.budgetSummary.includes ? itin.ui.budgetIncludesLine(itin.itinerary.budgetSummary.includes) : '—'} />
              </motion.div>
              </>
            )}

            {/* Full trip map */}
            <section className="mx-3 sm:mx-12 mt-10 mb-2 hidden sm:block print:hidden">
              <ItineraryMap
                days={itin.itinerary.days}
                destination={itin.itinerary.destination}
                focusedNeighborhood={itin.focusedNeighborhood}
                basecampMarker={itin.basecampMarker}
                labels={itin.mapLabels}
              />
            </section>

            {/* Transport card */}
            <div className="mx-3 sm:mx-12 mt-10 mb-2">
              <TransportCard
                destination={itin.itinerary.destination}
                guide={itin.displayCityTransport}
                ui={itin.ui}
                totalDays={itin.itinerary.totalDays}
                isLoading={itin.transportLoading}
                hotelAnchor={itin.basecampMarker ? { lat: itin.basecampMarker.lat, lng: itin.basecampMarker.lng } : null}
              />
            </div>

            {((itin.itinerary.packingTips?.length ?? 0) > 0 || (itin.itinerary.bestLocalTips?.length ?? 0) > 0) && (
              <SectionLabel>{itin.ui.dir === 'rtl' ? 'לפני שיוצאים' : 'Before you go'}</SectionLabel>
            )}

            {/* Packing tips */}
            {(itin.itinerary.packingTips?.length ?? 0) > 0 && (
              <div className="mx-3 sm:mx-12 mb-2 rounded-2xl px-1 py-3" style={{ background: 'transparent' }}>
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-[18px]" style={{ color: 'var(--color-ink-warm)' }}>
                  🎒 {itin.ui.packingTitle(itin.ui.audienceTitle(itin.profile?.groupType))}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {(itin.itinerary.packingTips ?? []).map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[13px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
                      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-sunrise-deep)' }}>✓</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Best local tips */}
            {(itin.itinerary.bestLocalTips?.length ?? 0) > 0 && (
              <div className="mx-3 sm:mx-12 mb-2 rounded-2xl px-1 py-3" style={{ background: 'transparent' }}>
                <h3 className="font-display font-semibold mb-3 flex items-center gap-2 text-[18px]" style={{ color: 'var(--color-ink-warm)' }}>
                  🗝️ {itin.ui.insiderIntel}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {(itin.itinerary.bestLocalTips ?? []).map((tip, i) => (
                    <li key={i} className="flex gap-2 text-[13px]" style={{ color: 'var(--color-ink-warm-mut)' }}>
                      <span className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-sunrise-deep)' }}>✦</span>{tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Logistics */}
            <div className="mx-3 sm:mx-12 mb-6">
              {itin.profile && <LogisticsDashboard profile={itin.profile} />}
            </div>

            {/* Footer CTA */}
            <div className="text-center py-8 mx-3 sm:mx-12 print:hidden" style={{ borderTop: '1px solid rgba(184,119,46,0.22)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--color-ink-warm-mut)' }}>{itin.ui.footerPrompt(itin.profile?.groupType)}</p>
              <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.95 }}>
                <Link
                  href="/onboarding"
                  className="cta-warm inline-flex items-center gap-2 px-8 py-3 rounded-full text-white font-semibold text-sm"
                >
                  {itin.ui.planNewTripButton}
                  <span aria-hidden>↗</span>
                </Link>
              </motion.div>
            </div>
          </div>
        )}

        {/* ── Mobile map FAB ─────────────────────────────────────────────── */}
        <motion.button
          onClick={() => itin.setMobileMapOpen(true)}
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 26 }}
          whileTap={{ scale: 0.90 }}
          className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold print:hidden"
          style={{ background: 'rgba(184,85,46,0.92)', border: '1px solid rgba(255,255,255,0.25)', boxShadow: 'var(--shadow-soft)' }}
        >
          <span>🗺</span> {itin.ui.mapFab}
        </motion.button>

        {/* ── Existing modals — unchanged ─────────────────────────────────── */}
        {itin.mobileMapOpen && (
          <MobileMapOverlay
            days={itin.itinerary.days}
            destination={itin.itinerary.destination}
            focusedNeighborhood={itin.focusedNeighborhood}
            basecampMarker={itin.basecampMarker}
            mapTitle={itin.ui.mapOpenMobile}
            mapLabels={itin.mapLabels}
            onClose={itin.handleMapClose}
          />
        )}

        <TripStoryCube
          open={itin.tripStoryOpen}
          onClose={() => itin.setTripStoryOpen(false)}
          itinerary={itin.itinerary}
          ui={itin.ui}
        />

        <AnimatePresence>
          {itin.expandedHotel && (
            <HotelDetailCube
              hotel={itin.expandedHotel}
              destination={itin.itinerary.destination ?? ''}
              profile={itin.profile}
              ui={itin.ui}
              onClose={() => itin.setExpandedHotel(null)}
            />
          )}
        </AnimatePresence>

        <div className="print:hidden">
          <QuickEdit itinerary={itin.itinerary} onUpdate={itin.handleQuickEditUpdate} />
        </div>

        <div className="print:hidden">
          <FeedbackSurveyModal
            open={itin.feedbackOpen}
            onSubmit={itin.handleFeedbackSubmit}
            onDismiss={itin.handleFeedbackDismiss}
          />
        </div>

      </div>

      <AssistantChat
        itinerary={itin.itinerary}
        profile={itin.profile}
        onCommitSwap={itin.handleCommitActivitySwap}
        sessionAccessToken={itin.session?.access_token}
      />
    </div>
  );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function BudgetCell({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <div
      className="relative overflow-hidden text-center px-4 py-5 rounded-2xl"
      style={{
        background: accent
          ? 'linear-gradient(150deg, #b8552e 0%, #8f4220 100%)'
          : 'linear-gradient(150deg, rgba(247,241,231,0.94) 0%, rgba(228,212,184,0.96) 100%)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <span aria-hidden className="absolute -bottom-3 end-1 text-[54px] leading-none opacity-[0.12] select-none pointer-events-none">💰</span>
      <p
        className="relative text-[13px] leading-snug"
        style={{ color: accent ? 'rgba(255,250,243,0.96)' : 'var(--color-ink-warm)', fontWeight: accent ? 700 : 500 }}
      >
        {budgetToUsd(label) || '—'}
      </p>
    </div>
  );
}

/** Left-aligned editorial section heading with a trailing hairline rule — the
 *  "magazine" rhythm that replaces stacked boxes with a continuous flow. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.8 }}
      transition={{ type: 'spring', stiffness: 240, damping: 26 }}
      className="mx-3 sm:mx-12 mt-12 mb-4 flex items-center gap-4"
    >
      <h2 className="font-display italic leading-none text-[24px] sm:text-[28px]" style={{ color: 'var(--color-ink-warm)' }}>
        {children}
      </h2>
      <span aria-hidden className="flex-1 h-px" style={{ background: 'rgba(43,38,34,0.14)' }} />
    </motion.div>
  );
}
