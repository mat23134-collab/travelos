'use client';

/**
 * VibeSection — Step 3 of the progressive onboarding flow.
 *
 * Quiet-Luxury redesign (2026-05):
 *   • Layered glass surfaces with soft, low-contrast shadows.
 *   • Minimal selection state — a precise 1-px ivory border, no glow.
 *   • Sharp typography pairing (serif headline + tight sans tracking).
 *   • Conditional composition inputs:
 *       Family → 1-2 Adults · 0-8 Children · Age 0-17 per child.
 *       Group  → total head count 3-12.
 *       Solo / Couple → no extra inputs.
 *   • Pace tile-row uses the same minimal selection language.
 *
 * Advances are driven by the onboarding-page footer CTA — this section
 * never auto-advances on selection.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useOnboardingStore } from '@/state/onboardingStore';
import type {
  SoloDynamics, CoupleDynamics, GroupDynamics as GroupDyn,
  GroupDynamicsPayload,
} from '@/lib/types';

const IVORY = '#f1ece3';
const IVORY_DIM = 'rgba(241,236,227,0.55)';
const IVORY_FAINT = 'rgba(241,236,227,0.32)';
const ACCENT = '#c4a26a';          // muted warm gold — quiet luxury accent
const ACCENT_SOFT = 'rgba(196,162,106,0.35)';
const SURFACE = 'rgba(255,255,255,0.04)';
const SURFACE_SEL = 'rgba(196,162,106,0.05)';
const BORDER = '1px solid rgba(255,255,255,0.07)';
const BORDER_SEL = `1px solid ${ACCENT}`;

const GROUP_OPTIONS = [
  { value: 'solo',   label: 'Solo',   sub: 'Just me'      },
  { value: 'couple', label: 'Couple', sub: 'Two of us'    },
  { value: 'family', label: 'Family', sub: 'Kids in tow'  },
  { value: 'group',  label: 'Group',  sub: '3+ friends'   },
] as const;

const PACE_OPTIONS = [
  { value: 'relaxed',  label: 'Slow & Intentional', sub: '2–3 stops a day, lots of breathing room' },
  { value: 'moderate', label: 'Balanced Explorer',  sub: 'A measured mix of motion and pause'      },
  { value: 'intense',  label: 'Full Throttle',      sub: 'Maximize the hours — no wasted moments' },
] as const;

// ── Dynamics (style of travel within the chosen group type) ──────────────────
// Editorial voice: short serif noun + four-word sub. Family is intentionally
// excluded — its dynamics are derived from the kids-ages composition.

const SOLO_DYN: Array<{ value: SoloDynamics; label: string; sub: string }> = [
  { value: 'digital-nomad', label: 'Nomad',    sub: 'Work-friendly cafés, slow afternoons' },
  { value: 'deep-recharge', label: 'Recharge', sub: 'Quiet spaces, intentional solitude'    },
  { value: 'adventure',     label: 'Seeker',   sub: 'Off-the-grid, edge-of-map'             },
];

const COUPLE_DYN: Array<{ value: CoupleDynamics; label: string; sub: string }> = [
  { value: 'romantic',     label: 'Romantic',       sub: 'Candlelit dinners, quiet streets' },
  { value: 'parent-child', label: 'Parent & Child', sub: 'One adult, one child'             },
  { value: 'reconnecting', label: 'Reconnecting',   sub: 'Old chapters, new pages'          },
];

const GROUP_DYN: Array<{ value: GroupDyn; label: string; sub: string }> = [
  { value: 'best-friends', label: 'Inner Circle',       sub: 'Old friends, inside jokes'    },
  { value: 'mixed-ages',   label: 'Mixed Generations',  sub: 'Pace tuned to every age'      },
  { value: 'work-crew',    label: 'The Crew',           sub: 'Polished, but unbuttoned'     },
];

function dynamicsForGroup(groupType: string) {
  if (groupType === 'solo')   return SOLO_DYN;
  if (groupType === 'couple') return COUPLE_DYN;
  if (groupType === 'group')  return GROUP_DYN;
  return [];
}

interface Props {
  isCompleted: boolean;
  onComplete:  () => void;
  onEdit:      () => void;
}

export function VibeSection({ isCompleted, onEdit }: Props) {
  const {
    groupType, groupDynamics, pace,
    familyAdults, familyChildAges, groupSize,
    setGroupType, setGroupDynamics, setPace,
    setFamilyAdults, setFamilyChildCount, setFamilyChildAge,
    setGroupSize,
  } = useOnboardingStore();

  const dynamicsOptions = dynamicsForGroup(groupType);
  const needsDynamics = dynamicsOptions.length > 0; // family skips
  const dynamicsAnswered = !needsDynamics || groupDynamics !== null;

  // ── Completed summary bar ──────────────────────────────────────────────────
  if (isCompleted) {
    const groupOpt = GROUP_OPTIONS.find((g) => g.value === groupType);
    const paceOpt  = PACE_OPTIONS.find((p) => p.value === pace);
    const compositionLine = composeSummary(groupType, familyAdults, familyChildAges, groupSize);
    const dynamicsOpt = groupDynamics
      ? [...SOLO_DYN, ...COUPLE_DYN, ...GROUP_DYN].find((d) => d.value === groupDynamics.subType)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-4 rounded-2xl backdrop-blur-xl"
        style={{
          background: 'rgba(255,255,255,0.025)',
          border: BORDER,
          boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -16px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-serif text-base text-white tracking-tight" style={{ color: IVORY }}>
            {groupOpt?.label}
          </span>
          {compositionLine && (
            <span className="text-xs tracking-wide" style={{ color: IVORY_DIM }}>
              · {compositionLine}
            </span>
          )}
          {dynamicsOpt && (
            <span className="text-xs tracking-wide" style={{ color: IVORY_DIM }}>
              · {dynamicsOpt.label}
            </span>
          )}
          {paceOpt && (
            <span className="text-xs tracking-wide" style={{ color: IVORY_DIM }}>
              · {paceOpt.label}
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full transition-colors"
          style={{ color: IVORY_DIM, border: '1px solid rgba(255,255,255,0.10)' }}
        >
          Edit
        </button>
      </motion.div>
    );
  }

  // ── Active form ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-7">
      {/* Header */}
      <div>
        <h2
          className="font-serif text-[28px] leading-[1.1] tracking-[-0.015em]"
          style={{ color: IVORY, fontWeight: 400 }}
        >
          Who&apos;s coming with you?
        </h2>
        <p
          className="mt-2 text-[13px] tracking-wide"
          style={{ color: IVORY_DIM }}
        >
          A few quiet questions to shape the restaurants, pace, and venues we choose.
        </p>
      </div>

      {/* Group type — glass card grid */}
      <div
        className="rounded-3xl p-3 backdrop-blur-2xl"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
          border: BORDER,
          boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 50px -30px rgba(0,0,0,0.6)',
        }}
      >
        <div className="grid grid-cols-2 gap-2">
          {GROUP_OPTIONS.map((opt) => {
            const sel = groupType === opt.value;
            return (
              <motion.button
                key={opt.value}
                onClick={() => setGroupType(opt.value)}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="relative px-5 py-5 rounded-2xl text-left transition-colors"
                style={{
                  background: sel ? SURFACE_SEL : SURFACE,
                  border: sel ? BORDER_SEL : BORDER,
                }}
              >
                <div
                  className="font-serif text-[19px] leading-none tracking-[-0.01em]"
                  style={{ color: sel ? IVORY : 'rgba(241,236,227,0.88)' }}
                >
                  {opt.label}
                </div>
                <div
                  className="mt-2 text-[11px] tracking-wide"
                  style={{ color: sel ? IVORY_DIM : IVORY_FAINT }}
                >
                  {opt.sub}
                </div>
                {sel && (
                  <motion.span
                    layoutId="vibe-group-dot"
                    className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full"
                    style={{ background: ACCENT }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Conditional composition inputs */}
      <AnimatePresence mode="wait">
        {groupType === 'family' && (
          <motion.div
            key="family-inputs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
            className="rounded-3xl p-6 backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
              border: BORDER,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 50px -30px rgba(0,0,0,0.6)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: IVORY_DIM }}>
              Family composition
            </p>

            <div className="flex flex-col gap-5">
              {/* Adults */}
              <FieldRow label="Adults">
                <QuietSelect
                  value={String(familyAdults)}
                  onChange={(v) => setFamilyAdults(Number(v))}
                  options={[
                    { value: '1', label: '1 adult'  },
                    { value: '2', label: '2 adults' },
                  ]}
                />
              </FieldRow>

              {/* Children count */}
              <FieldRow label="Children">
                <QuietSelect
                  value={String(familyChildAges.length)}
                  onChange={(v) => setFamilyChildCount(Number(v))}
                  options={Array.from({ length: 9 }, (_, i) => ({
                    value: String(i),
                    label: i === 0 ? 'No children' : i === 1 ? '1 child' : `${i} children`,
                  }))}
                />
              </FieldRow>

              {/* Per-child age dropdowns */}
              <AnimatePresence>
                {familyChildAges.length > 0 && (
                  <motion.div
                    key="child-ages"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.28 } }}
                    exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}
                    className="pt-2 border-t flex flex-col gap-3"
                    style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] pt-3" style={{ color: IVORY_DIM }}>
                      Children&apos;s ages
                    </p>
                    {familyChildAges.map((age, idx) => (
                      <FieldRow key={idx} label={`Child ${idx + 1}`} compact>
                        <QuietSelect
                          value={String(age)}
                          onChange={(v) => setFamilyChildAge(idx, Number(v))}
                          options={Array.from({ length: 18 }, (_, n) => ({
                            value: String(n),
                            label: n === 0 ? 'Under 1' : n === 1 ? '1 year' : `${n} years`,
                          }))}
                        />
                      </FieldRow>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {groupType === 'group' && (
          <motion.div
            key="group-inputs"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
            className="rounded-3xl p-6 backdrop-blur-2xl"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015))',
              border: BORDER,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 50px -30px rgba(0,0,0,0.6)',
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: IVORY_DIM }}>
              Group size
            </p>
            <FieldRow label="Total travelers">
              <QuietSelect
                value={String(groupSize)}
                onChange={(v) => setGroupSize(Number(v))}
                options={Array.from({ length: 10 }, (_, i) => {
                  const n = i + 3;
                  return { value: String(n), label: `${n} travelers` };
                })}
              />
            </FieldRow>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamics — sub-persona within the chosen group type */}
      <AnimatePresence mode="wait">
        {needsDynamics && (
          <motion.div
            key={`dynamics-${groupType}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: IVORY_DIM }}>
              {groupType === 'solo'  && 'Style of travel'}
              {groupType === 'couple' && 'Style of travel'}
              {groupType === 'group'  && 'Group vibe'}
            </p>
            <div className="flex flex-col gap-2">
              {dynamicsOptions.map((opt) => {
                const sel = groupDynamics?.subType === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => setGroupDynamics({ subType: opt.value as GroupDynamicsPayload['subType'] })}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-colors"
                    style={{
                      background: sel ? SURFACE_SEL : SURFACE,
                      border: sel ? BORDER_SEL : BORDER,
                    }}
                  >
                    <div>
                      <div
                        className="font-serif text-[16px] leading-tight tracking-[-0.01em]"
                        style={{ color: sel ? IVORY : 'rgba(241,236,227,0.88)' }}
                      >
                        {opt.label}
                      </div>
                      <div
                        className="text-[11px] mt-1 tracking-wide"
                        style={{ color: sel ? IVORY_DIM : IVORY_FAINT }}
                      >
                        {opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span
                        layoutId="vibe-dynamics-dot"
                        className="w-1.5 h-1.5 rounded-full shrink-0 ml-3"
                        style={{ background: ACCENT }}
                      />
                    )}
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pace — minimal vertical rail */}
      <AnimatePresence>
        {groupType && dynamicsAnswered && (
          <motion.div
            key="pace-section"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.36, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0 }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: IVORY_DIM }}>
              Pace
            </p>
            <div className="flex flex-col gap-2">
              {PACE_OPTIONS.map((opt) => {
                const sel = pace === opt.value;
                return (
                  <motion.button
                    key={opt.value}
                    onClick={() => setPace(opt.value)}
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="flex items-center justify-between px-5 py-4 rounded-2xl text-left transition-colors"
                    style={{
                      background: sel ? SURFACE_SEL : SURFACE,
                      border: sel ? BORDER_SEL : BORDER,
                    }}
                  >
                    <div>
                      <div
                        className="font-serif text-[16px] leading-tight tracking-[-0.01em]"
                        style={{ color: sel ? IVORY : 'rgba(241,236,227,0.88)' }}
                      >
                        {opt.label}
                      </div>
                      <div
                        className="text-[11px] mt-1 tracking-wide"
                        style={{ color: sel ? IVORY_DIM : IVORY_FAINT }}
                      >
                        {opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span
                        layoutId="vibe-pace-dot"
                        className="w-1.5 h-1.5 rounded-full shrink-0 ml-3"
                        style={{ background: ACCENT }}
                      />
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldRow({
  label,
  compact = false,
  children,
}: {
  label: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex items-center justify-between ${compact ? '' : ''}`}>
      <label
        className="text-[13px] tracking-wide"
        style={{ color: compact ? IVORY_DIM : IVORY }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function QuietSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-transparent text-[13px] pr-7 pl-3 py-2 rounded-lg transition-colors cursor-pointer"
        style={{
          color: IVORY,
          border: BORDER,
          background: SURFACE,
          minWidth: 160,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#0d1623', color: IVORY }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
        style={{ color: ACCENT_SOFT }}
      >
        ▾
      </span>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function composeSummary(
  groupType: string,
  familyAdults: number,
  familyChildAges: number[],
  groupSize: number,
): string | null {
  if (groupType === 'family') {
    const adultsLabel = `${familyAdults} ${familyAdults === 1 ? 'adult' : 'adults'}`;
    if (familyChildAges.length === 0) return adultsLabel;
    const kidsLabel = `${familyChildAges.length} ${familyChildAges.length === 1 ? 'child' : 'children'}`;
    return `${adultsLabel}, ${kidsLabel}`;
  }
  if (groupType === 'group') return `${groupSize} travelers`;
  return null;
}
