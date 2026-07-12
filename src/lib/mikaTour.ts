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

/**
 * Force the tour to run regardless of "seen"/armed state — add `?tour=1`
 * (or `?tour=replay`) to the URL. Lets us (and support) demo or re-test the
 * tour on any onboarding/results page without clearing storage.
 */
export function tourForced(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const t = new URLSearchParams(window.location.search).get('tour');
    return t === '1' || t === 'replay';
  } catch { return false; }
}

export const TOUR_COPY: Record<TourLang, {
  name: string;
  next: string;
  gotIt: string;
  start: string;
  destination: string;
  travelDetails: string;
  interests: string;
  vibe: string;
  hotel: string;
  dining: string;
  topsights: string;
  notescan: string;
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
    travelDetails:
      'טיפ קטן: פִּתחו את "פרטי טיסה" ומלאו שעת נחיתה ושעת המראה. ככה לא אתכנן לכם אטרקציות בזמן שאתם עוד בשדה התעופה — היום הראשון והאחרון ייתפרו סביב הטיסה.',
    interests:
      'כאן שני דברים: תקציב יומי (בלי טיסות), ומה מדליק אתכם — תרבות, אוכל, טבע, קניות... לפי הבחירות אני יודעת מה להדגיש ומה לדלג. הכל אופציונלי.',
    vibe:
      'ספרו לי על וייב הטיול – זוג, משפחה או חבורה – ובהמשך גם על הקצב: רגוע עם עצירות ספורות, מאוזן, או אינטנסיבי. לפי זה אקבע כמה לדחוס לכל יום ואבנה לכם את ה-Winning Picks המדויקים.',
    hotel:
      'זה שלב המלון. ספרו לי איפה אתם ישנים – או תנו לי להמליץ – ואשתמש בו כבסיס: כל יום יתחיל ויסתיים ליד המלון שלכם, בלי לרוץ מצד לצד של העיר.',
    dining:
      'יש לכם כללי אוכל? צמחוני, טבעוני, כשר, חלאל, ללא גלוטן או ללא לקטוז — סמנו, ואוודא שכל המסעדות וההמלצות מתאימות. אפשר גם לדלג.',
    topsights:
      'הקוביות האלה הן האטרקציות המובחרות של היעד. הקישו על כל אחת שבא לכם, ואשלב אותה במסלול. אפשר גם פשוט לדלג ולתת ל-AI לבחור בשבילכם.',
    notescan:
      'וטריק שאני אוהבת: כבר יש לכם רשימה משלכם? צלמו אותה — צילום מסך, פתק בכתב יד, כל דבר — ואני אסרוק, אחלץ את המקומות, ואשזור את מה שמתאים לתוך המסלול.',
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
    travelDetails:
      'Quick tip: open “Travel details” and set your landing and take-off times. Then I won’t plan anything while you’re still at the airport — your first and last days flex around the flight.',
    interests:
      'Two things here: your daily budget (excl. flights), and what lights you up — culture, food, nature, shopping… I use these to know what to feature and what to skip. All optional.',
    vibe:
      'Tell me the vibe of your trip — couple, family or group — and then the pace: relaxed with a few stops, balanced, or packed. That’s how I decide how much to fit into each day and build your precise Winning Picks.',
    hotel:
      'This is the hotel step. Tell me where you’re staying — or let me recommend — and I’ll use it as your base: every day starts and ends near your hotel, no criss-crossing the city.',
    dining:
      'Any food rules? Vegetarian, vegan, kosher, halal, gluten- or dairy-free — mark them and I’ll make sure every restaurant and rec fits. Feel free to skip.',
    topsights:
      'These tiles are the destination’s top sights. Tap any you love and I’ll weave it into your plan. Or just skip and let the AI choose for you.',
    notescan:
      'A trick I love: already have your own list? Snap a photo — a screenshot, a handwritten note, anything — and I’ll scan it, pull out the places, and weave the ones that fit into your plan.',
    daysMap:
      'Wow, look at that! Your trip is ready. Here’s your smart day-by-day plan, and the interactive route is already drawn live on the map!',
    sidePanel:
      'Need to change something? Open the hidden management side-toolbar to set your hotel as the trip base, save documents, or swap attractions in a click.',
  },
};
