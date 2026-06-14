import type { GroupType, TravelerProfile } from '@/lib/types';

export type TripUiLang = 'en' | 'he';

const AUDIENCE_TITLE_HE: Record<GroupType, string> = {
  solo: 'סולו',
  couple: 'זוג',
  family: 'משפחה',
  group: 'חבורה',
};

const AUDIENCE_TARGET_HE: Record<GroupType, string> = {
  solo: 'אתה',
  couple: 'הזוג שלכם',
  family: 'המשפחה שלכם',
  group: 'החבורה שלכם',
};

/** Chrome copy for itinerary + draft views (English / Hebrew). */
export function itineraryUi(lang: TripUiLang) {
  const he = lang === 'he';

  return {
    lang,
    dir: he ? ('rtl' as const) : ('ltr' as const),
    htmlLang: he ? 'he' : 'en',

    audienceTitle(g?: GroupType | null) {
      if (!g) return he ? 'חבורה' : 'Squad';
      return he ? (AUDIENCE_TITLE_HE[g] ?? 'חבורה') : ({ solo: 'Solo', couple: 'Couple', family: 'Family', group: 'Squad' }[g]);
    },
    audienceTarget(g?: GroupType | null) {
      if (!g) return he ? 'החבורה שלכם' : 'your squad';
      return he ? (AUDIENCE_TARGET_HE[g] ?? 'החבורה שלכם') : ({ solo: 'you', couple: 'your couple', family: 'your family', group: 'your squad' }[g]);
    },

    newTrip: he ? 'טיול חדש' : 'New trip',
    draft: he ? '← טיוטה' : '← Draft',
    scoutPicks: he ? 'בחירות סקאוט 💎' : 'Scout Picks 💎',
    heroAiBadge: he ? 'נבנה ב-AI · מודיעין חי' : `AI-Crafted · ${new Date().getFullYear()} Live Intel`,
    tripIntel: he ? 'מודיעין טיול' : 'Trip Intelligence',
    tripIntelSub: he ? 'איך נבנה המסלול שלכם' : 'How your itinerary was built',
    tripIntelFooter(n: number) {
      return he
        ? `ה-AI חצה ${n} מקורות אינטרנט כדי לסנן מלכודות תיירים ולסמן מידע סותר.`
        : `AI cross-referenced ${n} live web sources to surface the best spots, filter traps, and flag conflicting info.`;
    },
    masterPlanLabel: (audience: string) =>
      he ? `איך זה נשמע בשבילכם — ${audience}` : `How we shaped this for ${audience}`,
    dayItineraryMeta: (days: string | number) => (he ? `מסלול ${days} ימים` : `${days}-day itinerary`),
    budgetDaily: he ? 'ממוצע יומי' : 'Daily Average',
    budgetTotal: he ? 'הערכת סה״כ' : 'Total Estimate',
    budgetIncludes: he ? 'כולל' : 'Includes',
    budgetDailyLine: (v: string) =>
      he ? `בערך ${v} ליום — כיסוי לרוב השיאים` : `Think about ${v} a day for most of the highlights`,
    budgetTotalLine: (v: string) =>
      he ? `סביבות ${v} על כל הטיול — תלוי בערבים ובקניות` : `Around ${v} all in — swings with nights out and shopping`,
    budgetIncludesLine: (text: string) =>
      he ? `בשורה הזו: ${text}` : `Usually covers: ${text}`,
    heroPersonalEyebrow: he ? 'הטיול שלכם' : 'Your trip',
    /** Trip summary hero — `username` is the app handle from `trips.username`. */
    tripSummaryWelcome: (username: string) =>
      he
        ? `מוכנים לדרך, ${username}?`
        : `Ready for your journey, ${username}?`,
    heroPersonalTagline: he
      ? 'תאריכים, קצב ושכונות — לפי מה שסיפקתם, לא לפי טבלת אקסל.'
      : 'Dates, pace, and neighborhoods — tuned to what you told us, not a spreadsheet.',
    tripMetaTeaser(p: Pick<TravelerProfile, 'groupType' | 'budget' | 'pace'>) {
      const label = he
        ? (AUDIENCE_TITLE_HE[p.groupType] ?? 'חבורה')
        : ({ solo: 'Solo', couple: 'Couple', family: 'Family', group: 'Squad' }[p.groupType]);
      return he
        ? `${label} · סביב ${p.budget} · קצב ${p.pace}`
        : `${label} · ${p.pace} pace · ~${p.budget} budget`;
    },
    routeSection: (audience: string) => (he ? `מסלול ${audience}` : `${audience} Route`),
    mapOpenMobile: he ? 'מפת מסלול' : 'Route Map',

    cityTransportTitle: he ? 'תחבורה בעיר' : 'Getting around',
    cityTransportSubtitle: (city: string) =>
      he ? `איך לזוז ב${city} — מחירים משוערים וקישורים לכרטיסים` : `How to move in ${city} — typical prices & ticket links`,
    cityTransportOptionsHeading: he ? 'אפשרויות' : 'Options',
    cityTransportLinksHeading: he ? 'קישורים לכרטיסים ומידע' : 'Tickets & official info',
    cityTransportPriceLabel: he ? 'מחיר משוער' : 'Typical cost',
    cityTransportFallbackTitle: he ? 'תחבורה ציבורית' : 'Public transport',
    cityTransportFallbackBody: (city: string) =>
      he
        ? `חיפוש מהיר לכרטיסים ומסלולים ב${city} — אחרי הטיול יתווספו כאן טיפים ספציפיים מהמערכת.`
        : `Quick links to plan routes and tickets in ${city}. New trips will include tailored tips here.`,
    cityTransportSearchTickets: he ? 'חיפוש כרטיסים וקווים' : 'Search tickets & routes',
    cityTransportOpenMapsTransit: he ? 'מסלולים בתחבורה ציבורית (מפות)' : 'Transit directions (Maps)',
    cityTransportDailyAvgLabel: he ? 'ממוצע ליום' : 'Daily (avg)',
    cityTransportTripTotalLabel: (n: number) =>
      he ? `לכל הטיול (~${n} ימים)` : `Full trip (~${n} days)`,
    cityTransportOptionSite: he ? 'אתר / כרטיסים' : 'Tickets / site',
    cityTransportGoogleRoutesDoc: he ? 'תיעוד Google Routes — תחבורה ציבורית' : 'Google Routes API — transit (docs)',
    cityTransportGoogleRoutesDocUrl:
      'https://developers.google.com/maps/documentation/routes/transit-route?hl=he',

    transportFareSingle: he ? 'נסיעה בודדת' : 'Single',
    transportFareDay: he ? 'כרטיס יום' : 'Day pass',
    transportFareWeek: he ? '7 ימים' : '7-day pass',
    transportScoutTipEyebrow: he ? 'טיפ Scout' : 'Scout tip',
    transportOfficialApp: he ? 'אפליקציה רשמית' : 'Official app',
    transportIos: 'iOS',
    transportAndroid: 'Android',
    transportSearchOfficialTickets: he ? 'חיפוש כרטיסים' : 'Search tickets',
    transportTransitToCity: he ? 'מסלולים בתחבורה ציבורית' : 'Transit directions',
    transportRoutesPreview: he ? 'תצוגת מסלול' : 'Routes preview',
    transportRoutesLoading: he ? 'מעריכים זמן…' : 'Estimating…',
    transportRoutesUnavailable: he ? 'לא זמין' : 'Unavailable',
    transportRoutesResult: (mins: string) =>
      he ? `בערך ${mins} בתחבורה ציבורית למרכז` : `~${mins} transit to city center`,
    transportLoadingCard: he ? 'טוענים מחירי תחבורה…' : 'Loading transport prices…',

    mapDistanceTool: he ? 'מדידת מרחק' : 'Distance tool',
    mapSelectMoreHint: (remaining: number) =>
      remaining >= 2
        ? he
          ? 'לחצו על שני סימונים במפה (יום / בסיס וכו׳).'
          : 'Tap two pins on the map (e.g. two days or base camp).'
        : he
          ? 'לחצו על סימון נוסף אחד.'
          : 'Tap one more pin.',
    mapComputingRoutes: he ? 'מחשבים מסלולי הליכה ונהיגה…' : 'Computing walking & driving routes…',
    mapBetween: he ? 'בין' : 'Between',
    mapDirect: he ? 'קו אוויר' : 'Direct',
    mapWalking: he ? 'הליכה' : 'Walking',
    mapDriving: he ? 'נהיגה' : 'Driving',
    mapNa: he ? 'לא זמין' : 'N/A',
    mapOpenGoogleTransit: he ? 'מסלול בתחבורה ציבורית (Google Maps)' : 'Transit route (Google Maps)',
    mapClearSelection: he ? 'נקה בחירה' : 'Clear selection',

    draftReviewTitle: he ? 'סקירת טיוטה' : 'Review Draft',
    draftInstructions: (swaps: number) =>
      he
        ? `לחצו ↻ החלפה על כל פעילות, ואז אשרו כשמוכנים.${swaps > 0 ? ` · ${swaps} החלפות בוצעו` : ''}`
        : `Tap ↻ Swap on any activity you don't like, then finalize when ready.${swaps > 0 ? ` · ${swaps} swap${swaps > 1 ? 's' : ''} made` : ''}`,
    looksGood: he ? 'נראה מעולה ✓' : 'Looks Good ✓',
    aiStrategy: he ? 'אסטרטגיית AI' : 'AI Strategy',
    finalizeItinerary: he ? 'סיום ואישור המסלול ←' : 'Finalize Itinerary →',
    finalizeHint: he ? 'אחרי האישור אפשר עדיין לערוך עם Quick Edit' : 'You can still edit activities after finalizing using Quick Edit',
    draftSwap: he ? 'החלפה' : 'Swap',
    draftSwapping: he ? 'מחליפים…' : 'Swapping…',
    draftSwapPlaceholder: he ? 'למשל "משהו בחוץ" או השאירו ריק' : 'e.g. "something outdoors" or just leave blank',
    draftGo: he ? 'בצע' : 'Go',
    packingTitle: (audience: string) => (he ? `רשימת ציוד — ${audience}` : `${audience} Packing List`),
    insiderIntel: he ? 'טיפים מקומיים' : 'Insider Intel',
    planNewTripButton: he ? 'לתכנן טיול חדש ✈️' : 'Plan a New Trip ✈️',
    mapFab: he ? 'מפה' : 'Map',
    footerPrompt: (g: GroupType | null | undefined) => {
      if (he) {
        if (g === 'solo') return 'יעד חדש? טיול סולו חדש?';
        if (g === 'couple') return 'יעד חדש? טיול זוגי חדש?';
        if (g === 'family') return 'יעד חדש? טיול משפחתי חדש?';
        return 'יעד חדש? טיול עם החבורה?';
      }
      if (g === 'solo') return 'New destination? New solo trip?';
      if (g === 'couple') return 'New destination? New couple trip?';
      if (g === 'family') return 'New destination? New family trip?';
      return 'New destination? New squad trip?';
    },

    basecampBadge: he ? '🛏 נקודת הלינה' : '🛏 Stay hub',
    basecampYour: he ? '🛏 הלינה שלכם' : '🛏 Where you’re staying',
    basecampPreBooked: he ? 'מוזמן מראש' : 'Pre-booked',
    basecampNeighborhoodStrategy: he ? 'אסטרטגיית שכונה' : 'Neighborhood Strategy',
    basecampApprovedPicks: (title: string) => (he ? `מומלצים לאישור ${title}` : `${title}-Approved Picks`),
    basecampWhereStay: (target: string) => (he ? `איפה כדאי ל-${target} להתאכסן?` : `Where should ${target} stay?`),
    basecampFooter: he
      ? 'מבוסס על התחומים שבחרתם, התקציב, ומיקום אופטימלי בשכונות.'
      : 'Based on your interests, budget, and optimal neighborhood positioning',

    aroundHotelBadge: he ? 'מסביב למלון' : 'Around your stay',
    aroundHotelTitle: he ? 'מדריך השכונה מהדלת' : 'Doorstep neighborhood field guide',
    aroundHotelSub: (hood: string) =>
      he
        ? `מיקוד: ${hood} — מה מרגישים, מה לעשות ברגל, ואיך לזוז מכאן`
        : `Focused on ${hood} — feel of the blocks, walkable wins, and how to move from here`,
    aroundHotelVibes: he ? 'וויבים בשכונה' : 'Block vibes',
    aroundHotelWalk: he ? 'מה עושים בקרבת המלון' : 'Walkable from your hotel',
    aroundHotelTransit: he ? 'תחבורה ציבורית קרובה' : 'Public transport nearby',
    aroundHotelSignature: he ? 'טיפ מגנטי' : 'Signature move',
    aroundHotelPerkChip: he ? 'בונוס למזמינים מראש' : 'Pre-booked perk',

    hotelCardHint: he ? 'לחצו למחירים, קישורים וביקורות' : 'Tap for rates, links & reviews',
    hotelNeighborhoodEdge: he ? 'יתרון השכונה' : 'Neighborhood Edge',
    hotelModalBadge: he ? '🏨 בחירת לינה' : '🏨 Stay pick',
    hotelOfficialSite: he ? 'לאתר המלון הרשמי ←' : 'Official hotel site →',
    hotelCompare: he ? 'השוואת מחירים וזמינות חיה ←' : 'Compare rates & live availability →',
    hotelReviews: he ? 'ביקורות (גוגל) ↗' : 'Read reviews (Google) ↗',
    hotelPriceBand: he ? 'טווח מחיר (לפי התאריכים שלכם)' : 'Price band (your dates)',
    hotelAvailability: he ? 'זמינות לתאריכי הטיול' : 'Availability for your dates',
    hotelYourDates: he ? 'התאריכים שלכם:' : 'Your dates:',
    hotelFitSummary: he ? 'למה המלון הזה בשבילכם' : 'Why this stay fits you',
    hotelOtaCompareTitle: he ? 'השוואת מחירים (אינדיקטיבי)' : 'Compare prices (indicative)',
    hotelOtaOpen: he ? 'פתיחה ↗' : 'Open ↗',
    hotelOtaPerNight: he ? 'לילה (הערכה)' : '/night (est.)',
    hotelOtaNoPrice: he ? 'בדקו חי באתר' : 'Check live on site',
    hotelStatusAvailable: he ? 'זמין' : 'Available',
    hotelStatusSoldOut: he ? 'SOLD OUT' : 'SOLD OUT',
    hotelNoAvailabilityDates: he ? 'אין זמינות בתאריכים שלכם' : 'No availability for your dates',
    hotelCheckAnyway: he ? 'לבדוק בכל זאת ↗' : 'Check anyway ↗',
    hotelDisclaimer: he
      ? 'הערכות המחיר אינדיקטיביות אלא אם יש אינטגרציה חיה להזמנות. קישורי הזמנה מציגים זמינות בזמן אמת אצל הספק.'
      : 'Price hints are indicative unless sourced from a live booking integration. Opening booking links shows real-time availability from the provider.',

    intelSources: he ? 'מקורות שנסרקו' : 'Sources scanned',
    intelGems: he ? 'פנינות נסתרות' : 'Hidden gems found',
    intelTraps: he ? 'מלכודות תיירים סוננו' : 'Tourist traps filtered',
    intelContradictions: he ? 'סתירות שסומנו' : 'Contradictions flagged',

    shareOpenButton: he ? 'שיתוף' : 'Share',
    sharePanelTitle(audience: string) {
      return he ? `לשתף את המסלול · ${audience}` : `Share this trip · ${audience}`;
    },
    shareWhatsApp: he ? 'וואטסאפ' : 'Send on WhatsApp',
    shareWhatsAppSub(g?: GroupType | null) {
      void g;
      return he ? 'הודעה מוכנה עם התאריכים והנקודות' : 'Pre-filled message with dates & stops';
    },
    shareCopyLinkCta(g?: GroupType | null) {
      if (he) {
        if (g === 'couple') return 'שתפו עם בן/בת הזוג';
        if (g === 'family') return 'לשלוח למשפחה (קישור)';
        if (g === 'solo') return 'לשמור אצלכם / לשלוח לחבר/ה';
        return 'לשתף עם החבורה';
      }
      if (g === 'couple') return 'Share with your partner';
      if (g === 'family') return 'Send the link to family';
      if (g === 'solo') return 'DM yourself the link';
      return 'Share with your crew';
    },
    shareCopyLinkSub: he
      ? 'מעתיקים את הקישור — הדביקו בוואטסאפ, הערות, או מייל'
      : 'Copies the link — paste into WhatsApp, notes, or email',
    shareLinkCopied: he ? 'הקישור הועתק!' : 'Link copied!',
    sharePdf: he ? 'גרסת PDF' : 'Download PDF',
    sharePdfSub: he ? 'נוח למטוס או בלי רשת' : 'Offline-friendly layout',
    shareCalendar: he ? 'הוספה ליומן' : 'Add to Calendar',
    shareCalendarSub: he ? 'אפל ו-Google Calendar (קובץ .ics)' : 'Apple Calendar & Google Calendar (.ics)',
    shareMaps: he ? 'ייצוא ל-Google Maps' : 'Export to Google Maps',
    shareMapsSub: he ? 'הורד .kml — ייבוא ב-mymaps.google.com' : 'Download .kml — import at mymaps.google.com',
    shareTravelOsTitle: he ? 'משתמשי TravelOS' : 'TravelOS users',
    shareTravelOsBody: he
      ? 'אפשר לשגר את השמירה לדשבורד של מישהו לפי שם משתמש — או להשתמש בקישור לכולם.'
      : 'Send this saved trip to someone’s dashboard by username — or use the link for anyone.',
    shareTravelOsHint: he
      ? 'שמרו קודם את הטיול לחשבון, ואז חזרו לשיתוף כדי לשלוח לפי שם משתמש.'
      : 'Save the trip to your account first, then reopen Share to send by username.',

    tripStoryButton: he ? '📖 סיפור טיול' : '📖 Trip story',
    tripStoryTitle: he ? 'סיפור הטיול' : 'Your trip story',
    tripStorySubtitle(dest: string) {
      const d = dest.trim() || (he ? 'היעד שלכם' : 'your trip');
      return he ? `${d} — יום־יום, בקצרה ובלי עומס` : `${d} — day by day, short & sweet`;
    },
    tripStoryClose: he ? 'סגירה' : 'Close',
    tripStoryFooter: he
      ? 'שמות המקומות נשארים באנגלית — נוח למפות ולהזמנות.'
      : 'Place names stay in English — easier for maps & bookings.',
    tripStoryDayLabel: (n: number) => (he ? `יום ${n}` : `Day ${n}`),

    bankReplaceButton: he ? 'החלפה' : 'Swap',
    bankPickSlotTitle: he ? 'בחרו מה להחליף' : 'Choose what to replace',
    bankPickSlotSubtitle: (place: string) => (he ? `בחרו שיבוץ עבור "${place}"` : `Pick a slot for "${place}"`),
    bankPickSlotCancel: he ? 'ביטול' : 'Cancel',
    bankPickSlotConfirm: he ? 'אישור החלפה' : 'Confirm swap',

    daySummaryTitle: he ? '📋 תקציר היום' : "📋 Today's Plan",
  };
}

