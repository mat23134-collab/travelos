# Results Page — Editorial "Less-AI" Glow-Up

**Date:** 2026-06-17
**Status:** Design / awaiting approval
**Scope:** The itinerary **results** page (`src/components/ItineraryClient.tsx` final view) and the components it mounts.
**Goal:** Make the results page feel like a premium editorial travel magazine (à la BromoRise / Korsa Dribbble refs) rather than a generic "AI-generated" dark dashboard — without a rewrite.

---

## רקע ומוטיבציה (Why)

המשתמש הביא רפרנסים מ-Dribbble (BromoRise, Korsa) שמרגישים יוקרתיים ו"לא-AI". ניתוח של 5 התמונות + audit של 3 סוכנים על הקוד האמיתי העלה:

**מה מייצר את התחושה היוקרתית ברפרנסים:**
1. טיפוגרפיה **אדיטוריאלית** — serif תצוגתי high-contrast (Canela/Ogg style) מעורבב עם sans נקי.
2. **חום** — paper off-white, אקצנט sunrise-gold, צללים רכים (לא neon glow).
3. תמונות **full-bleed ממוסגרות** עם border-radius גדול ושוליים.
4. **גריד Bento אסימטרי** + כרטיסים צפים שחופפים.
5. תוויות מיקום bottom-left עם gradient scrim, כפתורי pill עם חץ.

**הממצא המכריע מה-audit:** הדף **כבר** עבר ל-teal (`#12343b`) + gold (`#C9A84C`) עם סקשנים בהירים (`itineraryResultsPalette.ts`), ו**קומפוננטות ה-Bento כבר בנויות** (`BentoGrid`/`BentoTile` ב-`DayCard.tsx:772-1033`) אך **לא מחוברות** לדף. בנוסף, `font-serif` בקוד **שבור** — אין token, אז כותרות נופלות ל-Georgia גנרי. לכן זו עבודת **חיבור + 3 תיקונים**, לא שכתוב.

---

## עקרונות מנחים (Principles)

- **Incremental, not rewrite.** ממחזרים רכיבים קיימים; מוסיפים מינימום קומפוננטות חדשות.
- **Dark hero ↔ light editorial sections.** כרטיסים כהים (`DayCard`, מודלים) **נשארים כהים**; רק משטחי ה-overview הופכים warm-paper.
- **Transform/opacity only** לכל אנימציה; אפס תלויות חדשות (`framer-motion` + `react-map-gl` כבר קיימים).
- **Reduced-motion מכובד תמיד** (כבר מחווט ב-`MotionProvider` + `globals.css:328-335`).
- **RTL-first.** עברית נתמכת — שימוש ב-`start/end` לוגי, לא `left/right`.
- **לא ממציאים נתונים.** מספר שאין לו שדה (למשל "ק״מ הליכה") — מחשבים מ-coords או משמיטים.

---

## פאזה A — "הזרקת חום" (Editorial Warmth)

**ROI הכי גבוה, מאמץ הכי נמוך. ~3 קבצים, אפס קומפוננטות חדשות.**

### A1. טיפוגרפיה — Fraunces display serif
- **`src/app/layout.tsx`:** להוסיף `next/font/google` → `Fraunces` (`subsets:['latin']`, `axes:['opsz']`, `style:['normal','italic']`, `variable:'--font-display'`, `display:'swap'`). להוסיף `${display.variable}` ל-`<html>` className (~`layout.tsx:72`).
- **`src/app/globals.css`** בתוך `@theme`:
  ```css
  --font-display: var(--font-display), 'Fraunces', ui-serif, Georgia, serif;
  --font-serif:   var(--font-display);   /* מתקן את font-serif השבור */
  ```
  ולהוסיף utility `.font-display` (במקביל ל-`.font-brand` ב-`globals.css:57`).
- **להחיל `.font-display`** על: כותרת ה-hero (פאזה B), כותרות `<h3>` של basecamp (`ItineraryClient.tsx:859,926,1000`), שם המלון (`ItineraryClient.tsx:140,541`), packing/tips (`ItineraryClient.tsx:1431,1447`). **italic** לכותרת חתימה אחת (hero).
- **עברית:** Fraunces ללא גליפים עבריים → ה-fallback בטוקן מטפל; לוודא שכותרות עבריות נופלות לפונט העברי הקיים (בדיקת QA על `dir==='rtl'`).

