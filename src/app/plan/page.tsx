// UI Version: 2.0.1 - 2026-04-30T14:00:00Z
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { questions } from '@/lib/questionnaire';
import { TravelerProfile } from '@/lib/types';

type FormData = Record<string, unknown>;

const STORAGE_KEY = 'travelos_plan_draft';
const TOTAL = questions.length;

// ─── Animation variants ───────────────────────────────────────────────────────

const slideVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? 48 : -48,
    scale: 0.97,
  }),
  center: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 380, damping: 30 },
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir > 0 ? -32 : 32,
    scale: 0.97,
    transition: { duration: 0.18, ease: 'easeIn' as const },
  }),
};

const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const optionVariant = {
  hidden: { opacity: 0, y: 16, scale: 0.96 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 28 },
  },
};

// ─── Destination grid (Step 1 — ONLY valid UI for destination) ────────────────

const FEATURED_DESTINATIONS = [
  { name: 'Rome',     country: 'Italy',   flag: '🇮🇹', tagline: 'La Dolce Vita',         accent: '#f97316' },
  { name: 'Paris',    country: 'France',  flag: '🇫🇷', tagline: 'City of Light',          accent: '#a855f7' },
  { name: 'London',   country: 'UK',      flag: '🇬🇧', tagline: 'Iconic & Eclectic',      accent: '#3b82f6' },
  { name: 'Athens',   country: 'Greece',  flag: '🇬🇷', tagline: 'Cradle of Civilization', accent: '#10b981' },
  { name: 'Budapest', country: 'Hungary', flag: '🇭🇺', tagline: 'Paris of the East',      accent: '#ec4899' },
];

