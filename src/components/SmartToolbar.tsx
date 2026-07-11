'use client';

/**
 * SmartToolbar — extensible concierge action bar on the itinerary overview.
 *
 * Today it exposes one feature, "Restaurants to book ahead": a curated,
 * verified set of reservable restaurants for the destination — each with a
 * photo, cuisine genre, a short editorial blurb, its signature dish, rating and
 * a booking link. The traveler picks one, chooses a day + time, and it's locked
 * into that day, which triggers auto-rescheduling around the reservation.
 *
 * The bar is built from a FEATURES array so new tools (transport, tickets, spa)
 * can be added later by dropping in another entry.
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  Activity,
  AttractionRecommendation,
  DayPlan,
  EventRecommendation,
  RestaurantRecommendation,
} from '@/lib/types';

// ─── Design tokens (light "paper" overview theme) ─────────────────────────────
const INK       = 'var(--color-ink-warm)';        // near-black warm text
const INK_MUT   = 'var(--color-ink-warm-mut)';    // muted warm text
const INK_FAINT = 'rgba(107,99,88,0.72)';         // faint labels
const ACCENT      = 'var(--color-terracotta)';      // primary accent
const ACCENT_DEEP = 'var(--color-terracotta-deep)'; // accent text/links
const STAR_ON     = 'var(--color-sunrise)';
const PAPER_SUNK  = 'var(--color-paper-sunk)';
const TERRA_SOFT  = 'var(--color-terracotta-soft)';
const CARD_BG     = 'rgba(255,255,255,0.55)';
const BORDER      = '1px solid rgba(43,38,34,0.12)';
const BORDER_ACC  = `1px solid ${ACCENT}`;

type Lang = 'he' | 'en';

// ─── Copy ─────────────────────────────────────────────────────────────────────

const COPY = {
  he: {
    eyebrow: 'קונסיירז׳ חכם',
    restaurants: 'מסעדות בהזמנה מראש',
    intro: (city: string) =>
      `בחרנו עבורכם את המסעדות המומלצות ב${city} שכדאי להזמין מראש — מסוננות לפי דירוגים, ביקורות אמיתיות וזמינות. בחרו מקום, קבעו יום ושעה, ואנחנו נשבץ אותו במסלול ונארגן מחדש את היום סביב ההזמנה.`,
    loading: 'טוען המלצות…',
    scouting: (city: string) => `מאתרים את השולחנות הכי שווים ב${city}…`,
    signIn: 'התחברו כדי לטעון המלצות מסעדות.',
    errorLoad: (city: string) => `לא הצלחנו לטעון המלצות מסעדות ל${city} כרגע.`,
    retry: 'נסו שוב',
    mustOrder: 'מנת הדגל',
    social: 'צפו בטיקטוק',
    add: 'הוספה למסלול',
    book: 'הזמנת מקום',
    lockTitle: (n: string) => `שיבוץ ״${n}״ במסלול`,
    lockSub: 'נשבץ את ההזמנה בשעה שתבחרו ונארגן מחדש את אותו יום סביבה.',
    whichDay: 'באיזה יום?',
    time: 'שעת ההזמנה',
    day: 'יום',
    back: 'חזרה',
    confirm: 'אישור ושיבוץ היום ←',
    rescheduling: 'מארגנים מחדש…',
    reviews: 'ביקורות',
    // Attractions
    attractions: 'אטרקציות בהזמנה מראש',
    attractionsIntro: (city: string) =>
      `האטרקציות ב${city} שבהן הזמנה מראש היא קריטית — כניסות מתוזמנות, אתרים שנמכרים שבועות קדימה וסיורי גישה מיוחדת. בחרו אטרקציה, קבעו יום ושעה, ואנחנו נשבץ אותה במסלול ונארגן מחדש את היום סביבה.`,
    scoutingAttractions: (city: string) => `מאתרים את האטרקציות שחובה להזמין מראש ב${city}…`,
    attractionsError: (city: string) => `לא הצלחנו לטעון המלצות אטרקציות ל${city} כרגע.`,
    insiderTip: 'טיפ מקומי',
    tickets: 'כרטיסים',
    // Events
    events: 'פסטיבלים ואירועים',
    eventsIntro: (city: string) =>
      `פסטיבלים ואירועים שמתקיימים ב${city} בדיוק בתאריכים שלכם — כל אירוע מגובה במקור אמיתי מהרשת.`,
    scoutingEvents: (city: string) => `סורקים אירועים ופסטיבלים ב${city} בתאריכים שלכם…`,
    eventsError: (city: string) => `לא הצלחנו לטעון אירועים ל${city} כרגע.`,
    eventsNone: 'לא מצאנו אירועים מיוחדים בתאריכים שלכם — שווה לבדוק שוב קרוב יותר לנסיעה.',
    eventsNoDates: 'חסרים תאריכי הטיול, אז אי אפשר לחפש אירועים.',
    sourceLink: 'מקור',
    eventTime: 'באיזו שעה?',
  },
  en: {
    eyebrow: 'Smart concierge',
    restaurants: 'Restaurants to book ahead',
    intro: (city: string) =>
      `We've curated the restaurants in ${city} worth reserving ahead — filtered by rating, real reviews and availability. Pick a place, choose a day and time, and we'll slot it into your itinerary and reschedule that day around it.`,
    loading: 'Loading recommendations…',
    scouting: (city: string) => `Finding the best reservable tables in ${city}…`,
    signIn: 'Sign in to load restaurant recommendations.',
    errorLoad: (city: string) => `We couldn't load restaurant recommendations for ${city} right now.`,
    retry: 'Try again',
    mustOrder: 'Must order',
    social: 'See on TikTok',
    add: 'Add to itinerary',
    book: 'Reserve',
    lockTitle: (n: string) => `Lock “${n}” into your trip`,
    lockSub: 'We’ll place the reservation at your chosen time and reschedule that day around it.',
    whichDay: 'Which day?',
    time: 'Reservation time',
    day: 'Day',
    back: 'Back',
    confirm: 'Confirm & reschedule day →',
    rescheduling: 'Rescheduling…',
    reviews: 'reviews',
    // Attractions
    attractions: 'Attractions to book ahead',
    attractionsIntro: (city: string) =>
      `The attractions in ${city} where booking ahead is critical — timed entries, sites that sell out weeks in advance and special-access tours. Pick one, choose a day and time, and we'll slot it in and reschedule that day around it.`,
    scoutingAttractions: (city: string) => `Finding the must-book attractions in ${city}…`,
    attractionsError: (city: string) => `We couldn't load attraction recommendations for ${city} right now.`,
    insiderTip: 'Insider tip',
    tickets: 'Tickets',
    // Events
    events: 'Festivals & events',
    eventsIntro: (city: string) =>
      `Festivals and events happening in ${city} during your exact dates — each one backed by a real web source.`,
    scoutingEvents: (city: string) => `Scanning festivals & events in ${city} on your dates…`,
    eventsError: (city: string) => `We couldn't load events for ${city} right now.`,
    eventsNone: 'No special events found on your dates — worth checking again closer to the trip.',
    eventsNoDates: 'Trip dates are missing, so we can’t search for events.',
    sourceLink: 'Source',
    eventTime: 'What time?',
  },
} as const;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SmartToolbarProps {
  destination: string;
  days: DayPlan[];
  lang: Lang;
  /** Trip window (ISO YYYY-MM-DD) — powers the date-scoped events section. */
  startDate?: string | null;
  endDate?: string | null;
  accessToken: string | null;
  onLockReservation: (dayIndex: number, activity: Activity) => Promise<void>;
  recalculateDayLoading: boolean;
}

