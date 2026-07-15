'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import type { TripLanguage } from '@/lib/types';
import { persistTripLanguagePref } from '@/lib/tripLanguagePref';
import { TripLanguageGateModal } from '@/components/TripLanguageGateModal';
import { BrandWordmark } from '@/components/BrandWordmark';
import { DESTINATIONS } from '@/lib/destinations';
import type { Destination } from '@/lib/destinations';
import { COUNTRIES } from '@/lib/countries';
import { savePendingIntent } from '@/lib/pendingIntent';
import { CinematicHeroBackground } from '@/components/CinematicHeroBackground';
import { resolveBackgroundImage } from '@/lib/stepBackgrounds';
import { hasRequiredLegalConsent, requestLegalConsent } from '@/lib/legalConsent';

// ── Design tokens ─────────────────────────────────────────────────────────────
// Editorial Warmth palette — warm paper body, terracotta accent, ink text.
// The cinematic hero stays dark (photo + scrim); the body sections are paper.
const NIGHT   = '#efe3cd';   // warm paper — primary body section background
const NIGHT_2 = '#e7dbc2';   // deeper warm sand — alternating section
const REDLINE = '#b8552e';   // terracotta — primary warm accent (was maroon)
const MUTED   = '#6b6358';   // warm muted text (ink-warm-mut)
const INK     = '#2b2622';   // warm near-black — body text/headlines on paper

function buildOnboardingHref(dest: Destination): string {
  const country = COUNTRIES.find((c) => c.cities.some((city) => city.name === dest.name));
  const params = new URLSearchParams({
    destination: dest.name,
    city: dest.name,
    country: country?.name ?? dest.country,
  });
  return `/onboarding?${params.toString()}`;
}

// ── Data ──────────────────────────────────────────────────────────────────────


const FEATURES = [
  { icon: '🧠', title: 'Claude AI Intelligence',   body: 'Analyzes your traveler DNA against live 2026 data to craft plans no generic builder can replicate.' },
  { icon: '🏨', title: 'Hotel Center of Gravity',  body: 'Every day radiates from your hotel. Zero wasted transit. Every stop geo-clustered within walking range.' },
  { icon: '📡', title: 'Live Web Intelligence',    body: 'Real-time blog data, crowd levels, traveler reports. Tourist traps flagged. Hidden gems surfaced.' },
  { icon: '💰', title: 'Budget-Validated',         body: 'Every experience verified against your exact budget tier with current 2026 pricing.' },
];


// ── Postcard card ─────────────────────────────────────────────────────────────