function DestinationGrid({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <motion.div
      className="grid grid-cols-2 sm:grid-cols-3 gap-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {FEATURED_DESTINATIONS.map((dest, i) => {
        const selected = value === dest.name;
        return (
          <motion.button
            key={dest.name}
            variants={optionVariant}
            onClick={() => onChange(dest.name)}
            whileHover={{ scale: 1.06, y: -6 }}
            whileTap={{ scale: 0.95 }}
            animate={
              selected
                ? { boxShadow: `0 0 0 3px ${dest.accent}, 0 20px 48px -10px ${dest.accent}66` }
                : { boxShadow: '0 2px 14px rgba(0,0,0,0.08)' }
            }
            transition={{ type: 'spring', stiffness: 400, damping: 24 }}
            className={[
              'relative flex flex-col items-start p-5 rounded-2xl border-2 text-left transition-colors',
              i === 4 ? 'col-span-2 sm:col-span-1' : '',
              selected ? 'bg-white' : 'border-[#e7e5e4] bg-white hover:bg-[#fafaf9]',
            ].join(' ')}
            style={selected ? { borderColor: dest.accent } : {}}
          >
            {selected && (
              <motion.div
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center shadow"
                style={{ backgroundColor: dest.accent }}
              >
                <span className="text-white text-xs font-bold leading-none">✓</span>
              </motion.div>
            )}

            <div className="text-5xl mb-3 leading-none">{dest.flag}</div>
            <div
              className="font-extrabold text-lg leading-tight"
              style={{ color: selected ? dest.accent : '#1c1917' }}
            >
              {dest.name}
            </div>
            <div className="text-xs font-medium text-[#a8a29e] mt-0.5">{dest.country}</div>
            <div className="text-xs text-[#78716c] italic mt-2 leading-snug">{dest.tagline}</div>
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

const LOADING_STEPS = [
  { icon: '📱', label: 'Scanning 2026 travel trends…' },
  { icon: '🍜', label: 'Cross-referencing local food blogs…' },
  { icon: '🗺', label: 'Optimizing neighborhood clusters…' },
  { icon: '✨', label: 'Vibe-checking the itinerary…' },
  { icon: '💎', label: 'Filtering tourist traps. You deserve better.' },
];

function LoadingScreen({ destination }: { destination: string }) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActiveStep((s) => Math.min(s + 1, LOADING_STEPS.length - 1)),
      5400,
    );
    return () => clearInterval(id);
  }, []);

  const pct = Math.round(((activeStep + 1) / LOADING_STEPS.length) * 100);

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      <div className="noise absolute w-[560px] h-[560px] rounded-full bg-[#ff5a5f]/10 blur-[130px] top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="noise absolute w-[320px] h-[320px] rounded-full bg-[#8b5cf6]/10 blur-[100px] bottom-1/4 right-1/4 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="mb-8"
      >
        <div className="w-20 h-20 rounded-[1.5rem] bg-[#ff5a5f]/15 border border-[#ff5a5f]/25 flex items-center justify-center text-4xl shadow-xl shadow-[#ff5a5f]/20">
          ✈️
        </div>
      </motion.div>

      <div className="text-[10px] font-semibold text-[#ff5a5f] uppercase tracking-widest mb-3">
        Building your {destination} itinerary
      </div>

      <div className="h-16 flex items-center justify-center mb-8 w-full max-w-sm">
        <AnimatePresence mode="wait">
          <motion.p
            key={activeStep}
            initial={{ opacity: 0, y: 18, filter: 'blur(4px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="text-lg sm:text-xl font-bold text-white leading-snug"
          >
            {LOADING_STEPS[activeStep].icon}&nbsp;&nbsp;{LOADING_STEPS[activeStep].label}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-2 w-full max-w-xs mb-8">
        {LOADING_STEPS.map((s, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.09, type: 'spring', stiffness: 380, damping: 28 }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left ${
                done ? 'bg-white/4 border border-white/8' :
                active ? 'bg-[#ff5a5f]/12 border border-[#ff5a5f]/30' :
                'opacity-25'
              }`}
            >
              <span className="text-base flex-shrink-0">{done ? '✓' : s.icon}</span>
              <span className={`text-xs flex-1 leading-snug ${
                done ? 'text-white/35 line-through' :
                active ? 'text-white font-medium' :
                'text-white/30'
              }`}>{s.label}</span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse flex-shrink-0" />}
            </motion.div>
          );
        })}
      </div>

      <div className="w-full max-w-xs h-1 bg-white/8 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          style={{ background: 'linear-gradient(90deg, #ff5a5f, #00d4ff)' }}
        />
      </div>
      <p className="text-white/20 text-[10px] tabular-nums">{pct}% · ~30 seconds · AI-powered</p>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlanPage() {
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [form, setForm] = useState<FormData>({ groupSize: 2, interests: [] });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Hard reset on every entry: clear saved draft and always start at Step 1
  useEffect(() => {
    localStorage.removeItem(STORAGE_KEY);
    setStep(0);
    setForm({ groupSize: 2, interests: [] });
  }, []);

  const question = questions[step];
  const progress = ((step + 1) / TOTAL) * 100;

  // Destination is valid only when one of the 5 hardcoded cities is selected
  const destinationChosen = FEATURED_DESTINATIONS.some(
    (d) => d.name === (form.destination as string),
  );
  const continueDisabled = question.key === 'destination' && !destinationChosen;

  const setValue = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  const toggleInterest = useCallback((val: string) => {
    setForm((prev) => {
      const current = (prev.interests as string[]) || [];
      return {
        ...prev,
        interests: current.includes(val)
          ? current.filter((i) => i !== val)
          : [...current, val],
      };
    });
    setError('');
  }, []);

  const validate = () => {
    const val = form[question.key];
    if (!question.required) return true;
    if (question.key === 'destination') return destinationChosen;
    if (question.type === 'multi-select') return (val as string[])?.length > 0;
    if (question.type === 'date-range') {
      return !!(form['startDate'] as string) && !!(form['endDate'] as string);
    }
    return !!val;
  };

  const handleNext = () => {
    if (!validate()) {
      setError(
        question.key === 'destination'
          ? 'Please select a destination to continue.'
          : 'Please complete this field before continuing.',
      );
      return;
    }
    if (step < TOTAL - 1) {
      setDirection(1);
      setStep((s) => s + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep((s) => s - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const start = form['startDate'] as string;
    const end = form['endDate'] as string;
    const duration =
      start && end
        ? Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000))
        : 5;

    const profile: TravelerProfile = {
      destination: (form.destination as string) || '',
      startDate: start || '',
      endDate: end || '',
      duration,
      groupType: (form.groupType as TravelerProfile['groupType']) || 'solo',
      groupSize: (form.groupSize as number) || 1,
      budget: (form.budget as TravelerProfile['budget']) || 'mid-range',
      pace: (form.pace as TravelerProfile['pace']) || 'moderate',
      interests: (form.interests as string[]) || [],
      accommodation: (form.accommodation as TravelerProfile['accommodation']) || 'boutique-hotel',
      dietaryRestrictions: (form.dietaryRestrictions as string) || '',
      mustHave: (form.mustHave as string) || '',
      hotelBooked: (form.hotelBooked as string) || '',
    };

    try {
      sessionStorage.setItem('travelos_profile', JSON.stringify(profile));
      localStorage.removeItem(STORAGE_KEY);

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      const rawText = await res.text();
      console.log('[plan] /api/generate response:', rawText.slice(0, 300));

      let result: { id?: string; itinerary?: unknown; error?: string; details?: string } = {};
      try {
        result = JSON.parse(rawText);
      } catch {
        throw new Error('Server returned a non-JSON response: ' + rawText.slice(0, 200));
      }

      if (!res.ok || result.error) {
        const detail = result.details ? ` (${result.details})` : '';
        throw new Error((result.error || `Server error ${res.status}`) + detail);
      }

      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const itineraryId = result.id ?? '';
      if (!UUID_RE.test(itineraryId)) {
        throw new Error('Invalid ID returned: "' + itineraryId + '"');
      }

      if (result.itinerary) {
        sessionStorage.setItem('travelos_itinerary', JSON.stringify(result.itinerary));
      }

      router.push('/itinerary/' + itineraryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) return <LoadingScreen destination={(form.destination as string) || ''} />;

  const isLast = step === TOTAL - 1;

  return (
    <div className="min-h-screen bg-[#fafaf9] flex flex-col relative overflow-hidden">

      {/* Background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-orb-float absolute w-[700px] h-[700px] rounded-full blur-[160px] -top-40 -left-40"
          style={{ backgroundColor: 'rgba(255,90,95,0.10)' }} />
        <div className="animate-orb-float absolute w-[500px] h-[500px] rounded-full blur-[140px] bottom-0 right-0"
          style={{ backgroundColor: 'rgba(139,92,246,0.07)', animationDelay: '-4s' }} />
        <div className="animate-orb-float absolute w-[300px] h-[300px] rounded-full blur-[120px] top-1/2 left-1/2"
          style={{ backgroundColor: 'rgba(0,212,255,0.06)', animationDelay: '-8s' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[#e7e5e4] bg-[#fafaf9]/80 backdrop-blur-sm">
        <Link href="/" className="text-lg font-semibold tracking-tight text-[#1c1917]">
          Travel<span className="text-[#ff5a5f]">OS</span>
        </Link>
        <span className="text-sm text-[#a8a29e] font-mono tabular-nums">
          {step + 1}<span className="text-[#d6d3d1]"> / {TOTAL}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 h-0.5 bg-[#e7e5e4]">
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, #ff5a5f, #ff8c8f, #ff5a5f)' }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        />
      </div>

      {/* Question area */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">

          {/* Step dots */}
          <div className="flex items-center gap-1.5 mb-8 justify-center">
            {questions.map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  width: i === step ? 20 : 6,
                  opacity: i <= step ? 1 : 0.4,
                  backgroundColor: i <= step ? '#ff5a5f' : '#d6d3d1',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="h-1.5 rounded-full"
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              {/* Question header */}
              <div className="mb-7">
                <motion.div
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="text-xs font-semibold text-[#ff5a5f] uppercase tracking-widest mb-2"
                >
                  Step {step + 1}
                </motion.div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#1c1917] leading-tight mb-2">
                  {question.title}
                </h2>
                {question.subtitle && (
                  <p className="text-[#78716c] text-base">{question.subtitle}</p>
                )}
              </div>

              {/* Input area */}
              <div className="mb-6">

                {/* ── Step 1: destination cards — NO text input ── */}
                {question.key === 'destination' && (
                  <DestinationGrid
                    value={(form.destination as string) || ''}
                    onChange={(v) => setValue('destination', v)}
                  />
                )}

                {/* ── Text (non-destination) ── */}
                {question.type === 'text' && question.key !== 'destination' && (
                  <input
                    type="text"
                    placeholder={question.placeholder}
                    value={(form[question.key] as string) || ''}
                    onChange={(e) => setValue(question.key, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                    autoFocus
                    className="w-full px-5 py-4 rounded-2xl border border-[#e7e5e4] bg-white shadow-sm focus:border-[#ff5a5f] focus:ring-2 focus:ring-[#ff5a5f]/10 focus:outline-none text-[#1c1917] text-base transition-all placeholder:text-[#a8a29e]"
                  />
                )}

                {/* ── Date range ── */}
                {question.type === 'date-range' && (
                  <div className="grid grid-cols-2 gap-3">
                    {(['startDate', 'endDate'] as const).map((key, i) => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-[#a8a29e] mb-1.5">
                          {i === 0 ? 'Departure' : 'Return'}
                        </label>
                        <input
                          type="date"
                          value={(form[key] as string) || ''}
                          onChange={(e) => setValue(key, e.target.value)}
                          className="w-full px-4 py-3.5 rounded-2xl border border-[#e7e5e4] bg-white shadow-sm focus:border-[#ff5a5f] focus:outline-none text-[#1c1917] transition-all"
                          min={
                            key === 'endDate'
                              ? (form['startDate'] as string) || new Date().toISOString().split('T')[0]
                              : new Date().toISOString().split('T')[0]
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Single select ── */}
                {question.type === 'select' && question.options && (
                  <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {question.options.map((opt) => {
                      const selected = form[question.key] === opt.value;
                      return (
                        <motion.button
                          key={opt.value}
                          variants={optionVariant}
                          onClick={() => setValue(question.key, opt.value)}
                          whileHover={{ scale: 1.03, y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          animate={
                            selected
                              ? { boxShadow: '0 0 0 2px #ff5a5f, 0 8px 24px -4px rgba(255,90,95,0.18)' }
                              : { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
                          }
                          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                          className={`text-left p-4 rounded-2xl border transition-colors ${
                            selected
                              ? 'border-[#ff5a5f] bg-[#fff5f5]'
                              : 'border-[#e7e5e4] bg-white hover:border-[#ff5a5f]/35 hover:bg-[#fff8f8]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {opt.icon && <span className="text-2xl mt-0.5 flex-shrink-0">{opt.icon}</span>}
                            <div>
                              <div className={`font-semibold text-sm ${selected ? 'text-[#ff5a5f]' : 'text-[#1c1917]'}`}>
                                {opt.label}
                              </div>
                              {opt.description && (
                                <div className="text-xs text-[#a8a29e] mt-0.5">{opt.description}</div>
                              )}
                            </div>
                            {selected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="ml-auto w-5 h-5 rounded-full bg-[#ff5a5f] flex items-center justify-center flex-shrink-0"
                              >
                                <span className="text-white text-[10px]">✓</span>
                              </motion.div>
                            )}
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── Multi-select ── */}
                {question.type === 'multi-select' && question.options && (
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                  >
                    {question.options.map((opt) => {
                      const selected = ((form[question.key] as string[]) || []).includes(opt.value);
                      return (
                        <motion.button
                          key={opt.value}
                          variants={optionVariant}
                          onClick={() => toggleInterest(opt.value)}
                          whileHover={{ scale: 1.06, y: -3 }}
                          whileTap={{ scale: 0.94 }}
                          animate={
                            selected
                              ? { boxShadow: '0 0 0 2px #ff5a5f, 0 6px 20px -4px rgba(255,90,95,0.20)' }
                              : { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }
                          }
                          transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                          className={`p-3 rounded-2xl border text-center transition-colors ${
                            selected
                              ? 'border-[#ff5a5f] bg-[#fff5f5]'
                              : 'border-[#e7e5e4] bg-white hover:border-[#ff5a5f]/30 hover:bg-[#fff8f8]'
                          }`}
                        >
                          <div className="text-xl mb-1.5">{opt.icon}</div>
                          <div className={`text-xs font-medium leading-tight ${selected ? 'text-[#ff5a5f]' : 'text-[#57534e]'}`}>
                            {opt.label}
                          </div>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                )}

                {/* ── Slider ── */}
                {question.type === 'slider' && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-[#e7e5e4] bg-white rounded-2xl p-6 shadow-xl shadow-[#ff5a5f]/5"
                  >
                    <div className="text-center mb-8">
                      <motion.span
                        key={(form[question.key] as number) ?? question.min}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-6xl font-bold text-[#1c1917] tabular-nums"
                      >
                        {(form[question.key] as number) ?? question.min ?? 1}
                      </motion.span>
                      <span className="text-[#a8a29e] ml-2 text-xl">
                        {((form[question.key] as number) ?? 1) === 1 ? 'person' : 'people'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={question.min || 1}
                      max={question.max || 20}
                      value={(form[question.key] as number) ?? 2}
                      onChange={(e) => setValue(question.key, Number(e.target.value))}
                      className="w-full accent-[#ff5a5f] cursor-pointer"
                    />
                    <div className="flex justify-between text-xs text-[#a8a29e] mt-2">
                      <span>{question.min}</span>
                      <span>{question.max}+</span>
                    </div>
                  </motion.div>
                )}

                {/* ── Textarea ── */}
                {question.type === 'textarea' && (
                  <textarea
                    placeholder={question.placeholder}
                    value={(form[question.key] as string) || ''}
                    onChange={(e) => setValue(question.key, e.target.value)}
                    rows={4}
                    className="w-full px-5 py-4 rounded-2xl border border-[#e7e5e4] bg-white shadow-sm focus:border-[#ff5a5f] focus:ring-2 focus:ring-[#ff5a5f]/10 focus:outline-none text-[#1c1917] text-base transition-all resize-none placeholder:text-[#a8a29e]"
                  />
                )}
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <motion.button
                  onClick={handleBack}
                  disabled={step === 0}
                  whileHover={{ scale: step === 0 ? 1 : 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-6 py-3 rounded-xl border border-[#e7e5e4] text-[#78716c] font-medium text-sm hover:bg-[#f5f5f4] hover:text-[#1c1917] hover:border-[#d6d3d1] transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                >
                  ← Back
                </motion.button>

                <motion.button
                  onClick={handleNext}
                  disabled={continueDisabled}
                  whileHover={{ scale: continueDisabled ? 1 : 1.04, y: continueDisabled ? 0 : -2 }}
                  whileTap={{ scale: continueDisabled ? 1 : 0.96 }}
                  className="relative px-8 py-3 rounded-xl font-semibold text-sm text-white overflow-hidden shadow-lg shadow-[#ff5a5f]/25 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
                  style={{ background: 'linear-gradient(135deg, #ff5a5f 0%, #e04a4f 100%)' }}
                >
                  <span className="relative z-10">
                    {isLast ? 'Generate Itinerary ✨' : 'Continue →'}
                  </span>
                  {!continueDisabled && (
                    <motion.div
                      className="absolute inset-0 bg-white/10"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </motion.button>
              </div>

              {!question.required && (
                <div className="text-center mt-4">
                  <button
                    onClick={handleNext}
                    className="text-sm text-[#a8a29e] hover:text-[#78716c] transition-colors"
                  >
                    Skip this question
                  </button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
