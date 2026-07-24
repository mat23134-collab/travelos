'use client';

/**
 * DayNeighborhoodGuide — the per-day entry point to the Dynamic Neighborhood
 * Profiler. Collapsed by default; on expand it collects the day's geo-located
 * stops, calls POST /api/neighborhood-profile, and renders the NeighborhoodGuide
 * in the requested site language.
 *
 * Lazy on purpose: the profiler hits three paid APIs (Tavily + Exa + Gemini), so
 * we only run it when the traveler actually asks to see it. Works for any
 * itinerary — new or already-created — since it's derived from the day's POIs at
 * view time, not baked in at generation.
 */

import { useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { NeighborhoodGuide } from '@/components/NeighborhoodGuide';
import type { DayPlan, TravelerProfile } from '@/lib/types';
import type { NeighborhoodProfile, ProfilerPoi } from '@/services/neighborhood/types';
import type { Session } from '@supabase/supabase-js';

type Status = 'idle' | 'loading' | 'ready' | 'empty' | 'signin' | 'error';

const COPY = {
  he: {
    title: 'מדריך השכונה של היום',
    subtitle: 'למה קיבצנו את היום כאן — סודות מקומיים, אמת בלי לייפות, תחבורה',
    error: 'לא הצלחנו לטעון את מדריך השכונה כרגע.',
    retry: 'נסו שוב',
    signIn: 'התחברו כדי לקבל מדריך שכונה מותאם אישית.',
    empty: (city: string) => `עדיין אין מיפוי שכונות ל${city} — נוסיף בקרוב.`,
  },
  en: {
    title: "Today's neighborhood guide",
    subtitle: 'Why we grouped today here — local secrets, the honest truth, transit',
    error: "We couldn't load the neighborhood guide right now.",
    retry: 'Try again',
    signIn: 'Sign in to get a personalized neighborhood guide.',
    empty: (city: string) => `We don't have neighborhood mapping for ${city} yet — coming soon.`,
  },
} as const;

function collectPois(day: DayPlan): ProfilerPoi[] {
  const pois: ProfilerPoi[] = [];
  for (const a of [day.morning, day.afternoon, day.evening]) {
    if (a?.name && typeof a.latitude === 'number' && typeof a.longitude === 'number') {
      pois.push({ name: a.name, lat: a.latitude, lng: a.longitude, category: 'attraction' });
    }
  }
  for (const m of [day.breakfast, day.lunch, day.dinner]) {
    if (m?.name && typeof m.latitude === 'number' && typeof m.longitude === 'number') {
      pois.push({ name: m.name, lat: m.latitude, lng: m.longitude, category: 'restaurant' });
    }
  }
  return pois;
}

export function DayNeighborhoodGuide({
  day, dayIndex, destination, session, profile, lang,
}: {
  day: DayPlan;
  dayIndex: number;
  destination: string;
  session: Session | null;
  profile: TravelerProfile | null;
  lang: 'he' | 'en';
}) {
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [data, setData] = useState<NeighborhoodProfile | null>(null);

  const pois = collectPois(day);
  const cityOnly = (destination ?? '').split(',')[0].trim();

  const load = useCallback(async () => {
    if (!session?.access_token) { setStatus('signin'); return; }
    if (!cityOnly || pois.length === 0) { setStatus('empty'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/neighborhood-profile', {
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
            dayNumber: dayIndex + 1,
          },
          lang,
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
  }, [session?.access_token, cityOnly, dayIndex, JSON.stringify(pois), lang]);

  // Nothing geo-located to profile → don't even show the entry point.
  if (pois.length === 0) return null;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && status === 'idle') void load();
  };

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(184,85,46,0.06)', border: '1px solid rgba(184,85,46,0.18)' }} dir={dir}>
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start transition-colors"
      >
        <span className="flex items-center gap-2">
          <span className="text-[18px]">🗺️</span>
          <span className="flex flex-col">
            <span className="text-[14px] font-black" style={{ color: '#2b2622' }}>{t.title}</span>
            <span className="text-[11.5px]" style={{ color: '#6b6358' }}>{t.subtitle}</span>
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
              {status === 'loading' && <NeighborhoodGuide loading lang={lang} />}
              {status === 'ready' && <NeighborhoodGuide profile={data} lang={lang} />}
              {status === 'error' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>
                  {t.error}{' '}
                  <button onClick={() => void load()} className="font-bold underline" style={{ color: '#b8552e' }}>{t.retry}</button>
                </div>
              )}
              {status === 'signin' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>{t.signIn}</div>
              )}
              {status === 'empty' && (
                <div className="p-5 text-center text-[13px]" style={{ color: '#6b6358' }}>
                  {t.empty(cityOnly || (lang === 'he' ? 'עיר הזו' : 'this city'))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
