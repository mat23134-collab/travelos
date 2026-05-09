import type { GroupType } from '@/lib/types';

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

    newTrip: he ? '← טיול חדש' : '← New Trip',
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
    masterPlanLabel: (audience: string) => (he ? `תוכנית האב של ${audience}` : `Your ${audience} Master Plan`),
    dayItineraryMeta: (days: string | number) => (he ? `מסלול ${days} ימים` : `${days}-day itinerary`),
    budgetDaily: he ? 'ממוצע יומי' : 'Daily Average',
    budgetTotal: he ? 'הערכת סה״כ' : 'Total Estimate',
    budgetIncludes: he ? 'כולל' : 'Includes',
    routeSection: (audience: string) => (he ? `מסלול ${audience}` : `${audience} Route`),
    mapOpenMobile: he ? 'מפת מסלול' : 'Route Map',

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

    basecampBadge: he ? '🏠 בסיס המחנה' : '🏠 Basecamp',
    basecampYour: he ? '🏠 בסיס המחנה שלכם' : '🏠 Your Basecamp',
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
    hotelModalBadge: he ? '🏨 בחירת בסיס' : '🏨 Basecamp pick',
    hotelOfficialSite: he ? 'לאתר המלון הרשמי ←' : 'Official hotel site →',
    hotelCompare: he ? 'השוואת מחירים וזמינות חיה ←' : 'Compare rates & live availability →',
    hotelReviews: he ? 'ביקורות (גוגל) ↗' : 'Read reviews (Google) ↗',
    hotelPriceBand: he ? 'טווח מחיר (לפי התאריכים שלכם)' : 'Price band (your dates)',
    hotelAvailability: he ? 'זמינות' : 'Availability',
    hotelYourDates: he ? 'התאריכים שלכם:' : 'Your dates:',
    hotelDisclaimer: he
      ? 'הערכות המחיר אינדיקטיביות אלא אם יש אינטגרציה חיה להזמנות. קישורי הזמנה מציגים זמינות בזמן אמת אצל הספק.'
      : 'Price hints are indicative unless sourced from a live booking integration. Opening booking links shows real-time availability from the provider.',

    intelSources: he ? 'מקורות שנסרקו' : 'Sources scanned',
    intelGems: he ? 'פנינות נסתרות' : 'Hidden gems found',
    intelTraps: he ? 'מלכודות תיירים סוננו' : 'Tourist traps filtered',
    intelContradictions: he ? 'סתירות שסומנו' : 'Contradictions flagged',
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
        'hidden-gem': 'Hidden Gem',
        'local-favorite': 'Local Fave',
        'viral-trend': 'Trending',
        classic: 'Classic',
        'luxury-pick': 'Luxury Pick',
        'budget-pick': 'Budget Pick',
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
    estSpend: 'Est. spend',
    copyLink: 'Copy Link',
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
    estSpend: 'הערכת הוצאה',
    copyLink: 'העתקת קישור',
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
  };
}