### A2. צבעוניות חמה — tokens חדשים
ב-`globals.css` `@theme` (לפי קונבנציית `--color-*` הקיימת):
```css
/* Warm paper surfaces */
--color-paper:        #f7f1e7;
--color-paper-sunk:   #efe6d6;
--color-ink-warm:     #2b2622;
--color-ink-warm-mut: #6b6358;
/* Sunrise accent */
--color-sunrise:      #e0a44b;
--color-sunrise-soft: #f0c98a;
--color-sunrise-deep: #b8772e;
/* Softened shadows */
--shadow-soft: 0 10px 30px -12px rgba(43,38,34,0.18);
--shadow-card: 0 4px 16px rgba(43,38,34,0.08);
```

### A3. החלפות נקודתיות ב-`ItineraryClient.tsx` (before→after)
1. `:1305` overlay `rgba(180,228,222,0.82)` (מנטה קר) → `var(--color-paper)` @ ~0.88. **השינוי הכי משמעותי בתחושה.**
2. `:1396,1430,1446` `bg-white` → `bg-[var(--color-paper)]`/`--color-paper-sunk`; טקסט `#222`/`#555`/`#444` (`:1431,1436,1447,1452,1553`) → `--color-ink-warm`/`--color-ink-warm-mut`.
3. צללים שטוחים `0 4px 16px rgba(0,0,0,0.07)` → `var(--shadow-card)`.
4. `:1469-1475` footer CTA → להוסיף `→` ולהחליף glow teal ב-`var(--shadow-soft)` (גם FAB `:1488-1490`).
5. `:1437,1453` check-marks `text-[#5aada5]` → `var(--color-sunrise-deep)`.

### A4. סיכוני פאזה A
- **זהב מקודד ~40×** כ-string ב-`ItineraryClient.tsx`, `DayCard.tsx` (`SLOT_GRADIENT:42-46`, `BURST_COLORS:303`), `itineraryResultsPalette.ts`. Token חדש **לא** יחליף אוטומטית — לאמץ token לקוד **חדש** בלבד, migration הדרגתי.
- **`font-serif` כיום no-op** → התיקון ישנה ~12 כותרות קיימות (onboarding, modals). רצוי, אבל לעשות QA לאותם מסכים.
- **משטחים כהים** (`DayCard`, `ActivityModal:502`, `HotelDetailCube`) — **לא** להחיל paper (טקסט לבן על לבן).
- **Print styles** (`globals.css:341`) תלויים ב-`bg-white` — לעדכן הסלקטור אם משנים שם.
- **Footer/SiteBackground navy** (`layout.tsx:39`) ייצור תפר מול דף paper — להחליט אם מחממים גם אותם.

---

## פאזה B — מבנה (Framed Hero + Bento + Stats)

**3 קומפוננטות presentational חדשות + חיבור רכיבים קיימים. אפס שינוי data/hooks.**

מבנה ה-overview היעד (מחליף `ItineraryClient.tsx:1364-1478`), שומר `max-w-5xl`:

### B1. `ItineraryHero` (חדש)
- מתחת ל-`ItineraryHeader` הקיים. מסגרת מעוגלת עם שוליים (`mx-3 sm:mx-12 rounded-[28px] overflow-hidden`).
- רקע: `DayPhoto` קיים (`query="${destination} skyline"`, `height~420`) — כולל scrim + `dark` mode מובנה.
- pill קטגוריה (סגנון `ItineraryClient.tsx:856` או `TripPill`), כותרת serif = `itinerary.destination`, subhead = `formatTripDateRange` (כבר מיובא `:40`).
- כרטיס-זכוכית בפינה תחתונה (סגנון מ-`ItineraryHeader.tsx:142-154`) עם strapline + pill CTA.

### B2. `TripStats` (חדש) — רצועה צפה שחופפת
- חופפת תחתית hero (`-mt-12 relative z-10`). מקורות נתונים (`types.ts`):
  - **ימים** → `itinerary.totalDays` (`:284`) / `days.length`.
  - **אטרקציות** → ספירת `morning/afternoon/evening` לא-null (לוגיקה קיימת ב-`ItineraryDayCard.deriveDayBullets:9-20`).
  - **שכונות** → `new Set(activity.neighborhood)` (`:148`).
  - **מסעדות** → ספירת `breakfast/lunch/dinner` (`:212-214`).
  - **תקציב** → `budgetSummary.dailyAverage/totalEstimate` (`:289-293`).
  - **ק״מ הליכה** → אין שדה; haversine מ-`latitude/longitude` (`:161-162`) **או להשמיט**. לא להמציא.
