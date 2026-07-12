'use client';

import { motion } from 'framer-motion';
import { Mountain, UtensilsCrossed, Landmark, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DIETARY_OPTIONS, getMustHaveGroups } from '@/lib/finishingTouches';
import { THEME, CARD } from '@/lib/onboardingTheme';
import { readTripLanguagePref } from '@/lib/tripLanguagePref';

// Hebrew chrome for this form. Place names (picks) and neighborhoods stay verbatim.
const HE: Record<string, string> = {
  // headers
  'Final details': 'פרטים אחרונים',
  'Optional — sharpens dining picks and locks in must-sees': 'אופציונלי — מחדד את בחירות האוכל ומקבע את המסטים',
  'Dining guardrails': 'כללי אוכל',
  "Tell us what not to miss, and what food rules we can't break": 'ספרו לנו מה אסור לפספס, ואילו כללי אוכל אסור לשבור',
  'Specific places we recommend': 'מקומות ספציפיים שאנחנו ממליצים',
  'Pick real attractions, landmarks, restaurants, and food stops to build into the route': 'בחרו אטרקציות, אתרים, מסעדות ועצירות אוכל אמיתיים לשילוב במסלול',
  // dietary
  'Vegetarian': 'צמחוני', 'No meat or fish': 'ללא בשר או דגים',
  'Vegan': 'טבעוני', 'No animal products': 'ללא מוצרים מן החי',
  'Kosher': 'כשר', 'Jewish dietary law': 'כשרות',
  'Halal': 'חלאל', 'Islamic dietary law': 'דין מזון אסלאמי',
  'Gluten-Free': 'ללא גלוטן', 'No wheat or gluten': 'ללא חיטה או גלוטן',
  'Dairy-Free': 'ללא חלב', 'No milk or dairy': 'ללא חלב ומוצריו',
  // strictness
  'How strict should we be?': 'כמה להחמיר?',
  'Strict': 'מחמיר', 'Only fully-compliant places': 'רק מקומות תואמים לחלוטין',
  'Flexible': 'גמיש', 'A good option on the menu is enough': 'אופציה טובה בתפריט מספיקה',
  // category titles
  'Attractions': 'אטרקציות', 'Restaurants': 'מסעדות', 'Restaurants & Food': 'מסעדות ואוכל',
  'Historical': 'היסטוריה', 'Museums & History': 'מוזיאונים והיסטוריה', 'Culture & History': 'תרבות והיסטוריה',
  'Icons & History': 'אייקונים והיסטוריה', 'Most Popular': 'הכי פופולרי', 'Most Popular (Touristy Too)': 'הכי פופולרי (גם תיירותי)',
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  attractions: Mountain,
  restaurants: UtensilsCrossed,
  historical:  Landmark,
  popular:     Star,
};

interface Props {
  destination: string;
  dietary: string[];
  mustHaveItems: string[];
  mustHaveOther: string;
  onToggleDietary: (value: string) => void;
  onToggleMustHave: (label: string) => void;
  onMustHaveOtherChange: (text: string) => void;
  /** Strict vs flexible interpretation of the dietary picks (optional). */
  dietaryStrictness?: 'strict' | 'flexible' | '';
  onDietaryStrictnessChange?: (v: 'strict' | 'flexible' | '') => void;
  mode?: 'all' | 'dietary' | 'recommendations';
  /** Show numbered step badge (onboarding section header) */
  stepBadge?: number;
}

const STRICTNESS_OPTIONS = [
  { value: 'strict'   as const, label: 'Strict',   sub: 'Only fully-compliant places' },
  { value: 'flexible' as const, label: 'Flexible', sub: 'A good option on the menu is enough' },
];