export type ItineraryUiStrings = ReturnType<typeof itineraryUi>;

/** Draft overview slot row (morning / afternoon / evening). */
export function draftSlotUi(lang: TripUiLang) {
  if (lang !== 'he') {
    return {
      morning: { label: 'Morning', notPlanned: '— not planned', swapped: '✓ Swapped' },
      afternoon: { label: 'Afternoon', notPlanned: '— not planned', swapped: '✓ Swapped' },
      evening: { label: 'Evening', notPlanned: '— not planned', swapped: '✓ Swapped' },
    };
  }
  return {
    morning: { label: 'בוקר', notPlanned: '— לא מתוכנן', swapped: '✓ הוחלף' },
    afternoon: { label: 'צהריים', notPlanned: '— לא מתוכנן', swapped: '✓ הוחלף' },
    evening: { label: 'ערב', notPlanned: '— לא מתוכנן', swapped: '✓ הוחלף' },
  };
}

/** Day card — slot headers, vibes, genre bands, small UI chrome. */
export function dayCardUi(lang: TripUiLang) {
  if (lang !== 'he') {
    return {
      slotMeta: {
        morning: { icon: '🌅', label: 'Morning' },
        afternoon: { icon: '☀️', label: 'Afternoon' },
        evening: { icon: '🌙', label: 'Evening' },
      } as const,
      vibeLabel: {
        'hidden-gem': 'Hidden gem',
        'local-favorite': 'Local favorite',
        'viral-trend': 'Trending spot',
        classic: 'Classic',
        'luxury-pick': 'Luxury pick',
        'budget-pick': 'Budget-friendly',
      },
      genreLabel: {
        sightseeing: 'Sightseeing & Vibes',
        food: 'Food & Dining',
        shopping: 'Shopping & Style',
        nightlife: 'Nightlife & Culture',
      },
      categoryShort: {
        sightseeing: 'Attraction',
        food: 'Dining',
        shopping: 'Shopping',
        nightlife: 'Nightlife',
      },
      reactions: [
        { id: 'fire', emoji: '🔥', label: 'On fire' },
        { id: 'pin', emoji: '📍', label: 'Pinned' },
        { id: 'love', emoji: '💖', label: 'Love it' },
      ],
    reviewsHeading: (audience: string) => `💬 What the ${audience} Says`,
    matchPercent: (n: number) => `${n}% Match`,
    live: 'Live',
    dayBrief: 'Day Brief',
    dayTimeline: 'Day Timeline',
    dayRoute: 'Day Route',
    mapLocationCount: (n: number) => `${n} location${n !== 1 ? 's' : ''}`,
    insiderIntelHeader: 'Insider Intel',
    startDayRoute: 'Start Day Route',
    estSpendLine: (amt: string) => `Roughly ${amt} for this day`,
    copyRouteLink: 'Copy map link',
    copied: 'Copied!',
    insiderClosed: (n: number) => `Pro Move · ${n} insider secret${n > 1 ? 's' : ''}`,
    insiderOpen: 'Hide intel',
    mealBreakfast: 'Breakfast',
    mealLunch: 'Lunch',
    mealDinner: 'Dinner',
    squadPick: (a: string) => `${a} Pick`,
    liveBuzz: 'Live Buzz',
    whyThis: 'Why this?',
    swapThis: 'Swap this activity',
    swapFinding: 'Finding something better…',
    swapWhatInstead: 'What would you like instead?',
    swapPlaceholder: 'e.g. "something with live music", "a rooftop bar"…',
    swapCancel: 'Cancel',
    swapScout: 'Scout it',
    swapScouting: 'Scouting…',
    scoutItButton: 'Scout It →',
    smartSwapButton: 'Swap',
    smartSwapTitle: 'Smart alternatives',
    smartSwapSubtitle: (genre: string) => `Same vibe · ${genre}`,
    smartSwapLoading: 'Finding two matches in the same genre…',
    smartSwapError: 'Could not load alternatives — try again.',
    smartSwapRetry: 'Retry',
    smartSwapIntro: 'About the spot',
    smartSwapWhyYou: 'Why it fits you',
    smartSwapReplace: 'Replace',
    smartSwapApplying: 'Applying…',
    smartSwapClose: 'Close',
    smartSwapCustom: 'Custom request instead',
    };
  }
  return {
    slotMeta: {
      morning: { icon: '🌅', label: 'בוקר' },
      afternoon: { icon: '☀️', label: 'אחר הצהריים' },
      evening: { icon: '🌙', label: 'ערב' },
    } as const,
    vibeLabel: {
      'hidden-gem': 'פנינה נסתרת',
      'local-favorite': 'מועדף מקומי',
      'viral-trend': 'טרנדי',
      classic: 'קלאסי',
      'luxury-pick': 'יוקרה',
      'budget-pick': 'חסכוני',
    },
    genreLabel: {
      sightseeing: 'אתרים ואווירה',
      food: 'אוכל ומסעדות',
      shopping: 'קניות וסטייל',
      nightlife: 'חיי לילה ותרבות',
    },
    categoryShort: {
      sightseeing: 'אטרקציה',
      food: 'מסעדה',
      shopping: 'קניות',
      nightlife: 'חיי לילה',
    },
    reactions: [
      { id: 'fire', emoji: '🔥', label: 'חם' },
      { id: 'pin', emoji: '📍', label: 'נשמר' },
      { id: 'love', emoji: '💖', label: 'אהבתי' },
    ],
    reviewsHeading: (audience: string) => `💬 מה ה-${audience} אומרים`,
    matchPercent: (n: number) => `${n}% התאמה`,
    live: 'חי',
    dayBrief: 'סיכום היום',
    dayTimeline: 'ציר זמן',
    dayRoute: 'מסלול היום',
    mapLocationCount: (n: number) => `${n} מיקומים`,
    insiderIntelHeader: 'מודיעין פנים',
    startDayRoute: 'התחלת מסלול היום',
    estSpendLine: (amt: string) => `היום בערך ${amt}`,
    copyRouteLink: 'העתקת קישור למפה',
    copied: 'הועתק!',
    insiderClosed: (n: number) => (n > 1 ? `טיפ מקצועי · ${n} סודות פנים` : `טיפ מקצועי · סוד פנים אחד`),
    insiderOpen: 'הסתרת מודיעין',
    mealBreakfast: 'ארוחת בוקר',
    mealLunch: 'ארוחת צהריים',
    mealDinner: 'ארוחת ערב',
    squadPick: (a: string) => `בחירת ${a}`,
    liveBuzz: 'באז חי',
    whyThis: 'למה כאן?',
    swapThis: 'החלפת הפעילות',
    swapFinding: 'מחפשים משהו טוב יותר…',
    swapWhatInstead: 'מה תרצו במקום?',
    swapPlaceholder: 'למשל "מוזיקה חיה", "בר גג", "גלריה נסתרת"…',
    swapCancel: 'ביטול',
    swapScout: 'לשגר',
    swapScouting: 'סורקים…',
    scoutItButton: 'סריקה →',
    smartSwapButton: 'החלפה',
    smartSwapTitle: 'החלפה חכמה',
    smartSwapSubtitle: (genre: string) => `אותו סגנון · ${genre}`,
    smartSwapLoading: 'מחפשים שתי אופציות באותו ז׳אנר…',
    smartSwapError: 'לא הצלחנו לטעון חלופות — נסו שוב.',
    smartSwapRetry: 'נסו שוב',
    smartSwapIntro: 'על המקום',
    smartSwapWhyYou: 'למה זה בשבילכם',
    smartSwapReplace: 'החלף',
    smartSwapApplying: 'מחילים…',
    smartSwapClose: 'סגירה',
    smartSwapCustom: 'בקשה מותאמת אישית',
  };
}
