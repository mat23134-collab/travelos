'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { DayPhoto } from '@/components/DayPhoto';
import type { Basecamp, HotelRecommendation, TravelerProfile } from '@/lib/types';
import type { ItineraryUiStrings } from '@/lib/tripUiCopy';

interface HotelSelectionCardProps {
  basecamp: Basecamp;
  destination: string;
  profile: TravelerProfile | null;
  ui: ItineraryUiStrings;
  onExpandHotel: (hotel: HotelRecommendation) => void;
}

export function HotelSelectionCard({
  basecamp,
  destination,
  profile: _profile,
  ui,
  onExpandHotel,
}: HotelSelectionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build hotel list depending on basecamp type
  if (basecamp.type === 'booked') {
    const booked = basecamp.booked;
    if (!booked) return null;

    // Synthesize a HotelRecommendation from the booked entry for uniform rendering
    const syntheticHotel: HotelRecommendation = {
      name: booked.name,
      neighborhood: booked.neighborhood,
      neighborhoodVibe: booked.neighborhoodInsight,
      whyItFits: booked.neighborhoodInsight,
      priceRange: '',
      neighborhoodInsight: booked.neighborhoodInsight,
    };

    return (
      <HotelSelectionLayout
        hotels={[syntheticHotel]}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        destination={destination}
        ui={ui}
        onExpandHotel={onExpandHotel}
      />
    );
  }

  // type === 'recommendations'
  const hotels = basecamp.recommendations;
  if (!hotels || hotels.length === 0) return null;

  // Filter out hotels explicitly flagged unavailable
  const visibleHotels = hotels.filter((h) => h.availability !== false);
  if (visibleHotels.length === 0) return null;

  return (
    <HotelSelectionLayout
      hotels={visibleHotels}
      selectedIndex={selectedIndex}
      onSelect={setSelectedIndex}
      destination={destination}
      ui={ui}
      onExpandHotel={onExpandHotel}
    />
  );
}

// ── Internal layout component ─────────────────────────────────────────────────

interface HotelSelectionLayoutProps {
  hotels: HotelRecommendation[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  destination: string;
  ui: ItineraryUiStrings;
  onExpandHotel: (hotel: HotelRecommendation) => void;
}

function HotelSelectionLayout({
  hotels,
  selectedIndex,
  onSelect,
  destination,
  ui,
  onExpandHotel,
}: HotelSelectionLayoutProps) {
  const displayHotels = hotels.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-3xl overflow-hidden"
      style={{ background: 'var(--color-paper)', boxShadow: 'var(--shadow-card)' }}
    >
      {/* Editorial header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4">
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[11px] font-bold uppercase tracking-[0.18em]"
            style={{ color: 'var(--color-sunrise-deep)' }}
          >
            {ui.hotelModalBadge ?? '🏨 Your Accommodation'}
          </span>
          <h3
            className="font-display italic text-[22px] leading-tight"
            style={{ color: 'var(--color-ink-warm)' }}
          >
            Where you&rsquo;ll stay
          </h3>
        </div>
        <span
          className="text-[12px] font-bold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-ink-warm-mut)' }}
        >
          {displayHotels.length}
        </span>
      </div>

      {/* Hotel cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 px-4 pb-5">
        {displayHotels.map((hotel, i) => (
          <HotelColumn
            key={`${hotel.name}-${i}`}
            hotel={hotel}
            destination={destination}
            isSelected={i === selectedIndex}
            onClick={() => {
              onSelect(i);
              onExpandHotel(hotel);
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Hotel column ──────────────────────────────────────────────────────────────

function HotelColumn({
  hotel,
  destination,
  isSelected,
  onClick,
}: {
  hotel: HotelRecommendation;
  destination: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  // Hotel photo: the hotel itself only — no neighborhood/destination dilution.
  const photoQuery = hotel.name;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -3 }}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className="group text-left rounded-2xl overflow-hidden focus:outline-none"
      style={{
        background: 'var(--color-paper)',
        boxShadow: isSelected
          ? '0 0 0 2px var(--color-sunrise-deep), var(--shadow-card)'
          : 'var(--shadow-soft)',
      }}
    >
      {/* Photo with overlay */}
      <div className="relative h-[180px] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-700 group-hover:scale-105">
          <DayPhoto query={photoQuery} alt={hotel.name} height={180} dark />
        </div>

        {/* Top row: rating (start), Selected (end) */}
        <div className="absolute top-2.5 inset-x-2.5 flex items-start justify-between">
          {hotel.ratingStars != null ? (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-white"
              style={{ background: 'rgba(0,0,0,0.42)', backdropFilter: 'blur(6px)' }}
            >
              <span style={{ color: '#f5c451' }}>★</span>
              {hotel.ratingStars.toFixed(1)}
              {hotel.ratingSource && (
                <span className="font-medium text-white/70">{hotel.ratingSource}</span>
              )}
            </span>
          ) : (
            <span />
          )}
          {isSelected && (
            <span
              className="px-2 py-0.5 rounded-full text-[9px] font-black text-white"
              style={{ background: 'rgba(184,119,46,0.92)' }}
            >
              ✓ Selected
            </span>
          )}
        </div>

        {/* Bottom: location label + title over the scrim */}
        <div className="absolute inset-x-0 bottom-0 p-3.5">
          {hotel.neighborhood && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/90 drop-shadow mb-0.5">
              📍 {hotel.neighborhood}
            </span>
          )}
          <h4 className="font-display text-white text-lg leading-tight drop-shadow line-clamp-2">
            {hotel.name}
          </h4>
        </div>
      </div>

      {/* Warm-paper footer: vibe + price */}
      <div className="px-3.5 py-3" style={{ background: 'var(--color-paper)' }}>
        {hotel.neighborhoodVibe && (
          <p
            className="text-[12px] leading-snug line-clamp-2 mb-2"
            style={{ color: 'var(--color-ink-warm-mut)' }}
          >
            {hotel.neighborhoodVibe}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          {hotel.priceRange ? (
            <span
              className="text-[13px] font-bold"
              style={{ color: 'var(--color-ink-warm)' }}
            >
              {hotel.priceRange}
              <span className="text-[10px] font-medium ml-1" style={{ color: 'var(--color-ink-warm-mut)' }}>
                /night
              </span>
            </span>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-1.5">
            {(() => {
              const aid = process.env.NEXT_PUBLIC_BOOKING_AFFILIATE_ID;
              if (!aid) return null;
              const q = encodeURIComponent(`${hotel.name} ${destination}`);
              return (
                <a
                  href={`https://www.booking.com/search.html?aid=${aid}&ss=${q}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: 'rgba(0,112,201,0.08)', color: '#0070c9' }}
                >
                  Book →
                </a>
              );
            })()}
            <span
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors"
              style={{ background: 'var(--color-paper-sunk)', color: 'var(--color-sunrise-deep)' }}
            >
              Details →
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