- **Mobile:** overlap רק ב-`sm+`; מתחת לכך גריד stacked/2-col, hero בגובה קטן יותר.

### B3. Bento day grid (חיבור, לא בנייה)
- `DayCarousel` (`:1373`) נשאר כ"בורר ימים" דק.
- ליום הנבחר: render `BentoGrid` (`DayCard.tsx:987`) — בוקר feature גבוה (`sm:col-span-2`), צהריים קטן, ערב רחב (`sm:col-span-3`). כל `BentoTile` כבר תמונה מלאה + תווית bottom-left + scrim + badge התאמה.
- כותרת היום = `DaySummaryCard` (קיים) עם `day.theme`/`day.daySummary` (`:207,218`).

### B4. `SectionCard` (חדש) — מעטפת משותפת
איחוד הדפוס החוזר `mx-3 sm:mx-12 rounded-… bg-paper shadow` לקומפוננטה אחת; עוטף את כל הסקשנים (map, hotels, budget, transport, tips, logistics) למראה ממוסגר אחיד.

### B5. סיכוני פאזה B
- **מפה במובייל:** map כיום `hidden sm:block` (`:1406`) + FAB→`MobileMapOverlay`. **לשמור** את ה-FAB path; לא להציג map תמיד-פתוח במובייל.
- **RTL:** תוויות bottom-left ו-glass card → `ms-/me-`/`inset-inline`. `BentoTile` כיום `left-2.5`/`right-2.5` קשיח (`DayCard.tsx:841,850,880`) — **לא** מתהפך, צריך תיקון. חצי `DayCarousel` + `scrollBy({left})` (`:19-21`) LTR-biased.
- **ימים חלקיים:** `BentoGrid` מניח קיום slots; ימים עם meals בלבד / `skipDay1` (`:142`) — לוודא degrade חינני (tiles כבר guarded `:1000,1010,1020`).
- **Photo fetches:** hero + stat-bg + bento = ריבוי `/api/photos` בו-זמנית; לשמור `height` קבוע (CLS), לשקול מגבלת concurrency.

---

## פאזה C — תנועה (Motion)

**אפס תלויות חדשות. הכול דרך `framer-motion` + `react-map-gl` קיימים. הכול מכבד reduced-motion.**

סדר עדיפות (impact × effort):

### C1 (ראשון) — Scroll-reveal + stagger
- וריאנט משותף module-level ב-`ItineraryClient.tsx`:
  ```tsx
  const revealUp = { hidden:{opacity:0,y:28,scale:0.985},
    show:{opacity:1,y:0,scale:1,transition:{type:'spring',stiffness:260,damping:28}} };
  ```
- לעטוף סקשני overview (`:1390-1463`) ב-`motion` עם `whileInView`/`viewport={{once:true,amount:0.25}}`.
- stagger לכרטיסי carousel: `ItineraryDayCard.tsx:45-58` — `whileInView` + `delay: min(dayNumber-1,6)*0.05`. לשמור `whileHover/whileTap`.
- day-detail left column (`DayDetailPanel.tsx:145-182`): `staggerChildren` parent variant.

### C2 — Hover tilt 3D + zoom
- tilt: `useMotionValue` ל-`rotateX/Y` מ-`onMouseMove`, עטוף ב-`useSpring`, על שורש הכרטיס (`HotelCard:595`, `ItineraryDayCard:45`, `BentoTile:800`). `±4°`, `transformPerspective:900`, reset ב-`onMouseLeave`. **לא** `useState` לקואורדינטות.
- zoom: `group-hover:scale-[1.06] transition-transform duration-500` על wrapper של `DayPhoto` (כרטיסים כבר `group` + `overflow-hidden`). CSS → reduced-motion חינם.

### C3 — Count-up
- רכיב `CountUp` עם `useInView({once:true,amount:0.6})` + `useMotionValue` + `animate(...,{duration:1.1,ease:'easeOut'})`. `tabular-nums` (קיים) למניעת jitter. מזין את `TripStats` (פאזה B2).

