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
  if (days.length === 0) return null;

  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    // Advance one full-width day per click.
    const step = scrollRef.current?.clientWidth ?? 368;
    scrollRef.current?.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className="relative px-12 py-2">
      <NavArrow dir="left" onClick={() => scroll(-1)} />

      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto pb-4 pt-1 [&::-webkit-scrollbar]:hidden"
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
      aria-label={dir === 'left' ? 'Previous day' : 'Next day'}
      className="flex absolute top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full items-center justify-center text-2xl font-bold transition-all hover:scale-110 active:scale-95"
      style={{
        [dir === 'left' ? 'left' : 'right']: -6,
        background: '#fffdf7',
        border: '1.5px solid var(--color-sunrise-deep)',
        color: 'var(--color-sunrise-deep)',
        boxShadow: '0 6px 20px -4px rgba(0,0,0,0.22)',
      }}
    >
      {dir === 'left' ? '‹' : '›'}
    </button>
  );
}
