'use client';

/**
 * GuestItineraryTeaser — shown instead of the full itinerary for a trip that
 * was generated anonymously (guest mode: onboarding + generation need no
 * account) and hasn't been claimed by a signed-up account yet.
 *
 * Shows just enough to prove the trip is real and good — destination, dates,
 * day count, and Day 1 in full — then locks the rest behind a sign-up CTA.
 * Deliberately a SEPARATE, simpler component rather than threading a gate
 * through ItineraryClient's full render tree (maps, swaps, side panel, etc.)
 * — lower regression risk, and this view has none of that interactivity
 * anyway.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import type { Itinerary } from '@/lib/types';
import { formatTripDateRange } from '@/lib/formatTripDateRange';
import { savePendingIntent } from '@/lib/pendingIntent';
import { GuestTeaserMikaTour } from '@/components/tour/MikaTour';

interface Props {
  itinerary: Itinerary;
  itineraryId: string;
  startDate?: string | null;
  endDate?: string | null;
  lang: 'he' | 'en';
}

const COPY = {
  he: {
    ready: 'הטיול שלכם מוכן!',
    daysLine: (n: number) => `מסלול ל-${n} ימים`,
    day1: 'יום 1',
    lockedDays: (n: number) => `עוד ${n} ימים מחכים לכם`,
    unlockTitle: 'הרשמו בחינם כדי לראות את כל הטיול',
    unlockSub: 'כל הימים, המפה האינטראקטיבית, המלצות מסעדות ואטרקציות — תוך פחות מדקה.',
    cta: 'הרשמו וצפו בטיול המלא ←',
    alreadyHave: 'כבר יש לכם חשבון?',
    login: 'התחברו',
    morning: 'בוקר', afternoon: 'צהריים', evening: 'ערב',
  },
  en: {
    ready: 'Your trip is ready!',
    daysLine: (n: number) => `${n}-day itinerary`,
    day1: 'Day 1',
    lockedDays: (n: number) => `${n} more day${n === 1 ? '' : 's'} waiting for you`,
    unlockTitle: 'Sign up free to see your full trip',
    unlockSub: 'Every day, the interactive map, restaurant and attraction picks — takes under a minute.',
    cta: 'Sign up & unlock the full trip ←',
    alreadyHave: 'Already have an account?',
    login: 'Log in',
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
  },
} as const;

type TeaserCopy = (typeof COPY)['en'] | (typeof COPY)['he'];

function DayOnePreview({ itinerary, t }: { itinerary: Itinerary; t: TeaserCopy }) {
  const day = itinerary.days?.[0];
  if (!day) return null;
  const slots = [
    { key: 'morning' as const, label: t.morning, act: day.morning },
    { key: 'afternoon' as const, label: t.afternoon, act: day.afternoon },
    { key: 'evening' as const, label: t.evening, act: day.evening },
  ].filter((s) => s.act);

  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: '#fffdf7', border: '1px solid rgba(43,38,34,0.10)', boxShadow: '0 6px 20px -10px rgba(43,38,34,0.20)' }}
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] mb-1" style={{ color: '#b8552e' }}>{t.day1}</p>
      {day.theme && <h3 className="font-serif text-lg mb-3" style={{ color: '#2b2622' }}>{day.theme}</h3>}
      <div className="flex flex-col gap-2.5">
        {slots.map(({ key, label, act }) => (
          <div key={key} className="flex items-start gap-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wide w-16 shrink-0 pt-0.5" style={{ color: '#9a8f7e' }}>{label}</span>
            <span className="text-sm" style={{ color: '#2b2622' }}>
              {act?.category_emoji ? `${act.category_emoji} ` : ''}{act?.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GuestItineraryTeaser({ itinerary, itineraryId, startDate, endDate, lang }: Props) {
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  const totalDays = itinerary.totalDays ?? itinerary.days?.length ?? 0;
  const lockedCount = Math.max(0, totalDays - 1);
  const dateRange = formatTripDateRange(startDate ?? undefined, endDate ?? undefined);

  const goToAuth = () => savePendingIntent({ claimItineraryId: itineraryId });

  return (
    <main dir={dir} className="min-h-screen relative" style={{ backgroundColor: '#efe3cd' }}>
      <GuestTeaserMikaTour lang={lang} />
      <div className="relative z-10 max-w-xl mx-auto px-5 sm:px-8 py-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] mb-2" style={{ color: '#8f4220' }}>✦ {t.ready}</p>
          <h1 className="font-serif text-3xl sm:text-4xl mb-1.5" style={{ color: '#2b2622' }}>
            {itinerary.destination}
          </h1>
          <p className="text-sm mb-8" style={{ color: '#6b6358' }}>
            {[dateRange, t.daysLine(totalDays)].filter(Boolean).join(' · ')}
          </p>

          <DayOnePreview itinerary={itinerary} t={t} />

          {/* Locked days — blurred stack, no real content leaked.
              blur() is applied PER CARD, not to the wrapping flex container —
              blurring the container merges the separate rounded cards (plus
              the gaps between them) into one indistinct blob at this radius,
              since the filter composites the whole subtree as a single
              region before drawing. */}
          {lockedCount > 0 && (
            <div className="relative mt-4">
              <div className="flex flex-col gap-3" aria-hidden="true" style={{ userSelect: 'none', pointerEvents: 'none' }}>
                {Array.from({ length: Math.min(3, lockedCount) }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-5 h-24"
                    style={{ background: '#fffdf7', border: '1px solid rgba(43,38,34,0.08)', filter: 'blur(6px)', opacity: 0.55 }}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-start justify-center pt-6">
                <span
                  className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(43,38,34,0.85)', color: '#fff' }}
                >
                  🔒 {t.lockedDays(lockedCount)}
                </span>
              </div>
            </div>
          )}

          {/* Unlock CTA */}
          <div
            data-tour="guest-cta"
            className="mt-8 rounded-3xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #b8552e, #8f4220)', color: '#fff', boxShadow: '0 16px 40px -12px rgba(184,85,46,0.45)' }}
          >
            <h2 className="font-serif text-xl mb-1.5">{t.unlockTitle}</h2>
            <p className="text-[13px] opacity-85 mb-5 leading-relaxed">{t.unlockSub}</p>
            <Link
              href="/auth"
              onClick={goToAuth}
              className="inline-flex items-center justify-center w-full py-3.5 rounded-2xl text-sm font-black"
              style={{ background: '#fff', color: '#8f4220' }}
            >
              {t.cta}
            </Link>
            <p className="text-[12px] opacity-75 mt-3">
              {t.alreadyHave}{' '}
              <Link href="/auth" onClick={goToAuth} className="font-bold underline underline-offset-2">
                {t.login}
              </Link>
            </p>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
