'use client';

/**
 * PreferencesSection — Section 3 of the progressive onboarding flow.
 *
 * Two connected decisions collected in one focused screen:
 *   1. Budget level (3 options, required — unlocks the Continue button)
 *   2. Interests / what lights the traveler up (8 chips, optional multi-select)
 *
 * Both feed directly into the AI prompt: budget calibrates hotel & dining
 * picks; interests bias activity selection toward the right genre clusters.
 */

import { motion } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import { THEME, CARD } from '@/lib/onboardingTheme';
import { Wallet, CreditCard, Gem, Landmark, UtensilsCrossed, Mountain, Palette, Moon, Flower2, ShoppingBag } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const BUDGET_OPTIONS = [
  {
    value: 'budget',
    label: 'Lean & Local',
    icon:  Wallet as LucideIcon,
    sub:   'Under $100/day · hostels, street eats, free sights',
  },
  {
    value: 'mid-range',
    label: 'Comfortable',
    icon:  CreditCard as LucideIcon,
    sub:   '$100–$300/day · boutique stays, local favourites',
  },
  {
    value: 'luxury',
    label: 'Luxury',
    icon:  Gem as LucideIcon,
    sub:   '$300+/day · five-star, fine dining, private tours',
  },
] as const;

const INTEREST_OPTIONS: { value: string; label: string; sub: string; icon: LucideIcon }[] = [
  { value: 'culture',      label: 'Culture & History', sub: 'Landmarks & local stories',  icon: Landmark },
  { value: 'food',         label: 'Food & Dining',     sub: 'Markets & standout meals',   icon: UtensilsCrossed },
  { value: 'adventure',    label: 'Adventure',         sub: 'Active, outdoorsy days',     icon: Mountain },
  { value: 'art',          label: 'Art & Museums',     sub: 'Galleries & design stops',   icon: Palette },
  { value: 'nightlife',    label: 'Nightlife',         sub: 'Bars & after-dark spots',    icon: Moon },
  { value: 'wellness',     label: 'Wellness & Spa',    sub: 'Spas & slow mornings',       icon: Flower2 },
  { value: 'shopping',     label: 'Shopping',          sub: 'Boutiques & markets',        icon: ShoppingBag },
  { value: 'hidden-gems',  label: 'Hidden Gems',       sub: 'Lesser-known local picks',   icon: Gem },
];

interface Props {
  isCompleted: boolean;
  onComplete:  () => void;
  onEdit:      () => void;
}

export function PreferencesSection({ isCompleted, onComplete, onEdit }: Props) {
  const { interests, budget, toggleInterest, setBudget } = useOnboardingStore();

  const budgetOpt = BUDGET_OPTIONS.find((b) => b.value === budget);

  // ── Completed summary bar ──────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: THEME.surface, border: `1px solid ${THEME.border}` }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: THEME.gold }}>✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate" style={{ color: THEME.textBody }}>
              {budgetOpt?.label}
            </p>
            {interests.length > 0 && (
              <p className="text-xs mt-0.5 truncate" style={{ color: THEME.textMuted }}>
                {interests.length} interests
              </p>
            )}
          </div>
        </div>
        <button onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle shrink-0"
          style={{ color: THEME.textMuted, border: `1px solid ${THEME.border}` }}>
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6">

      {/* Budget — 3 row options */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: THEME.textMuted }}>
          Daily budget <span style={{ color: THEME.textFaint }}>(excl. flights)</span>
        </p>
        {BUDGET_OPTIONS.map((opt) => {
          const sel = budget === opt.value;
          return (
            <motion.button
              key={opt.value}
              onClick={() => setBudget(opt.value)}
              whileHover={{ scale: 1.01, x: 3 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-colors"
              style={sel ? CARD.selected : CARD.base}
            >
              <opt.icon
                size={18}
                strokeWidth={1.75}
                style={{ color: sel ? THEME.gold : THEME.textMuted }}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight"
                  style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>
                  {opt.label}
                </div>
                <div className="text-[11px] mt-0.5 leading-snug" style={{ color: THEME.textMuted }}>
                  {opt.sub}
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Interests — 4×2 chip grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: THEME.textMuted }}>
          What lights you up?{' '}
          <span style={{ color: THEME.textFaint }}>(optional — pick any)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {INTEREST_OPTIONS.map((opt) => {
            const sel = interests.includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                onClick={() => toggleInterest(opt.value)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                style={sel ? CARD.selected : CARD.base}
              >
                <opt.icon
                  size={18}
                  strokeWidth={1.75}
                  style={{ color: sel ? THEME.gold : THEME.textMuted }}
                  className="shrink-0 mt-0.5"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-semibold leading-snug"
                    style={{ color: sel ? THEME.deepGreen : THEME.textBody }}>
                    {opt.label}
                  </span>
                  <span className="block text-[10px] mt-0.5 leading-snug" style={{ color: THEME.textFaint }}>
                    {opt.sub}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
