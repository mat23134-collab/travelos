'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import type { TripLanguage } from '@/lib/types';
import { persistTripLanguagePref } from '@/lib/tripLanguagePref';

// ── Palette ───────────────────────────────────────────────────────────────────
// Background  : #091f36  (Purple Shadow)
// Primary     : #9e363a  (Redline)      — buttons, accents, glow
// Card surface: #0f2862  (Blue Popsicle)
// Body text   : #4f5f76  (Grey Blue Leaf)
// Headings    : #ffffff

const BG      = '#091f36';
const BG_MID  = '#0b1d35';
const BG_DEEP = '#071629';
const PRIMARY = '#9e363a';
const PRIMARY_HOVER = '#b5404a';
const CARD    = '#0f2862';
const MUTED   = '#4f5f76';

// ── Content ───────────────────────────────────────────────────────────────────

const features = [
  {
    num: '01',
    title: 'Claude AI Intelligence',
    description:
      'Analyzes your traveler DNA against 2025–2026 live data to craft plans no generic itinerary builder can replicate.',
  },
  {
    num: '02',
    title: 'Hotel Center of Gravity',
    description:
      'Every day radiates out from your hotel. Zero wasted transit. Every stop geo-clustered within walking range of your basecamp.',
  },
  {
    num: '03',
    title: 'Live Web Intelligence',
    description:
      'Real-time blog data, crowd levels, and traveler reports. Tourist traps flagged. Hidden gems surfaced.',
  },
  {
    num: '04',
    title: 'Budget-Validated',
    description:
      'Every hotel, restaurant, and experience verified against your exact budget tier with current 2026 pricing.',
  },
];

const testimonials = [
  {
    quote:
      'We did Tokyo in 7 days with two toddlers and zero meltdowns. The family-optimized routing was genuinely brilliant.',
    author: 'Sara M.',
    trip: 'Tokyo, Japan',
  },
  {
    quote:
      'Three hours of tab-chaos replaced by one click. Caught that the museum was under renovation — saved our whole trip.',
    author: 'James K.',
    trip: 'Barcelona, Spain',
  },
  {
    quote:
      "Solo in Morocco, luxury budget. Found a riad most sites don't even list. Stayed two extra days because of it.",
    author: 'Priya V.',
    trip: 'Marrakech, Morocco',
  },
];

const HERO_SCATTER = [
  { src: '/hero-scatter-1.png', cls: '-top-10 -left-12 rotate-[-7deg]' },
  { src: '/hero-scatter-2.png', cls: '-top-12 right-0 rotate-[6deg]' },
  { src: '/hero-scatter-3.png', cls: 'top-1/2 -left-16 -translate-y-1/2 rotate-[-5deg]' },
  { src: '/hero-scatter-4.png', cls: 'top-1/2 -right-16 -translate-y-1/2 rotate-[5deg]' },
  { src: '/hero-scatter-5.png', cls: '-bottom-12 left-2 rotate-[8deg]' },
  { src: '/hero-scatter-6.png', cls: '-bottom-14 right-0 rotate-[-6deg]' },
];

// ── Shared inline-style helpers ───────────────────────────────────────────────

const CARD_STYLE = {
  background: `rgba(15,40,98,0.22)`,
  border: `1px solid rgba(255,255,255,0.07)`,
};

const LABEL_STYLE = {
  color: PRIMARY,
  fontSize: '0.625rem',
  letterSpacing: '0.2em',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
};

