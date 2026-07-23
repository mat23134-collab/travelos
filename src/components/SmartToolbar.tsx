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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import type {
  Activity,
  AttractionRecommendation,
  BudgetLevel,
  DayPlan,
  EventRecommendation,
  RestaurantRecommendation,
} from '@/lib/types';
import type { Landmark } from '@/app/api/landmarks/route';
import { AttractionDetailModal } from '@/components/AttractionDetailModal';
import { rankBookAhead, type TripDayGeo } from '@/lib/bookAheadRanker';
import { normalizeNeighborhoodSlug, MAX_PRICE_LEVEL_BY_BUDGET } from '@/lib/restaurantBank';
import { personalizeOnlyHere } from '@/lib/attractionBank';
import { genreLabel } from '@/lib/restaurantGenre';
import { availableConcepts, primaryConcept, resolveCountry, RestaurantConcept } from '@/lib/restaurantConcepts';
import { trackReservationCtaClick, trackBookAheadPanelShown } from '@/lib/bookAheadMetrics';

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
      `בחרנו עבורכם את המסעדות המומלצות ב${city} שכדאי להזמין מראש, בהתאמה לתקציב שבחרתם בטיול — מסוננות לפי דירוגים, ביקורות אמיתיות וזמינות. בחרו מקום, קבעו יום ושעה, ואנחנו נשבץ אותו במסלול ונארגן מחדש את היום סביב ההזמנה.`,
    splurgeToggleOn:  '✨ הציגו גם מסעדות יוקרה',
    splurgeToggleOff: '💰 חזרה לתקציב שלי',
    priceRangeLabel: 'טווח מחירים',
    tierMyBudget: 'התקציב שלי',
    tierOneUp: 'רמה מעל',
    tierLuxury: 'כולל יוקרה',
    conceptAll: 'הכול',
    moreConcepts: (n: number) => `עוד ${n}`,
    seeAll: 'כל המסעדות',
    allTitle: (city: string) => `כל המסעדות ב${city}`,
    allSubtitle: 'מסודר לפי רמת מחיר — מהמשתלם ועד הפרימיום',
    perPerson: 'לאדם',
    close: 'סגירה',
    tierName1: 'זול ומשתלם',
    tierName2: 'מחיר ביניים',
    tierName3: 'יוקרתי',
    tierName4: 'פרימיום',
    yourBudgetTag: 'שלך',
    emptyTier: 'אין עדיין מסעדות ברמה הזו',
    badgeKosher: 'כשר',
    badgeKosherStyle: 'כשר סטייל',
    badgeVeg: 'צמחוני',
    badgeVegan: 'טבעוני',
    refresh: 'רענון מסעדות',
    refreshing: 'מחפשים עוד מסעדות מתאימות…',
    bookByLabel: (d: string) => `כדאי להזמין עד ${d}`,
    loading: 'טוען המלצות…',
    scouting: (city: string) => `מאתרים את השולחנות הכי שווים ב${city}…`,
    signIn: 'התחברו כדי לטעון המלצות מסעדות.',
    errorLoad: (city: string) => `לא הצלחנו לטעון המלצות מסעדות ל${city} כרגע.`,
    retry: 'נסו שוב',
    mustOrder: 'מנת הדגל',
    bookAhead: 'להזמין',
    social: 'צפו בטיקטוק',
    viewOnMaps: 'צפו במפה',
    viewMenu: 'תפריט / אתר',
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
    // Walk-In attractions
    walkin: 'כניסה חופשית',
    walkinIntro: (city: string) =>
      `מקומות ב${city} שאפשר פשוט להגיע אליהם — בלי הזמנה, בלי כרטיס מראש. נהדרים למילוי זמן פנוי בין תחנות מתוכננות.`,
    scoutingWalkin: (city: string) => `מאתרים מקומות לכניסה חופשית ב${city}…`,
    walkinError: (city: string) => `לא הצלחנו לטעון המלצות לכניסה חופשית ל${city} כרגע.`,
    bestTime: 'הזמן הכי טוב',
    timeNeeded: 'זמן מוערך',
    freeEntry: 'כניסה חופשית',
    payAtDoor: 'תשלום בכניסה',
    // Only-Here hidden gems (Engine C)
    onlyHere: 'רק כאן',
    onlyHereTitle: (city: string) => `רק ב${city}`,
    onlyHereIntro: (city: string) =>
      `חוויות שקשורות ספציפית ל${city} — דברים שלא הייתם חושבים לחפש, ושלא תוכלו לחוות בשום עיר אחרת.`,
    scoutingOnlyHere: (city: string) => `מחפשים חוויות ייחודיות ב${city}…`,
    onlyHereError: (city: string) => `לא הצלחנו לטעון חוויות ייחודיות ל${city} כרגע.`,
    whyOnlyHere: 'למה דווקא כאן',
    howToDoIt: 'איך עושים את זה',
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
    // Explore — curated attraction bank (same picks as onboarding step 7)
    explore: 'בנק אטרקציות',
    exploreIntro: (city: string) =>
      `עיינו באטרקציות הנבחרות של ${city} — אתרים, היסטוריה ואוכל מקומי — ושבצו כל אחת ליום ולשעה שתבחרו. אנחנו נארגן מחדש את היום סביבה.`,
    exploreError: (city: string) => `לא הצלחנו לטעון את בנק האטרקציות ל${city} כרגע.`,
    exploreEmpty: (city: string) => `עדיין אין לנו אטרקציות נבחרות ל${city}.`,
    catSightseeing: 'אתרים',
    catHistory: 'היסטוריה',
    catFood: 'אוכל מקומי',
  },
  en: {
    eyebrow: 'Smart concierge',
    restaurants: 'Restaurants to book ahead',
    intro: (city: string) =>
      `We've curated the restaurants in ${city} worth reserving ahead, matched to the budget you picked for this trip — filtered by rating, real reviews and availability. Pick a place, choose a day and time, and we'll slot it into your itinerary and reschedule that day around it.`,
    splurgeToggleOn:  '✨ Show splurge picks too',
    splurgeToggleOff: '💰 Back to my budget',
    priceRangeLabel: 'Price range',
    tierMyBudget: 'My budget',
    tierOneUp: 'One level up',
    tierLuxury: 'Incl. luxury',
    conceptAll: 'All',
    moreConcepts: (n: number) => `+${n} more`,
    seeAll: 'All restaurants',
    allTitle: (city: string) => `All restaurants in ${city}`,
    allSubtitle: 'Organized by price level — from great value to premium',
    perPerson: 'per person',
    close: 'Close',
    tierName1: 'Great value',
    tierName2: 'Mid-range',
    tierName3: 'Upscale',
    tierName4: 'Premium',
    yourBudgetTag: 'yours',
    emptyTier: 'No restaurants at this level yet',
    badgeKosher: 'Kosher',
    badgeKosherStyle: 'Kosher-style',
    badgeVeg: 'Vegetarian',
    badgeVegan: 'Vegan',
    refresh: 'Refresh restaurants',
    refreshing: 'Finding more matching restaurants…',
    bookByLabel: (d: string) => `Book by ${d}`,
    loading: 'Loading recommendations…',
    scouting: (city: string) => `Finding the best reservable tables in ${city}…`,
    signIn: 'Sign in to load restaurant recommendations.',
    errorLoad: (city: string) => `We couldn't load restaurant recommendations for ${city} right now.`,
    retry: 'Try again',
    mustOrder: 'Must order',
    bookAhead: 'Book',
    social: 'See on TikTok',
    viewOnMaps: 'View on map',
    viewMenu: 'Menu / website',
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
    // Walk-In attractions
    walkin: 'Walk right in',
    walkinIntro: (city: string) =>
      `Places in ${city} you can just show up to — no reservation, no advance ticket. Great for filling spontaneous gaps between planned stops.`,
    scoutingWalkin: (city: string) => `Finding walk-in-worthy spots in ${city}…`,
    walkinError: (city: string) => `We couldn't load walk-in recommendations for ${city} right now.`,
    bestTime: 'Best time',
    timeNeeded: 'Time needed',
    freeEntry: 'Free entry',
    payAtDoor: 'Pay at door',
    // Only-Here hidden gems (Engine C)
    onlyHere: 'Only Here',
    onlyHereTitle: (city: string) => `Only in ${city}`,
    onlyHereIntro: (city: string) =>
      `Experiences specific to ${city} — things you'd never have thought to search for, and can't have anywhere else.`,
    scoutingOnlyHere: (city: string) => `Finding one-of-a-kind experiences in ${city}…`,
    onlyHereError: (city: string) => `We couldn't load unique experiences for ${city} right now.`,
    whyOnlyHere: 'Why only here',
    howToDoIt: 'How to do it',
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
    // Explore — curated attraction bank (same picks as onboarding step 7)
    explore: 'Attraction bank',
    exploreIntro: (city: string) =>
      `Browse the curated highlights of ${city} — sights, history and local food — and slot any of them into the day and time you choose. We'll reschedule that day around it.`,
    exploreError: (city: string) => `We couldn't load the attraction bank for ${city} right now.`,
    exploreEmpty: (city: string) => `We don't have curated highlights for ${city} yet.`,
    catSightseeing: 'Sightseeing',
    catHistory: 'History',
    catFood: 'Local Food',
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
  /** Trip's chosen budget tier — scopes the restaurant panel to matching price
   *  levels by default (traveler can opt into pricier picks explicitly). */
  budget?: BudgetLevel | null;
  /** Trip group type (solo/couple/family/group) — feeds restaurant GroupFit. */
  groupType?: string | null;
  /** Trip interests / culinary focus — feed restaurant GenreFit. */
  interests?: string[] | null;
  /** Free-text dietary restrictions — feed the restaurant dietary gate. */
  dietary?: string | null;
  accessToken: string | null;
  onLockReservation: (dayIndex: number, activity: Activity) => Promise<void>;
  recalculateDayLoading: boolean;
}

