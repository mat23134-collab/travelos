/**
 * onboardingUi — bilingual (en/he) chrome strings for the onboarding wizard,
 * mirroring the pattern of `tripUiCopy.ts` (itineraryUi). Place names are never
 * routed through here — they stay verbatim.
 */
import type { TripLanguage } from './types';

export function onboardingUi(lang: TripLanguage) {
  const he = lang === 'he';
  return {
    lang,
    dir: he ? ('rtl' as const) : ('ltr' as const),

    // ── Footer / nav ──────────────────────────────────────────────
    back: he ? 'חזרה' : 'Back',
    continue: he ? 'המשך' : 'Continue',
    skip: he ? 'דלג' : 'Skip',

    // ── Step CTA / validation labels (page.tsx stepState) ─────────
    pickCountry:        he ? 'בחרו מדינה' : 'Pick a country',
    singleOrMulti:      he ? 'עיר אחת או כמה?' : 'Single or multi-city?',
    selectCity:         he ? 'בחרו לפחות עיר אחת' : 'Select at least one city',
    planCityTour:       (n: number) => he ? `תכננו סיור ב-${n} ערים →` : `Plan ${n}-city tour →`,
    planTrip:           (name: string) => he ? `תכננו את ${name} →` : `Plan ${name} →`,

    pickDates:          he ? 'בחרו תאריכי נסיעה' : 'Pick your travel dates',
    nightsContinue:     (n: number) => he ? `${n} לילות · המשך →` : `${n} nights · Continue →`,
    continueArrow:      he ? 'המשך →' : 'Continue →',

    pickBudget:         he ? 'בחרו רמת תקציב' : 'Pick a budget level',
    nextTravelStyle:    he ? 'הבא: סגנון טיול →' : 'Next: travel style →',

    whoComing:          he ? 'מי מגיע?' : "Who's coming?",
    addAdult:           he ? 'הוסיפו לפחות מבוגר אחד' : 'Add at least one adult',
    pickGroupSize:      he ? 'בחרו את גודל הקבוצה' : 'Pick your group size',
    pickStyle:          he ? 'בחרו סגנון טיול' : 'Pick your style of travel',
    choosePace:         he ? 'בחרו קצב' : 'Choose your pace',

    nextDiningRules:    he ? 'הבא: כללי אוכל →' : 'Next: dining rules →',
    pickLocationPref:   he ? 'בחרו העדפת מיקום' : 'Pick your location preference',
    pickNightlyBudget:  he ? 'בחרו תקציב ללילה' : 'Pick nightly budget',
    selectOrSkip:       he ? 'בחרו אפשרות או דלגו' : 'Select an option or skip',

    nextRecommendations: he ? 'הבא: ההמלצות שלנו →' : 'Next: our recommendations →',

    skipGenerate:       he ? 'דלגו וצרו' : 'Skip & generate',
    generateWithPicks:  (n: number) =>
      he
        ? (n === 1 ? 'צרו עם בחירה אחת' : `צרו עם ${n} בחירות`)
        : (n === 1 ? 'Generate with 1 pick' : `Generate with ${n} picks`),
  };
}

export type OnboardingUi = ReturnType<typeof onboardingUi>;
