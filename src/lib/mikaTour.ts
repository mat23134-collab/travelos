/**
 * mikaTour — state + copy for Mika's guided product tour.
 *
 * The tour spans two routes:
 *   Phase 1 (wizard, /onboarding): two contextual spotlights — the destination
 *     input (wizard step 0) and the vibe archetypes (wizard step 3).
 *   Phase 2 (results, /itinerary/[id]): a linear 2-step tour — the daily plan +
 *     map, then the hidden side-panel trigger.
 *
 * Cross-route handoff is done through localStorage: when the user fires
 * generation from onboarding we "arm" the results tour, and the itinerary page
 * runs Phase 2 automatically once the trip has loaded, then disarms itself.
 * Each tip is also marked "seen" so it never repeats. All access is wrapped so
 * private-mode / SSR never throws.
 */

export type TourLang = 'he' | 'en';

const SEEN_PREFIX  = 'sarto_tour_seen_';
const RESULTS_ARM  = 'sarto_tour_results_armed';

export function hasSeenTip(id: string): boolean {
  try { return localStorage.getItem(SEEN_PREFIX + id) === '1'; } catch { return false; }
}
export function markTipSeen(id: string): void {
  try { localStorage.setItem(SEEN_PREFIX + id, '1'); } catch { /* ignore */ }
}

/** Called when generation starts in onboarding — Phase 2 will run on results. */
export function armResultsTour(): void {
  try { localStorage.setItem(RESULTS_ARM, '1'); } catch { /* ignore */ }
}
export function isResultsTourArmed(): boolean {
  try { return localStorage.getItem(RESULTS_ARM) === '1'; } catch { return false; }
}
export function disarmResultsTour(): void {
  try { localStorage.removeItem(RESULTS_ARM); } catch { /* ignore */ }
}

export const TOUR_COPY: Record<TourLang, {
  name: string;
  next: string;
  gotIt: string;
  start: string;
  destination: string;
  vibe: string;
  daysMap: string;
  sidePanel: string;
}> = {
  he: {
    name: 'מיקה',
    next: 'הבא',
    gotIt: 'הבנתי!',
    start: 'יאללה, בואו נתחיל',
    destination:
      'היי! אני מיקה, עוזרת הטיולים האישית שלכם. בואו נתחיל את ההרפתקה! פשוט הקלידו כאן את היעד הבא שלכם.',
    vibe:
      'כאן תוכלו לספר לי על וייב הטיול שלכם – משפחה, רומנטי, או אקשן. ה-AI שלנו יתחשב בהכל כדי לבנות לכם את ה-Winning Picks הכי מדויקים.',
    daysMap:
      'וואו, תראו את זה! המסלול שלכם מוכן. כאן מפורט לו״ז יומי חכם, והמסלול האינטראקטיבי כבר נמתח בלייב על המפה!',
    sidePanel:
      'צריכים לעדכן משהו? פתחו את סייד-טולבר הניהול הנסתר כדי לקבע את המלון שלכם כבסיס לטיול, לשמור מסמכים, או להחליף אטרקציות בקליק.',
  },
  en: {
    name: 'Mika',
    next: 'Next',
    gotIt: 'Got it!',
    start: 'Let’s go',
    destination:
      'Hi! I’m Mika, your personal travel assistant. Let’s start the adventure — just type your next destination right here.',
    vibe:
      'Tell me the vibe of your trip here — family, romantic, or action. Our AI weighs it all to build you the most precise Winning Picks.',
    daysMap:
      'Wow, look at that! Your trip is ready. Here’s your smart day-by-day plan, and the interactive route is already drawn live on the map!',
    sidePanel:
      'Need to change something? Open the hidden management side-toolbar to set your hotel as the trip base, save documents, or swap attractions in a click.',
  },
};