type FeatureKey = 'explore' | 'restaurants' | 'attractions' | 'walkin' | 'onlyHere' | 'events';

// Extensible: append new tools here as they ship.
const FEATURES: Array<{ key: FeatureKey; emoji: string; labelKey: FeatureKey }> = [
  { key: 'explore', emoji: '🧭', labelKey: 'explore' },
  { key: 'restaurants', emoji: '🍽️', labelKey: 'restaurants' },
  { key: 'attractions', emoji: '🎟️', labelKey: 'attractions' },
  { key: 'walkin', emoji: '🚶', labelKey: 'walkin' },
  { key: 'onlyHere', emoji: '💎', labelKey: 'onlyHere' },
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
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-[13px] font-semibold"
              style={{
                background: on ? ACCENT : CARD_BG,
                border: on ? BORDER_ACC : BORDER,
                color: on ? '#fff' : INK,
                boxShadow: on ? '0 6px 18px -6px rgba(184,85,46,0.55)' : '0 2px 6px -4px rgba(43,38,34,0.35)',
              }}
            >
              <span className="text-[15px] leading-none">{f.emoji}</span>
              {COPY[lang][f.labelKey]}
            </motion.button>
          );
        })}
      </div>

      {/* Feature content opens in a floating overlay (not inline below). */}
      <AnimatePresence>
        {active !== null && (
          <FeatureModal
            title={`${FEATURES.find((f) => f.key === active)!.emoji}  ${COPY[lang][active]}`}
            lang={lang}
            onClose={() => setActive(null)}
          >
            {active === 'explore' && <ExplorePanel {...props} />}
            {active === 'restaurants' && <RestaurantsPanel {...props} />}
            {active === 'attractions' && <AttractionsPanel {...props} />}
            {active === 'walkin' && <WalkInPanel {...props} />}
            {active === 'onlyHere' && <OnlyHerePanel {...props} />}
            {active === 'events' && <EventsPanel {...props} />}
          </FeatureModal>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * FeatureModal — the floating overlay a concierge feature opens into (a mobile
 * bottom-sheet, a centered desktop dialog). Replaces the old inline expand so
 * the content floats above the page instead of pushing it down.
 */
function FeatureModal({
  title, lang, onClose, children,
}: {
  title: string;
  lang: Lang;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = COPY[lang];
  const dir = lang === 'he' ? 'rtl' : 'ltr';
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-6"
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="fixed inset-0 bg-[#1a130c]/55 backdrop-blur-md" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full sm:max-w-4xl max-h-[94dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden rounded-t-[26px] sm:rounded-[26px] shadow-2xl"
        style={{ background: 'var(--color-paper, #efe3cd)', boxShadow: '0 24px 60px -12px rgba(26,19,12,0.55)' }}
        initial={{ y: 48, opacity: 0.85, scale: 0.99 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 48, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
      >
        {/* Grab handle (mobile) */}
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <span className="w-10 h-1 rounded-full" style={{ background: 'rgba(43,38,34,0.22)' }} />
        </div>
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 pt-3 sm:pt-5 pb-3 border-b" style={{ borderColor: 'rgba(43,38,34,0.10)' }}>
          <h2 className="text-[17px] sm:text-[19px] font-bold leading-tight" style={{ color: INK }}>{title}</h2>
          <button
            onClick={onClose}
            aria-label={t.close ?? 'Close'}
            className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold transition-transform active:scale-90"
            style={{ background: CARD_BG, border: BORDER, color: INK }}
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 sm:px-6 py-4">
          {children}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

// ─── Explore feature — curated attraction bank ─────────────────────────────────
//
// The same curated Top Sights that power onboarding step 7 (/api/landmarks,
// backed by public.places rows), now reachable from the concierge on the
// overview and inside a day. Pick a landmark → choose a day + time → it's
// slotted in as a fixed anchor and the day reshuffles around it.

interface LandmarkBank {
  sightseeing: Landmark[];
  history: Landmark[];
  food: Landmark[];
}

function ExplorePanel({ destination, days, lang, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'empty' | 'error'>('idle');
  const [bank, setBank] = useState<LandmarkBank>({ sightseeing: [], history: [], food: [] });
  const [picked, setPicked] = useState<Landmark | null>(null);
  const [detail, setDetail] = useState<Landmark | null>(null);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;
    setStatus('loading');
    try {
      const res = await fetch(`/api/landmarks?city=${encodeURIComponent(city)}&lang=${lang}`);
      const data = (await res.json()) as Partial<LandmarkBank>;
      const next: LandmarkBank = {
        sightseeing: data.sightseeing ?? [],
        history: data.history ?? [],
        food: data.food ?? [],
      };
      const total = next.sightseeing.length + next.history.length + next.food.length;
      setBank(next);
      setStatus(total === 0 ? 'empty' : 'ready');
    } catch {
      setStatus('error');
    }
  }, [destination, lang]);

  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <Spinner />
        <span className="text-[13px]" style={{ color: INK_MUT }}>{t.loading}</span>
      </div>
    );
  }

  if (status === 'empty') {
    return <p className="py-8 text-center text-[13px]" style={{ color: INK_MUT }}>🧭 {t.exploreEmpty(destination)}</p>;
  }

  if (status === 'error') {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>{t.exploreError(destination)}</p>
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
        item={{ name: picked.name, photoUrl: picked.photo_url }}
        days={days}
        lang={lang}
        loading={recalculateDayLoading}
        defaultTime="10:00"
        onCancel={() => setPicked(null)}
        onConfirm={async (dayIndex, lockedTime) => {
          await onLockReservation(dayIndex, landmarkToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  const groups: Array<{ key: keyof LandmarkBank; label: string }> = [
    { key: 'sightseeing', label: t.catSightseeing },
    { key: 'history', label: t.catHistory },
    { key: 'food', label: t.catFood },
  ];

  return (
    <div>
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
        {t.exploreIntro(destination)}
      </p>
      <div className="flex flex-col gap-5">
        {groups.map(({ key, label }) => {
          const items = bank[key];
          if (items.length === 0) return null;
          return (
            <div key={key}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] mb-2.5 mx-1" style={{ color: INK_FAINT }}>
                {label}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {items.map((l) => (
                  <ExploreCard key={l.id} l={l} lang={lang} onOpen={() => setDetail(l)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tap a card → full detail (links + description); "add" then asks day/time */}
      {detail && (
        <AttractionDetailModal
          landmark={detail}
          destination={destination}
          lang={lang}
          onClose={() => setDetail(null)}
          onAdd={() => { setPicked(detail); setDetail(null); }}
        />
      )}
    </div>
  );
}

function ExploreCard({ l, lang, onOpen }: { l: Landmark; lang: Lang; onOpen: () => void }) {
  const detailsLabel = lang === 'he' ? 'לפרטים ולהוספה' : 'View details';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex flex-col text-start rounded-2xl overflow-hidden transition-transform active:scale-[0.985]"
      style={{ background: CARD_BG, border: BORDER, boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
    >
      {/* Photo (3:4 cuboid, matching step 7) */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: '3 / 4', background: PAPER_SUNK }}>
        {l.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={l.photo_url} alt={l.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl" style={{ opacity: 0.4 }}>
            {l.category_emoji || '📍'}
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-2/5 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(9,13,20,0.72), rgba(9,13,20,0) 100%)' }}
        />
        {/* Details pill on hover — opens the full sheet (links + add) */}
        <span
          className="absolute bottom-2 inset-x-2 py-1.5 rounded-lg text-[11.5px] font-bold text-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ background: ACCENT, color: '#fff' }}
        >
          {detailsLabel}
        </span>
      </div>
      {/* Caption */}
      <div className="p-3 flex flex-col gap-1">
        <span className="text-[13.5px] font-bold leading-tight line-clamp-1" style={{ color: INK }}>{l.name}</span>
        {l.description && (
          <span className="text-[11px] leading-snug line-clamp-2" style={{ color: INK_FAINT }}>{l.description}</span>
        )}
      </div>
    </button>
  );
}

// ─── Restaurants feature ────────────────────────────────────────────────────────

function RestaurantsPanel({ destination, days, lang, budget, groupType, interests, dietary, startDate, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'error'>('idle');
  const [restaurants, setRestaurants] = useState<RestaurantRecommendation[]>([]);
  const [picked, setPicked] = useState<RestaurantRecommendation | null>(null);
  // The trip budget's default price ceiling (budget→2, mid-range→3, luxury→4).
  // A trip with no budget on file sees everything.
  const budgetCeiling = budget ? MAX_PRICE_LEVEL_BY_BUDGET[budget] : 4;
  // Which max price level the traveler is currently browsing. Defaults to their
  // budget ceiling; the price-range selector lets them step up a tier ("one
  // level up") or all the way to luxury — instead of the old binary toggle.
  const [viewLevel, setViewLevel] = useState(budgetCeiling);
  // Reset the view when the trip budget changes.
  useEffect(() => { setViewLevel(budgetCeiling); }, [budgetCeiling]);
  // "All restaurants" modal (grouped by price tier).
  const [showAll, setShowAll] = useState(false);
  // Cuisine-concept filter (ramen / sushi / pizza / …) — null = all concepts.
  const [activeConcept, setActiveConcept] = useState<string | null>(null);
  // Drop the concept filter when the city changes (its concepts differ).
  useEffect(() => { setActiveConcept(null); }, [destination]);
  // Manual, foreground top-up: the automatic background revalidate (on
  // `stale`/`needsTopUp`) is fire-and-forget and invisible, so a traveler
  // stuck with a luxury-skewed bank has no way to see it actually happen.
  // This hits the same scout endpoint but awaits it and swaps the list in.
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;

    const qs = new URLSearchParams({ city, lang });
    if (budget) qs.set('budget', budget);
    // Always pull the FULL pool across every price level (in-budget rows still
    // sort first, server-side). The tier selector then filters client-side —
    // instant, no refetch — and the "all restaurants" modal shows every tier.
    qs.set('maxLevel', '4');
    qs.set('limit', '40');

    setStatus('loading');
    try {
      const res = await fetch(`/api/restaurants?${qs.toString()}`);
      const data = (await res.json()) as {
        restaurants?: RestaurantRecommendation[];
        stale?: boolean;
        needsTopUp?: boolean;
      };
      if (data.restaurants && data.restaurants.length > 0) {
        setRestaurants(data.restaurants);
        setStatus('ready');
        // `needsTopUp`: the bank has rows but too few actually match this
        // trip's budget (e.g. a first scout that skewed luxury) — kick a
        // background additive scout for real affordable/mid-range picks so
        // the NEXT visit is properly stocked, same pattern as `stale` below.
        if (data.stale || data.needsTopUp) {
          backgroundRevalidate('/api/restaurants/scout', { city, lang, budget }, accessToken);
        }
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/restaurants/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang, budget }),
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
  }, [destination, accessToken, lang, budget, viewLevel]);

  // Re-fetch on mount AND whenever the price-range selector (or any other `load`
  // dependency) changes — not just when status is 'idle', so changing the tier
  // actually re-queries instead of silently no-oping.
  useEffect(() => { void load(); }, [load]);

  // Per-day geography for GeoFit: a neighborhood slug + centroid from each day's
  // activities (morning/afternoon/evening carry lat/lng + neighborhood).
  const dayGeo: TripDayGeo[] = useMemo(() => {
    return days.map((d) => {
      const acts = [d.morning, d.afternoon, d.evening].filter(Boolean) as Activity[];
      const pts = acts
        .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
        .map((a) => ({ lat: a.latitude as number, lng: a.longitude as number }));
      const centroid = pts.length
        ? { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length }
        : null;
      const hood = acts.find((a) => a.neighborhood)?.neighborhood ?? null;
      return { neighborhoodSlug: normalizeNeighborhoodSlug(hood), centroid };
    });
  }, [days]);

  // Concept chips: gated to the destination's country (Italian city → pizza/
  // pasta/meat, never sushi) and to concepts actually present in the results.
  const country = useMemo(() => resolveCountry(restaurants, destination), [restaurants, destination]);
  const concepts = useMemo(() => availableConcepts(restaurants, { country, min: 1 }), [restaurants, country]);
  // Narrow the ranking pool by concept, then (for the inline view) by the tier
  // selector's ceiling — client-side, so switching tiers is instant. Rows with
  // an unknown price level are kept (never hidden by a filter we can't confirm).
  const conceptPool = useMemo(
    () => (activeConcept ? restaurants.filter((r) => primaryConcept(r, country)?.key === activeConcept) : restaurants),
    [restaurants, activeConcept, country],
  );
  // "≤ ceiling" for the traveler's own default budget view (everything within
  // their means, cheapest included) — but once they deliberately step UP to a
  // pricier tab, that tab means "show me THIS bracket", not "raise my
  // ceiling". Without this, a ¥1,000 ramen counter with a high composite
  // score could keep out-ranking the actual priceLevel-3/4 picks under the
  // "יוקרתי"/"פרימיום" tabs — the budgetFit term in rankBookAhead nudges
  // toward the target tier but doesn't hard-exclude cheaper places, so the
  // exclusion has to happen here.
  const browsingUp = viewLevel > budgetCeiling;
  const visiblePool = useMemo(
    () => conceptPool.filter((r) => r.priceLevel == null || (browsingUp ? r.priceLevel === viewLevel : r.priceLevel <= viewLevel)),
    [conceptPool, viewLevel, browsingUp],
  );

  // Request-time ranking: layer per-trip fit + diversity over the fetched pool,
  // trimming to the handful actually shown (§4/§6/§8). Recomputes only when the
  // pool or trip context changes.
  const dietaryTokens = useMemo(
    () => (dietary ? dietary.toLowerCase().split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean) : undefined),
    [dietary],
  );
  const picks = useMemo(
    () =>
      rankBookAhead(visiblePool, {
        budget,
        groupType,
        culinaryTags: interests ?? undefined,
        dietary: dietaryTokens,
        days: dayGeo,
        nights: days.length,
        startDate,
        viewMaxLevel: viewLevel,
        lang,
        limit: 8,
      }),
    [visiblePool, budget, groupType, interests, dietaryTokens, dayGeo, days.length, startDate, viewLevel, lang],
  );

  // North-star denominator: the panel actually showed the traveler picks (§12).
  useEffect(() => {
    if (status === 'ready' && picks.length > 0) trackBookAheadPanelShown(picks.length);
  }, [status, picks.length]);

  const refreshRestaurants = useCallback(async () => {
    const city = destination.trim();
    if (!city || !accessToken || refreshing) return;
    setRefreshing(true);
    try {
      const scoutRes = await fetch('/api/restaurants/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang, budget }),
      });
      const scoutData = (await scoutRes.json()) as { restaurants?: RestaurantRecommendation[] };
      // Swap the list in only on a real result — a throttled/failed call
      // still returns whatever's cached, so the panel never goes empty.
      if (scoutData.restaurants && scoutData.restaurants.length > 0) {
        setRestaurants(scoutData.restaurants);
      }
    } catch {
      /* best-effort — keep showing whatever's already on screen */
    } finally {
      setRefreshing(false);
    }
  }, [destination, accessToken, lang, budget, refreshing]);

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
          onClick={() => void load()}
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
      {/* Intro spans the full width so it reads as a paragraph, not a squeezed
          column; controls sit on their own row below. */}
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
        {t.intro(destination)}
      </p>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4 mx-1">
        <PriceLadder viewLevel={viewLevel} budgetCeiling={budgetCeiling} onSelect={setViewLevel} lang={lang} />
        {accessToken && (
          <button
            onClick={() => void refreshRestaurants()}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-bold whitespace-nowrap transition-transform active:scale-95 disabled:opacity-60"
            style={{ background: CARD_BG, border: BORDER, color: INK, boxShadow: '0 2px 6px -4px rgba(43,38,34,0.35)' }}
          >
            {refreshing ? <Spinner /> : '🔄'}
            {refreshing ? t.refreshing : t.refresh}
          </button>
        )}
      </div>

      {/* Filter row: cuisine-concept chips (only those present in this city's
          results) + a prominent "all restaurants" entry point. */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3.5 mx-1">
        <ConceptChipRow concepts={concepts} active={activeConcept} onSelect={setActiveConcept} lang={lang} />
        <button
          onClick={() => setShowAll(true)}
          className="ms-auto flex items-center gap-1.5 px-3 py-1 rounded-full text-[11.5px] font-bold transition-colors"
          style={{ background: 'transparent', border: BORDER_ACC, color: ACCENT_DEEP }}
        >
          {t.seeAll} · {restaurants.length}
          <span aria-hidden>↗</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {(picks.length > 0 ? picks : visiblePool.slice(0, 8)).map((r, i) => (
          <RestaurantCard key={r.id ?? `${r.name}-${i}`} r={r} lang={lang} onAdd={() => setPicked(r)} />
        ))}
      </div>

      {showAll && (
        <AllRestaurantsModal
          city={destination}
          restaurants={restaurants}
          lang={lang}
          onPick={(r) => { setShowAll(false); setPicked(r); }}
          onClose={() => setShowAll(false)}
        />
      )}
    </div>
  );
}

/**
 * "All restaurants" modal — the full city list, grouped into clean price-tier
 * sections (Great value → Premium) so tiers never blend, with a concept filter.
 * Within each tier, sorted by composite quality/value.
 */
function AllRestaurantsModal({
  city, restaurants, lang, onPick, onClose,
}: {
  city: string;
  restaurants: RestaurantRecommendation[];
  lang: Lang;
  onPick: (r: RestaurantRecommendation) => void;
  onClose: () => void;
}) {
  const t = COPY[lang];
  const [concept, setConcept] = useState<string | null>(null);
  const dir = lang === 'he' ? 'rtl' : 'ltr';

  const country = useMemo(() => resolveCountry(restaurants, city), [restaurants, city]);
  const concepts = useMemo(() => availableConcepts(restaurants, { country, min: 1 }), [restaurants, country]);
  const filtered = useMemo(
    () => (concept ? restaurants.filter((r) => primaryConcept(r, country)?.key === concept) : restaurants),
    [restaurants, concept, country],
  );

  // Group by price tier (4 → 1, premium first). Unknown-price rows go last.
  const tiers = useMemo(() => {
    const byLevel = new Map<number, RestaurantRecommendation[]>();
    const unknown: RestaurantRecommendation[] = [];
    for (const r of filtered) {
      if (r.priceLevel && r.priceLevel >= 1 && r.priceLevel <= 4) {
        (byLevel.get(r.priceLevel) ?? byLevel.set(r.priceLevel, []).get(r.priceLevel)!).push(r);
      } else {
        unknown.push(r);
      }
    }
    const sortByScore = (a: RestaurantRecommendation, b: RestaurantRecommendation) =>
      (b.compositeScore ?? b.score ?? 0) - (a.compositeScore ?? a.score ?? 0);
    const sections = [4, 3, 2, 1]
      .filter((lvl) => (byLevel.get(lvl)?.length ?? 0) > 0)
      .map((lvl) => ({ level: lvl, items: byLevel.get(lvl)!.sort(sortByScore) }));
    if (unknown.length) sections.push({ level: 0, items: unknown.sort(sortByScore) });
    return sections;
  }, [filtered]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-6"
      dir={dir}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="fixed inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        className="relative z-10 w-full sm:max-w-4xl max-h-[92dvh] sm:max-h-[88dvh] flex flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl shadow-2xl"
        style={{ background: 'var(--color-paper, #f3ead9)' }}
        initial={{ y: 40, opacity: 0.9 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 34 }}
      >
        {/* Header */}
        <div className="sticky top-0 px-5 sm:px-6 pt-5 pb-3 border-b" style={{ background: 'var(--color-paper, #f3ead9)', borderColor: 'rgba(43,38,34,0.10)' }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-[19px] font-bold leading-tight" style={{ color: INK }}>{t.allTitle(city)}</h3>
              <p className="text-[12px] mt-0.5" style={{ color: INK_MUT }}>{t.allSubtitle}</p>
            </div>
            <button
              onClick={onClose}
              aria-label={t.close}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[15px] font-bold transition-colors"
              style={{ background: CARD_BG, border: BORDER, color: INK }}
            >
              ✕
            </button>
          </div>
          {concepts.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-3">
              <ConceptChipRow concepts={concepts} active={concept} onSelect={setConcept} lang={lang} />
            </div>
          )}
        </div>

        {/* Body — tier sections */}
        <div className="overflow-y-auto px-5 sm:px-6 py-4 flex flex-col gap-6">
          {tiers.map((section) => (
            <div key={section.level}>
              <div className="flex items-center gap-2 mb-3">
                {section.level > 0 && <PriceTierPips level={section.level} active={false} />}
                <span className="text-[13.5px] font-bold" style={{ color: INK }}>
                  {section.level > 0 ? tierName(section.level, t) : '—'}
                </span>
                <span className="text-[11.5px] font-semibold" style={{ color: INK_FAINT }}>· {section.items.length}</span>
                <span className="flex-1 h-px" style={{ background: 'rgba(43,38,34,0.10)' }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {section.items.map((r, i) => (
                  <RestaurantCard key={r.id ?? `${r.name}-${i}`} r={r} lang={lang} onAdd={() => onPick(r)} />
                ))}
              </div>
            </div>
          ))}
          {tiers.length === 0 && (
            <p className="text-center py-10 text-[13px]" style={{ color: INK_MUT }}>{t.emptyTier}</p>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/** Scannable dietary badge for the restaurant card. */
function DietaryBadge({ label, tone }: { label: string; tone: 'kosher' | 'kosherStyle' | 'veg' }) {
  const styles: Record<string, { bg: string; color: string }> = {
    kosher:      { bg: 'rgba(59,130,120,0.14)',  color: '#2f6f63' },
    kosherStyle: { bg: 'rgba(59,130,120,0.10)',  color: '#3f7a6f' },
    veg:         { bg: 'rgba(96,140,60,0.14)',   color: '#4b7a2a' },
  };
  const s = styles[tone];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10.5px] font-bold" style={{ background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

/** Localized name for a 1–4 price tier. */
function tierName(level: number, t: (typeof COPY)[Lang]): string {
  return [t.tierName1, t.tierName2, t.tierName3, t.tierName4][Math.min(3, Math.max(0, level - 1))];
}

/**
 * ConceptChipRow — cuisine-concept filter chips, capped to `maxVisible` so a
 * city with a large concept catalog (e.g. Tokyo's 6 JP-specific + several
 * universal concepts) doesn't dump 10+ chips on screen at once; the rest sit
 * behind a "+N more" toggle.
 */
function ConceptChipRow({
  concepts, active, onSelect, lang, maxVisible = 6,
}: {
  concepts: RestaurantConcept[];
  active: string | null;
  onSelect: (key: string | null) => void;
  lang: Lang;
  maxVisible?: number;
}) {
  const t = COPY[lang];
  const [expanded, setExpanded] = useState(false);
  if (concepts.length <= 1) return null;
  const visible = expanded ? concepts : concepts.slice(0, maxVisible);
  const hiddenCount = concepts.length - visible.length;
  return (
    <>
      <button
        onClick={() => onSelect(null)}
        className="px-2.5 py-1 rounded-full text-[11.5px] font-bold transition-colors"
        style={{
          background: active === null ? ACCENT : CARD_BG,
          border: active === null ? BORDER_ACC : BORDER,
          color: active === null ? '#fff' : INK,
        }}
      >
        {t.conceptAll}
      </button>
      {visible.map((c) => {
        const on = active === c.key;
        return (
          <button
            key={c.key}
            onClick={() => onSelect(on ? null : c.key)}
            className="px-2.5 py-1 rounded-full text-[11.5px] font-bold transition-colors"
            style={{
              background: on ? ACCENT : CARD_BG,
              border: on ? BORDER_ACC : BORDER,
              color: on ? '#fff' : INK,
            }}
          >
            {c.label[lang]}
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          className="px-2.5 py-1 rounded-full text-[11.5px] font-bold transition-colors"
          style={{ background: 'transparent', border: BORDER, color: INK_FAINT }}
        >
          {t.moreConcepts(hiddenCount)}
        </button>
      )}
    </>
  );
}

/**
 * PriceLadder — the price-range selector. All four levels as a single connected
 * "ladder" (great value → premium); tapping a rung shows everything up to it.
 * The trip's own budget rung is marked so the traveler always knows their
 * baseline while browsing up. Replaces the old two-preset toggle.
 */
function PriceLadder({
  viewLevel, budgetCeiling, onSelect, lang,
}: {
  viewLevel: number;
  budgetCeiling: number;
  onSelect: (level: number) => void;
  lang: Lang;
}) {
  const t = COPY[lang];
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10.5px] font-semibold whitespace-nowrap" style={{ color: INK_FAINT }}>{t.priceRangeLabel}</span>
      <div className="flex rounded-xl p-0.5 gap-0.5" style={{ background: 'rgba(43,38,34,0.06)', border: BORDER }}>
        {[1, 2, 3, 4].map((level) => {
          const on = viewLevel === level;
          const isBudget = level === budgetCeiling;
          return (
            <button
              key={level}
              onClick={() => onSelect(level)}
              title={tierName(level, t)}
              className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all"
              style={{
                background: on ? ACCENT : 'transparent',
                color: on ? '#fff' : INK,
                boxShadow: on ? '0 2px 8px -3px rgba(184,85,46,0.6)' : undefined,
              }}
            >
              <PriceTierPips level={level} active={on} />
              <span className="hidden sm:inline">{tierName(level, t)}</span>
              {isBudget && (
                <span
                  className="text-[8.5px] font-bold px-1 py-px rounded-full leading-none"
                  style={{ background: on ? 'rgba(255,255,255,0.28)' : TERRA_SOFT, color: on ? '#fff' : ACCENT_DEEP }}
                >
                  {t.yourBudgetTag}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Four pips, filled up to `level` — a clean, language-neutral price indicator. */
function PriceTierPips({ level, active = true }: { level: number; active?: boolean }) {
  return (
    <span className="inline-flex items-center gap-[3px]" dir="ltr" aria-label={`price level ${level}`}>
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            width: 6, height: 6,
            background: i <= level ? (active ? '#fff' : ACCENT) : 'currentColor',
            opacity: i <= level ? 1 : 0.28,
          }}
        />
      ))}
    </span>
  );
}

/** Price range rendered left-to-right so currency + numbers never flip in RTL. */
function PriceRange({ value, className, style }: { value: string; className?: string; style?: React.CSSProperties }) {
  return <span dir="ltr" className={className} style={style}>{value}</span>;
}

/** A Google Maps deep link for a place — by place_id when we have it (most
 *  accurate), else by raw coordinates. No API key needed for this URL form. */
function googleMapsUrl(r: { googlePlaceId?: string | null; name: string; latitude?: number | null; longitude?: number | null }): string | null {
  if (r.googlePlaceId) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.name)}&query_place_id=${encodeURIComponent(r.googlePlaceId)}`;
  }
  if (typeof r.latitude === 'number' && typeof r.longitude === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${r.latitude},${r.longitude}`;
  }
  return null;
}

/** Short localized date for the "book by" chip, e.g. "Aug 27" / "27 באוג׳". */
function formatBookByDate(iso: string, lang: Lang): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { month: 'short', day: 'numeric' });
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
        {/* Price badge — the literal price range when we have it (what a
            traveler actually reads as "expensive"), pips only as a fallback
            when we don't — showing both at once let a ¥1,000–2,000 ramen
            counter carry the same dots as a splurge tasting menu. */}
        {(r.priceRange || r.priceLevel) && (
          <div
            className="absolute top-2.5 right-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg text-[12px] font-bold"
            style={{ background: 'rgba(255,255,255,0.92)', color: ACCENT_DEEP }}
          >
            {r.priceRange ? <PriceRange value={r.priceRange} /> : <PriceTierPips level={r.priceLevel!} active={false} />}
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
          {(r.cuisineStyle || r.neighborhood || r.cuisineGenre) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {(r.cuisineStyle || genreLabel(r.cuisineGenre, lang)) && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
                >
                  {r.cuisineStyle ?? genreLabel(r.cuisineGenre, lang)}
                </span>
              )}
              {r.neighborhood && (
                <span className="text-[11.5px]" style={{ color: INK_FAINT }}>📍 {r.neighborhood}</span>
              )}
            </div>
          )}
        </div>

        {/* Dietary badges — scannable at a glance (Israeli calibration). */}
        {(r.kosherStatus === 'certified' || r.kosherStatus === 'kosher-style' || r.vegetarianFriendly || r.veganFriendly) && (
          <div className="flex flex-wrap gap-1.5">
            {r.kosherStatus === 'certified' && <DietaryBadge label={`✡️ ${t.badgeKosher}`} tone="kosher" />}
            {r.kosherStatus === 'kosher-style' && <DietaryBadge label={`✡️ ${t.badgeKosherStyle}`} tone="kosherStyle" />}
            {r.veganFriendly ? <DietaryBadge label={`🌱 ${t.badgeVegan}`} tone="veg" />
              : r.vegetarianFriendly && <DietaryBadge label={`🥗 ${t.badgeVeg}`} tone="veg" />}
          </div>
        )}

        {/* Why this pick fits the trip — top reason only (was up to 3). */}
        {r.fitReasons && r.fitReasons.length > 0 && (
          <span
            className="self-start inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold"
            style={{ background: PAPER_SUNK, color: INK_MUT }}
          >
            ✓ {r.fitReasons[0]}
          </span>
        )}

        {r.description && (
          <p className="text-[12.5px] leading-relaxed line-clamp-2" style={{ color: INK_MUT }}>{r.description}</p>
        )}

        {r.signatureDish && (
          <p className="text-[12px]" style={{ color: INK }}>
            <span style={{ color: ACCENT_DEEP, fontWeight: 700 }}>🍴 {t.mustOrder}: </span>
            {r.signatureDish}
          </p>
        )}

        {/* One booking-urgency signal, not three: a concrete "book by" date
            beats the qualitative lead-time phrase, which beats the free-text
            urgency blurb — showing more than one said the same thing twice. */}
        {r.bookByDate ? (
          <span
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
            style={{ background: '#8f4220', color: '#fff' }}
          >
            ⏳ {t.bookByLabel(formatBookByDate(r.bookByDate, lang))}
          </span>
        ) : r.bookingLeadTime ? (
          <span
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
            style={{ background: PAPER_SUNK, color: ACCENT_DEEP }}
          >
            ⏳ {t.bookAhead}: {r.bookingLeadTime}
          </span>
        ) : r.bookingUrgency ? (
          <div
            className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug"
            style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
          >
            <span>⚡</span>
            <span>{r.bookingUrgency}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-2 flex-wrap mt-auto pt-1">
          <button
            onClick={onAdd}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold min-w-[45%]"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {t.add}
          </button>
          {(r.platform?.url || r.reservationUrl) && (
            <a
              href={r.platform?.url ?? r.reservationUrl ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={r.platform?.ctaLabel ?? t.book}
              onClick={() => trackReservationCtaClick(r.platform?.name)}
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold whitespace-nowrap"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              {r.platform?.ctaLabel ?? t.book} ↗
            </a>
          )}
          {googleMapsUrl(r) && (
            <a
              href={googleMapsUrl(r)!}
              target="_blank"
              rel="noopener noreferrer"
              title={t.viewOnMaps}
              aria-label={t.viewOnMaps}
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              🗺️
            </a>
          )}
          {r.websiteUrl && (
            <a
              href={r.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={t.viewMenu}
              aria-label={t.viewMenu}
              className="py-2.5 px-3 rounded-xl text-[13px] font-semibold"
              style={{ background: 'rgba(255,255,255,0.7)', border: BORDER, color: INK }}
            >
              🌐
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
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
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
            <PriceRange value={a.priceRange} />
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

        {a.bookingLeadTime && (
          <span
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
            style={{ background: PAPER_SUNK, color: ACCENT_DEEP }}
          >
            ⏳ {t.bookAhead}: {a.bookingLeadTime}
          </span>
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

// ─── Walk-In attractions feature (Engine B) ───────────────────────────────────

function WalkInPanel({ destination, days, lang, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'error'>('idle');
  const [places, setPlaces] = useState<AttractionRecommendation[]>([]);
  const [picked, setPicked] = useState<AttractionRecommendation | null>(null);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;

    setStatus('loading');
    try {
      const res = await fetch(`/api/attractions?city=${encodeURIComponent(city)}&lang=${lang}&engine=walk_in`);
      const data = (await res.json()) as { attractions?: AttractionRecommendation[]; stale?: boolean };
      if (data.attractions && data.attractions.length > 0) {
        setPlaces(data.attractions);
        setStatus('ready');
        if (data.stale) backgroundRevalidate('/api/attractions/scout', { city, lang, engine: 'walk_in' }, accessToken);
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/attractions/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang, engine: 'walk_in' }),
      });
      const scoutData = (await scoutRes.json()) as { attractions?: AttractionRecommendation[] };
      if (scoutData.attractions && scoutData.attractions.length > 0) {
        setPlaces(scoutData.attractions);
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
          {status === 'scouting' ? t.scoutingWalkin(destination) : t.loading}
        </span>
      </div>
    );
  }

  if (status === 'error' || places.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>
          {accessToken ? t.walkinError(destination) : t.signIn}
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
          await onLockReservation(dayIndex, walkInToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  return (
    <div>
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
        {t.walkinIntro(destination)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {places.map((p, i) => (
          <WalkInCard key={p.id ?? `${p.name}-${i}`} p={p} lang={lang} onAdd={() => setPicked(p)} />
        ))}
      </div>
    </div>
  );
}

function WalkInCard({ p, lang, onAdd }: { p: AttractionRecommendation; lang: Lang; onAdd: () => void }) {
  const t = COPY[lang];
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: CARD_BG, border: BORDER, boxShadow: '0 6px 20px -12px rgba(43,38,34,0.25)' }}
    >
      {/* Photo */}
      <div className="relative h-36 w-full" style={{ background: PAPER_SUNK }}>
        {p.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.photoUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl" style={{ opacity: 0.5 }}>🚶</div>
        )}
        {typeof p.rating === 'number' && (
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: INK }}
          >
            <span style={{ color: STAR_ON }}>★</span>
            {p.rating.toFixed(1)}
            {p.ratingCount ? <span style={{ color: INK_FAINT }}>· {p.ratingCount.toLocaleString()}</span> : null}
          </div>
        )}
        {p.isFree != null && (
          <div
            className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg text-[11px] font-bold"
            style={{ background: 'rgba(255,255,255,0.92)', color: p.isFree ? '#1f7a4d' : ACCENT_DEEP }}
          >
            {p.isFree ? `🆓 ${t.freeEntry}` : `💳 ${t.payAtDoor}`}
          </div>
        )}
        {p.highlight && (
          <div
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
            style={{ background: 'linear-gradient(90deg, rgba(184,85,46,0.96), rgba(143,66,32,0.96))', color: '#fff' }}
          >
            <span>✨</span>
            <span className="truncate">{p.highlight}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{p.name}</p>
          {(p.category || p.neighborhood) && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {p.category && (
                <span
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                  style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
                >
                  {p.category}
                </span>
              )}
              {p.neighborhood && (
                <span className="text-[11.5px]" style={{ color: INK_FAINT }}>📍 {p.neighborhood}</span>
              )}
            </div>
          )}
        </div>

        {p.description && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: INK_MUT }}>{p.description}</p>
        )}

        {p.bestTimeOfDay && (
          <span
            className="self-start inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
            style={{ background: PAPER_SUNK, color: ACCENT_DEEP }}
          >
            🕐 {t.bestTime}: {p.bestTimeOfDay}
          </span>
        )}

        {p.timeNeeded && (
          <span className="text-[11.5px]" style={{ color: INK_FAINT }}>⏱️ {t.timeNeeded}: {p.timeNeeded}</span>
        )}

        <div className="flex items-center gap-2 mt-auto pt-1">
          <button
            onClick={onAdd}
            className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold"
            style={{ background: ACCENT, color: '#fff' }}
          >
            {t.add}
          </button>
        </div>
      </div>
    </div>
  );
}

function walkInToActivity(p: AttractionRecommendation, lockedTime: string): Activity {
  return {
    name: p.name,
    description: p.description ?? `Walk-in visit at ${p.name}`,
    neighborhood: p.neighborhood ?? undefined,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    website_url: p.websiteUrl ?? undefined,
    google_place_id: p.googlePlaceId ?? undefined,
    inventory_source_table: 'places',
    latitude: p.latitude ?? undefined,
    longitude: p.longitude ?? undefined,
    category_emoji: '🚶',
    tags: ['attraction', 'walk-in'],
    duration: p.timeNeeded ?? undefined,
  };
}

// ─── Only-Here hidden gems feature (Engine C) ─────────────────────────────────

function OnlyHerePanel({ destination, days, lang, groupType, accessToken, onLockReservation, recalculateDayLoading }: SmartToolbarProps) {
  const t = COPY[lang];
  const [status, setStatus] = useState<'idle' | 'loading' | 'scouting' | 'ready' | 'error'>('idle');
  const [gems, setGems] = useState<AttractionRecommendation[]>([]);
  const [picked, setPicked] = useState<AttractionRecommendation | null>(null);

  const load = useCallback(async () => {
    const city = destination.trim();
    if (!city) return;

    setStatus('loading');
    try {
      const res = await fetch(`/api/attractions?city=${encodeURIComponent(city)}&lang=${lang}&engine=only_here`);
      const data = (await res.json()) as { attractions?: AttractionRecommendation[]; stale?: boolean };
      if (data.attractions && data.attractions.length > 0) {
        setGems(data.attractions);
        setStatus('ready');
        if (data.stale) backgroundRevalidate('/api/attractions/scout', { city, lang, engine: 'only_here' }, accessToken);
        return;
      }
      if (!accessToken) { setStatus('error'); return; }

      setStatus('scouting');
      const scoutRes = await fetch('/api/attractions/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ city, lang, engine: 'only_here' }),
      });
      const scoutData = (await scoutRes.json()) as { attractions?: AttractionRecommendation[] };
      if (scoutData.attractions && scoutData.attractions.length > 0) {
        setGems(scoutData.attractions);
        setStatus('ready');
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }, [destination, accessToken, lang]);

  useEffect(() => { if (status === 'idle') void load(); }, [status, load]);

  // Deprioritize (not remove) picks that clash with the trip's group — a
  // hidden gem that clashes with a family trip shouldn't top the list (§C.2).
  const personalized = useMemo(() => personalizeOnlyHere(gems, groupType), [gems, groupType]);

  if (status === 'loading' || status === 'scouting') {
    return (
      <div className="flex items-center gap-3 py-10 justify-center">
        <Spinner />
        <span className="text-[13px]" style={{ color: INK_MUT }}>
          {status === 'scouting' ? t.scoutingOnlyHere(destination) : t.loading}
        </span>
      </div>
    );
  }

  if (status === 'error' || gems.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-[13px] mb-3" style={{ color: INK_MUT }}>
          {accessToken ? t.onlyHereError(destination) : t.signIn}
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
        defaultTime="11:00"
        onCancel={() => setPicked(null)}
        onConfirm={async (dayIndex, lockedTime) => {
          await onLockReservation(dayIndex, onlyHereToActivity(picked, lockedTime));
          setPicked(null);
        }}
      />
    );
  }

  return (
    <div>
      <p className="text-[15px] font-bold mb-1 mx-1" style={{ color: INK }}>
        💎 {t.onlyHereTitle(destination)}
      </p>
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
        {t.onlyHereIntro(destination)}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {personalized.map((g, i) => (
          <OnlyHereCard key={g.id ?? `${g.name}-${i}`} g={g} lang={lang} onAdd={() => setPicked(g)} />
        ))}
      </div>
    </div>
  );
}

function OnlyHereCard({ g, lang, onAdd }: { g: AttractionRecommendation; lang: Lang; onAdd: () => void }) {
  const t = COPY[lang];
  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: CARD_BG, border: '1px solid rgba(184,85,46,0.22)', boxShadow: '0 8px 26px -12px rgba(184,85,46,0.35)' }}
    >
      {/* Photo */}
      <div className="relative h-36 w-full" style={{ background: PAPER_SUNK }}>
        {g.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={g.photoUrl} alt={g.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-3xl" style={{ opacity: 0.5 }}>💎</div>
        )}
        {typeof g.rating === 'number' && (
          <div
            className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-lg text-[11.5px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: INK }}
          >
            <span style={{ color: STAR_ON }}>★</span>
            {g.rating.toFixed(1)}
          </div>
        )}
        {/* hookLine — the "wait, I can do THAT here?" line, always visible */}
        {g.hookLine && (
          <div
            className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold"
            style={{ background: 'linear-gradient(90deg, rgba(184,85,46,0.96), rgba(143,66,32,0.96))', color: '#fff' }}
          >
            <span>💎</span>
            <span className="truncate">{g.hookLine}</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-3.5 flex flex-col gap-2 flex-1">
        <div>
          <p className="text-[15px] font-bold leading-tight" style={{ color: INK }}>{g.name}</p>
          {g.neighborhood && (
            <span className="text-[11.5px] mt-1.5 block" style={{ color: INK_FAINT }}>📍 {g.neighborhood}</span>
          )}
        </div>

        {g.description && (
          <p className="text-[12.5px] leading-relaxed" style={{ color: INK_MUT }}>{g.description}</p>
        )}

        {g.whyOnlyHere && (
          <p className="text-[12px]" style={{ color: INK }}>
            <span style={{ color: ACCENT_DEEP, fontWeight: 700 }}>✨ {t.whyOnlyHere}: </span>
            {g.whyOnlyHere}
          </p>
        )}

        {g.howToDoIt && (
          <div
            className="flex items-start gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] leading-snug"
            style={{ background: TERRA_SOFT, color: ACCENT_DEEP }}
          >
            <span>📌</span>
            <span>{g.howToDoIt}</span>
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
        </div>
      </div>
    </div>
  );
}

function onlyHereToActivity(g: AttractionRecommendation, lockedTime: string): Activity {
  return {
    name: g.name,
    description: g.description ?? `A local experience unique to this city: ${g.name}`,
    neighborhood: g.neighborhood ?? undefined,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    website_url: g.websiteUrl ?? undefined,
    google_place_id: g.googlePlaceId ?? undefined,
    inventory_source_table: 'places',
    estimatedCost: g.priceRange ?? undefined,
    latitude: g.latitude ?? undefined,
    longitude: g.longitude ?? undefined,
    category_emoji: '💎',
    tags: ['attraction', 'only-here'],
  };
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
      <p className="text-[13.5px] leading-[1.65] font-medium mb-4 mx-1 max-w-[62ch]" style={{ color: INK_MUT }}>
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
              <PriceRange value={e.priceRange} className="text-[11.5px] font-semibold" style={{ color: ACCENT_DEEP }} />
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
    google_place_id: r.googlePlaceId ?? undefined,
    inventory_source_table: 'restaurants',
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
    google_place_id: a.googlePlaceId ?? undefined,
    inventory_source_table: 'places',
    estimatedCost: a.priceRange ?? undefined,
    latitude: a.latitude ?? undefined,
    longitude: a.longitude ?? undefined,
    category_emoji: '🎟️',
    tags: ['attraction', 'reservation'],
    duration: '2–3 hours',
  };
}

function landmarkToActivity(l: Landmark, lockedTime: string): Activity {
  return {
    name: l.name,
    description: l.description ?? `Visit ${l.name}`,
    isFixed: true,
    lockedTime,
    startTime: lockedTime,
    google_place_id: l.google_place_id ?? undefined,
    inventory_source_table: 'places',
    category_emoji: l.category_emoji ?? '📍',
    tags: ['attraction'],
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
