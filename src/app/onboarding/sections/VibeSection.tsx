'use client';

/**
 * VibeSection — Section 4 of the progressive onboarding flow.
 *
 * Two fast decisions: who's traveling (group type) and preferred pace.
 * Pace options reveal instantly after a group type is tapped.
 * Both selections auto-advance the flow — no button needed.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';

const BLUE  = '#4a7bde';
const GOLD  = '#c5912a';
const MUTED = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

const GROUP_OPTIONS = [
  { value: 'solo',   label: 'Solo',   icon: '🧳', sub: 'Just me'        },
  { value: 'couple', label: 'Couple', icon: '💑', sub: 'Two of us'       },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', sub: 'Kids in tow'    },
  { value: 'group',  label: 'Group',  icon: '👥', sub: '3+ friends'      },
];

const PACE_OPTIONS = [
  { value: 'relaxed',  label: 'Slow & Intentional', icon: '🌊', sub: 'Max 2–3 stops/day, lots of breathing room' },
  { value: 'moderate', label: 'Balanced Explorer',   icon: '🗺️', sub: 'Mix of activity and downtime'               },
  { value: 'intense',  label: 'Full Throttle',       icon: '⚡', sub: 'Packed schedule — maximize every hour'       },
];

interface Props {
  isCompleted: boolean;
  onComplete:  () => void;
  onEdit:      () => void;
}

export function VibeSection({ isCompleted, onComplete, onEdit }: Props) {
  const { groupType, pace, setGroupType, setPace } = useOnboardingStore();

  function handleGroupSelect(gt: string) {
    setGroupType(gt as 'solo' | 'couple' | 'family' | 'group');
    // If pace already chosen, auto-advance immediately
    if (pace) setTimeout(() => onComplete(), 300);
  }

  function handlePaceSelect(p: string) {
    setPace(p as 'relaxed' | 'moderate' | 'intense');
    // Auto-advance after the selection animation registers
    setTimeout(() => onComplete(), 350);
  }

  const groupOpt = GROUP_OPTIONS.find((g) => g.value === groupType);
  const paceOpt  = PACE_OPTIONS.find((p) => p.value === pace);

  // ── Completed summary bar ──────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(74,123,222,0.22)' }}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: BLUE }}>✓</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              {groupOpt?.icon} {groupOpt?.label}
            </span>
            {paceOpt && (
              <span className="text-xs" style={{ color: MUTED }}>
                · {paceOpt.icon} {paceOpt.label}
              </span>
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
  return (
    <div className="flex flex-col gap-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: BLUE }}>4</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Who's coming?</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Shapes restaurants, activities, and pacing — two quick taps
          </p>
        </div>
      </div>

      {/* Group type — 2×2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {GROUP_OPTIONS.map((opt) => {
          const sel = groupType === opt.value;
          return (
            <motion.button
              key={opt.value}
              onClick={() => handleGroupSelect(opt.value)}
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.97 }}
              animate={sel
                ? { boxShadow: `0 0 0 2px ${BLUE}, 0 10px 28px -6px rgba(74,123,222,0.28)` }
                : { boxShadow: 'none' }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="relative p-4 rounded-2xl border text-left transition-colors"
              style={sel
                ? { borderColor: BLUE, background: 'rgba(74,123,222,0.12)' }
                : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }
              }
            >
              {sel && (
                <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: BLUE }}>
                  <span className="text-white text-[9px] font-bold">✓</span>
                </motion.div>
              )}
              <div className="text-2xl mb-2 leading-none">{opt.icon}</div>
              <div className="text-sm font-bold leading-tight"
                style={{ color: sel ? '#7fa8ed' : 'rgba(255,255,255,0.9)' }}>
                {opt.label}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{opt.sub}</div>
            </motion.button>
          );
        })}
      </div>

      {/* Pace — reveals after group type selected */}
      <AnimatePresence>
        {groupType && (
          <motion.div key="pace-section"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -8 }}>
            <p className="text-xs font-semibold mb-3" style={{ color: MUTED }}>
              How do you like to travel?
            </p>
            <div className="flex flex-col gap-2">
              {PACE_OPTIONS.map((opt) => {
                const sel = pace === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => handlePaceSelect(opt.value)}
                    whileHover={{ scale: 1.01, x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl border text-left transition-colors"
                    style={sel
                      ? { borderColor: BLUE, background: 'rgba(74,123,222,0.10)' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                    }
                  >
                    <span className="text-xl shrink-0 leading-none">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight"
                        style={{ color: sel ? '#7fa8ed' : 'rgba(255,255,255,0.9)' }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>
                        {opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xs font-bold shrink-0" style={{ color: BLUE }}>✓</motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
