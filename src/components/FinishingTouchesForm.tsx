'use client';

import { motion } from 'framer-motion';
import { DIETARY_OPTIONS, getMustHaveGroups } from '@/lib/finishingTouches';

const ACCENT = '#9e363a';
const MUTED  = 'rgba(255,255,255,0.38)';

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
      title: 'Our recommendations',
      body: 'Pick the kinds of places you want us to prioritize',
    },
  }[mode];

  return (
    <div className="flex flex-col gap-6">

      {stepBadge != null ? (
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
            style={{ background: ACCENT }}
          >
            {stepBadge}
          </span>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">{headerCopy.title}</h2>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              {headerCopy.body}
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">{headerCopy.title}</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            {headerCopy.body}
          </p>
        </div>
      )}

      {/* Dietary */}
      {showDietary && <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: MUTED }}>
          Dietary preferences{' '}
          <span style={{ color: 'rgba(255,255,255,0.20)' }}>(optional — pick any)</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {DIETARY_OPTIONS.map((opt) => {
            const sel = dietary.includes(opt.value);
            return (
              <motion.button
                key={opt.value}
                type="button"
                onClick={() => onToggleDietary(opt.value)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                animate={sel
                  ? { boxShadow: `0 0 0 2px ${ACCENT}, 0 8px 28px -6px rgba(158,54,58,0.22)` }
                  : { boxShadow: 'none' }
                }
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                style={sel
                  ? { borderColor: ACCENT, background: 'rgba(158,54,58,0.10)', color: '#e07078' }
                  : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)' }
                }
              >
                <span className="text-base shrink-0 leading-none">{opt.icon}</span>
                <span className="text-xs font-semibold leading-snug flex-1">{opt.label}</span>
                {sel && (
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-[10px] font-black shrink-0" style={{ color: ACCENT }}>✓</motion.span>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>}

      {/* Must-haves */}
      {showRecommendations && <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
          Our picks for {destination || 'your trip'}{' '}
          <span style={{ color: 'rgba(255,255,255,0.18)' }}>(optional)</span>
        </p>
        {hasCityPicks && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {mustHaveGroups.map((group) => (
              <div
                key={group.key}
                className="rounded-2xl border p-2.5"
                style={{
                  borderColor: 'rgba(255,255,255,0.07)',
                  background: 'rgba(255,255,255,0.025)',
                }}
              >
                <p
                  className="text-[10px] font-black uppercase tracking-widest px-1 pb-2"
                  style={{ color: 'rgba(255,255,255,0.34)' }}
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
                        animate={sel
                          ? { boxShadow: `0 0 0 2px ${ACCENT}, 0 8px 28px -6px rgba(158,54,58,0.22)` }
                          : { boxShadow: 'none' }
                        }
                        transition={{ type: 'spring', stiffness: 400, damping: 24 }}
                        className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border text-left transition-colors"
                        style={sel
                          ? { borderColor: ACCENT, background: 'rgba(158,54,58,0.10)', color: '#e07078' }
                          : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.7)' }
                        }
                      >
                        <span className="text-base shrink-0 leading-none">{pick.icon}</span>
                        <span className="text-xs font-semibold leading-snug flex-1">{pick.label}</span>
                        {sel && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="text-[10px] font-black shrink-0"
                            style={{ color: ACCENT }}
                          >
                            ✓
                          </motion.span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <input
          type="text"
          placeholder='Anything else? e.g. "teamLab", "hidden izakayas", "sunrise view"'
          value={mustHaveOther}
          onChange={(e) => onMustHaveOtherChange(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl border focus:outline-none text-sm transition-all text-white"
          style={{
            borderColor: 'rgba(255,255,255,0.07)',
            background: 'rgba(255,255,255,0.02)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = ACCENT;
            e.currentTarget.style.boxShadow = `0 0 0 2px rgba(158,54,58,0.15)`;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        />
      </div>}
    </div>
  );
}
