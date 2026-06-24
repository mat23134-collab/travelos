/**
 * stepCopy — dynamic headline + sub line for each onboarding wizard step.
 * Pure function over a snapshot of the store; total fallbacks mean it can
 * never throw or return empty strings, regardless of how little the user
 * has answered.
 *
 * Bilingual (en/he). The chosen trip language localizes all chrome; the only
 * thing kept verbatim is the city name (an official place name, never translated).
 */
import type { TripLanguage } from './types';

export interface StepCopyState {
  cityName:  string | null;
  nights:    number | null;
  groupType: string | null;
}

export interface StepCopy {
  headline: string;
  sub:      string;
}

const NIGHT_WORDS = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
];

/** "Five nights" up to twelve, "13 nights" beyond (en); "5 לילות" / "לילה אחד" (he). */
export function spellNights(n: number, lang: TripLanguage = 'en'): string {
  if (lang === 'he') return n === 1 ? 'לילה אחד' : `${n} לילות`;
  const word = n >= 1 && n <= 12 ? NIGHT_WORDS[n] : String(n);
  return `${word} ${n === 1 ? 'night' : 'nights'}`;
}

export function getStepCopy(step: number, s: StepCopyState, lang: TripLanguage = 'en'): StepCopy {
  const city = s.cityName?.trim() || null;
  const he = lang === 'he';

  switch (step) {
    case 0:
      return he
        ? { headline: 'לאן?', sub: 'בחרו מדינה, ואז את הערים שלכם.' }
        : { headline: 'Where to?', sub: 'Choose a country, then pick your cities.' };
    case 1:
      if (he) {
        return city
          ? { headline: `מתי ${city}?`, sub: 'בחרו את תאריכי הנסיעה.' }
          : { headline: 'מתי אתם נוסעים?', sub: 'בחרו את תאריכי הנסיעה.' };
      }
      return city
        ? { headline: `When does ${city} happen?`, sub: 'Pick your travel dates.' }
        : { headline: 'When are you traveling?',   sub: 'Pick your travel dates.' };
    case 2: {
      if (he) {
        const sub = 'התקציב מכייל כל המלצה; התחומים מטים את הבחירות.';
        if (city && s.nights) return { headline: `${spellNights(s.nights, 'he')} ב-${city} — מה התקציב?`, sub };
        if (city)             return { headline: `${city} — מה התקציב?`, sub };
        return { headline: 'מה התקציב?', sub };
      }
      const sub = 'Budget calibrates every recommendation; interests bias the picks.';
      if (city && s.nights) return { headline: `${spellNights(s.nights)} in ${city} — what's the budget?`, sub };
      if (city)             return { headline: `${city} — what's the budget?`, sub };
      return { headline: "What's the budget?", sub };
    }
    case 3: {
      if (he) {
        const sub = 'כמה שאלות שקטות שיעצבו את המסעדות, הקצב והמקומות שנבחר.';
        return city
          ? { headline: `באיזה קצב לטייל ב-${city}?`, sub }
          : { headline: 'איך אתם מטיילים?', sub };
      }
      const sub = 'A few quiet questions to shape the restaurants, pace, and venues we choose.';
      return city
        ? { headline: `How fast do you want ${city} to move?`, sub }
        : { headline: 'How do you travel?', sub };
    }
    case 4: {
      if (he) {
        const sub = 'כבר הזמנתם, או שנמצא את השכונה הנכונה?';
        return city
          ? { headline: `איפה תישנו ב-${city}?`, sub }
          : { headline: 'איפה תתאכסנו?', sub };
      }
      const sub = 'Booked already, or shall we find the right neighborhood?';
      return city
        ? { headline: `Where will you sleep in ${city}?`, sub }
        : { headline: 'Where will you stay?', sub };
    }
    case 5: {
      if (he) {
        const sub = 'מגבלות תזונה שכדאי לכבד. אופציונלי — אפשר לדלג.';
        return city
          ? { headline: `אוכלים את ${city} — יש כללים?`, sub }
          : { headline: 'יש מגבלות תזונה?', sub };
      }
      const sub = 'Dietary needs we should respect. Optional — skip freely.';
      return city
        ? { headline: `Eating your way through ${city} — any rules?`, sub }
        : { headline: 'Any dining rules?', sub };
    }
    case 6: {
      if (he) {
        const sub = 'המלצות נבחרות והמקומות שאסור לפספס.';
        return city
          ? { headline: `נגיעה אחרונה — מה אסור לפספס ב-${city}?`, sub }
          : { headline: 'נגיעה אחרונה', sub };
      }
      const sub = 'Hand-picked recommendations and your must-sees.';
      return city
        ? { headline: `Last touch — what can't you miss in ${city}?`, sub }
        : { headline: 'Last touch', sub };
    }
    default:
      return he
        ? { headline: 'כמעט שם', sub: 'עוד קצת.' }
        : { headline: 'Almost there', sub: 'Just a little more.' };
  }
}
