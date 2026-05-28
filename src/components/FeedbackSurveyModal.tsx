'use client';

/**
 * FeedbackSurveyModal — 5-question micro-survey shown on the results page
 * ~45 s after the user lands. Quiet-luxury glass styling, RTL Hebrew copy.
 *
 * Submission posts to /api/feedback. Whether submitted or dismissed, the
 * parent records a localStorage flag so it never reappears for the same
 * itinerary.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const IVORY       = '#f1ece3';
const IVORY_DIM   = 'rgba(241,236,227,0.62)';
const IVORY_FAINT = 'rgba(241,236,227,0.4)';
const ACCENT      = '#c4a26a';
const STAR_ON     = '#e2c178';
const STAR_OFF    = 'rgba(241,236,227,0.18)';
const SURFACE     = 'rgba(255,255,255,0.04)';
const SURFACE_SEL = 'rgba(196,162,106,0.10)';
const BORDER      = '1px solid rgba(255,255,255,0.08)';
const BORDER_SEL  = `1px solid ${ACCENT}`;

export interface FeedbackPayload {
  searchAccuracy: number | null;
  readability: number | null;
  recommendationsHelpful: 'yes' | 'partial' | 'no' | null;
  waitTime: 'fast' | 'fair' | 'slow' | null;
  missingFeedback: string;
}

interface Props {
  open: boolean;
  /** Returns true on a confirmed save, false on any failure. */
  onSubmit: (payload: FeedbackPayload) => Promise<boolean>;
  onDismiss: () => void;
}

const HELP_OPTIONS: Array<{ value: 'yes' | 'partial' | 'no'; label: string }> = [
  { value: 'yes',     label: 'כן, לגמרי' },
  { value: 'partial', label: 'חלקית, היה חסר לי מידע' },
  { value: 'no',      label: 'לא ממש' },
];

const WAIT_OPTIONS: Array<{ value: 'fast' | 'fair' | 'slow'; label: string }> = [
  { value: 'fast', label: 'מהירים מאוד' },
  { value: 'fair', label: 'סבירים לחלוטין' },
  { value: 'slow', label: 'איטיים מדי' },
];

