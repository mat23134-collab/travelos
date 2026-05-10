'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import { Itinerary, TravelerProfile, Basecamp, HotelRecommendation, type BookedHotelAround, type Activity } from '@/lib/types';
import { DayCard } from '@/components/DayCard';
import { DayPhoto } from '@/components/DayPhoto';
import { QuickEdit } from '@/components/QuickEdit';
import { SharePanel } from '@/components/SharePanel';
import { LogisticsDashboard } from '@/components/LogisticsDashboard';
import { DraftOverview } from '@/components/DraftOverview';
import { TrendingTicker } from '@/components/TrendingTicker';
import { itineraryUi, type ItineraryUiStrings } from '@/lib/tripUiCopy';
import { hotelOtaSearchUrl, mergeHotelOtaRows } from '@/lib/hotelOtaLinks';
import type { SwapResult } from '@/app/api/swap/route';
import { useAuth } from '@/lib/auth-context';

const ItineraryMap = dynamic(
  () => import('@/components/ItineraryMap').then((m) => m.ItineraryMap),
  { ssr: false, loading: () => <div className="w-full rounded-2xl animate-pulse" style={{ height: 380, background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.07)' }} /> }
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
  const adults = profile?.groupSize && profile.groupSize > 0 ? profile.groupSize : 2;
  const otaOpts = { checkIn, checkOut, adults };
  const otaRows = mergeHotelOtaRows(hotel.otaPriceCompare);
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
          background: '#0f1117',
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
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
            style={{ background: 'rgba(15,17,23,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            ✕
          </motion.button>
          <div
            className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-white text-[10px] font-bold uppercase tracking-wide z-10"
            style={{ background: 'rgba(15,17,23,0.75)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            {ui.hotelModalBadge}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pt-5 pb-6">
          <h3 className="text-white font-bold text-xl tracking-tight leading-tight">{hotel.name}</h3>
          <p className="text-white/45 text-sm mt-1">📍 {hotel.neighborhood}</p>

          <div className="flex flex-wrap gap-2 mt-3 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a] bg-[#9e363a]/12 px-2 py-0.5 rounded-full">
              {hotel.neighborhoodVibe}
            </span>
            <span className="text-[10px] text-white/45 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
              {hotel.priceRange}
            </span>
            {stars && hotel.ratingStars != null && Number.isFinite(hotel.ratingStars) && (
              <span className="text-[10px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
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
              className="mb-3 rounded-xl px-3 py-2.5 border border-amber-500/20"
              style={{ background: 'rgba(245,158,11,0.07)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-200/80 mb-1">{ui.hotelPriceBand}</p>
              <p className="text-xs text-amber-100/85 leading-relaxed">{hotel.estimatedPriceRangeTripDates}</p>
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

          <div className="mb-4 rounded-xl overflow-hidden border border-amber-500/25" style={{ background: 'rgba(245,158,11,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-200/90 px-3 pt-2.5 pb-2 border-b border-amber-500/15">
              {ui.hotelOtaCompareTitle}
            </p>
            <ul className="divide-y divide-white/8">
              {otaRows.map((row) => (
                <li key={row.id} className="px-3 py-2.5 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-white/90">{row.label}</p>
                    <p className="text-[11px] text-amber-100/85 font-mono mt-0.5">
                      {row.indicativeNightly ? `${row.indicativeNightly} · ${ui.hotelOtaPerNight}` : ui.hotelOtaNoPrice}
                    </p>
                    {row.note && (
                      <p className="text-[10px] text-white/40 leading-snug mt-1">{row.note}</p>
                    )}
                  </div>
                  <a
                    href={hotelOtaSearchUrl(row.id, hotel.name, destination, otaOpts)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center justify-center px-3 py-2 rounded-lg text-[11px] font-bold text-white border border-white/15 hover:bg-white/10 transition-colors"
                  >
                    {ui.hotelOtaOpen}
                  </a>
                </li>
              ))}
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
            {hotel.websiteUrl && (
              <a
                href={hotel.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-xl text-sm font-bold text-center text-white transition-opacity hover:opacity-95"
                style={{ background: '#9e363a', boxShadow: '0 4px 18px rgba(158,54,58,0.28)' }}
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

function HotelCard({ hotel, onOpen, ui }: { hotel: HotelRecommendation; onOpen: () => void; ui: ItineraryUiStrings }) {
  const stars = starRow(hotel.ratingStars);
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.98 }}
      className="relative flex flex-col rounded-2xl border border-white/10 overflow-hidden transition-all duration-200 hover:border-[#9e363a]/40 text-left w-full cursor-pointer"
      style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(12px)' }}
    >
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#9e363a]/50 to-transparent" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a] bg-[#9e363a]/12 px-2 py-0.5 rounded-full">
            {hotel.neighborhoodVibe}
          </span>
          <span className="text-[10px] text-white/40 font-mono">{hotel.priceRange}</span>
          {stars && hotel.ratingStars != null && (
            <span className="text-[10px] text-amber-300/80">{stars}</span>
          )}
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">{hotel.name}</p>
          <p className="text-[11px] text-white/45 mt-0.5">📍 {hotel.neighborhood}</p>
        </div>
        <p className="text-xs text-white/65 leading-relaxed line-clamp-3">
          {hotel.fitSummary?.trim() || hotel.whyItFits}
        </p>
        <div
          className="mt-auto rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">{ui.hotelNeighborhoodEdge}</p>
          <p className="text-[11px] text-white/60 leading-relaxed">{hotel.neighborhoodInsight}</p>
        </div>
        <p className="text-[10px] text-white/30 text-center pt-1">{ui.hotelCardHint}</p>
      </div>
    </motion.button>
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

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 26 }}
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#9e363a]/08 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-[#8b5cf6]/08 rounded-full blur-[80px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a]">{ui.basecampBadge}</span>
            <span className="text-[10px] text-white/30">{ui.basecampApprovedPicks(title)}</span>
          </div>
          <h3 className="text-base font-bold text-white mb-4">{ui.basecampWhereStay(target)}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {recommendations.map((hotel, i) => (
              <HotelCard key={`${hotel.name}-${hotel.neighborhood}-${i}`} hotel={hotel} onOpen={() => setSelected(hotel)} ui={ui} />
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
        className="relative rounded-2xl overflow-hidden mb-8"
        style={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#9e363a]/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-40 h-40 bg-[#8b5cf6]/10 rounded-full blur-[60px] pointer-events-none" />
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a]">{ui.basecampYour}</span>
            <span className="text-[10px] text-white/30 bg-white/8 px-2 py-0.5 rounded-full border border-white/10">{ui.basecampPreBooked}</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">{name}</h3>
          <p className="text-sm text-white/45 mt-0.5">📍 {neighborhood}</p>
          <div
            className="mt-4 rounded-xl px-4 py-3"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8c8f] mb-1">{ui.basecampNeighborhoodStrategy}</p>
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
      className="relative rounded-2xl overflow-hidden mb-8"
      style={{
        background: 'linear-gradient(145deg, rgba(74,123,222,0.12) 0%, rgba(15,17,23,0.98) 42%, #0f1117 100%)',
        border: '1px solid rgba(139,92,246,0.22)',
        boxShadow: '0 0 0 1px rgba(158,54,58,0.12) inset, 0 20px 60px -30px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-[#4a7bde]/15 blur-[90px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-56 h-56 rounded-full bg-[#9e363a]/10 blur-[70px] pointer-events-none" />
      <div className="relative z-10 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#9e363a]">{ui.aroundHotelBadge}</span>
          <span className="text-[10px] text-white/35 px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.04]">
            {ui.aroundHotelPerkChip}
          </span>
        </div>
        <h3 className="text-lg font-bold text-white tracking-tight mb-1">{ui.aroundHotelTitle}</h3>
        <p className="text-xs text-white/45 mb-4">{ui.aroundHotelSub(neighborhood)}</p>
        {around.areaHeadline && (
          <p className="text-sm text-white/85 leading-relaxed mb-5 border-l-2 border-[#9e363a] pl-3">{around.areaHeadline}</p>
        )}
        <div className="grid gap-4 lg:grid-cols-2">
          {!!around.vibes?.length && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8c8f] mb-2">{ui.aroundHotelVibes}</p>
              <div className="flex flex-wrap gap-1.5">
                {around.vibes.map((v, i) => (
                  <span
                    key={i}
                    className="text-[11px] px-2.5 py-1 rounded-full font-medium"
                    style={{
                      background: 'rgba(158,54,58,0.18)',
                      color: '#f0d0d4',
                      border: '1px solid rgba(158,54,58,0.35)',
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
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8c8f] mb-2">{ui.aroundHotelTransit}</p>
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
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#ff8c8f] mb-2">{ui.aroundHotelWalk}</p>
            <ul className="grid sm:grid-cols-2 gap-2">
              {around.walkableHighlights.map((h, i) => (
                <li key={i} className="text-xs text-white/72 leading-relaxed flex gap-2">
                  <span className="text-[#9e363a] shrink-0">▸</span>
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
              background: 'linear-gradient(120deg, rgba(158,54,58,0.2) 0%, rgba(15,40,98,0.35) 100%)',
              border: '1px solid rgba(158,54,58,0.35)',
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
        <span className="w-1.5 h-1.5 rounded-full bg-[#9e363a] animate-pulse" />
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
              className="relative w-full max-w-sm bg-[#0f1117] rounded-2xl border border-white/10 p-6 shadow-2xl"
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            >
              <div className="absolute top-0 right-0 w-40 h-40 bg-[#9e363a]/10 rounded-full blur-[60px] pointer-events-none" />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-white font-bold text-base tracking-tight">{ui.tripIntel}</h3>
                    <p className="text-white/40 text-xs mt-0.5">{ui.tripIntelSub}</p>
                  </div>
                  <motion.button
                    onClick={() => setOpen(false)}
                    whileTap={{ scale: 0.85 }}
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

/** Pretty range for hero subtitle — expects ISO or YYYY-MM-DD */
function formatTripDateRange(
  start?: string | null,
  end?: string | null,
  locale = 'en-US',
): string | null {
  const s = start?.trim().slice(0, 10);
  const e = end?.trim().slice(0, 10);
  if (!s || !e || !/^\d{4}-\d{2}-\d{2}$/.test(s) || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return null;
  const ds = new Date(`${s}T12:00:00`);
  const de = new Date(`${e}T12:00:00`);
  if (Number.isNaN(+ds) || Number.isNaN(+de)) return null;

  const y1 = ds.getFullYear();
  const y2 = de.getFullYear();
  const m1 = ds.getMonth();
  const d2 = de.getDate();

  const monthDay = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  const full = (d: Date) =>
    d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });

  if (y1 === y2 && m1 === de.getMonth()) {
    return `${monthDay(ds)}–${d2}, ${y2}`;
  }
  if (y1 === y2) {
    return `${monthDay(ds)} – ${full(de)}`;
  }
  return `${full(ds)} – ${full(de)}`;
}

// ─── Hero animation ───────────────────────────────────────────────────────────

const heroVariant = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 280, damping: 26 } },
};

// ─── Mobile map overlay ───────────────────────────────────────────────────────

function MobileMapOverlay({
  days, destination, focusedNeighborhood, basecampMarker, onClose, mapTitle,
}: {
  days: Itinerary['days'];
  destination: string;
  focusedNeighborhood?: string;
  basecampMarker?: { lat: number; lng: number; label?: string } | null;
  onClose: () => void;
  mapTitle: string;
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
          style={{ height: '85dvh', background: '#0d1f36', border: '1px solid rgba(255,255,255,0.10)' }}
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
              className="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.14)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
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
}

export function ItineraryClient({ initialItinerary, initialProfile, initialViewMode = 'draft' }: Props) {
  const { session } = useAuth();
  const [itinerary, setItinerary] = useState<Itinerary>(initialItinerary);
  const [profile] = useState<TravelerProfile | null>(initialProfile);
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [editBanner, setEditBanner] = useState('');
  const [mobileMapOpen, setMobileMapOpen] = useState(false);
  const [focusedNeighborhood, setFocusedNeighborhood] = useState<string | undefined>();
  const basecampMarker = useMemo(() => {
    if (
      profile?.hotelLat != null &&
      profile?.hotelLng != null &&
      Number.isFinite(profile.hotelLat) &&
      Number.isFinite(profile.hotelLng)
    ) {
      return {
        lat: profile.hotelLat,
        lng: profile.hotelLng,
        label: profile.hotelAddress || profile.hotelBooked || 'Base Camp',
      };
    }
    return null;
  }, [profile]);

  const ui = useMemo(
    () => itineraryUi(profile?.tripLanguage === 'he' ? 'he' : 'en'),
    [profile?.tripLanguage],
  );

  const tripDatesLabel = useMemo(
    () =>
      formatTripDateRange(
        profile?.startDate,
        profile?.endDate,
        ui.lang === 'he' ? 'he-IL' : 'en-US',
      ),
    [profile?.startDate, profile?.endDate, ui.lang],
  );

  // Admin check — reads the client-readable cookie set by middleware on ?key= login.
  // Used purely for UI visibility; actual data filtering happens server-side.
  const isAdmin = useMemo(() => {
    if (typeof document === 'undefined') return false;
    return document.cookie.split(';').some((c) => c.trim() === 'travelos_admin_ui=1');
  }, []);

  // If React reuses this component instance during client-side navigation (e.g.
  // /itinerary → /itinerary/[id]), useState won't reinitialise. Sync from props
  // so server-fetched Supabase data always wins over any stale local state.
  useEffect(() => {
    setItinerary(initialItinerary);
    setViewMode(initialViewMode ?? 'draft');
  }, [initialItinerary, initialViewMode]);

  // Only write back to sessionStorage for the sessionStorage-backed route
  // (/itinerary). The [id] route always re-fetches from Supabase, so writing
  // here would pollute sessionStorage with a different trip's data.
  const sessionPersist = initialViewMode !== 'final';

  const persistAndSet = useCallback((updated: Itinerary) => {
    setItinerary(updated);
    if (sessionPersist) {
      try { sessionStorage.setItem('travelos_itinerary', JSON.stringify(updated)); } catch { /* ignore */ }
    }
  }, [sessionPersist]);

  const handleQuickEditUpdate = useCallback((updated: Itinerary, summary: string) => {
    persistAndSet(updated);
    setEditBanner(summary);
    setTimeout(() => setEditBanner(''), 5000);
  }, [persistAndSet]);

  const handleDraftUpdate = useCallback((updated: Itinerary) => {
    persistAndSet(updated);
  }, [persistAndSet]);

  const handleSlotSwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    request?: string,
  ) => {
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined, // enables targeted row-level DB update
        dayIndex,
        slot,
        request: request?.trim() || `Suggest a better ${slot} activity`,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');

    const updatedDays = itinerary.days.map((day, i) =>
      i !== dayIndex ? day : { ...day, [slot]: data.activity }
    );
    persistAndSet({ ...itinerary, days: updatedDays });
    setEditBanner(data.summary);
    setTimeout(() => setEditBanner(''), 5000);
  }, [itinerary, persistAndSet]);

  /** Smart swap: persist a chosen proposal without re-running the swap LLM. */
  const handleCommitActivitySwap = useCallback(async (
    dayIndex: number,
    slot: 'morning' | 'afternoon' | 'evening',
    replacementActivity: Activity,
    proposalSummary: string,
  ) => {
    const res = await fetch('/api/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itinerary,
        itinerary_id: itinerary._id ?? undefined,
        dayIndex,
        slot,
        replacementActivity,
        proposalSummary: proposalSummary.trim() || undefined,
      }),
    });
    const data: SwapResult & { error?: string } = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Swap failed');

    const updatedDays = itinerary.days.map((day, i) =>
      i !== dayIndex ? day : { ...day, [slot]: data.activity }
    );
    persistAndSet({ ...itinerary, days: updatedDays });
    setEditBanner(data.summary);
    setTimeout(() => setEditBanner(''), 5000);
  }, [itinerary, persistAndSet]);

  const handleNeighborhoodClick = useCallback((neighborhood: string) => {
    setFocusedNeighborhood(neighborhood);
    setMobileMapOpen(true);
  }, []);

  // ── DRAFT MODE ──────────────────────────────────────────────────────────────
  if (viewMode === 'draft') {
    return (
      <DraftOverview
        itinerary={itinerary}
        onUpdate={handleDraftUpdate}
        onFinalize={() => setViewMode('final')}
        ui={ui}
      />
    );
  }

  // ── FINAL MODE ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#091f36' }} dir={ui.dir} lang={ui.htmlLang}>
      {/* Edit banner */}
      <AnimatePresence>
        {editBanner && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed top-0 inset-x-0 z-50 text-white text-sm py-2.5 px-6 text-center shadow-lg print:hidden"
            style={{ background: 'rgba(9,31,54,0.96)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            ✓ {editBanner}
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className={`sticky z-40 backdrop-blur-sm border-b transition-all print:hidden ${editBanner ? 'top-10' : 'top-0'}`}
        style={{ background: 'rgba(9,31,54,0.90)', borderColor: 'rgba(255,255,255,0.08)' }}
      >
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight text-white">
            Travel<span style={{ color: '#9e363a' }}>OS</span>
          </Link>
          <div className="flex items-center gap-2">
            {initialViewMode !== 'final' && (
              <motion.button
                onClick={() => setViewMode('draft')}
                whileTap={{ scale: 0.92, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
                className="text-xs font-medium px-3 py-2 rounded-lg border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.50)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.80)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'; }}
              >
                {ui.draft}
              </motion.button>
            )}
            <SharePanel
              itinerary={itinerary}
              profile={profile}
              itineraryDbId={itinerary._id ?? null}
              accessToken={session?.access_token ?? null}
            />
            {isAdmin && (
              <Link
                href={`/explore/${encodeURIComponent(itinerary.destination)}`}
                className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}
              >
                {ui.scoutPicks}
              </Link>
            )}
            <Link
              href="/plan"
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors"
              style={{ borderColor: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.60)' }}
            >
              {ui.newTrip}
            </Link>
          </div>
        </div>
      </nav>

      {/* Trending Now ticker — social proof belt below nav */}
      <TrendingTicker destination={itinerary.destination} groupType={profile?.groupType} />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Hero — full-bleed destination photo with glassmorphism */}
        <motion.div
          variants={heroVariant}
          initial="hidden"
          animate="show"
          className="rounded-2xl mb-8 text-white relative overflow-hidden"
        >
          <div className="absolute inset-0 pointer-events-none">
            <DayPhoto
              query={`${itinerary.destination} cityscape`}
              alt={itinerary.destination}
              height={520}
              dark
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/55 to-black/30 pointer-events-none" />
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#9e363a]/20 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-[#8b5cf6]/18 rounded-full blur-[90px] pointer-events-none" />
          <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-[#00d4ff]/10 rounded-full blur-[70px] pointer-events-none" />

          <div className="relative z-10 p-6 sm:p-10">
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-white/70 backdrop-blur-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#9e363a] animate-pulse" />
                {ui.heroAiBadge}
              </div>
              {itinerary._meta && <TripIntelligenceButton meta={itinerary._meta} ui={ui} />}
            </div>
            <h1
              className="text-6xl sm:text-8xl font-black mb-3 tracking-tighter leading-none"
              style={{ textShadow: '0 4px 40px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.8)' }}
            >
              {itinerary.destination ?? 'Your Trip'}
            </h1>
            <p className="text-white/65 text-sm mb-6">
              {ui.dayItineraryMeta(itinerary.totalDays ?? '?')}
              {tripDatesLabel && ` · ${tripDatesLabel}`}
              {profile && ` · ${profile.groupType} · ${profile.budget} budget · ${profile.pace} pace`}
            </p>
            {itinerary.strategicOverview && (
              <div
                className="rounded-xl p-4"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  backdropFilter: 'blur(20px) saturate(160%)',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}
              >
                <div className="text-xs font-semibold uppercase tracking-widest text-[#ff8c8f] mb-2">{ui.masterPlanLabel(ui.audienceTitle(profile?.groupType))}</div>
                <p className="text-white/85 text-sm leading-relaxed">{itinerary.strategicOverview}</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Basecamp */}
        {itinerary.basecamp && (
          <BasecampSection
            basecamp={itinerary.basecamp}
            groupType={profile?.groupType}
            destination={itinerary.destination ?? ''}
            profile={profile}
            ui={ui}
          />
        )}

        {itinerary.basecamp?.type === 'booked' &&
          itinerary.basecamp.booked?.aroundHotel &&
          hasAroundHotelContent(itinerary.basecamp.booked.aroundHotel) && (
            <BookedHotelAroundSection
              around={itinerary.basecamp.booked.aroundHotel}
              neighborhood={itinerary.basecamp.booked.neighborhood}
              ui={ui}
            />
          )}

        {/* Budget summary */}
        {itinerary.budgetSummary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 26 }}
            className="rounded-2xl p-6 mb-8 grid sm:grid-cols-3 gap-4"
            style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.30)' }}
          >
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{ui.budgetDaily}</div>
              <div className="text-xl font-bold text-white tracking-tight">{itinerary.budgetSummary.dailyAverage ?? '—'}</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(158,54,58,0.12)', border: '1px solid rgba(158,54,58,0.22)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{ui.budgetTotal}</div>
              <div className="text-xl font-bold tracking-tight" style={{ color: '#c05060' }}>{itinerary.budgetSummary.totalEstimate ?? '—'}</div>
            </div>
            <div className="text-center p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.38)' }}>{ui.budgetIncludes}</div>
              <div className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.55)' }}>{itinerary.budgetSummary.includes ?? '—'}</div>
            </div>
          </motion.div>
        )}

        {/* Map — desktop only */}
        <section className="mb-8 print:hidden hidden sm:block">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold text-white tracking-tight">{ui.routeSection(ui.audienceTitle(profile?.groupType))}</h2>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.38)' }}>Pinned by neighborhood</span>
          </div>
          <ItineraryMap
            days={itinerary.days}
            destination={itinerary.destination}
            focusedNeighborhood={focusedNeighborhood}
            basecampMarker={basecampMarker}
          />
        </section>

        {/* Day cards — staggered fade-in */}
        <motion.div
          className="flex flex-col gap-6 mb-8"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.13 } } }}
        >
          {itinerary.days.map((day, i) => (
            <motion.div
              key={`${day.day}-${i}`}
              variants={{
                hidden: { opacity: 0, y: 56, scale: 0.97 },
                show: {
                  opacity: 1, y: 0, scale: 1,
                  transition: { type: 'spring', stiffness: 260, damping: 28 },
                },
              }}
              style={{ willChange: 'transform, opacity' }}
            >
              <DayCard
                day={day}
                index={i}
                destination={itinerary.destination}
                groupType={profile?.groupType}
                ui={ui}
                itinerary={itinerary}
                profile={profile ?? null}
                onSwapSlot={(slot, req) => handleSlotSwap(i, slot, req)}
                onCommitActivitySwap={(slot, act, summary) =>
                  handleCommitActivitySwap(i, slot, act, summary)
                }
                onNeighborhoodClick={handleNeighborhoodClick}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* Packing + tips */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          {(itinerary.packingTips?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.25)' }}
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 tracking-tight"><span>🎒</span> {ui.packingTitle(ui.audienceTitle(profile?.groupType))}</h3>
              <ul className="flex flex-col gap-2">
                {(itinerary.packingTips ?? []).map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#9e363a' }}>✓</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          {(itinerary.bestLocalTips?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.08 }}
              className="rounded-2xl p-6"
              style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 4px 24px -4px rgba(0,0,0,0.25)' }}
            >
              <h3 className="font-bold text-white mb-4 flex items-center gap-2 tracking-tight"><span>🗝️</span> {ui.insiderIntel}</h3>
              <ul className="flex flex-col gap-2">
                {(itinerary.bestLocalTips ?? []).map((tip, i) => (
                  <li key={i} className="flex gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.65)' }}>
                    <span className="flex-shrink-0 mt-0.5" style={{ color: '#9e363a' }}>✦</span>{tip}
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </div>

        {profile && <LogisticsDashboard profile={profile} />}

        <div className="text-center py-8 print:hidden" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-sm mb-4" style={{ color: 'rgba(255,255,255,0.40)' }}>
            {ui.footerPrompt(profile?.groupType)}
          </p>
          <motion.div
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.95, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
            className="inline-block"
          >
            <Link
              href="/plan"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ background: '#9e363a', boxShadow: '0 6px 24px -4px rgba(158,54,58,0.38)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#7a2a2d')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '#9e363a')}
            >
              {ui.planNewTripButton}
            </Link>
          </motion.div>
        </div>
      </div>

      {/* Mobile floating map button */}
      <motion.button
        onClick={() => setMobileMapOpen(true)}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 26 }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.90, transition: { type: 'spring', stiffness: 600, damping: 18 } }}
        className="sm:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 px-4 py-3 rounded-full text-white text-sm font-semibold shadow-xl print:hidden"
        style={{ background: 'rgba(15,40,98,0.90)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px -8px rgba(0,0,0,0.60)' }}
      >
        <span>🗺</span> {ui.mapFab}
      </motion.button>

      {mobileMapOpen && (
        <MobileMapOverlay
          days={itinerary.days}
          destination={itinerary.destination}
          focusedNeighborhood={focusedNeighborhood}
          basecampMarker={basecampMarker}
          mapTitle={ui.mapOpenMobile}
          onClose={() => { setMobileMapOpen(false); setFocusedNeighborhood(undefined); }}
        />
      )}

      <div className="print:hidden">
        <QuickEdit itinerary={itinerary} onUpdate={handleQuickEditUpdate} />
      </div>
    </div>
  );
}
