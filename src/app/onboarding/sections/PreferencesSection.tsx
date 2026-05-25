'use client';

/**
 * PreferencesSection — Section 5 of the progressive onboarding flow.
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

const GOLD  = '#c5912a';
const MUTED = 'rgba(255,255,255,0.38)';

const BUDGET_OPTIONS = [
  {
    value: 'budget',
    label: 'Budget Explorer',
    icon:  '💚',
    sub:   'Under $100/day · hostels, street food, free sights',
  },
  {
    value: 'mid-range',
    label: 'Smart Traveler',
    icon:  '💛',
    sub:   '$100–$300/day · boutique hotels, local restaurants',
  },
  {
    value: 'luxury',
    label: 'Luxury Seeker',
    icon:  '💎',
    sub:   '$300+/day · 5-star, fine dining, private tours',
  },
] as const;

const INTEREST_OPTIONS = [
  { value: 'culture',      label: 'Culture & History', icon: '🏛️' },
  { value: 'food',         label: 'Food & Dining',     icon: '🍜' },
  { value: 'adventure',    label: 'Adventure',          icon: '🧗' },
  { value: 'art',          label: 'Art & Museums',      icon: '🎨' },
  { value: 'nightlife',    label: 'Nightlife',           icon: '🌃' },
  { value: 'wellness',     label: 'Wellness & Spa',     icon: '🧘' },
  { value: 'shopping',     label: 'Shopping',           icon: '🛍️' },
  { value: 'hidden-gems',  label: 'Hidden Gems',        icon: '💎' },
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
    const interestIcons = interests
      .slice(0, 4)
      .map((v) => INTEREST_OPTIONS.find((o) => o.value === v)?.icon ?? '')
      .join(' ');

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(197,145,42,0.22)' }}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: GOLD }}>✓</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">
              {budgetOpt?.icon} {budgetOpt?.label}
            </p>
            {interests.length > 0 && (
              <p className="text-xs mt-0.5 truncate" style={{ color: MUTED }}>
                {interestIcons}
                {interests.length > 4 && ` +${interests.length - 4} more`}
              </p>
            )}
          </div>
        </div>
        <button onClick={onEdit}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors hover-bg-subtle shrink-0"
          style={{ color: MUTED, border: '1px solid rgba(255,255,255,0.10)' }}>
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ────────────────────────────────────────────────────────────
  const canContinue = !!budget;

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: GOLD }}>5</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Your travel style</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Budget calibrates every recommendation · interests bias the picks
          </p>
        </div>
      </div>

      {/* Budget — 3 row options */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>
          Daily budget <span style={{ color: 'rgba(255,255,255,0.20)' }}>(excl. flights)</span>
        </p>
        {BUDGET_OPTIONS.map((opt) => {
          const sel = budget === opt.value;
          return (
            <motion.button
              key={opt.value}
              onClick={() => setBudget(opt.value)}
              whileHover={{ scale: 1.01, x: 3 }}
              whileTap={{ scale: 0.98 }}
              animate={sel
                ? { boxShadow: `0 0 0 2px ${GOLD}, 0 8px 28px -6px rgba(197,145,42,0.25)` }
                : { boxShadow: 'none' }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl border text-left transition-colors"
              style={sel
                ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)' }
                : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
              }
            >
              <span className="text-xl shrink-0 leading-none">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold leading-tight"
                  style={{ color: sel ? '#d4a235' : 'rgba(255,255,255,0.9)' }}>
                  {opt.label}
                </div>
                <div className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>
                  {opt.sub}
                </div>
              </div>
              {sel && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                  className="text-xs font-bold shrink-0" style={{ color: GOLD }}>✓</motion.span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Interests — 4×2 chip grid */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
          What lights you up?{' '}
          <span style={{ color: 'rgba(255,255,255,0.18)' }}>(optional — pick any)</span>
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
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                style={sel
                  ? { borderColor: GOLD, background: 'rgba(197,145,42,0.10)', color: '#d4a235' }
                  : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)' }
                }
              >
                <span className="text-base shrink-0 leading-none">{opt.icon}</span>
                <span className="text-xs font-semibold leading-snug flex-1">{opt.label}</span>
                {sel && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-[10px] font-black shrink-0" style={{ color: GOLD }}>✓</motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Continue */}
      <motion.button
        onClick={canContinue ? onComplete : undefined}
        disabled={!canContinue}
        whileHover={canContinue ? { scale: 1.02, y: -1 } : {}}
        whileTap={canContinue ? { scale: 0.97 } : {}}
        className="w-full py-3.5 rounded-full text-sm font-black tracking-wide transition-all disabled:opacity-35"
        style={{
          background: canContinue
            ? 'linear-gradient(135deg, #9e363a, #b5404a)'
            : 'rgba(255,255,255,0.07)',
          color: canContinue ? '#fff' : 'rgba(255,255,255,0.3)',
          boxShadow: canContinue ? '0 0 48px rgba(158,54,58,0.48), 0 8px 24px -4px rgba(158,54,58,0.35)' : 'none',
          cursor: canContinue ? 'pointer' : 'default',
        }}
      >
        {canContinue ? 'Generate My Itinerary ✨' : 'Pick a budget to continue'}
      </motion.button>
    </div>
  );
}