const DIVIDER_LINE = (
  <span className="w-8 h-px flex-shrink-0" style={{ background: PRIMARY }} />
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAuthGate, setShowAuthGate] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);

  const openPlanningLanguageStep = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (loading) return;
    e.preventDefault();
    setShowLangModal(true);
  };

  const confirmTripLanguage = (lang: TripLanguage) => {
    persistTripLanguagePref(lang);
    setShowLangModal(false);
    if (!user) {
      setShowAuthGate(true);
      return;
    }
    router.push('/onboarding');
  };

  return (
    <main
      className="min-h-screen overflow-x-hidden relative"
      style={{
        backgroundColor: BG,
        color: '#ffffff',
        backgroundImage:
          'linear-gradient(rgba(9,31,54,0.78), rgba(9,31,54,0.86)), url("/hero-scatter-1.png"), url("/hero-scatter-2.png"), url("/hero-scatter-3.png"), url("/hero-scatter-4.png"), url("/hero-scatter-5.png"), url("/hero-scatter-6.png")',
        backgroundSize: 'cover, 34% 34%, 34% 34%, 34% 34%, 34% 34%, 34% 34%, 34% 34%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center, 0% 0%, 100% 0%, 0% 100%, 100% 100%, 25% 50%, 75% 50%',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-8 py-5"
        style={{
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
          background: `rgba(9,31,54,0.88)`,
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <span className="text-base font-black" style={{ letterSpacing: '-0.025em' }}>
          Travel<span style={{ color: PRIMARY }}>OS</span>
        </span>

        <div className="flex items-center gap-6">
          <Link
            href="/plan"
            className="hidden sm:inline text-[11px] font-semibold transition-colors"
            style={{ color: MUTED, letterSpacing: '0.14em', textTransform: 'uppercase' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ffffff')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = MUTED)}
          >
            Plan a Trip
          </Link>

          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
                style={{ background: PRIMARY, color: '#fff', boxShadow: `0 0 20px rgba(158,54,58,0.35)` }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = PRIMARY_HOVER;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(181,64,74,0.5)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = PRIMARY;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(158,54,58,0.35)';
                }}
              >
                My Trips
              </Link>
            ) : (
              <Link
                href="/auth"
                className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all"
                style={{ color: MUTED, border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(158,54,58,0.5)`;
                  (e.currentTarget as HTMLElement).style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLElement).style.color = MUTED;
                }}
              >
                Log In
              </Link>
            )
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center px-8 pt-28 pb-20 lg:px-16">

        {/* Radial washes */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 55% 70% at 10% 50%, rgba(158,54,58,0.07) 0%, transparent 70%)` }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 80% at 85% 30%, rgba(15,40,98,0.18) 0%, transparent 65%)` }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: copy ─────────────────────────────────────────────────── */}
          <div>

            {/* Eyebrow label */}
            <div className="flex items-center gap-3 mb-9">
              <span className="w-6 h-px" style={{ background: PRIMARY }} />
              <span style={LABEL_STYLE}>AI-Powered Travel Intelligence</span>
            </div>

            {/* Headline */}
            <h1
              className="font-black leading-[0.93] mb-8"
              style={{ fontSize: 'clamp(2.9rem, 6.5vw, 5.25rem)', letterSpacing: '-0.038em' }}
            >
              The world,
              <br />
              <span style={{ color: 'rgba(255,255,255,0.20)' }}>precisely</span>
              <br />
              planned.
            </h1>

            {/* Sub-copy */}
            <p
              className="mb-10 leading-relaxed max-w-md"
              style={{ color: MUTED, fontSize: '1.05rem', lineHeight: 1.8 }}
            >
              Set your hotel as home base. Answer 10 questions. Get a
              hyper-personalized itinerary built from live intelligence,
              verified pricing, and neighborhood-level logistics — in under 60 seconds.
            </p>

            {/* Primary CTA → Onboarding (new Hotel Anchor flow) */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-14">
              <Link
                href="/onboarding"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: PRIMARY,
                  color: '#fff',
                  letterSpacing: '-0.01em',
                  boxShadow: `0 0 40px rgba(158,54,58,0.32), 0 4px 20px rgba(158,54,58,0.22)`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = PRIMARY_HOVER;
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(181,64,74,0.48), 0 4px 24px rgba(181,64,74,0.32)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = PRIMARY;
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 40px rgba(158,54,58,0.32), 0 4px 20px rgba(158,54,58,0.22)`;
                  (e.currentTarget as HTMLElement).style.transform = '';
                }}
                onClick={openPlanningLanguageStep}
              >
                Start Planning
                <span className="transition-transform group-hover:translate-x-0.5 inline-block">→</span>
              </Link>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.18)' }}>
                {user ? 'Ready to plan · ~60 seconds' : 'Account required · ~60 seconds'}
              </span>
            </div>

            {/* Stats strip */}
            <div
              className="flex items-center gap-10 pt-8"
              style={{ borderTop: `1px solid rgba(255,255,255,0.06)` }}
            >
              {[
                { val: '60s',  label: 'To generate'   },
                { val: '10',   label: 'Questions'      },
                { val: '100%', label: 'Personalized'   },
              ].map((s) => (
                <div key={s.val}>
                  <div
                    className="font-black text-2xl"
                    style={{ color: PRIMARY, letterSpacing: '-0.04em' }}
                  >
                    {s.val}
                  </div>
                  <div className="mt-0.5" style={{ ...LABEL_STYLE, color: MUTED }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: static emblem image ─────────────────────────────────── */}
          <div className="hidden lg:flex justify-center items-center" aria-hidden="true">
            <div className="relative w-[520px] h-[520px] flex items-center justify-center">
              {HERO_SCATTER.map((item, i) => (
                <img
                  key={i}
                  src={item.src}
                  alt=""
                  className={`absolute ${item.cls} w-[116px] h-[116px] rounded-2xl object-cover border border-white/20 shadow-xl opacity-90`}
                  style={{ boxShadow: '0 18px 28px -18px rgba(0,0,0,0.75)' }}
                  draggable={false}
                />
              ))}

              <div
                className="rounded-[2rem] p-4 relative z-10"
                style={{
                  background: 'rgba(9,31,54,0.18)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: '0 28px 60px -28px rgba(0,0,0,0.55)',
                }}
              >
                <img
                  src="/hero-globe.png"
                  alt="TravelOS global intelligence"
                  className="w-[360px] h-[360px] object-contain select-none rounded-[1.5rem]"
                  draggable={false}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Manifesto strip ───────────────────────────────────────────────────── */}
      <div
        className="py-14 px-8 text-center"
        style={{
          borderTop:    `1px solid rgba(255,255,255,0.05)`,
          borderBottom: `1px solid rgba(255,255,255,0.05)`,
          background: `linear-gradient(90deg, transparent, rgba(15,40,98,0.12), transparent)`,
        }}
      >
        <p
          className="font-light italic"
          style={{
            color: 'rgba(255,255,255,0.18)',
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            maxWidth: 560,
            margin: '0 auto',
            letterSpacing: '0.02em',
          }}
        >
          &ldquo;Intelligence meets wanderlust.&rdquo;
        </p>
      </div>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: BG_MID }}>
        <div className="max-w-6xl mx-auto">

          <div className="flex items-center gap-4 mb-14">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>The System</span>
          </div>

          <h2
            className="font-black mb-14"
            style={{
              fontSize: 'clamp(1.8rem, 3.8vw, 3rem)',
              letterSpacing: '-0.035em',
              maxWidth: 520,
            }}
          >
            Not another generic planner.
          </h2>

          {/* 2×2 grid */}
          <div
            className="grid sm:grid-cols-2"
            style={{ border: `1px solid rgba(255,255,255,0.07)`, overflow: 'hidden' }}
          >
            {features.map((f, i) => (
              <div
                key={f.num}
                className="p-9 transition-colors duration-300"
                style={{
                  background: `rgba(9,31,54,0.70)`,
                  borderRight:  i % 2 === 0 ? `1px solid rgba(255,255,255,0.07)` : 'none',
                  borderBottom: i < 2       ? `1px solid rgba(255,255,255,0.07)` : 'none',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = `rgba(15,40,98,0.32)`)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = `rgba(9,31,54,0.70)`)}
              >
                <div
                  className="font-black font-mono mb-7"
                  style={{ fontSize: '2.75rem', color: `rgba(158,54,58,0.18)`, letterSpacing: '-0.04em' }}
                >
                  {f.num}
                </div>
                <h3
                  className="font-bold text-base mb-3"
                  style={{ color: '#ffffff', letterSpacing: '-0.015em' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: BG }}>
        <div className="max-w-6xl mx-auto">

          <div className="flex items-center gap-4 mb-14">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>The Process</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-14 sm:gap-10">
            {[
              { step: '01', title: 'Set your hotel',        desc: 'Drop in your hotel address — it becomes the gravitational center of your entire itinerary.' },
              { step: '02', title: 'AI builds your plan',   desc: 'Claude cross-references live data, real blogs, and current 2026 pricing around your basecamp.' },
              { step: '03', title: 'Travel with precision', desc: 'Day-by-day schedules, geo-clustered by neighborhood, with dining built in.' },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {i < 2 && (
                  <div
                    className="absolute hidden sm:block"
                    style={{
                      top: '1.5rem',
                      left: 'calc(100% + 1rem)',
                      width: '2rem',
                      height: '1px',
                      background: `linear-gradient(90deg, rgba(158,54,58,0.5), transparent)`,
                    }}
                  />
                )}
                <div
                  className="font-black font-mono mb-5"
                  style={{ fontSize: '3rem', color: `rgba(158,54,58,0.16)`, letterSpacing: '-0.04em' }}
                >
                  {item.step}
                </div>
                <h3 className="font-bold mb-3" style={{ color: '#ffffff', letterSpacing: '-0.015em' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: BG_MID }}>
        <div className="max-w-6xl mx-auto">

          <div className="flex items-center gap-4 mb-14">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>From Travelers</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="p-7 rounded-2xl transition-all duration-300"
                style={CARD_STYLE}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = `rgba(158,54,58,0.28)`;
                  (e.currentTarget as HTMLElement).style.background   = `rgba(15,40,98,0.40)`;
                  (e.currentTarget as HTMLElement).style.transform     = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.background   = `rgba(15,40,98,0.22)`;
                  (e.currentTarget as HTMLElement).style.transform     = '';
                }}
              >
                <div
                  className="font-black mb-4 leading-none select-none"
                  style={{ color: PRIMARY, fontSize: '2rem', fontFamily: 'Georgia, serif' }}
                >
                  &ldquo;
                </div>
                <p className="text-sm leading-relaxed mb-7" style={{ color: MUTED }}>
                  {t.quote}
                </p>
                <div style={{ borderTop: `1px solid rgba(255,255,255,0.06)`, paddingTop: '1rem' }}>
                  <div className="text-sm font-semibold" style={{ color: '#ffffff' }}>{t.author}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.22)' }}>{t.trip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section
        className="relative py-36 px-8 text-center overflow-hidden"
        style={{ backgroundColor: BG_DEEP }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 60% 55% at 50% 100%, rgba(158,54,58,0.12) 0%, transparent 70%)` }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: `radial-gradient(ellipse 50% 40% at 50% 0%, rgba(15,40,98,0.18) 0%, transparent 65%)` }}
        />

        <div className="max-w-xl mx-auto relative z-10">
          <div className="flex items-center justify-center gap-4 mb-10">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>Ready</span>
            {DIVIDER_LINE}
          </div>

          <h2
            className="font-black mb-8"
            style={{ fontSize: 'clamp(2.4rem, 5vw, 3.75rem)', letterSpacing: '-0.038em', lineHeight: 1.0 }}
          >
            Travel smarter.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.18)' }}>Start in 60 seconds.</span>
          </h2>

          <Link
            href="/onboarding"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-bold text-sm transition-all"
            style={{
              background: PRIMARY,
              color: '#fff',
              letterSpacing: '-0.01em',
              boxShadow: `0 0 60px rgba(158,54,58,0.32)`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = PRIMARY_HOVER;
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 80px rgba(181,64,74,0.48)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = PRIMARY;
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = `0 0 60px rgba(158,54,58,0.32)`;
            }}
            onClick={openPlanningLanguageStep}
          >
            Plan My First Trip →
          </Link>

          <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
            {user ? 'Signed in · continue to onboarding' : 'Sign in or create an account to continue'}
          </p>
        </div>
      </section>

      {showLangModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center px-4"
          style={{ background: 'rgba(7,22,41,0.82)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="trip-lang-title"
        >
          <div
            className="w-full max-w-md rounded-2xl p-7"
            style={{ background: '#0b1d35', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <h3
              id="trip-lang-title"
              className="text-xl font-black mb-2"
              style={{ letterSpacing: '-0.02em' }}
            >
              Result language
            </h3>
            <p className="text-sm mb-1" style={{ color: MUTED }}>
              Choose the language for your trip plan text and on-page tips. Venue and place names stay in English for maps and search.
            </p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }} dir="rtl">
              בחרו שפה לטקסטים והסברים בטיול. שמות מקומות יישארו באנגלית למפות ולחיפוש.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <button
                type="button"
                className="px-4 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
                style={{ background: PRIMARY, color: '#fff' }}
                onClick={() => confirmTripLanguage('en')}
              >
                English
              </button>
              <button
                type="button"
                className="px-4 py-4 rounded-xl text-sm font-bold transition-transform hover:scale-[1.02]"
                style={{
                  background: 'rgba(15,40,98,0.55)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: '#fff',
                }}
                onClick={() => confirmTripLanguage('he')}
              >
                עברית
              </button>
            </div>
            <button
              type="button"
              className="w-full py-3 rounded-xl text-sm font-semibold"
              style={{ border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
              onClick={() => setShowLangModal(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {showAuthGate && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(7,22,41,0.78)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: '#0b1d35', border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <h3 className="text-xl font-black mb-2" style={{ letterSpacing: '-0.02em' }}>
              Sign in to create a trip
            </h3>
            <p className="text-sm mb-6" style={{ color: MUTED }}>
              To generate personalized itineraries, please log in or create a free account.
            </p>
            <div className="flex gap-3">
              <Link
                href="/auth"
                className="flex-1 text-center px-4 py-3 rounded-xl text-sm font-bold"
                style={{ background: PRIMARY, color: '#fff' }}
              >
                Log In / Sign Up
              </Link>
              <button
                type="button"
                className="px-4 py-3 rounded-xl text-sm font-semibold"
                style={{ border: '1px solid rgba(255,255,255,0.15)', color: '#fff' }}
                onClick={() => setShowAuthGate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        className="flex items-center justify-between px-8 py-7 text-xs"
        style={{
          borderTop: `1px solid rgba(255,255,255,0.055)`,
          backgroundColor: BG,
          color: MUTED,
        }}
      >
        <span className="font-bold" style={{ letterSpacing: '-0.015em' }}>
          Travel<span style={{ color: PRIMARY }}>OS</span>
        </span>
        <span>AI-powered travel intelligence · 2026</span>
      </footer>
    </main>
  );
}