### C4 — Map route-line draw (מתחילים בדף-היום)
- אין route line כיום (רק `<Marker>`). להוסיף `<Source geojson>`+`<Layer type="line">` ל-`ItineraryMap.tsx` (~`:310`), prop חדש `activeDayIndex` (`:54-64`).
- אנימציה: `line-dasharray` ב-rAF loop (~20fps/50ms) או one-shot progressive `setData` (slice 0→100%). LineString מ-`buildMarkers` (`:116-146`) מסונן ל-`activeDayIndex`.
- **להתחיל בדף-היום** (`DayDetailPanel.tsx:197`, `days={[day]}` — סדר חד-משמעי) לפני overview.
- **reduced-motion:** Mapbox paint props מחוץ ל-MotionConfig → לקרוא `matchMedia` (דפוס מ-`CinematicHeroBackground.tsx:17-23`, לחלץ ל-`src/hooks/usePrefersReducedMotion.ts`) ולרנדר קו סטטי מלא.

### C5 — Hero parallax
- `useScroll`+`useTransform`: `bgY = useTransform(scrollY,[0,600],[0,80])` על רקע fixed (`:1284`). caption (`:1366`) rise-in. `useTransform` לא מכוסה ע"י MotionConfig → guard עם `usePrefersReducedMotion` (y:0).

### C6 (PR נפרד) — Sticky map 2-col
restructure ל-grid: day list שמאל + map `sticky top-64` ימין. שינוי layout, לא motion patch.

### C7 — סיכוני תנועה
- **Map rerenders (סיכון עליון):** `buildMarkers`(`:207`)/`allPoints`(`:281`) מחושבים כל render → `useMemo` keyed על `days`/`activeDayIndex`; לשנות paint דרך `setPaintProperty`/`setData`, לא ע"י re-render של `<Layer>`.
- **flyTo conflicts:** כבר 2 effects (`:215-232`, `:235-244`) — active-day flyTo עלול לקטוע; לתאם camera-intent יחיד.
- **Mobile/touch:** tilt ללא משמעות במגע; gate `(hover:hover)` + reset. dash ב-20fps לחיסכון בסוללה.
- **`AnimatePresence mode="wait"`** ב-day-detail (`:108`) — לא לערבב `whileInView` per-child עם enter/exit; להעדיף `staggerChildren` חד-פעמי.

---

## רכיבים: reuse / wrap / new

**Reuse as-is:** `DayPhoto`, `BentoTile`/`BentoGrid`, `DaySummaryCard`, `HotelSelectionCard`/`HotelCard`/`HotelDetailCube`, `ItineraryMap`, `TransportCard`, `LogisticsDashboard`, `BudgetCell`, `TripPill`.
**Wrap/restyle:** overview block (`:1364-1478`), `DayCarousel` (demote ל-day-picker), map mount.
**New (presentational בלבד):** `ItineraryHero`, `TripStats`, `SectionCard`, `CountUp`, `usePrefersReducedMotion` hook.

---

## תוכנית בדיקה (Testing)

- **ויזואלי:** הרצת הדף על יעד אמיתי, השוואה לרפרנסים — desktop + mobile (~380px) + RTL (עברית).
- **Reduced-motion:** OS toggle → לוודא הכול מתייצב מיידית, route line סטטי.
- **Unit:** ל-`TripStats` derivations (ספירות, haversine) — `*.test.ts` לצד הקומפוננטה (קונבנציה קיימת, למשל `DaySummaryCard.test.ts`).
- **Regression:** מסכי onboarding/modals שמושפעים מתיקון `font-serif`.
- **Lint/build:** `npm run lint` + build נקי.

---

## רצף יישום מומלץ

1. **פאזה A** (warmth) — נפרס לבד, ערך מיידי.
2. **פאזה C1+C2** (reveal+tilt) — motion זול על רכיבים קיימים.
3. **פאזה B** (hero+stats+bento) — המבנה.
4. **פאזה C3-C5** (count-up אחרי stats, route-draw, parallax).
5. **C6** sticky-map — PR נפרד.

כל פאזה היא PR/commit עצמאי שניתן לבדוק חזותית לפני המעבר לבא.
