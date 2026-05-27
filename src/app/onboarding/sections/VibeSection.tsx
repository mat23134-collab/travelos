'use client';

/**
 * VibeSection — Section 4 of the progressive onboarding flow.
 *
 * Three fast decisions:
 *   1. Who's coming?     (group type — 2×2 grid)
 *   2. Dynamic sub-question (unique per group type — Solo / Couple / Group only)
 *   3. Pace              (appears after both above are answered, or after group type
 *                         for Family which has its own kids-age modal)
 *
 * All selections auto-advance — no button needed.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import type {
  SoloDynamics, CoupleDynamics, FamilyDynamics, GroupDynamics,
  GroupDynamicsPayload,
} from '@/lib/types';

const PURPLE = '#7b6fcf';
const MUTED  = 'rgba(255,255,255,0.38)';

const reveal = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } },
};

// ── Group type ─────────────────────────────────────────────────────────────────
const GROUP_OPTIONS = [
  { value: 'solo',   label: 'Solo',   icon: '🧳', sub: 'Just me'        },
  { value: 'couple', label: 'Couple', icon: '💑', sub: 'Two of us'       },
  { value: 'family', label: 'Family', icon: '👨‍👩‍👧‍👦', sub: 'Kids in tow'    },
  { value: 'group',  label: 'Group',  icon: '👥', sub: '3+ friends'      },
];

// ── Sub-questions by group type ───────────────────────────────────────────────
const SOLO_DYNAMICS: Array<{ value: SoloDynamics; label: string; icon: string; sub: string }> = [
  { value: 'digital-nomad',  label: 'Digital Nomad',   icon: '💻', sub: 'Work + explore — need good wifi & cafés' },
  { value: 'deep-recharge',  label: 'Deep Recharge',   icon: '🧘', sub: 'Slow down, museums, long dinners alone' },
  { value: 'adventure',      label: 'Adventure Seeker', icon: '🏔️', sub: 'Maximize experiences, go off-script'   },
];

const COUPLE_DYNAMICS: Array<{ value: CoupleDynamics; label: string; icon: string; sub: string }> = [
  { value: 'romantic',      label: 'Romantic Escape',  icon: '🌹', sub: 'Candlelit dinners, quiet corners, sunset views'   },
  { value: 'parent-child',  label: 'Parent & Child',   icon: '👧', sub: 'One adult, one kid — balance fun for both'        },
  { value: 'reconnecting',  label: 'Reconnecting',     icon: '✨', sub: 'Long-term couple rediscovering adventures together' },
];

const GROUP_DYNAMICS: Array<{ value: GroupDynamics; label: string; icon: string; sub: string }> = [
  { value: 'best-friends', label: 'Best Friends',  icon: '🍺', sub: 'Shared history, inside jokes, skip the tourist stuff' },
  { value: 'mixed-ages',   label: 'Mixed Ages',    icon: '👨‍👩‍👦', sub: 'Different energy levels — include everyone'          },
  { value: 'work-crew',    label: 'Work Crew',     icon: '💼', sub: 'Colleagues bonding — professional but relaxed'        },
];

// ── Pace ───────────────────────────────────────────────────────────────────────
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

export function VibeSection({ isCompleted, onEdit }: Props) {
  const { groupType, groupDynamics, pace, setGroupType, setGroupDynamics, setPace } = useOnboardingStore();

  // Family skips the sub-question (it has its own FamilyKidsModal further down)
  const needsDynamics = groupType === 'solo' || groupType === 'couple' || groupType === 'group';
  const dynamicsAnswered = !needsDynamics || groupDynamics !== null;

  function handleGroupSelect(gt: string) {
    setGroupType(gt as 'solo' | 'couple' | 'family' | 'group');
  }

  function handleDynamicsSelect(subType: GroupDynamicsPayload['subType']) {
    setGroupDynamics({ subType });
  }

  function handlePaceSelect(p: string) {
    setPace(p as 'relaxed' | 'moderate' | 'intense');
  }

  const groupOpt     = GROUP_OPTIONS.find((g) => g.value === groupType);
  const paceOpt      = PACE_OPTIONS.find((p) => p.value === pace);
  const dynamicsLabel = resolveDynamicsLabel(groupType, groupDynamics?.subType);

  // ── Completed summary bar ──────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl"
        style={{ background: 'rgba(15,40,98,0.28)', border: '1px solid rgba(123,111,207,0.22)' }}
      >
        <div className="flex items-center gap-3">
          <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0"
            style={{ background: PURPLE }}>✓</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">
              {groupOpt?.icon} {groupOpt?.label}
            </span>
            {dynamicsLabel && (
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                · {dynamicsLabel}
              </span>
            )}
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
          style={{ background: PURPLE }}>4</span>
        <div>
          <h2 className="text-xl font-black text-white tracking-tight">Who's coming?</h2>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>
            Shapes restaurants, activities, and pacing
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
                ? { boxShadow: `0 0 0 2px ${PURPLE}, 0 10px 28px -6px rgba(123,111,207,0.28)` }
                : { boxShadow: 'none' }
              }
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              className="relative p-4 rounded-2xl border text-left transition-colors"
              style={sel
                ? { borderColor: PURPLE, background: 'rgba(123,111,207,0.12)' }
                : { borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }
              }
            >
              {sel && (
                <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: PURPLE }}>
                  <span className="text-white text-[9px] font-bold">✓</span>
                </motion.div>
              )}
              <div className="text-2xl mb-2 leading-none">{opt.icon}</div>
              <div className="text-sm font-bold leading-tight"
                style={{ color: sel ? '#b8b0f0' : 'rgba(255,255,255,0.9)' }}>
                {opt.label}
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>{opt.sub}</div>
            </motion.button>
          );
        })}
      </div>

      {/* Dynamic sub-question — reveals after group type, only for solo/couple/group */}
      <AnimatePresence>
        {groupType && groupType !== 'family' && (
          <motion.div key={`dynamics-${groupType}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -8 }}>
            <p className="text-xs font-semibold mb-3" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {groupType === 'solo'   && 'What kind of solo trip?'}
              {groupType === 'couple' && 'What kind of couple trip?'}
              {groupType === 'group'  && 'What\'s the group vibe?'}
            </p>
            <div className="flex flex-col gap-2">
              {getDynamicsOptions(groupType).map((opt) => {
                const sel = groupDynamics?.subType === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => handleDynamicsSelect(opt.value as GroupDynamicsPayload['subType'])}
                    whileHover={{ scale: 1.01, x: 3 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-3.5 px-4 py-3.5 rounded-xl border text-left transition-colors"
                    style={sel
                      ? { borderColor: '#9b87e0', background: 'rgba(123,111,207,0.10)' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                    }
                  >
                    <span className="text-xl shrink-0 leading-none">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight"
                        style={{ color: sel ? '#b8b0f0' : 'rgba(255,255,255,0.9)' }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>
                        {opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xs font-bold shrink-0" style={{ color: PURPLE }}>✓</motion.span>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pace — reveals after dynamics answered (or immediately after Family is picked) */}
      <AnimatePresence>
        {groupType && dynamicsAnswered && (
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
                      ? { borderColor: PURPLE, background: 'rgba(123,111,207,0.10)' }
                      : { borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }
                    }
                  >
                    <span className="text-xl shrink-0 leading-none">{opt.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold leading-tight"
                        style={{ color: sel ? '#b8b0f0' : 'rgba(255,255,255,0.9)' }}>
                        {opt.label}
                      </div>
                      <div className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED }}>
                        {opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-xs font-bold shrink-0" style={{ color: PURPLE }}>✓</motion.span>
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

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDynamicsOptions(groupType: string) {
  if (groupType === 'solo')   return SOLO_DYNAMICS;
  if (groupType === 'couple') return COUPLE_DYNAMICS;
  if (groupType === 'group')  return GROUP_DYNAMICS;
  return [];
}

function resolveDynamicsLabel(groupType: string, subType?: string): string | null {
  if (!subType) return null;
  const all = [...SOLO_DYNAMICS, ...COUPLE_DYNAMICS, ...GROUP_DYNAMICS];
  const match = all.find((o) => o.value === subType);
  return match ? `${match.icon} ${match.label}` : null;
}
