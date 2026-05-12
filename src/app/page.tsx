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

// ── Design tokens ─────────────────────────────────────────────────────────────
// Night palette — deep lounge, not pitch black
const NIGHT   = '#0b1220';
const NIGHT_2 = '#0f1929';
const REDLINE = '#9e363a';
const MUTED   = '#64748b';

// ── Data ──────────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  { name: 'Rome',     country: 'Italy',   vibe: 'Eternal',  flag: '🇮🇹' },
  { name: 'Paris',    country: 'France',  vibe: 'Luminous', flag: '🇫🇷' },
  { name: 'London',   country: 'UK',      vibe: 'Electric', flag: '🇬🇧' },
  { name: 'Athens',   country: 'Greece',  vibe: 'Ancient',  flag: '🇬🇷' },
  { name: 'Budapest', country: 'Hungary', vibe: 'Opulent',  flag: '🇭🇺' },
];

const FEATURES = [
  { icon: '🧠', title: 'Claude AI Intelligence',   body: 'Analyzes your traveler DNA against live 2026 data to craft plans no generic builder can replicate.' },
  { icon: '🏨', title: 'Hotel Center of Gravity',  body: 'Every day radiates from your hotel. Zero wasted transit. Every stop geo-clustered within walking range.' },
  { icon: '📡', title: 'Live Web Intelligence',    body: 'Real-time blog data, crowd levels, traveler reports. Tourist traps flagged. Hidden gems surfaced.' },
  { icon: '💰', title: 'Budget-Validated',         body: 'Every experience verified against your exact budget tier with current 2026 pricing.' },
];

const TESTIMONIALS = [
  { quote: 'We did Tokyo in 7 days with two toddlers and zero meltdowns. The family-optimized routing was genuinely brilliant.', author: 'Sara M.',  trip: 'Tokyo, Japan',       emoji: '🇯🇵' },
  { quote: 'Three hours of tab-chaos replaced by one click. Caught the museum was under renovation — saved our whole trip.',      author: 'James K.', trip: 'Barcelona, Spain',    emoji: '🇪🇸' },
  { quote: "Solo in Morocco, luxury budget. Found a riad most sites don't even list. Stayed two extra days because of it.",        author: 'Priya V.', trip: 'Marrakech, Morocco',  emoji: '🇲🇦' },
];

// ── Postcard card ─────────────────────────────────────────────────────────────

function PostcardCard({
  dest,
  index,
  onSelect,
}: {
  dest: (typeof DESTINATIONS)[0];
  index: number;
  onSelect: (name: string) => void;
}) {
  const [photo,     setPhoto]     = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [liked,     setLiked]     = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/place-photo?name=${encodeURIComponent(dest.name)}&city=${encodeURIComponent(dest.name)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.photoUrl) setPhoto(d.photoUrl); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dest.name]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.09, type: 'spring', stiffness: 240, damping: 22 }}
      whileHover={{ y: -12, boxShadow: '0 40px 80px rgba(0,0,0,0.6)' }}
      onClick={() => onSelect(dest.name)}
      className="group relative rounded-3xl overflow-hidden cursor-pointer select-none"
      style={{
        height: 340,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        background: '#111827',
      }}
    >
      {/* Photo */}
      {photo && (
        <img
          src={photo}
          alt={dest.name}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.07]"
          style={{ opacity: imgLoaded ? 1 : 0, transition: 'opacity 0.55s ease, transform 0.7s ease' }}
          onLoad={() => setImgLoaded(true)}
        />
      )}

      {/* Skeleton shimmer while photo loads */}
      {!imgLoaded && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{ background: 'linear-gradient(135deg, rgba(15,40,98,0.35) 0%, rgba(11,18,32,0.7) 100%)' }}
        />
      )}

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
          {dest.vibe}
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
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-bold text-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300"
          style={{ background: REDLINE }}
        >
          Plan this trip →
        </div>
      </div>
    </motion.div>
  );
}

// ── Hero background — fetches a cinematic photo for Rome ─────────────────────

