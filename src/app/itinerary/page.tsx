'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { ItineraryClient } from '@/components/ItineraryClient';
import { ItinerarySkeleton } from '@/components/ItinerarySkeleton';
import { MOCK_ITINERARY, MOCK_PROFILE } from '@/lib/mockData';

export default function ItineraryPage() {
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [initialViewMode, setInitialViewMode] = useState<'draft' | 'final'>('draft');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('travelos_itinerary');
      const rawProfile = sessionStorage.getItem('travelos_profile');
      if (!raw) {
        setItinerary(MOCK_ITINERARY);
        setProfile(MOCK_PROFILE);
        setInitialViewMode('final');
        return;
      }
      setItinerary(JSON.parse(raw));
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {
      setError('Could not load your itinerary. Please try again.');
    }
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#f8f7f2] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-[#111827] mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-[#6b7280] mb-6">{error}</p>
        <Link href="/plan" className="px-6 py-3 rounded-xl bg-[#ff5a5f] text-white font-semibold text-sm hover:bg-[#e04a4f] transition-colors">
          Try again
        </Link>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="min-h-screen bg-[#f8f7f2]">
        <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-sm border-b border-[#e5e7eb]">
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight text-[#111827]">
              Travel<span className="text-[#ff5a5f]">OS</span>
            </div>
            <div className="skeleton-bar w-28 h-7 rounded-lg" />
          </div>
        </div>
        <ItinerarySkeleton count={3} />
      </div>
    );
  }

  return (
    <ItineraryClient
      initialItinerary={itinerary}
      initialProfile={profile}
      initialViewMode={initialViewMode}
    />
  );
}
