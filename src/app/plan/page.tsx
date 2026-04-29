'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { questions } from '@/lib/questionnaire';
import { TravelerProfile } from '@/lib/types';
import type { DestinationSuggestion } from '@/app/api/discover/route';

type FormData = Record<string, unknown>;

const STORAGE_KEY = 'travelos_plan_draft';
const TOTAL = questions.length;

// ─── Spring variants ──────────────────────────────────────────────────────────

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
  show: {
    transition: { staggerChildren: 0.055 },
  },
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

// ─── Destination picker ───────────────────────────────────────────────────────

function DestinationPicker({
  suggestions,
  onPick,
  onClose,
}: {
  suggestions: DestinationSuggestion[];
  onPick: (name: string) => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-lg bg-[#0f1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
        >
          <div className="px-6 py-5 border-b border-white/10">
            <h3 className="font-bold text-white text-lg">✨ Your perfect matches</h3>
            <p className="text-sm text-white/50 mt-0.5">
              Based on your vibe, budget, and interests — pick one.
            </p>
          </div>
          <motion.div
            className="p-4 flex flex-col gap-3 max-h-[60vh] overflow-y-auto"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {suggestions.map((dest) => (
              <motion.button
                key={dest.name}
                variants={optionVariant}
                onClick={() => onPick(dest.name)}
                whileHover={{ scale: 1.02, x: 4 }}
                whileTap={{ scale: 0.98 }}
                className="text-left p-4 rounded-2xl border border-white/10 bg-white/5 hover:border-[#ff5a5f]/60 hover:bg-[#ff5a5f]/10 transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl flex-shrink-0">{dest.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white group-hover:text-[#ff5a5f] transition-colors">
                        {dest.name}
                      </span>
                      <span className="text-xs text-white/40">{dest.country}</span>
                      <span className="text-[10px] bg-white/10 text-white/60 px-2 py-0.5 rounded-full">
                        {dest.vibe}
                      </span>
                    </div>
                    <p className="text-sm text-white/40 mt-0.5 italic">{dest.tagline}</p>
                    <p className="text-xs text-white/60 mt-1.5 leading-relaxed">{dest.whyMatch}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
          <div className="px-4 pb-4">
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Never mind, I'll type a destination
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Loading screen ───────────────────────────────────────────────────────────

const getLoadingSteps = (dest: string) => [
  { icon: '📱', label: `Scanning 2026 TikTok trends for ${dest || 'your destination'}…` },
  { icon: '🍜', label: 'Cross-referencing local food blogs for hidden gems…' },
  { icon: '🗺', label: 'Optimizing logistics and neighborhood clusters…' },
  { icon: '✨', label: 'Vibe-checking the itinerary for your squad…' },
  { icon: '💎', label: 'Filtering tourist traps. Your squad deserves better.' },
];

function LoadingScreen({ destination }: { destination: string }) {
  const steps = getLoadingSteps(destination);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setActiveStep((s) => Math.min(s + 1, steps.length - 1)),
      5400,
    );
    return () => clearInterval(id);
  }, [steps.length]);

  const pct = Math.round(((activeStep + 1) / steps.length) * 100);

  return (
    <div className="min-h-screen bg-[#080b12] flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
      {/* Orbs */}
      <div className="noise absolute w-[560px] h-[560px] rounded-full bg-[#ff5a5f]/10 blur-[130px] top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-orb-float" />
      <div className="noise absolute w-[320px] h-[320px] rounded-full bg-[#8b5cf6]/10 blur-[100px] bottom-1/4 right-1/4 pointer-events-none" style={{ animationDelay: '-5s' }} />
      <div className="noise absolute w-[240px] h-[240px] rounded-full bg-[#00d4ff]/8 blur-[80px] top-1/2 left-1/4 pointer-events-none" style={{ animationDelay: '-10s' }} />

      {/* Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        className="mb-8 relative"
      >
        <div className="w-20 h-20 rounded-[1.5rem] bg-[#ff5a5f]/15 border border-[#ff5a5f]/25 flex items-center justify-center text-4xl shadow-xl shadow-[#ff5a5f]/20 animate-glow-pulse">
          ✈️
        </div>
      </motion.div>

      {/* Label + animated headline */}
      <div className="text-[10px] font-semibold text-[#ff5a5f] uppercase tracking-widest mb-3">
        Building your squad's master plan
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
            {steps[activeStep].icon}&nbsp;&nbsp;{steps[activeStep].label}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Step checklist */}
      <div className="flex flex-col gap-2 w-full max-w-xs mb-8">
        {steps.map((step, i) => {
          const done = i < activeStep;
          const active = i === activeStep;
          return (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.09, type: 'spring', stiffness: 380, damping: 28 }}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-left ${
                done    ? 'bg-white/4 border border-white/8' :
                active  ? 'bg-[#ff5a5f]/12 border border-[#ff5a5f]/30' :
                          'opacity-25'
              }`}
            >
              <span className="text-base flex-shrink-0">
                {done ? '✓' : step.icon}
              </span>
              <span className={`text-xs flex-1 leading-snug ${
                done   ? 'text-white/35 line-through' :
                active ? 'text-white font-medium' :
                         'text-white/30'
              }`}>
                {step.label}
              </span>
              {active && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse flex-shrink-0" />
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-xs h-1 bg-white/8 rounded-full overflow-hidden mb-3">
        <motion.div
          className="h-full rounded-full relative overflow-hidden"
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
          style={{ background: 'linear-gradient(90deg, #ff5a5f, #00d4ff)' }}
        >
          <span className="absolute inset-0 animate-shimmer opacity-60" />
        </motion.div>
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { form: savedForm, step: savedStep } = JSON.parse(saved);
        if (savedForm) setForm(savedForm);
        if (typeof savedStep === 'number') setStep(savedStep);
      }
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, step }));
    } catch { /* ignore */ }
  }, [form, step, hydrated]);

  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[] | null>(null);

  const question = questions[step];
  const progress = ((step + 1) / TOTAL) * 100;

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
    if (question.type === 'multi-select') return (val as string[])?.length > 0;
    if (question.type === 'date-range') {
      return !!(form['startDate'] as string) && !!(form['endDate'] as string);
    }
    return !!val;
  };

  const handleNext = () => {
    if (!validate()) {
      setError('Please complete this field before continuing.');
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

  const handleSurpriseMe = async () => {
    setSurpriseLoading(true);
    setError('');
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: form.budget || 'mid-range',
          pace: form.pace || 'moderate',
          interests: form.interests || [],
          groupType: form.groupType || 'couple',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find destinations');
      setSuggestions(data.destinations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load suggestions. Try typing a destination.');
    } finally {
      setSurpriseLoading(false);
    }
  };

  const handlePickDestination = (name: string) => {
    setValue('destination', name);
    setSuggestions(null);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    // Clear stale trip data immediately so a failed or slow generation never
    // shows old content on the itinerary routes.
    try {
      sessionStorage.removeItem('travelos_itinerary');
      sessionStorage.removeItem('travelos_profile');
    } catch { /* ignore */ }

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
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Generation failed');
      }

      const result = await res.json();
      console.log('DEBUG: API Result:', result);

      // API now returns { id: string, itinerary: {...} }
      const itinerary = result.itinerary ?? result;
      sessionStorage.setItem('travelos_itinerary', JSON.stringify(itinerary));
      sessionStorage.setItem('travelos_profile', JSON.stringify(profile));
      localStorage.removeItem(STORAGE_KEY);

      if (typeof result.id === 'string' && result.id.length > 10) {
        console.log('[plan] Navigating to /itinerary/' + result.id);
        router.push('/itinerary/' + result.id);
      } else {
        console.error('[plan] No valid id in API response — raw result:', result);
        router.push('/itinerary');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  if (isSubmitting) return <LoadingScreen destination={(form.destination as string) || ''} />;

  const isLast = step === TOTAL - 1;

  return (
    <>
      {suggestions && (
        <DestinationPicker
          suggestions={suggestions}
          onPick={handlePickDestination}
          onClose={() => setSuggestions(null)}
        />
      )}

      <div className="min-h-screen bg-[#fafaf9] flex flex-col relative overflow-hidden">

        {/* Watercolor orbs — softened for light canvas */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="animate-orb-float absolute w-[700px] h-[700px] rounded-full blur-[160px] -top-40 -left-40"
            style={{ backgroundColor: 'rgba(255,90,95,0.10)' }} />
          <div
            className="animate-orb-float absolute w-[500px] h-[500px] rounded-full blur-[140px] bottom-0 right-0"
            style={{ backgroundColor: 'rgba(139,92,246,0.07)', animationDelay: '-4s' }}
          />
          <div
            className="animate-orb-float absolute w-[300px] h-[300px] rounded-full blur-[120px] top-1/2 left-1/2"
            style={{ backgroundColor: 'rgba(0,212,255,0.06)', animationDelay: '-8s' }}
          />
        </div>

        {/* Top bar */}
        <div className="relative z-10 flex items-center justify-between px-6 py-5 border-b border-[#e7e5e4] bg-[#fafaf9]/80 backdrop-blur-sm">
          <Link href="/" className="text-lg font-semibold tracking-tight text-[#1c1917]">
            Travel<span className="text-[#ff5a5f]">OS</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-[#a8a29e] font-mono tabular-nums">
              {step + 1}<span className="text-[#d6d3d1]"> / {TOTAL}</span>
            </span>
            {step > 0 && (
              <button
                onClick={() => {
                  if (confirm('Clear your answers and start over?')) {
                    localStorage.removeItem(STORAGE_KEY);
                    setForm({ groupSize: 2, interests: [] });
                    setDirection(-1);
                    setStep(0);
                  }
                }}
                className="text-xs text-[#a8a29e] hover:text-[#78716c] transition-colors"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative z-10 h-0.5 bg-[#e7e5e4]">
          <motion.div
            className="h-full"
            style={{
              background: 'linear-gradient(90deg, #ff5a5f, #ff8c8f, #ff5a5f)',
              backgroundSize: '200% 100%',
            }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 200, damping: 30 }}
          />
        </div>

        {/* Question area */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl">

            {/* Step indicator dots */}
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

                  {/* Text input */}
                  {question.type === 'text' && (
                    <div className="flex flex-col gap-3">
                      <input
                        type="text"
                        placeholder={question.placeholder}
                        value={(form[question.key] as string) || ''}
                        onChange={(e) => setValue(question.key, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                        autoFocus
                        className="w-full px-5 py-4 rounded-2xl border border-[#e7e5e4] bg-white shadow-sm focus:border-[#ff5a5f] focus:ring-2 focus:ring-[#ff5a5f]/10 focus:outline-none text-[#1c1917] text-base transition-all placeholder:text-[#a8a29e]"
                      />
                      {question.key === 'destination' && (
                        <motion.button
                          onClick={handleSurpriseMe}
                          disabled={surpriseLoading}
                          whileHover={{ scale: surpriseLoading ? 1 : 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="relative self-start flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white overflow-hidden disabled:opacity-50"
                          style={{
                            background: 'linear-gradient(135deg, #ff5a5f, #8b5cf6, #00d4ff)',
                            backgroundSize: '200% 200%',
                          }}
                        >
                          <span className="absolute inset-0 animate-shimmer opacity-40" />
                          <span className="relative flex items-center gap-1.5">
                            {surpriseLoading ? (
                              <>
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                Finding your squad's perfect match…
                              </>
                            ) : (
                              <>✨ Surprise the squad</>
                            )}
                          </span>
                        </motion.button>
                      )}
                    </div>
                  )}

                  {/* Date range */}
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

                  {/* Single select */}
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
                            animate={selected ? {
                              boxShadow: '0 0 0 2px #ff5a5f, 0 8px 24px -4px rgba(255,90,95,0.18)',
                            } : {
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}
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

                  {/* Multi-select */}
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
                            animate={selected ? {
                              boxShadow: '0 0 0 2px #ff5a5f, 0 6px 20px -4px rgba(255,90,95,0.20)',
                            } : {
                              boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                            transition={{ type: 'spring', stiffness: 450, damping: 22 }}
                            className={`p-3 rounded-2xl border text-center transition-colors ${
                              selected
                                ? 'border-[#ff5a5f] bg-[#fff5f5]'
                                : 'border-[#e7e5e4] bg-white hover:border-[#ff5a5f]/30 hover:bg-[#fff8f8]'
                            }`}
                          >
                            <div className="text-xl mb-1.5">{opt.icon}</div>
                            <div className={`text-xs font-medium leading-tight ${
                              selected ? 'text-[#ff5a5f]' : 'text-[#57534e]'
                            }`}>
                              {opt.label}
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}

                  {/* Slider */}
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

                  {/* Textarea */}
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
                    whileHover={{ scale: 1.04, y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    className="relative px-8 py-3 rounded-xl font-semibold text-sm text-white overflow-hidden shadow-lg shadow-[#ff5a5f]/25"
                    style={{ background: 'linear-gradient(135deg, #ff5a5f 0%, #e04a4f 100%)' }}
                  >
                    <span className="relative z-10">
                      {isLast ? 'Generate Itinerary ✨' : 'Continue →'}
                    </span>
                    <motion.div
                      className="absolute inset-0 bg-white/10"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.4 }}
                    />
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
    </>
  );
}