function useHeroPhoto() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch('/api/place-photo?name=Rome+Colosseum&city=Rome')
      .then((r) => r.json())
      .then((d) => { if (d.photoUrl) setUrl(d.photoUrl); })
      .catch(() => {});
  }, []);
  return url;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [showLangModal,   setShowLangModal]   = useState(false);
  const [showAuthGate,    setShowAuthGate]    = useState(false);
  const [scrolled,        setScrolled]        = useState(false);
  const [pendingDest,     setPendingDest]     = useState<string | null>(null);

  const heroPhoto = useHeroPhoto();

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
    setPendingDest(null);
    setShowLangModal(true);
  };

  // Postcard click — pre-selects destination
  const handleDestinationSelect = (name: string) => {
    setPendingDest(name);
    setShowLangModal(true);
  };

  const confirmTripLanguage = (lang: TripLanguage) => {
    persistTripLanguagePref(lang);
    setShowLangModal(false);
    if (!user) { setShowAuthGate(true); return; }
    if (pendingDest) {
      router.push(`/plan?destination=${encodeURIComponent(pendingDest)}`);
    } else {
      router.push('/onboarding');
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden" style={{ backgroundColor: NIGHT, color: '#fff' }}>

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
            className="hidden sm:block text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors duration-200"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#fff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.40)')}
          >
            Plan a Trip
          </Link>

          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all duration-200"
                style={{ background: REDLINE, boxShadow: `0 0 22px rgba(158,54,58,0.40)` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 36px rgba(158,54,58,0.58)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform = '';
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 22px rgba(158,54,58,0.40)`;
                }}
              >
                My Trips
              </Link>
            ) : (
              <Link
                href="/auth"
                className="px-5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200"
                style={{
                  color: 'rgba(255,255,255,0.60)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  background: 'rgba(255,255,255,0.05)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.color = '#fff';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(158,54,58,0.45)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.60)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)';
                }}
              >
                Log In
              </Link>
            )
          )}
        </div>
      </motion.nav>

      {/* ── Hero — fullscreen cinematic ────────────────────────────────────── */}
      <section
        className="relative min-h-screen flex items-center justify-center px-8 py-32 overflow-hidden"
        style={{
          backgroundImage: heroPhoto
            ? `linear-gradient(to bottom, rgba(11,18,32,0.45) 0%, rgba(11,18,32,0.72) 55%, rgba(11,18,32,1) 100%), url('${heroPhoto}')`
            : `linear-gradient(160deg, ${NIGHT} 0%, #0f2040 50%, ${NIGHT} 100%)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
          backgroundAttachment: 'fixed',
        }}
      >
        {/* Ambient Redline glow at bottom */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 75% 45% at 50% 105%, rgba(158,54,58,0.10) 0%, transparent 65%)' }}
        />

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
              className="group inline-flex items-center gap-3 px-10 py-4 rounded-full font-bold text-sm text-white transition-all duration-200"
              style={{
                background: REDLINE,
                boxShadow: `0 0 50px rgba(158,54,58,0.48), 0 4px 24px rgba(158,54,58,0.28)`,
                letterSpacing: '-0.01em',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.025)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 75px rgba(158,54,58,0.62), 0 8px 32px rgba(158,54,58,0.38)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = '';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 50px rgba(158,54,58,0.48), 0 4px 24px rgba(158,54,58,0.28)`;
              }}
              onClick={openPlanningLanguageStep}
            >
              Start Planning
              <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
            </Link>

            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              {user ? '~60 seconds · Ready to plan' : 'Account required · Free to start'}
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
              className="font-black text-white"
              style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em', maxWidth: 480 }}
            >
              Your evening in{' '}
              <span style={{ color: 'rgba(255,255,255,0.18)' }}>one of these.</span>
            </h2>
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
            className="font-black text-white mb-16"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em' }}
          >
            From hotel to hero itinerary
            <br />
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>in three steps.</span>
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
                  style={{ fontSize: '3.5rem', color: 'rgba(158,54,58,0.14)', letterSpacing: '-0.04em' }}
                >
                  {item.n}
                </div>
                <h3
                  className="font-bold text-white mb-3"
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
              Why TravelOS
            </span>
          </div>

          <h2
            className="font-black text-white mb-16"
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
                className="p-8 rounded-3xl transition-all duration-300 cursor-default"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.22)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background    = 'rgba(255,255,255,0.056)';
                  el.style.borderColor   = 'rgba(158,54,58,0.24)';
                  el.style.transform     = 'translateY(-5px)';
                  el.style.boxShadow     = '0 24px 56px rgba(0,0,0,0.38)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.background  = 'rgba(255,255,255,0.03)';
                  el.style.borderColor = 'rgba(255,255,255,0.06)';
                  el.style.transform   = '';
                  el.style.boxShadow   = '0 4px 24px rgba(0,0,0,0.22)';
                }}
              >
                <div className="text-3xl mb-5">{f.icon}</div>
                <h3
                  className="font-bold text-white mb-3"
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

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: NIGHT_2 }}>
        <div className="max-w-5xl mx-auto">

          <div className="flex items-center gap-3 mb-5">
            <span className="w-6 h-px" style={{ background: REDLINE }} />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.24em]"
              style={{ color: REDLINE }}
            >
              From Travelers
            </span>
          </div>

          <h2
            className="font-black text-white mb-16"
            style={{ fontSize: 'clamp(1.9rem, 4vw, 3rem)', letterSpacing: '-0.035em' }}
          >
            Stories worth repeating.
          </h2>

          <div className="grid sm:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <motion.div
                key={t.author}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.09, type: 'spring', stiffness: 240, damping: 22 }}
                className="flex flex-col p-8 rounded-3xl transition-all duration-300"
                style={{
                  background: 'rgba(255,255,255,0.028)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform   = 'translateY(-7px)';
                  el.style.boxShadow   = '0 28px 64px rgba(0,0,0,0.44)';
                  el.style.borderColor = 'rgba(158,54,58,0.20)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.transform   = '';
                  el.style.boxShadow   = '0 8px 32px rgba(0,0,0,0.28)';
                  el.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div className="text-3xl mb-5">{t.emoji}</div>
                <p
                  className="text-sm leading-relaxed mb-7 flex-1 italic"
                  style={{ color: 'rgba(255,255,255,0.60)' }}
                >
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                  <div className="font-semibold text-sm text-white">{t.author}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.24)' }}>
                    {t.trip}
                  </div>
                </div>
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
          style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 110%, rgba(158,54,58,0.15) 0%, transparent 65%)' }}
        />
        {/* Top hairline in Redline */}
        <div
          className="absolute top-0 inset-x-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent 5%, rgba(158,54,58,0.45) 50%, transparent 95%)' }}
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
            className="font-black text-white mb-10 leading-[0.93]"
            style={{ fontSize: 'clamp(2.6rem, 6vw, 4.2rem)', letterSpacing: '-0.04em' }}
          >
            Travel smarter.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>Start in 60 seconds.</span>
          </h2>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-3 px-12 py-5 rounded-full font-bold text-sm text-white transition-all duration-200"
            style={{
              background: REDLINE,
              boxShadow: `0 0 65px rgba(158,54,58,0.44), 0 4px 28px rgba(158,54,58,0.28)`,
              letterSpacing: '-0.01em',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px) scale(1.03)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 96px rgba(158,54,58,0.60), 0 8px 36px rgba(158,54,58,0.38)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 65px rgba(158,54,58,0.44), 0 4px 28px rgba(158,54,58,0.28)`;
            }}
            onClick={openPlanningLanguageStep}
          >
            Plan My First Trip →
          </Link>

          <p className="mt-6 text-xs" style={{ color: 'rgba(255,255,255,0.14)' }}>
            {user ? 'Signed in · continue to onboarding' : 'Create a free account to continue'}
          </p>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer
        className="flex flex-col sm:flex-row items-center justify-between px-8 py-8 gap-3"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          backgroundColor: NIGHT,
        }}
      >
        <BrandWordmark accent={REDLINE} className="text-sm" />
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
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
                background: NIGHT_2,
                border: '1px solid rgba(255,255,255,0.08)',
                boxShadow: '0 48px 100px rgba(0,0,0,0.60)',
              }}
            >
              <h3
                className="text-xl font-black mb-2"
                style={{ letterSpacing: '-0.025em' }}
              >
                Sign in to create a trip
              </h3>
              <p className="text-sm mb-7" style={{ color: MUTED }}>
                To generate personalised itineraries, please log in or create a free account.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/auth"
                  className="flex-1 text-center px-4 py-3 rounded-xl text-sm font-bold text-white"
                  style={{ background: REDLINE }}
                >
                  Log In / Sign Up
                </Link>
                <button
                  type="button"
                  className="px-4 py-3 rounded-xl text-sm font-semibold text-white transition-colors"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                  onClick={() => setShowAuthGate(false)}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.12)')}
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
