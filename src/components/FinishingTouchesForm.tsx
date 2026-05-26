'use client';

import { motion } from 'framer-motion';
import { DIETARY_OPTIONS, getMustHavePicks } from '@/lib/finishingTouches';

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
  stepBadge,
}: Props) {
  const mustHavePicks = getMustHavePicks(destination);
  const hasCityPicks = !!destination && mustHavePicks.length > 0;

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
            <h2 className="text-xl font-black text-white tracking-tight">Final details</h2>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>
              Optional — sharpens dining picks and locks in must-sees
            </p>
          </div>
        </div>
      ) : (
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Final details</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Optional — sharpens dining picks and locks in must-sees
          </p>
        </div>
      )}

      {/* Dietary */}
      <div className="flex flex-col gap-2">
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
      </div>

      {/* Must-haves */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: MUTED }}>
          Must-haves for {destination || 'your trip'}{' '}
          <span style={{ color: 'rgba(255,255,255,0.18)' }}>(optional)</span>
        </p>
        {hasCityPicks && (
          <div className="grid grid-cols-2 gap-2 mb-3">
            {mustHavePicks.map((pick) => {
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
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-[10px] font-black shrink-0" style={{ color: ACCENT }}>✓</motion.span>
                  )}
                </motion.button>
              );
            })}
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
      </div>
    </div>
  );
}