export function FinishingTouchesForm({
  destination,
  dietary,
  mustHaveItems,
  mustHaveOther,
  onToggleDietary,
  onToggleMustHave,
  onMustHaveOtherChange,
  dietaryStrictness = '',
  onDietaryStrictnessChange,
  mode = 'all',
  stepBadge,
}: Props) {
  const he = (readTripLanguagePref() ?? 'en') === 'he';
  const t = (s: string) => (he ? (HE[s] ?? s) : s);
  const mustHaveGroups = getMustHaveGroups(destination);
  const hasCityPicks = mustHaveGroups.some((group) => group.items.length > 0);
  const showDietary = mode === 'all' || mode === 'dietary';
  const showRecommendations = mode === 'all' || mode === 'recommendations';
  const headerCopy = {
    all: {
      title: 'Final details',
      body: 'Optional — sharpens dining picks and locks in must-sees',
    },
    dietary: {
      title: 'Dining guardrails',
      body: "Tell us what not to miss, and what food rules we can't break",
    },
    recommendations: {
      title: 'Specific places we recommend',
      body: 'Pick real attractions, landmarks, restaurants, and food stops to build into the route',
    },
  }[mode];

  // The onboarding shell renders the step headline + sub for dietary /
  // recommendations modes — suppress this component's own header there.
  const showHeader = mode === 'all';

  return (
    <div className="flex flex-col gap-6" data-tour="dining">

      {showHeader && (stepBadge != null ? (
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={{ background: THEME.gold, color: THEME.ink }}
          >
            {stepBadge}
          </span>
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ color: THEME.deepGreen }}>{t(headerCopy.title)}</h2>
            <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>
              {t(headerCopy.body)}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-black tracking-tight" style={{ color: THEME.deepGreen }}>{t(headerCopy.title)}</h2>
          <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>
            {t(headerCopy.body)}
          </p>
        </div>
      ))}

      {/* Dietary */}
      {showDietary && <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: THEME.textMuted }}>
          {he ? 'העדפות תזונה ' : 'Dietary preferences '}
          <span style={{ color: THEME.textFaint }}>{he ? '(אופציונלי — בחרו)' : '(optional — pick any)'}</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_OPTIONS.map((opt) => {
            const sel = dietary.includes(opt.value);
            const Icon = opt.icon;
            return (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => onToggleDietary(opt.value)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                style={sel ? CARD.selected : CARD.base}
              >
                <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0 mt-0.5" />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold leading-snug"
                    style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(opt.label)}</span>
                  <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: THEME.textFaint }}>{t(opt.sub)}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Strict vs flexible — only matters once at least one rule is set */}
        {onDietaryStrictnessChange && dietary.length > 0 && (
          <div className="mt-3">
            <p className="text-[11px] mb-2" style={{ color: THEME.textFaint }}>
              {t('How strict should we be?')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {STRICTNESS_OPTIONS.map((o) => {
                const sel = dietaryStrictness === o.value;
                return (
                  <motion.button
                    key={o.value}
                    type="button"
                    onClick={() => onDietaryStrictnessChange(sel ? '' : o.value)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex flex-col items-start gap-0.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors"
                    style={sel ? CARD.selected : CARD.base}
                  >
                    <span className="text-xs font-semibold leading-snug"
                      style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{t(o.label)}</span>
                    <span className="text-[10px] leading-snug" style={{ color: THEME.textFaint }}>{t(o.sub)}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>}

      {/* Must-haves */}
      {showRecommendations && <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: THEME.textMuted }}>
          {he ? 'הבחירות שלנו ל-' : 'Our picks for '}{destination || (he ? 'הטיול שלך' : 'your trip')}{' '}
          <span style={{ color: THEME.textFaint }}>{he ? '(אופציונלי)' : '(optional)'}</span>
        </p>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: THEME.textFaint }}>
          {he ? 'בחרו מקומות ספציפיים שנבנה סביבם. השמות נשלחים ישירות לפרומפט המסלול.' : 'Choose specific places you want us to build around. These names are sent directly into the itinerary prompt.'}
        </p>
        {hasCityPicks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {mustHaveGroups.map((group) => {
              const CategoryIcon = CATEGORY_ICON[group.key] ?? Star;
              return (
              <div
                key={group.key}
                className="rounded-2xl border p-2.5"
                style={CARD.base}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest px-1 pb-2"
                  style={{ color: THEME.textFaint }}
                >
                  {t(group.title)}
                </p>
                <div className="grid gap-2">
                  {group.items.map((pick) => {
                    const sel = mustHaveItems.includes(pick.label);
                    return (
                      <motion.button
                        key={pick.label}
                        type="button"
                        onClick={() => onToggleMustHave(pick.label)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                        className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                        style={sel ? CARD.selected : CARD.base}
                      >
                        <CategoryIcon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0 mt-0.5" />
                        <span className="flex-1 min-w-0">
                          <span className="block text-xs font-bold leading-snug"
                            style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{pick.label}</span>
                          {(pick.area || pick.note) && (
                            <span className="block text-[10px] leading-snug mt-0.5" style={{ color: THEME.textFaint }}>
                              {[pick.area, pick.note].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>
        )}
        <input
          type="text"
          placeholder={he ? 'עוד משהו? למשל "teamLab", "איזקאיות נסתרות", "נוף זריחה"' : 'Anything else? e.g. "teamLab", "hidden izakayas", "sunrise view"'}
          value={mustHaveOther}
          onChange={(e) => onMustHaveOtherChange(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl border focus:outline-none text-sm transition-all"
          style={{
            borderColor: THEME.border,
            background: THEME.surface,
            color: THEME.textBody,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = THEME.borderSel;
            e.currentTarget.style.boxShadow = `0 0 0 2px ${THEME.goldSoft}`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = THEME.border;
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>}
    </div>
  );
}