function PostcardCard({
  dest,
  index,
  onSelect,
}: {
  dest: Destination;
  index: number;
  onSelect: (destination: Destination) => void;
}) {
  const [liked, setLiked] = useState(false);
  const photo = resolveBackgroundImage(dest.name, index, dest.country);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.09, type: 'spring', stiffness: 240, damping: 22 }}
      whileHover={{ y: -12, boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}
      onClick={() => onSelect(dest)}
      className="group relative rounded-3xl overflow-hidden cursor-pointer select-none"
      style={{
        height: 340,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        background: '#111827',
      }}
    >
      {/* Photo */}
      <img
        src={photo}
        alt={dest.name}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
      />

      {/* Dark gradient overlay — always present for text readability */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(10,15,26,0.96) 0%, rgba(10,15,26,0.35) 55%, rgba(10,15,26,0.08) 100%)',
        }}
      />

      {/* Redline neon top rule — the TravelOS signature */}
      <div
        className="absolute top-0 inset-x-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 5%, ${REDLINE}88 50%, transparent 95%)` }}
      />

      {/* Heart / favorite */}
      <motion.button
        className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(11,18,32,0.65)', backdropFilter: 'blur(8px)' }}
        onClick={(e) => { e.stopPropagation(); setLiked((l) => !l); }}
        whileTap={{ scale: 0.78 }}
        transition={{ type: 'spring', stiffness: 600, damping: 20 }}
        aria-label={liked ? 'Remove from favourites' : 'Add to favourites'}
      >
        <span style={{ color: liked ? REDLINE : 'rgba(255,255,255,0.45)', fontSize: 13 }}>
          {liked ? '♥' : '♡'}
        </span>
      </motion.button>

      {/* Content */}
      <div className="absolute bottom-0 inset-x-0 p-6 z-10">
        <div
          className="text-xs italic font-light tracking-wide mb-1"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          {dest.tagline}
        </div>
        <div
          className="font-black text-2xl text-white leading-tight"
          style={{ letterSpacing: '-0.03em' }}
        >
          {dest.name}
        </div>
        <div className="text-xs mt-0.5 mb-5" style={{ color: 'rgba(255,255,255,0.32)' }}>
          {dest.country} {dest.flag}
        </div>

        {/* CTA — slides up on hover via group-hover */}
        <div
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white opacity-60 translate-y-0 group-hover:opacity-100 transition-all duration-300"
          style={{ background: REDLINE }}
        >
          Plan this trip →
        </div>
      </div>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [showLangModal,   setShowLangModal]   = useState(false);
  const [showAuthGate,    setShowAuthGate]    = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [pendingDest,     setPendingDest]     = useState<Destination | null>(null);

  // Scroll-aware nav opacity
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // "Start Planning" CTA
  const openPlanningLanguageStep = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) return;
    e.preventDefault();
    if (!hasRequiredLegalConsent()) {
      requestLegalConsent();
      return;
    }
    setPendingDest(null);
    setShowLangModal(true);
  };

  // Postcard click — pre-selects destination
  const handleDestinationSelect = (destination: Destination) => {
    if (!hasRequiredLegalConsent()) {
      requestLegalConsent();
      return;
    }
    setPendingDest(destination);
    setShowLangModal(true);
  };

  const goToOnboarding = (destination: Destination | null) => {
    if (destination) {
      router.push(buildOnboardingHref(destination));
    } else {
      router.push('/onboarding');
    }
  };

  const confirmTripLanguage = (lang: TripLanguage) => {
    persistTripLanguagePref(lang);
    setShowLangModal(false);
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    goToOnboarding(pendingDest);
  };

  // "Continue as guest" from the auth gate — no account needed to plan/generate.
  const continueAsGuest = () => {
    setShowAuthGate(false);
    goToOnboarding(pendingDest);
  };

  // "Log In / Sign Up" from the auth gate — carries the destination through
  // the /auth round trip so it lands the user back on onboarding pre-filled.
  const goToAuthFromGate = () => {
    savePendingIntent({ destination: pendingDest?.name });
  };

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: NIGHT, color: INK }}>

      {/* ── Glassmorphism Nav ──────────────────────────────────────────────── */}
      <motion.nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-8 py-5"
        animate={{
          backgroundColor: scrolled ? 'rgba(11,18,32,0.90)' : 'rgba(11,18,32,0.01)',
          borderBottomColor: scrolled ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0)',
        }}
        transition={{ duration: 0.35 }}
        style={{
          borderBottom: '1px solid',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="text-base font-bold text-white">
          <BrandWordmark accent={REDLINE} className="text-base" />
        </Link>

        <div className="flex items-center gap-5">
          <Link
            href="/onboarding"
            className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors duration-200 hover-text-white"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            onClick={openPlanningLanguageStep}
          >
            Plan a Trip
          </Link>

          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200 hover-lift-sm-brand"
                style={{ background: REDLINE, boxShadow: `0 0 22px rgba(184,85,46,0.40)` }}
              >
                My Trips
              </Link>
            ) : (
              <Link
                href="/auth"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 hover-login-nav"
                style={{
                  color: 'rgba(255,255,255,0.60)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  background: 'rgba(255,255,255,0.05)',
                }}
              >
                Log In
              </Link>
            )
          )}
        </div>
      </motion.nav>

      {/* ── Hero — cinematic video + destination stills ───────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center px-8 py-32 overflow-hidden">
        <CinematicHeroBackground />

        <div className="relative z-10 max-w-3xl mx-auto text-center">

          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
            className="flex items-center justify-center gap-3 mb-8"
          >
            <span className="w-7 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: REDLINE }}
            >
              AI-Powered Travel Intelligence
            </span>
            <span className="w-7 h-px" style={{ background: REDLINE }} />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22, type: 'spring', stiffness: 240, damping: 22 }}
            className="font-black text-white leading-[0.91] mb-7"
            style={{ fontSize: 'clamp(3rem, 7.5vw, 5.75rem)', letterSpacing: '-0.04em' }}
          >
            Where will you
            <br />
            <span style={{ color: 'rgba(255,255,255,0.20)' }}>wake up next?</span>
          </motion.h1>

          {/* Sub-copy */}
          <motion.p
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.30, type: 'spring', stiffness: 240, damping: 24 }}
            className="text-base sm:text-lg leading-relaxed mb-11 mx-auto max-w-xl"
            style={{ color: 'rgba(255,255,255,0.48)', lineHeight: 1.8 }}
          >
            Answer 10 questions. Get a hyper-personal itinerary built from live
            intelligence, verified pricing, and neighborhood-level logistics — in 60 seconds.
          </motion.p>

          {/* Primary CTA — pill-shaped */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, type: 'spring', stiffness: 260, damping: 24 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/onboarding"
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full font-bold text-sm text-white transition-all duration-200 hover-lift-brand"
              style={{
                background: REDLINE,
                boxShadow: `0 0 50px rgba(184,85,46,0.48), 0 4px 24px rgba(184,85,46,0.28)`,
                letterSpacing: '-0.01em',
              }}
              onClick={openPlanningLanguageStep}
            >
              Start Planning
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>

            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              ~60 seconds · No account needed
            </span>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.56, duration: 0.7 }}
            className="flex items-center justify-center gap-12 mt-16 pt-10"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            {[
              { val: '60s',  label: 'To generate'  },
              { val: '10',   label: 'Questions'     },
              { val: '100%', label: 'Personalized'  },
            ].map((s) => (
              <div key={s.val} className="text-center">
                <div
                  className="font-black text-2xl"
                  style={{ color: REDLINE, letterSpacing: '-0.04em' }}
                >
                  {s.val}
                </div>
                <div
                  className="text-[10px] uppercase tracking-[0.2em] mt-0.5"
                  style={{ color: 'rgba(255,255,255,0.22)' }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="w-px h-10"
            style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)' }}
          />
          <span className="text-[9px] uppercase tracking-[0.22em]" style={{ color: 'rgba(255,255,255,0.18)' }}>
            Explore
          </span>
        </motion.div>
      </section>

      {/* ── Destination Postcards ─────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: NIGHT }}>
        <div className="max-w-6xl mx-auto">

          {/* Section header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <span className="w-6 h-px" style={{ background: REDLINE }} />
              <span
                className="text-[10px] font-bold uppercase tracking-[0.24em]"
                style={{ color: REDLINE }}
              >
                Trending Escapes
              </span>
            </div>
            <h2
              className="font-black mb-3"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em', maxWidth: 520 }}
            >
              Live the trip{' '}
              <span style={{ color: 'rgba(43,38,34,0.30)' }}>you imagined.</span>
            </h2>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: MUTED }}>
              Pick a destination — each card is a real place, ready for your itinerary.
            </p>
          </div>

          {/* 5 postcard cards — 3-col on lg, 2-col on sm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DESTINATIONS.map((dest, i) => (
              <PostcardCard
                key={dest.name}
                dest={dest}
                index={i}
                onSelect={handleDestinationSelect}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: NIGHT_2 }}>
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center gap-3 mb-5">
            <span className="w-6 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.24em]"
              style={{ color: REDLINE }}
            >
              The Process
            </span>
          </div>

          <h2
            className="font-black mb-16"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em' }}
          >
            From hotel to hero itinerary
            <br />
            <span style={{ color: 'rgba(43,38,34,0.30)' }}>in three steps.</span>
          </h2>

          <div className="grid sm:grid-cols-3 gap-12">
            {[
              {
                n: '01',
                title: 'Set your hotel',
                body: 'Drop in your hotel address — it becomes the gravitational centre of your entire trip. Every stop within walking range.',
              },
              {
                n: '02',
                title: 'Answer 10 questions',
                body: 'Your pace, budget, vibe, dietary needs. Claude cross-references live 2026 data and builds around your exact profile.',
              },
              {
                n: '03',
                title: 'Travel with precision',
                body: 'Day-by-day schedules, geo-clustered by neighbourhood. Every time slot filled. Every meal considered.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.n}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.10, type: 'spring', stiffness: 250, damping: 24 }}
              >
                <div
                  className="font-black font-mono mb-5 select-none"
                  style={{ fontSize: '3.5rem', color: 'rgba(184,85,46,0.14)', letterSpacing: '-0.04em' }}
                >
                  {item.n}
                </div>
                <h3
                  className="font-bold mb-3"
                  style={{ letterSpacing: '-0.015em' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {item.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: NIGHT }}>
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center gap-3 mb-5">
            <span className="w-6 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.24em]"
              style={{ color: REDLINE }}
            >
              Why Sarto
            </span>
          </div>

          <h2
            className="font-black mb-16"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em', maxWidth: 440 }}
          >
            Not another generic planner.
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, type: 'spring', stiffness: 250, damping: 24 }}
                className="p-8 rounded-3xl transition-all duration-300 cursor-default hover-feature-card"
                style={{
                  background: '#fffdf7',
                  border: '1px solid rgba(43,38,34,0.10)',
                  boxShadow: '0 4px 16px rgba(43,38,34,0.08)',
                }}
              >
                <div className="text-3xl mb-5">{f.icon}</div>
                <h3
                  className="font-bold mb-3"
                  style={{ letterSpacing: '-0.015em' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {f.body}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section
        className="relative py-40 px-8 text-center overflow-hidden"
        style={{ backgroundColor: NIGHT }}
      >
        {/* Redline glow from below */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 110%, rgba(184,85,46,0.15) 0%, transparent 65%)' }}
        />
        {/* Top hairline in Redline */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(184,85,46,0.45) 50%, transparent 95%)' }}
        />

        <motion.div
          className="relative z-10 max-w-lg mx-auto"
          initial={{ opacity: 0, y: 44 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        >
          <div className="flex items-center justify-center gap-5 mb-10">
            <span className="w-10 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: REDLINE }}
            >
              Ready
            </span>
            <span className="w-10 h-px" style={{ background: REDLINE }} />
          </div>

          <h2
            className="font-black mb-10 leading-[0.93]"
            style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', letterSpacing: '-0.04em' }}
          >
            Travel smarter.
            <br />
            <span style={{ color: 'rgba(43,38,34,0.30)' }}>Start in 60 seconds.</span>
          </h2>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-3 px-12 py-5 rounded-full font-bold text-sm text-white transition-all duration-200 hover-lift-brand-lg"
            style={{
              background: REDLINE,
              boxShadow: `0 0 65px rgba(184,85,46,0.44), 0 4px 28px rgba(184,85,46,0.28)`,
              letterSpacing: '-0.01em',
            }}
            onClick={openPlanningLanguageStep}
          >
            Plan My First Trip →
          </Link>

          <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.14)' }}>
            No account needed to start
          </p>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        className="flex flex-col sm:flex-row items-center justify-between px-8 py-8 gap-3"
        style={{
          borderTop: '1px solid rgba(43,38,34,0.08)',
          backgroundColor: NIGHT,
        }}
      >
        <BrandWordmark accent={REDLINE} className="text-sm" />
        <p className="text-xs" style={{ color: MUTED }}>
          AI-powered travel intelligence · 2026
        </p>
      </footer>

      {/* ── Modals ────────────────────────────────────────────────────────── */}

      <TripLanguageGateModal
        open={showLangModal}
        onSelect={confirmTripLanguage}
        onCancel={() => setShowLangModal(false)}
      />

      <AnimatePresence>
        {showAuthGate && (
          <motion.div
            key="auth-gate-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: 'rgba(7,12,22,0.88)', backdropFilter: 'blur(10px)' }}
          >
            <motion.div
              key="auth-gate-modal"
              initial={{ opacity: 0, scale: 0.93, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 24 }}
              transition={{ type: 'spring', stiffness: 340, damping: 26 }}
              className="w-full max-w-md rounded-3xl p-8"
              style={{
                background: '#fffdf7',
                border: '1px solid rgba(43,38,34,0.10)',
                boxShadow: '0 24px 60px -20px rgba(43,38,34,0.35)',
              }}
            >
              <h3
                className="text-xl font-black mb-2"
                style={{ letterSpacing: '-0.025em' }}
              >
                Sign in — or just try it out
              </h3>
              <p className="text-sm mb-7" style={{ color: MUTED }}>
                Create a free account to save your trips across devices, or jump straight in as a guest —
                you can always sign up later to keep what you build.
              </p>
              <div className="flex flex-col gap-3">
                <Link
                  href="/auth"
                  onClick={goToAuthFromGate}
                  className="text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: REDLINE }}
                >
                  Log In / Sign Up
                </Link>
                <button
                  type="button"
                  onClick={continueAsGuest}
                  className="px-4 py-3 rounded-xl text-sm font-bold transition-colors hover-border-subtle"
                  style={{ border: `1px solid ${REDLINE}`, color: REDLINE }}
                >
                  Continue as guest
                </button>
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl text-sm font-semibold transition-colors hover-border-subtle"
                  style={{ color: MUTED }}
                  onClick={() => setShowAuthGate(false)}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
