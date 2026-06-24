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
import { readTripLanguagePref } from '@/lib/tripLanguagePref';
import type {
  SoloDynamics, CoupleDynamics, GroupDynamics as GroupDyn,
  GroupDynamicsPayload,
} from '@/lib/types';

/**
 * Editorial Warmth pilot — VibeSection reads the results-page warmth tokens
 * (paper / sunrise / ink-warm from globals.css) directly instead of the shared
 * onboardingTheme. Same shape as THEME so a green-lit rollout is just copying
 * these values into onboardingTheme.ts.
 */
const WARM = {
  gold:       'var(--color-sunrise-deep)',         // accent: selection dot (contrast-safe on paper)
  goldSoft:   'rgba(184,119,46,0.45)',             // faint accent (chevrons)
  ink:        'var(--color-ink-warm)',             // strongest text
  deepGreen:  'var(--color-ink-warm)',             // headlines
  textBody:   'var(--color-ink-warm)',             // card option titles
  textMuted:  'var(--color-ink-warm-mut)',         // sub-labels
  textFaint:  '#9a8f7e',                           // hints, tertiary copy (warm faint)
  ivory:      'var(--color-paper)',                // page ground
  surface:    '#fffdf7',                           // warm-white card on paper
  surfaceSel: '#f6ead2',                           // sunrise-tinted selected card
  border:     'rgba(43,38,34,0.12)',               // unselected border (warm ink, faint)
  borderSel:  'var(--color-sunrise-deep)',         // selected border
} as const;

const CARD_SHADOW = 'var(--shadow-card)';

const BORDER = `1px solid ${WARM.border}`;
const BORDER_SEL = `1px solid ${WARM.borderSel}`;

const GROUP_OPTIONS = [
  { value: 'solo',   label: 'Solo',   labelHe: 'סולו',  sub: 'Just me',     subHe: 'רק אני'   },
  { value: 'couple', label: 'Couple', labelHe: 'זוג',   sub: 'Two of us',   subHe: 'שנינו'    },
  { value: 'family', label: 'Family', labelHe: 'משפחה', sub: 'Kids in tow', subHe: 'עם ילדים' },
  { value: 'group',  label: 'Group',  labelHe: 'חבורה', sub: '3+ friends',  subHe: '3+ חברים' },
] as const;

const PACE_OPTIONS = [
  { value: 'relaxed',  label: 'Slow & Intentional', labelHe: 'איטי ומכוון', sub: '2–3 stops a day, room to breathe',      subHe: '2–3 עצירות ביום, מקום לנשום' },
  { value: 'moderate', label: 'A Measured Pace',    labelHe: 'קצב מדוד',    sub: 'A balanced mix of sights and downtime', subHe: 'איזון בין אתרים למנוחה'      },
  { value: 'intense',  label: 'See It All',         labelHe: 'לראות הכל',   sub: 'Pack the days — make every hour count', subHe: 'ימים גדושים — לנצל כל שעה'   },
] as const;

// ── Dynamics (style of travel within the chosen group type) ──────────────────
// Editorial voice: short serif noun + four-word sub. Family is intentionally
// excluded — its dynamics are derived from the kids-ages composition.

const SOLO_DYN: Array<{ value: SoloDynamics; label: string; labelHe: string; sub: string; subHe: string }> = [
  { value: 'digital-nomad', label: 'Nomad',    labelHe: 'נווד',  sub: 'Work-friendly cafés, slow afternoons', subHe: 'בתי קפה לעבודה, אחר-צהריים רגוע' },
  { value: 'deep-recharge', label: 'Recharge', labelHe: 'טעינה', sub: 'Quiet spaces, intentional solitude',   subHe: 'מקומות שקטים, בדידות מכוונת'      },
  { value: 'adventure',     label: 'Seeker',   labelHe: 'מחפש',  sub: 'Off-the-grid, edge-of-map',            subHe: 'הרחק מהמסלול, בקצה המפה'         },
];

const COUPLE_DYN: Array<{ value: CoupleDynamics; label: string; labelHe: string; sub: string; subHe: string }> = [
  { value: 'romantic',     label: 'Romantic',       labelHe: 'רומנטי',       sub: 'Candlelit dinners, quiet streets', subHe: 'ארוחות לאור נרות, רחובות שקטים' },
  { value: 'parent-child', label: 'Parent & Child', labelHe: 'הורה וילד',    sub: 'One adult, one child',             subHe: 'מבוגר אחד, ילד אחד'            },
  { value: 'reconnecting', label: 'Reconnecting',   labelHe: 'התחברות מחדש', sub: 'Old chapters, new pages',          subHe: 'פרקים ישנים, דפים חדשים'        },
];

