'use client';

import { motion } from 'framer-motion';
import { Mountain, UtensilsCrossed, Landmark, Star } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DIETARY_OPTIONS, getMustHaveGroups } from '@/lib/finishingTouches';
import { THEME, CARD } from '@/lib/onboardingTheme';

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
  mode?: 'all' | 'dietary' | 'recommendations';
  /** Show numbered step badge (onboarding section header) */
  stepBadge?: number;
}

export function FinishingTouchesForm({
  destination,
  dietary,
  mustHaveItems,
  mustHaveOther,
  onToggleDietary,
  onToggleMustHave,
  onMustHaveOtherChange,
  mode = 'all',
  stepBadge,
}: Props) {
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
    <div className="flex flex-col gap-6">

      {showHeader && (stepBadge != null ? (
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0"
            style={{ background: THEME.gold, color: THEME.ink }}
          >
            {stepBadge}
          </span>
          <div>
            <h2 className="text-xl font-black tracking-tight" style={{ color: THEME.deepGreen }}>{headerCopy.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>
              {headerCopy.body}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-black tracking-tight" style={{ color: THEME.deepGreen }}>{headerCopy.title}</h2>
          <p className="text-xs mt-0.5" style={{ color: THEME.textMuted }}>
            {headerCopy.body}
          </p>
        </div>
      ))}

      {/* Dietary */}
      {showDietary && <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: THEME.textMuted }}>
          Dietary preferences{' '}
          <span style={{ color: THEME.textFaint }}>(optional — pick any)</span>
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
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                style={sel ? CARD.selected : CARD.base}
              >
                <Icon size={18} strokeWidth={1.75} style={{ color: sel ? THEME.gold : THEME.textMuted }} className="shrink-0" />
                <span className="text-xs font-semibold leading-snug flex-1"
                  style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>{opt.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>}

      {/* Must-haves */}
      {showRecommendations && <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: THEME.textMuted }}>
          Our picks for {destination || 'your trip'}{' '}
          <span style={{ color: THEME.textFaint }}>(optional)</span>
        </p>
        <p className="text-xs mb-3 leading-relaxed" style={{ color: THEME.textFaint }}>
          Choose specific places you want us to build around. These names are sent directly into the itinerary prompt.
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
                  {group.title}
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
          placeholder='Anything else? e.g. "teamLab", "hidden izakayas", "sunrise view"'
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