type FeatureKey = 'restaurants' | 'attractions' | 'events';

// Extensible: append new tools here as they ship.
const FEATURES: Array<{ key: FeatureKey; emoji: string; labelKey: FeatureKey }> = [
  { key: 'restaurants', emoji: '🍽️', labelKey: 'restaurants' },
  { key: 'attractions', emoji: '🎟️', labelKey: 'attractions' },
  { key: 'events', emoji: '🎪', labelKey: 'events' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartToolbar(props: SmartToolbarProps) {
  const { lang } = props;
  const t = COPY[lang];
  const [active, setActive] = useState<FeatureKey | null>(null);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  return (
    <div className="rounded-2xl p-3 sm:p-4" style={{ background: PAPER_SUNK, border: BORDER }} dir={dir}>
      {/* Header row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em] mx-1" style={{ color: INK_FAINT }}>
          ✦ {t.eyebrow}
        </span>
        <div className="flex-1" />
        {FEATURES.map((f) => {
          const on = active === f.key;
          return (
            <motion.button
              key={f.key}
              onClick={() => setActive(on ? null : f.key)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors"
              style={{
                background: on ? ACCENT : CARD_BG,
                border: on ? BORDER_ACC : BORDER,
                color: on ? '#fff' : INK,
              }}
            >
              <span>{f.emoji}</span>
              {COPY[lang][f.labelKey]}
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {active !== null && (
          <motion.div
            key={active}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28 }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              {active === 'restaurants' && <RestaurantsPanel {...props} />}
              {active === 'attractions' && <AttractionsPanel {...props} />}
              {active === 'events' && <EventsPanel {...props} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Restaurants feature ────────────────────────────────────────────────────────

function RestaurantsPanel({ destination, days, lang, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'error'>('idle');
  const [restaurants, setRestaurants] = useState<RestaurantRecommendation[]>([]);
  const [picked, setPicked] = useState<RestaurantRecommendation | null>(null);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;

    setStatus('loading');
    try {
      const res = await fetch(`/api/restaurants?city=${encodeURIComponent(city)}&lang=${lang}`);
      const data = (await res.json()) as { restaurants?: RestaurantRecommendation[]; stale?: boolean };
      if (data.restaurants && data.restaurants.length > 0) {
        setRestaurants(data.restaurants);
        setStatus('ready');
        if (data.stale) backgroundRevalidate('/api/restaurants/scout', { city, lang }, accessToken);
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/restaurants/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang }),
      });
      const scoutData = (await scoutRes.json()) as { restaurants?: RestaurantRecommendation[] };
      if (scoutData.restaurants && scoutData.restaurants.length > 0) {
        setRestaurants(scoutData.restaurants);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [destination, accessToken, lang]);

  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);

  if (status === 'loading' || status === 'scouting') {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <Spinner />
        <span className="text-[13px]" style={{ color: INK_MUT }}>
          {status === 'scouting' ? t.scouting(destination) : t.loading}
        </span>
      </div>
    );
  }

  if (status === 'error' || restaurants.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>
          {accessToken ? t.errorLoad(destination) : t.signIn}
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold"
          style={{ background: CARD_BG, border: BORDER, color: INK }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (picked) {
    return (
      <ConfirmReservation
        item={picked}
        days={days}
        lang={lang}
        loading={recalculateDayLoading}
        onCancel={() => setPicked(null)}
        onConfirm={async (dayIndex, lockedTime) => {
          await onLockReservation(dayIndex, restaurantToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  return (
    <div>
      <p className="text-[12.5px] leading-relaxed mb-4 mx-1" style={{ color: INK_MUT }}>
        {t.intro(destination)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {restaurants.map((r, i) => (
          <RestaurantCard key={r.id ?? `${r.name}-${i}`} r={r} lang={lang} onAdd={() => setPicked(r)} />
        ))}
      </div>
    </div>
  );
}

function RestaurantCard({ r, lang, onAdd }: { r: RestaurantRecommendation; lang: Lang; onAdd: () => void }) {
  const t = COPY[lang];
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: CARD_BG, border: BORDER, boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
    >
      {/* Photo */}
      <div className="relative h-36 w-full" style={{ background: PAPER_SUNK }}>
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photoUrl} alt={r.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl" style={{ opacity: 0.5 }}>🍽️</div>
        )}
        {/* Rating badge */}
        {typeof r.rating === 'number' && (
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: INK }}
          >
            <span style={{ color: STAR_ON }}>★</span>
            {r.rating.toFixed(1)}
            {r.ratingCount ? <span style={{ color: INK_FAINT }}>· {r.ratingCount.toLocaleString()}</span> : null}
          </div>
        )}
        {/* Price badge */}
        {r.priceRange && (
          <div
            className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.92)', color: ACCENT_DEEP }}
          >
            {r.priceRange}
          </div>
        )}
        {/* Highlight badge — what makes this an experience */}
        {r.highlight && (
          <div
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
            style={{ background: 'linear-gradient(90deg, rgba(184,85,46,0.96), rgba(143,66,32,0.96))', color: '#fff' }}
          >
            <span>✨</span>
            <span className="truncate">{r.highlight}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{r.name}</p>
          {(r.cuisineStyle || r.neighborhood) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {r.cuisineStyle && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
                >
                  {r.cuisineStyle}
                </span>
              )}
              {r.neighborhood && (
                <span className="text-[11.5px]" style={{ color: INK_FAINT }}>📍 {r.neighborhood}</span>
              )}
            </div>
          )}
        </div>

        {r.description && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: INK_MUT }}>{r.description}</p>
        )}

        {r.signatureDish && (
          <p className="text-[12px]" style={{ color: INK }}>
            <span style={{ color: ACCENT_DEEP, fontWeight: 700 }}>🍴 {t.mustOrder}: </span>
            {r.signatureDish}
          </p>
        )}

        {/* Booking urgency — why reserving is critical */}
        {r.bookingUrgency && (
          <div
            className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug"
            style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
          >
            <span>⚡</span>
            <span>{r.bookingUrgency}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={onAdd}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {t.add}
          </button>
          {r.reservationUrl && (
            <a
              href={r.reservationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              {t.book} ↗
            </a>
          )}
          {r.socialUrl && (
            <a
              href={r.socialUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t.social}
              aria-label={t.social}
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold"
              style={{ background: '#000', color: '#fff' }}
            >
              ♪
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmReservation({
  item, days, lang, loading, defaultDayIndex, defaultTime, onCancel, onConfirm,
}: {
  /** The thing being locked in — any recommendation with a name and photo. */
  item: { name: string; photoUrl?: string | null };
  days: DayPlan[];
  lang: Lang;
  loading: boolean;
  /** Preselected day (e.g. the day an event actually happens). */
  defaultDayIndex?: number;
  defaultTime?: string;
  onCancel: () => void;
  onConfirm: (dayIndex: number, lockedTime: string) => Promise<void>;
}) {
  const t = COPY[lang];
  const [dayIndex, setDayIndex] = useState(
    defaultDayIndex != null && defaultDayIndex >= 0 && defaultDayIndex < days.length ? defaultDayIndex : 0,
  );
  const [time, setTime] = useState(defaultTime ?? '19:30');

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: BORDER }}>
      {/* Header with photo strip */}
      <div className="relative h-24 w-full" style={{ background: PAPER_SUNK }}>
        {item.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.photoUrl} alt={item.name} className="h-full w-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(255,255,255,0.85), rgba(255,255,255,0.2))' }} />
        <div className="absolute bottom-2.5 inset-x-3.5">
          <p className="text-[15px] font-bold" style={{ color: INK }}>🔒 {t.lockTitle(item.name)}</p>
        </div>
      </div>

      <div className="p-4">
        <p className="text-[12px] mb-4" style={{ color: INK_MUT }}>{t.lockSub}</p>

        <span className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: INK_FAINT }}>{t.whichDay}</span>
        <div className="flex gap-2 flex-wrap mb-4">
          {days.map((d, i) => {
            const on = i === dayIndex;
            return (
              <button
                key={i}
                onClick={() => setDayIndex(i)}
                className="px-3.5 py-1.5 rounded-lg text-[12.5px] font-semibold transition-colors"
                style={{
                  background: on ? ACCENT : 'rgba(255,255,255,0.6)',
                  border: on ? BORDER_ACC : BORDER,
                  color: on ? '#fff' : INK_MUT,
                }}
              >
                {t.day} {d.day ?? i + 1}
              </button>
            );
          })}
        </div>

        <span className="text-[11px] uppercase tracking-widest mb-1.5 block" style={{ color: INK_FAINT }}>{t.time}</span>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-[13px] mb-4 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
        />

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-[13px]"
            style={{ background: 'rgba(255,255,255,0.6)', border: BORDER, color: INK_MUT }}
          >
            {t.back}
          </button>
          <button
            onClick={() => onConfirm(dayIndex, time)}
            disabled={loading}
            className="flex-[2] py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2"
            style={{ background: loading ? PAPER_SUNK : ACCENT, color: loading ? INK_FAINT : '#fff', cursor: loading ? 'not-allowed' : 'pointer' }}
          >
            {loading ? (<><Spinner /> {t.rescheduling}</>) : t.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Attractions feature ───────────────────────────────────────────────────────

function AttractionsPanel({ destination, days, lang, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'error'>('idle');
  const [attractions, setAttractions] = useState<AttractionRecommendation[]>([]);
  const [picked, setPicked] = useState<AttractionRecommendation | null>(null);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;

    setStatus('loading');
    try {
      const res = await fetch(`/api/attractions?city=${encodeURIComponent(city)}&lang=${lang}`);
      const data = (await res.json()) as { attractions?: AttractionRecommendation[]; stale?: boolean };
      if (data.attractions && data.attractions.length > 0) {
        setAttractions(data.attractions);
        setStatus('ready');
        if (data.stale) backgroundRevalidate('/api/attractions/scout', { city, lang }, accessToken);
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/attractions/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang }),
      });
      const scoutData = (await scoutRes.json()) as { attractions?: AttractionRecommendation[] };
      if (scoutData.attractions && scoutData.attractions.length > 0) {
        setAttractions(scoutData.attractions);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [destination, accessToken, lang]);

  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);

  if (status === 'loading' || status === 'scouting') {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <Spinner />
        <span className="text-[13px]" style={{ color: INK_MUT }}>
          {status === 'scouting' ? t.scoutingAttractions(destination) : t.loading}
        </span>
      </div>
    );
  }

  if (status === 'error' || attractions.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>
          {accessToken ? t.attractionsError(destination) : t.signIn}
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold"
          style={{ background: CARD_BG, border: BORDER, color: INK }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (picked) {
    return (
      <ConfirmReservation
        item={picked}
        days={days}
        lang={lang}
        loading={recalculateDayLoading}
        defaultTime="10:00"
        onCancel={() => setPicked(null)}
        onConfirm={async (dayIndex, lockedTime) => {
          await onLockReservation(dayIndex, attractionToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  return (
    <div>
      <p className="text-[12.5px] leading-relaxed mb-4 mx-1" style={{ color: INK_MUT }}>
        {t.attractionsIntro(destination)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {attractions.map((a, i) => (
          <AttractionCard key={a.id ?? `${a.name}-${i}`} a={a} lang={lang} onAdd={() => setPicked(a)} />
        ))}
      </div>
    </div>
  );
}

function AttractionCard({ a, lang, onAdd }: { a: AttractionRecommendation; lang: Lang; onAdd: () => void }) {
  const t = COPY[lang];
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: CARD_BG, border: BORDER, boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
    >
      {/* Photo */}
      <div className="relative h-36 w-full" style={{ background: PAPER_SUNK }}>
        {a.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.photoUrl} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl" style={{ opacity: 0.5 }}>🎟️</div>
        )}
        {typeof a.rating === 'number' && (
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: INK }}
          >
            <span style={{ color: STAR_ON }}>★</span>
            {a.rating.toFixed(1)}
            {a.ratingCount ? <span style={{ color: INK_FAINT }}>· {a.ratingCount.toLocaleString()}</span> : null}
          </div>
        )}
        {a.priceRange && (
          <div
            className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.92)', color: ACCENT_DEEP }}
          >
            {a.priceRange}
          </div>
        )}
        {a.highlight && (
          <div
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
            style={{ background: 'linear-gradient(90deg, rgba(184,85,46,0.96), rgba(143,66,32,0.96))', color: '#fff' }}
          >
            <span>✨</span>
            <span className="truncate">{a.highlight}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{a.name}</p>
          {(a.category || a.neighborhood) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {a.category && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
                >
                  {a.category}
                </span>
              )}
              {a.neighborhood && (
                <span className="text-[11.5px]" style={{ color: INK_FAINT }}>📍 {a.neighborhood}</span>
              )}
            </div>
          )}
        </div>

        {a.description && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: INK_MUT }}>{a.description}</p>
        )}

        {a.insiderTip && (
          <p className="text-[12px]" style={{ color: INK }}>
            <span style={{ color: ACCENT_DEEP, fontWeight: 700 }}>💡 {t.insiderTip}: </span>
            {a.insiderTip}
          </p>
        )}

        {a.bookingUrgency && (
          <div
            className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug"
            style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
          >
            <span>⚡</span>
            <span>{a.bookingUrgency}</span>
          </div>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={onAdd}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {t.add}
          </button>
          {a.ticketUrl && (
            <a
              href={a.ticketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              {t.tickets} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Events feature ────────────────────────────────────────────────────────────

/** Map an ISO event date onto the trip's day index (0-based); -1 if outside. */
function dayIndexForDate(startDate: string | null | undefined, tripStart: string | null | undefined, dayCount: number): number {
  if (!startDate || !tripStart) return -1;
  const ev = new Date(startDate).getTime();
  const t0 = new Date(tripStart).getTime();
  if (!Number.isFinite(ev) || !Number.isFinite(t0)) return -1;
  const idx = Math.round((ev - t0) / 86_400_000);
  return idx >= 0 && idx < dayCount ? idx : -1;
}

function formatEventDates(e: EventRecommendation, lang: Lang): string {
  const locale = lang === 'he' ? 'he-IL' : 'en-US';
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  if (!e.startDate) return '';
  if (!e.endDate || e.endDate === e.startDate) return fmt(e.startDate);
  return `${fmt(e.startDate)} – ${fmt(e.endDate)}`;
}

function EventsPanel({ destination, days, lang, startDate, endDate, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'empty' | 'error'>('idle');
  const [events, setEvents] = useState<EventRecommendation[]>([]);
  const [picked, setPicked] = useState<EventRecommendation | null>(null);

  const from = startDate?.slice(0, 10) ?? null;
  const to = endDate?.slice(0, 10) ?? from;

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city || !from || !to) return;

    setStatus('loading');
    try {
      const res = await fetch(
        `/api/events?city=${encodeURIComponent(city)}&from=${from}&to=${to}&lang=${lang}`,
      );
      const data = (await res.json()) as { events?: EventRecommendation[]; stale?: boolean };
      if (data.events && data.events.length > 0) {
        setEvents(data.events);
        setStatus('ready');
        if (data.stale) backgroundRevalidate('/api/events/scout', { city, from, to, lang }, accessToken);
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/events/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, from, to, lang }),
      });
      const scoutData = (await scoutRes.json()) as { ok?: boolean; events?: EventRecommendation[] };
      if (scoutData.events && scoutData.events.length > 0) {
        setEvents(scoutData.events);
        setStatus('ready');
      } else if (scoutData.ok) {
        // Scout ran fine and found nothing grounded in the window — honest empty state.
        setStatus('empty');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [destination, accessToken, lang, from, to]);

  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);

  if (!from) {
    return <p className="py-6 text-center text-[13px]" style={{ color: INK_MUT }}>{t.eventsNoDates}</p>;
  }

  if (status === 'loading' || status === 'scouting') {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <Spinner />
        <span className="text-[13px]" style={{ color: INK_MUT }}>
          {status === 'scouting' ? t.scoutingEvents(destination) : t.loading}
        </span>
      </div>
    );
  }

  if (status === 'empty') {
    return <p className="py-8 text-center text-[13px]" style={{ color: INK_MUT }}>🎪 {t.eventsNone}</p>;
  }

  if (status === 'error' || events.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>
          {accessToken ? t.eventsError(destination) : t.signIn}
        </p>
        <button
          onClick={() => setStatus('idle')}
          className="px-4 py-2 rounded-xl text-[13px] font-semibold"
          style={{ background: CARD_BG, border: BORDER, color: INK }}
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (picked) {
    return (
      <ConfirmReservation
        item={picked}
        days={days}
        lang={lang}
        loading={recalculateDayLoading}
        defaultDayIndex={dayIndexForDate(picked.startDate, from, days.length)}
        defaultTime="20:00"
        onCancel={() => setPicked(null)}
        onConfirm={async (dayIndex, lockedTime) => {
          await onLockReservation(dayIndex, eventToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  return (
    <div>
      <p className="text-[12.5px] leading-relaxed mb-4 mx-1" style={{ color: INK_MUT }}>
        {t.eventsIntro(destination)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {events.map((e, i) => (
          <EventCard key={e.id ?? `${e.name}-${i}`} e={e} lang={lang} onAdd={() => setPicked(e)} />
        ))}
      </div>
    </div>
  );
}

function EventCard({ e, lang, onAdd }: { e: EventRecommendation; lang: Lang; onAdd: () => void }) {
  const t = COPY[lang];
  const dates = formatEventDates(e, lang);
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: CARD_BG, border: BORDER, boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
    >
      {/* Date banner (events have no Places photo — lead with the dates) */}
      <div
        className="flex items-center justify-between px-3.5 py-2.5"
        style={{ background: 'linear-gradient(90deg, rgba(184,85,46,0.94), rgba(143,66,32,0.94))', color: '#fff' }}
      >
        <span className="text-[13px] font-bold">🗓️ {dates}</span>
        {e.highlight && <span className="text-[11.5px] font-semibold truncate">✨ {e.highlight}</span>}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{e.name}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {e.category && (
              <span
                className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
              >
                {e.category}
              </span>
            )}
            {e.venue && <span className="text-[11.5px]" style={{ color: INK_FAINT }}>📍 {e.venue}</span>}
            {e.priceRange && (
              <span className="text-[11.5px] font-semibold" style={{ color: ACCENT_DEEP }}>{e.priceRange}</span>
            )}
          </div>
        </div>

        {e.description && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: INK_MUT }}>{e.description}</p>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={onAdd}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {t.add}
          </button>
          {(e.ticketUrl || e.sourceUrl) && (
            <a
              href={e.ticketUrl ?? e.sourceUrl ?? '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              {e.ticketUrl ? t.tickets : t.sourceLink} ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function restaurantToActivity(r: RestaurantRecommendation, lockedTime: string): Activity {
  return {
    name: r.name,
    description: r.description ?? `Reservation at ${r.name}`,
    neighborhood: r.neighborhood ?? undefined,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    reservationStatus: 'booked',
    reservationUrl: r.reservationUrl ?? undefined,
    website_url: r.websiteUrl ?? undefined,
    estimatedCost: r.priceRange ?? undefined,
    latitude: r.latitude ?? undefined,
    longitude: r.longitude ?? undefined,
    category_emoji: '🍽️',
    tags: ['dining', 'reservation'],
    duration: '1.5–2 hours',
  };
}

function attractionToActivity(a: AttractionRecommendation, lockedTime: string): Activity {
  return {
    name: a.name,
    description: a.description ?? `Timed-entry visit at ${a.name}`,
    neighborhood: a.neighborhood ?? undefined,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    reservationStatus: 'booked',
    reservationUrl: a.ticketUrl ?? undefined,
    website_url: a.websiteUrl ?? undefined,
    estimatedCost: a.priceRange ?? undefined,
    latitude: a.latitude ?? undefined,
    longitude: a.longitude ?? undefined,
    category_emoji: '🎟️',
    tags: ['attraction', 'reservation'],
    duration: '2–3 hours',
  };
}

function eventToActivity(e: EventRecommendation, lockedTime: string): Activity {
  return {
    name: e.name,
    description: e.description ?? `Event: ${e.name}`,
    neighborhood: e.venue ?? undefined,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    reservationStatus: e.ticketUrl ? 'booked' : 'pending',
    reservationUrl: e.ticketUrl ?? e.sourceUrl ?? undefined,
    estimatedCost: e.priceRange ?? undefined,
    category_emoji: '🎪',
    tags: ['event', 'festival'],
    duration: '2–3 hours',
  };
}

/**
 * Stale-while-revalidate: when the GET returns cached data flagged `stale`,
 * fire the scout in the background to refresh the bank for the NEXT visitor.
 * Fire-and-forget — the current user keeps seeing the (slightly old) cache.
 */
function backgroundRevalidate(url: string, body: object, token: string | null) {
  if (!token) return;
  void fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).catch(() => { /* best-effort */ });
}

function Spinner() {
  return (
    <motion.span
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
      className="inline-block w-3.5 h-3.5 rounded-full border-2 border-t-transparent"
      style={{ borderColor: `${ACCENT} transparent transparent transparent` }}
    />
  );
}
