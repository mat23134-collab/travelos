'use client';

/**
 * CityGuideSection — the whole-trip CITY guide at the top of the results page.
 *
 * Unlike the per-day neighborhood guide, this needs NO polygon data — every trip
 * has a destination city, so it works everywhere. Collapsed by default; on expand
 * it samples the trip's stops, calls POST /api/city-profile (Tavily + Exa +
 * Gemini, cached), and renders the shared guide in its 'city' variant.
 */

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NeighborhoodGuide } from '@/components/NeighborhoodGuide';
import type { DayPlan, TravelerProfile } from '@/lib/types';
import type { NeighborhoodProfile, ProfilerPoi } from '@/services/neighborhood/types';
import type { Session } from '@supabase/supabase-js';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'signin' | 'error';

/** A representative sample of the trip's stops — attractions first, then meals. */
function collectTripPois(days: DayPlan[]): ProfilerPoi[] {
  const attractions: ProfilerPoi[] = [];
  const meals: ProfilerPoi[] = [];
  for (const day of days) {
    for (const a of [day.morning, day.afternoon, day.evening]) {
      if (a?.name) attractions.push({ name: a.name, lat: a.latitude ?? 0, lng: a.longitude ?? 0, category: 'attraction' });
    }
    for (const m of [day.breakfast, day.lunch, day.dinner]) {
      if (m?.name) meals.push({ name: m.name, lat: m.latitude ?? 0, lng: m.longitude ?? 0, category: 'restaurant' });
    }
  }
  return [...attractions.slice(0, 10), ...meals.slice(0, 5)];
}

export function CityGuideSection({
  destination, days, session, profile,
}: {
  destination: string;
  days: DayPlan[];
  session: Session | null;
  profile: TravelerProfile | null;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<NeighborhoodProfile | null>(null);

  const cityOnly = (destination ?? '').split(',')[0].trim();
  const pois = collectTripPois(days);

  const load = useCallback(async () => {
    if (!session?.access_token) { setStatus('signin'); return; }
    if (!cityOnly) { setStatus('empty'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/city-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          city: cityOnly,
          pois,
          profile: {
            interests: profile?.interests ?? [],
            groupType: profile?.groupType ?? null,
            budget: profile?.budget ?? null,
            pace: profile?.pace ?? null,
            dayNumber: days.length, // trip length
          },
        }),
      });
      if (res.status === 204) { setStatus('empty'); return; }
      if (!res.ok) { setStatus('error'); return; }
      const json = (await res.json()) as NeighborhoodProfile;
      setData(json);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.access_token, cityOnly, days.length, JSON.stringify(pois)]);

  if (!cityOnly) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && status === 'idle') void load();
  };

  return (
    <div className="mx-3 sm:mx-12 mb-2 rounded-2xl overflow-hidden" style={{ background: 'rgba(184,85,46,0.06)', border: '1px solid rgba(184,85,46,0.18)' }} dir="rtl">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-start transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[20px]">🏙️</span>
          <span className="flex flex-col">
            <span className="text-[15px] font-black" style={{ color: '#2b2622' }}>מדריך העיר — {cityOnly}</span>
            <span className="text-[12px]" style={{ color: '#6b6358' }}>למה העיר מתאימה לכם, סודות מקומיים, אמת בלי לייפות, ואיך מסתובבים</span>
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-[13px]" style={{ color: '#b8552e' }}>▾</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">
              {status === 'loading' && <NeighborhoodGuide loading variant="city" />}
              {status === 'ready' && <NeighborhoodGuide profile={data} variant="city" />}
              {status === 'error' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>
                  לא הצלחנו לטעון את מדריך העיר כרגע.{' '}
                  <button onClick={() => void load()} className="font-bold underline" style={{ color: '#b8552e' }}>נסו שוב</button>
                </div>
              )}
              {status === 'signin' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>התחברו כדי לקבל מדריך עיר מותאם אישית.</div>
              )}
              {status === 'empty' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>אין מספיק מידע ליצירת מדריך עיר.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