const GROUP_DYN: Array<{ value: GroupDyn; label: string; labelHe: string; sub: string; subHe: string }> = [
  { value: 'best-friends', label: 'Inner Circle',      labelHe: 'מעגל קרוב',     sub: 'Old friends, inside jokes', subHe: 'חברים ותיקים, בדיחות פנימיות' },
  { value: 'mixed-ages',   label: 'Mixed Generations', labelHe: 'דורות מעורבים', sub: 'Pace tuned to every age',   subHe: 'קצב שמתאים לכל גיל'           },
  { value: 'work-crew',    label: 'Colleagues',        labelHe: 'קולגות',        sub: 'Coworkers, off the clock',  subHe: 'עמיתים, אחרי העבודה'          },
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

  const he = (readTripLanguagePref() ?? 'en') === 'he';
  const dynamicsOptions = dynamicsForGroup(groupType);
  const needsDynamics = dynamicsOptions.length > 0; // family skips
  const dynamicsAnswered = !needsDynamics || groupDynamics !== null;

  // ── Completed summary bar ──────────────────────────────────────────────────
  if (isCompleted) {
    const groupOpt = GROUP_OPTIONS.find((g) => g.value === groupType);
    const paceOpt  = PACE_OPTIONS.find((p) => p.value === pace);
    const compositionLine = composeSummary(groupType, familyAdults, familyChildAges, groupSize, he);
    const dynamicsOpt = groupDynamics
      ? [...SOLO_DYN, ...COUPLE_DYN, ...GROUP_DYN].find((d) => d.value === groupDynamics.subType)
      : null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between px-6 py-4 rounded-2xl"
        style={{
          background: WARM.surface,
          border: BORDER,
          boxShadow: CARD_SHADOW,
        }}
      >
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="font-serif text-base tracking-tight" style={{ color: WARM.deepGreen }}>
            {groupOpt ? (he ? groupOpt.labelHe : groupOpt.label) : ''}
          </span>
          {compositionLine && (
            <span className="text-xs tracking-wide" style={{ color: WARM.textMuted }}>
              · {compositionLine}
            </span>
          )}
          {dynamicsOpt && (
            <span className="text-xs tracking-wide" style={{ color: WARM.textMuted }}>
              · {he ? dynamicsOpt.labelHe : dynamicsOpt.label}
            </span>
          )}
          {paceOpt && (
            <span className="text-xs tracking-wide" style={{ color: WARM.textMuted }}>
              · {he ? paceOpt.labelHe : paceOpt.label}
            </span>
          )}
        </div>
        <button
          onClick={onEdit}
          className="text-[11px] uppercase tracking-[0.18em] px-3 py-1.5 rounded-full transition-colors"
          style={{ color: WARM.textMuted, border: BORDER }}
        >
          {he ? 'עריכה' : 'Edit'}
        </button>
      </motion.div>
    );
  }

  // ── Active form ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-7">
      {/* Group type — card grid */}
      <div
        className="rounded-3xl p-3"
        style={{
          background: WARM.surface,
          border: BORDER,
          boxShadow: CARD_SHADOW,
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
                className="relative px-5 py-5 rounded-2xl text-start transition-colors"
                style={{
                  background: sel ? WARM.surfaceSel : WARM.surface,
                  border: sel ? BORDER_SEL : BORDER,
                }}
              >
                <div
                  className="font-serif text-[19px] leading-none tracking-[-0.01em]"
                  style={{ color: sel ? WARM.deepGreen : WARM.textBody }}
                >
                  {he ? opt.labelHe : opt.label}
                </div>
                <div
                  className="mt-2 text-[11px] tracking-wide"
                  style={{ color: sel ? WARM.textMuted : WARM.textFaint }}
                >
                  {he ? opt.subHe : opt.sub}
                </div>
                {sel && (
                  <motion.span
                    layoutId="vibe-group-dot"
                    className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full"
                    style={{ background: WARM.gold }}
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
            className="rounded-3xl p-6"
            style={{
              background: WARM.surface,
              border: BORDER,
              boxShadow: CARD_SHADOW,
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: WARM.textMuted }}>
              {he ? 'הרכב המשפחה' : 'Family composition'}
            </p>

            <div className="flex flex-col gap-5">
              {/* Adults */}
              <FieldRow label={he ? 'מבוגרים' : 'Adults'}>
                <QuietSelect
                  value={String(familyAdults)}
                  onChange={(v) => setFamilyAdults(Number(v))}
                  options={[
                    { value: '1', label: he ? 'מבוגר אחד' : '1 adult'  },
                    { value: '2', label: he ? '2 מבוגרים' : '2 adults' },
                  ]}
                />
              </FieldRow>

              {/* Children count */}
              <FieldRow label={he ? 'ילדים' : 'Children'}>
                <QuietSelect
                  value={String(familyChildAges.length)}
                  onChange={(v) => setFamilyChildCount(Number(v))}
                  options={Array.from({ length: 9 }, (_, i) => ({
                    value: String(i),
                    label: he
                      ? (i === 0 ? 'ללא ילדים' : i === 1 ? 'ילד אחד' : `${i} ילדים`)
                      : (i === 0 ? 'No children' : i === 1 ? '1 child' : `${i} children`),
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
                    style={{ borderColor: WARM.border }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] pt-3" style={{ color: WARM.textMuted }}>
                      {he ? 'גילאי הילדים' : "Children's ages"}
                    </p>
                    {familyChildAges.map((age, idx) => (
                      <FieldRow key={idx} label={he ? `ילד ${idx + 1}` : `Child ${idx + 1}`} compact>
                        <QuietSelect
                          value={String(age)}
                          onChange={(v) => setFamilyChildAge(idx, Number(v))}
                          options={Array.from({ length: 18 }, (_, n) => ({
                            value: String(n),
                            label: he
                              ? (n === 0 ? 'מתחת לשנה' : n === 1 ? 'שנה' : `${n} שנים`)
                              : (n === 0 ? 'Under 1' : n === 1 ? '1 year' : `${n} years`),
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
            className="rounded-3xl p-6"
            style={{
              background: WARM.surface,
              border: BORDER,
              boxShadow: CARD_SHADOW,
            }}
          >
            <p className="text-[11px] uppercase tracking-[0.22em] mb-5" style={{ color: WARM.textMuted }}>
              {he ? 'גודל החבורה' : 'Group size'}
            </p>
            <FieldRow label={he ? 'סך הנוסעים' : 'Total travelers'}>
              <QuietSelect
                value={String(groupSize)}
                onChange={(v) => setGroupSize(Number(v))}
                options={Array.from({ length: 10 }, (_, i) => {
                  const n = i + 3;
                  return { value: String(n), label: he ? `${n} נוסעים` : `${n} travelers` };
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
            <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: WARM.textMuted }}>
              {groupType === 'solo'  && (he ? 'סגנון הטיול' : 'Style of travel')}
              {groupType === 'couple' && (he ? 'סגנון הטיול' : 'Style of travel')}
              {groupType === 'group'  && (he ? 'אופי החבורה' : 'Group vibe')}
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
                    className="flex items-center justify-between px-5 py-4 rounded-2xl text-start transition-colors"
                    style={{
                      background: sel ? WARM.surfaceSel : WARM.surface,
                      border: sel ? BORDER_SEL : BORDER,
                    }}
                  >
                    <div>
                      <div
                        className="font-serif text-[16px] leading-tight tracking-[-0.01em]"
                        style={{ color: sel ? WARM.deepGreen : WARM.textBody }}
                      >
                        {he ? opt.labelHe : opt.label}
                      </div>
                      <div
                        className="text-[11px] mt-1 tracking-wide"
                        style={{ color: sel ? WARM.textMuted : WARM.textFaint }}
                      >
                        {he ? opt.subHe : opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span
                        layoutId="vibe-dynamics-dot"
                        className="w-1.5 h-1.5 rounded-full shrink-0 ml-3"
                        style={{ background: WARM.gold }}
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
            <p className="text-[11px] uppercase tracking-[0.22em] mb-3" style={{ color: WARM.textMuted }}>
              {he ? 'קצב' : 'Pace'}
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
                    className="flex items-center justify-between px-5 py-4 rounded-2xl text-start transition-colors"
                    style={{
                      background: sel ? WARM.surfaceSel : WARM.surface,
                      border: sel ? BORDER_SEL : BORDER,
                    }}
                  >
                    <div>
                      <div
                        className="font-serif text-[16px] leading-tight tracking-[-0.01em]"
                        style={{ color: sel ? WARM.deepGreen : WARM.textBody }}
                      >
                        {he ? opt.labelHe : opt.label}
                      </div>
                      <div
                        className="text-[11px] mt-1 tracking-wide"
                        style={{ color: sel ? WARM.textMuted : WARM.textFaint }}
                      >
                        {he ? opt.subHe : opt.sub}
                      </div>
                    </div>
                    {sel && (
                      <motion.span
                        layoutId="vibe-pace-dot"
                        className="w-1.5 h-1.5 rounded-full shrink-0 ml-3"
                        style={{ background: WARM.gold }}
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
        style={{ color: compact ? WARM.textMuted : WARM.deepGreen }}
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
          color: WARM.textBody,
          border: BORDER,
          background: WARM.surface,
          minWidth: 160,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: '#fff', color: WARM.textBody }}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px]"
        style={{ color: WARM.goldSoft }}
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
  he = false,
): string | null {
  if (groupType === 'family') {
    const adultsLabel = he
      ? `${familyAdults} ${familyAdults === 1 ? 'מבוגר' : 'מבוגרים'}`
      : `${familyAdults} ${familyAdults === 1 ? 'adult' : 'adults'}`;
    if (familyChildAges.length === 0) return adultsLabel;
    const kidsLabel = he
      ? `${familyChildAges.length} ${familyChildAges.length === 1 ? 'ילד' : 'ילדים'}`
      : `${familyChildAges.length} ${familyChildAges.length === 1 ? 'child' : 'children'}`;
    return `${adultsLabel}, ${kidsLabel}`;
  }
  if (groupType === 'group') return he ? `${groupSize} נוסעים` : `${groupSize} travelers`;
  return null;
}
