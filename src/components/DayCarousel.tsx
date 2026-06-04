'use client';

import { useRef } from 'react';
import { ItineraryDayCard } from '@/components/ItineraryDayCard';
import type { DayPlan } from '@/lib/types';

interface DayCarouselProps {
  days: DayPlan[];
  selectedDayIndex: number;  // -1 = none selected
  destination: string;
  onSelectDay: (index: number) => void;
}

export function DayCarousel({ days, selectedDayIndex, destination, onSelectDay }: DayCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 368, behavior: 'smooth' });
  };

  return (
    <div className="relative px-12 py-2">
      <NavArrow dir="left" onClick={() => scroll(-1)} />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-1"
        style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
      >
        {days.map((day, i) => (
          <ItineraryDayCard
            key={`day-${day.day}-${i}`}
            day={day}
            dayNumber={i + 1}
            isActive={selectedDayIndex === i}
            totalDays={days.length}
            destination={destination}
            onClick={() => onSelectDay(i)}
          />
        ))}
      </div>

      <NavArrow dir="right" onClick={() => scroll(1)} />
    </div>
  );
}

function NavArrow({ dir, onClick }: { dir: 'left' | 'right'; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full flex items-center justify-center text-base font-bold transition-all hover:scale-110"
      style={{
        [dir === 'left' ? 'left' : 'right']: 4,
        background: 'rgba(255,255,255,0.75)',
        border: '1px solid rgba(90,173,165,0.3)',
        color: '#5aada5',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
}
