'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Itinerary, TravelerProfile } from '@/lib/types';
import { ItineraryClient } from '@/components/ItineraryClient';
import { ItinerarySkeleton } from '@/components/ItinerarySkeleton';
import { BrandWordmark } from '@/components/BrandWordmark';

export default function ItineraryPage() {
  const router = useRouter();
  const [itinerary, setItinerary] = useState<Itinerary | null>(null);
  const [profile, setProfile] = useState<TravelerProfile | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('travelos_itinerary');
      const rawProfile = sessionStorage.getItem('travelos_profile');
      if (!raw) {
        router.replace('/onboarding');
        return;
      }
      setItinerary(JSON.parse(raw));
      if (rawProfile) setProfile(JSON.parse(rawProfile));
    } catch {
      setError('Could not load your itinerary. Please try again.');
    }
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#091f36] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">😕</div>
        <h2 className="text-xl font-bold text-white mb-2 tracking-tight">Something went wrong</h2>
        <p className="text-white/50 mb-6">{error}</p>
        <Link href="/onboarding" className="px-6 py-3 rounded-xl text-white font-semibold text-sm transition-colors" style={{ background: '#9e363a' }}>
          Try again
        </Link>
      </div>
    );
  }

  if (!itinerary) {
    return (
      <div className="min-h-screen bg-[#091f36]">
        <div className="sticky top-0 z-40 backdrop-blur-sm border-b" style={{ background: 'rgba(9,31,54,0.90)', borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="text-lg font-semibold tracking-tight text-white">
              <BrandWordmark accent="#9e363a" className="text-lg" />
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
      initialViewMode="draft"
    />
  );
}