export function FeedbackSurveyModal({ open, onSubmit, onDismiss }: Props) {
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [readability, setReadability] = useState<number | null>(null);
  const [helpful, setHelpful] = useState<'yes' | 'partial' | 'no' | null>(null);
  const [wait, setWait] = useState<'fast' | 'fair' | 'slow' | null>(null);
  const [missing, setMissing] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(false);

  const canSubmit = accuracy != null || readability != null || helpful != null || wait != null || missing.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(false);
    // Only show the thank-you state on a CONFIRMED save — never optimistically.
    const ok = await onSubmit({
      searchAccuracy: accuracy,
      readability,
      recommendationsHelpful: helpful,
      waitTime: wait,
      missingFeedback: missing.trim(),
    });
    setSubmitting(false);
    if (ok) setDone(true);
    else setError(true);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          dir="rtl"
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0"
            style={{ background: 'rgba(6,12,18,0.62)', backdropFilter: 'blur(6px)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
          />

          {/* Card */}
          <motion.div
            className="relative w-full max-w-md rounded-3xl p-6 sm:p-7 overflow-y-auto"
            style={{
              maxHeight: '90vh',
              background: 'linear-gradient(180deg, rgba(20,30,42,0.96), rgba(13,20,30,0.97))',
              border: BORDER,
              boxShadow: '0 1px 0 rgba(255,255,255,0.06) inset, 0 40px 90px -40px rgba(0,0,0,0.8)',
              backdropFilter: 'blur(24px)',
            }}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 28 } }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
          >
            {/* Close */}
            <button
              onClick={onDismiss}
              aria-label="סגירה"
              className="absolute top-4 left-4 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              style={{ color: IVORY_FAINT, border: '1px solid rgba(255,255,255,0.10)' }}
            >
              ✕
            </button>

            {done ? (
              <DoneState />
            ) : (
              <>
                {/* Header */}
                <div className="text-center mb-6 pt-1">
                  <h2 className="font-serif text-[22px] leading-tight" style={{ color: IVORY, fontWeight: 400 }}>
                    נשמח לשמוע את דעתך! ✈️
                  </h2>
                  <p className="mt-2 text-[12.5px] leading-relaxed" style={{ color: IVORY_DIM }}>
                    כמה שאלות קצרות כדי שנוכל להמשיך לדייק את הטיולים שלכם עם Sarto.
                  </p>
                </div>

                <div className="flex flex-col gap-6">
                  {/* Q1 — accuracy */}
                  <Question
                    index={1}
                    text="עד כמה תוצאות החיפוש היו מדויקות למה שחיפשת?"
                    hint="1 = בכלל לא · 5 = קלע בול!"
                  >
                    <StarRow value={accuracy} onChange={setAccuracy} />
                  </Question>

                  {/* Q2 — readability */}
                  <Question
                    index={2}
                    text="עד כמה היה נוח וברור לקרוא את המסלול וההמלצות?"
                    hint="1 = מסורבל · 5 = ברור ונוח מאוד"
                  >
                    <StarRow value={readability} onChange={setReadability} />
                  </Question>

                  {/* Q3 — helpful */}
                  <Question index={3} text="האם ההמלצות שקיבלת עזרו לך להתקדם בתכנון הטיול?">
                    <RadioRow options={HELP_OPTIONS} value={helpful} onChange={(v) => setHelpful(v as typeof helpful)} />
                  </Question>

                  {/* Q4 — wait time */}
                  <Question index={4} text="איך היו זמני ההמתנה עד לקבלת המסלול?">
                    <RadioRow options={WAIT_OPTIONS} value={wait} onChange={(v) => setWait(v as typeof wait)} />
                  </Question>

                  {/* Q5 — free text */}
                  <Question index={5} text="מה הדבר האחד שהיה חסר לך כאן? (אופציונלי)">
                    <textarea
                      value={missing}
                      onChange={(e) => setMissing(e.target.value)}
                      rows={3}
                      placeholder="טקסט חופשי…"
                      maxLength={1000}
                      className="w-full rounded-xl px-3.5 py-3 text-[13px] resize-none focus:outline-none transition-colors"
                      style={{ background: SURFACE, border: BORDER, color: IVORY }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = ACCENT; }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                    />
                  </Question>
                </div>

                {/* Error */}
                {error && (
                  <p className="mt-4 text-center text-[12px] leading-relaxed" style={{ color: '#e2a0a0' }}>
                    לא הצלחנו לשמור את המשוב כרגע — בדקו את החיבור ונסו שוב.
                  </p>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitting}
                  className="mt-6 w-full py-3.5 rounded-xl font-semibold text-[14px] transition-all"
                  style={{
                    background: canSubmit ? ACCENT : 'rgba(255,255,255,0.05)',
                    color: canSubmit ? '#1a1308' : IVORY_FAINT,
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    boxShadow: canSubmit ? '0 10px 28px -10px rgba(196,162,106,0.55)' : 'none',
                  }}
                >
                  {submitting ? 'שולח…' : error ? 'נסה שוב' : 'שליחת משוב'}
                </button>
                <button
                  onClick={onDismiss}
                  className="mt-2 w-full py-2 text-[12px] transition-colors"
                  style={{ color: IVORY_FAINT }}
                >
                  אולי בפעם אחרת
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Question({
  index,
  text,
  hint,
  children,
}: {
  index: number;
  text: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[13.5px] leading-snug mb-2.5" style={{ color: IVORY }}>
        <span style={{ color: ACCENT, fontWeight: 700 }}>{index}.</span>{' '}
        {text}
      </p>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11px]" style={{ color: IVORY_FAINT }}>
          {hint}
        </p>
      )}
    </div>
  );
}

function StarRow({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const active = hover ?? value ?? 0;
  return (
    <div className="flex gap-1.5 flex-row-reverse justify-end" onMouseLeave={() => setHover(null)}>
      {[5, 4, 3, 2, 1].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          aria-label={`${star} מתוך 5`}
          className="text-[26px] leading-none transition-transform"
          style={{
            color: star <= active ? STAR_ON : STAR_OFF,
            transform: star <= active ? 'scale(1.05)' : 'scale(1)',
          }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function RadioRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const sel = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-right transition-colors"
            style={{ background: sel ? SURFACE_SEL : SURFACE, border: sel ? BORDER_SEL : BORDER }}
          >
            <span
              className="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
              style={{ border: `1.5px solid ${sel ? ACCENT : 'rgba(255,255,255,0.25)'}` }}
            >
              {sel && <span className="w-2 h-2 rounded-full" style={{ background: ACCENT }} />}
            </span>
            <span className="text-[13px]" style={{ color: sel ? IVORY : IVORY_DIM }}>
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DoneState() {
  return (
    <motion.div
      className="py-10 text-center flex flex-col items-center gap-3"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(196,162,106,0.15)', border: `1px solid ${ACCENT}` }}
      >
        <span className="text-2xl">✓</span>
      </div>
      <h3 className="font-serif text-[20px]" style={{ color: IVORY, fontWeight: 400 }}>
        תודה רבה! 🙏
      </h3>
      <p className="text-[12.5px] max-w-[260px]" style={{ color: IVORY_DIM }}>
        המשוב שלך עוזר לנו לדייק את הטיולים הבאים שלך עם Sarto.
      </p>
    </motion.div>
  );
}
