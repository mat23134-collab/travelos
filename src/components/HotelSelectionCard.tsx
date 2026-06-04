'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
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
  destination: _destination,
  ui,
  onExpandHotel,
}: HotelSelectionLayoutProps) {
  const displayHotels = hotels.slice(0, 3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="rounded-[20px] overflow-hidden"
      style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)' }}
    >
      {/* Teal header bar */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ background: '#5aada5' }}
      >
        <span className="text-white text-[15px] font-bold tracking-tight">
          {ui.hotelModalBadge ?? '🏨 Your Accommodation'}
        </span>
        <span
          className="text-[12px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
        >
          {displayHotels.length}
        </span>
      </div>

      {/* Hotel columns */}
      <div className="bg-white grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black/[0.06]">
        {displayHotels.map((hotel, i) => (
          <HotelColumn
            key={`${hotel.name}-${i}`}
            hotel={hotel}
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
  isSelected,
  onClick,
}: {
  hotel: HotelRecommendation;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 text-left px-4 py-4 transition-colors hover:bg-[#f0f9f8] focus:outline-none"
      style={{ background: isSelected ? '#e8f4f2' : undefined }}
    >
      {/* Hotel name */}
      <p className="text-[14px] font-bold text-[#222] leading-snug line-clamp-2 mb-1">
        {hotel.name}
      </p>

      {/* Star rating */}
      {hotel.ratingStars != null && (
        <div className="flex items-center gap-0.5 mb-1">
          {Array.from({ length: Math.round(hotel.ratingStars) }, (_, i) => (
            <span key={i} className="text-[#f59e0b] text-[11px]">★</span>
          ))}
          {hotel.ratingSource && (
            <span className="text-[10px] text-[#888] ml-1">{hotel.ratingSource}</span>
          )}
        </div>
      )}

      {/* Neighborhood */}
      <p className="text-[12px] text-[#5aada5] font-medium mb-1 truncate">
        {hotel.neighborhood}
      </p>

      {/* Price */}
      {hotel.priceRange && (
        <p className="text-[12px] text-[#666]">
          {hotel.priceRange}
          <span className="text-[10px] text-[#999] ml-1">/night</span>
        </p>
      )}

      {/* Selected indicator */}
      {isSelected && (
        <div
          className="mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block"
          style={{ background: '#5aada5', color: 'white' }}
        >
          Selected
        </div>
      )}
    </button>
  );
}
