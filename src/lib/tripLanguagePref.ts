import type { TripLanguage } from './types';

/** Session key: chosen on the home page before onboarding / plan. */
export const TRIP_LANGUAGE_PREF_KEY = 'travelos_trip_language_pref';

export function persistTripLanguagePref(lang: TripLanguage): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TRIP_LANGUAGE_PREF_KEY, lang);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readTripLanguagePref(): TripLanguage | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = sessionStorage.getItem(TRIP_LANGUAGE_PREF_KEY);
    if (v === 'he' || v === 'en') return v;
  } catch {
    /* ignore */
  }
  return null;
}
