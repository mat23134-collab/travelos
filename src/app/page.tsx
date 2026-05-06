'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';

// CompassInjector uses R3F (useFrame) + tunnel-rat — both require browser.
// Dynamic import with ssr:false prevents the server-prerender crash.
const CompassInjector = dynamic(
  () => import('@/three/CompassInjector').then((m) => ({ default: m.CompassInjector })),
  { ssr: false }
);

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
    title: 'Neighborhood Clustering',
    description:
      'Every day is geographically optimized. Zero cross-city transit. Every stop within walking distance of the last.',
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
      "Solo in Morocco, luxury budget. Found a riad most sites don’t even list. Stayed two extra days because of it.",
    author: 'Priya V.',
    trip: 'Marrakech, Morocco',
  },
];

// ── Shared inline-style helpers ───────────────────────────────────────────────

const CARD_STYLE = {
  background: 'rgba(255,255,255,0.028)',
  border: '1px solid rgba(255,255,255,0.07)',
};

const LABEL_STYLE = {
  color: '#dc2626',
  fontSize: '0.625rem',
  letterSpacing: '0.2em',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
};

const DIVIDER_LINE = (
  <span className="w-8 h-px flex-shrink-0" style={{ background: '#dc2626' }} />
);

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main
      className="min-h-screen overflow-x-hidden relative"
      style={{ backgroundColor: '#080b12', color: '#f2f2f2' }}
    >
      {/* 3D Compass — injected into canvas background via tunnel */}
      <CompassInjector />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-40 flex items-center justify-between px-8 py-5"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.055)',
          background: 'rgba(8,11,18,0.84)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <span
          className="text-base font-black"
          style={{ letterSpacing: '-0.025em' }}
        >
          Travel<span style={{ color: '#dc2626' }}>OS</span>
        </span>

        <div className="flex items-center gap-6">
          <Link
            href="/plan"
            className="hidden sm:inline text-[11px] font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', textTransform: 'uppercase' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f2f2f2')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.35)')}
          >
            Plan a Trip
          </Link>

          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="text-xs font-bold px-5 py-2.5 rounded-xl transition-all"
                style={{ background: '#dc2626', color: '#fff', boxShadow: '0 0 20px rgba(220,38,38,0.28)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ef4444'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 32px rgba(239,68,68,0.4)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#dc2626'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(220,38,38,0.28)'; }}
              >
                My Trips
              </Link>
            ) : (
              <Link
                href="/auth"
                className="text-xs font-semibold px-5 py-2.5 rounded-xl transition-all"
                style={{ color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.45)'; (e.currentTarget as HTMLElement).style.color = '#f2f2f2'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
              >
                Log In
              </Link>
            )
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      {/* Full-viewport height. Text on left; right half is "open" — the fixed
          3D canvas background shows the compass through the transparent layout. */}
      <section className="relative min-h-screen flex items-center px-8 pt-28 pb-20 lg:px-16">

        {/* Subtle radial wash behind the hero text */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 55% 70% at 10% 50%, rgba(220,38,38,0.055) 0%, transparent 70%)' }}
        />

        <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-2 gap-16 items-center">

          {/* ── Left: copy ─────────────────────────────────────────────────── */}
          <div>

            {/* Eyebrow label */}
            <div className="flex items-center gap-3 mb-9">
              <span className="w-6 h-px" style={{ background: '#dc2626' }} />
              <span style={LABEL_STYLE}>AI-Powered Travel Intelligence</span>
            </div>

            {/* Headline */}
            <h1
              className="font-black leading-[0.93] mb-8"
              style={{
                fontSize: 'clamp(2.9rem, 6.5vw, 5.25rem)',
                letterSpacing: '-0.038em',
              }}
            >
              The world,
              <br />
              <span style={{ color: 'rgba(255,255,255,0.22)' }}>precisely</span>
              <br />
              planned.
            </h1>

            {/* Sub-copy */}
            <p
              className="mb-10 leading-relaxed max-w-md"
              style={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '1.05rem',
                lineHeight: 1.8,
              }}
            >
              Answer 10 questions. Get a hyper-personalized itinerary built
              from live web intelligence, verified pricing, and
              neighborhood-level logistics — in under 60 seconds.
            </p>

            {/* Primary CTA */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 mb-14">
              <Link
                href="/plan"
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold text-sm transition-all"
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  letterSpacing: '-0.01em',
                  boxShadow: '0 0 40px rgba(220,38,38,0.28), 0 4px 20px rgba(220,38,38,0.18)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#ef4444';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(239,68,68,0.42), 0 4px 24px rgba(239,68,68,0.28)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = '#dc2626';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(220,38,38,0.28), 0 4px 20px rgba(220,38,38,0.18)';
                  (e.currentTarget as HTMLElement).style.transform = '';
                }}
              >
                Plan My Trip
                <span className="transition-transform group-hover:translate-x-0.5 inline-block">→</span>
              </Link>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Free · No account needed · ~60 seconds
              </span>
            </div>

            {/* Stats strip */}
            <div
              className="flex items-center gap-10 pt-8"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              {[
                { val: '60s',  label: 'To generate'   },
                { val: '10',   label: 'Questions'      },
                { val: '100%', label: 'Personalized'   },
              ].map((s) => (
                <div key={s.val}>
                  <div
                    className="font-black text-2xl"
                    style={{ color: '#dc2626', letterSpacing: '-0.04em' }}
                  >
                    {s.val}
                  </div>
                  <div className="mt-0.5" style={{ ...LABEL_STYLE, color: 'rgba(255,255,255,0.22)' }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: transparent — 3D canvas shines through ──────────────── */}
          <div className="hidden lg:block" aria-hidden="true" />
        </div>
      </section>

      {/* ── Manifesto strip ───────────────────────────────────────────────────── */}
      <div
        className="py-14 px-8 text-center"
        style={{
          borderTop:    '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
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
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: '#0c0f1a' }}>
        <div className="max-w-6xl mx-auto">

          {/* Section label */}
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

          {/* 2×2 grid with hairline borders */}
          <div
            className="grid sm:grid-cols-2"
            style={{ border: '1px solid rgba(255,255,255,0.065)', overflow: 'hidden' }}
          >
            {features.map((f, i) => (
              <div
                key={f.num}
                className="p-9 transition-colors duration-300"
                style={{
                  background: 'rgba(8,11,18,0.85)',
                  borderRight:  i % 2 === 0 ? '1px solid rgba(255,255,255,0.065)' : 'none',
                  borderBottom: i < 2       ? '1px solid rgba(255,255,255,0.065)' : 'none',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(220,38,38,0.042)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'rgba(8,11,18,0.85)')}
              >
                <div
                  className="font-black font-mono mb-7"
                  style={{ fontSize: '2.75rem', color: 'rgba(220,38,38,0.16)', letterSpacing: '-0.04em' }}
                >
                  {f.num}
                </div>
                <h3
                  className="font-bold text-base mb-3"
                  style={{ color: '#f2f2f2', letterSpacing: '-0.015em' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.33)' }}>
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: '#080b12' }}>
        <div className="max-w-6xl mx-auto">

          <div className="flex items-center gap-4 mb-14">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>The Process</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-14 sm:gap-10">
            {[
              { step: '01', title: 'Answer 10 questions',  desc: 'Destination, dates, pace, interests, budget. Takes 90 seconds.' },
              { step: '02', title: 'AI builds your plan',  desc: 'Claude cross-references live data, real blogs, and current 2026 pricing.' },
              { step: '03', title: 'Travel with precision', desc: 'Day-by-day schedules, geo-clustered by neighborhood, with dining built in.' },
            ].map((item, i) => (
              <div key={item.step} className="relative">
                {/* Connecting arrow on desktop */}
                {i < 2 && (
                  <div
                    className="absolute hidden sm:block"
                    style={{
                      top: '1.5rem',
                      left: 'calc(100% + 1rem)',
                      width: '2rem',
                      height: '1px',
                      background: 'linear-gradient(90deg, rgba(220,38,38,0.5), transparent)',
                    }}
                  />
                )}
                <div
                  className="font-black font-mono mb-5"
                  style={{ fontSize: '3rem', color: 'rgba(220,38,38,0.14)', letterSpacing: '-0.04em' }}
                >
                  {item.step}
                </div>
                <h3 className="font-bold mb-3" style={{ color: '#f2f2f2', letterSpacing: '-0.015em' }}>
                  {item.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-28 px-8 lg:px-16" style={{ backgroundColor: '#0c0f1a' }}>
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
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(220,38,38,0.22)';
                  (e.currentTarget as HTMLElement).style.background   = 'rgba(220,38,38,0.032)';
                  (e.currentTarget as HTMLElement).style.transform     = 'translateY(-3px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)';
                  (e.currentTarget as HTMLElement).style.background   = 'rgba(255,255,255,0.028)';
                  (e.currentTarget as HTMLElement).style.transform     = '';
                }}
              >
                {/* Crimson quote glyph */}
                <div
                  className="font-black mb-4 leading-none select-none"
                  style={{ color: '#dc2626', fontSize: '2rem', fontFamily: 'Georgia, serif' }}
                >
                  &ldquo;
                </div>
                <p className="text-sm leading-relaxed mb-7" style={{ color: 'rgba(255,255,255,0.52)' }}>
                  {t.quote}
                </p>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                  <div className="text-sm font-semibold" style={{ color: '#f2f2f2' }}>{t.author}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.24)' }}>{t.trip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section
        className="relative py-36 px-8 text-center overflow-hidden"
        style={{ backgroundColor: '#060810' }}
      >
        {/* Upward crimson glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 55% at 50% 100%, rgba(220,38,38,0.09) 0%, transparent 70%)' }}
        />

        <div className="max-w-xl mx-auto relative z-10">
          <div className="flex items-center justify-center gap-4 mb-10">
            {DIVIDER_LINE}
            <span style={LABEL_STYLE}>Ready</span>
            {DIVIDER_LINE}
          </div>

          <h2
            className="font-black mb-8"
            style={{
              fontSize: 'clamp(2.4rem, 5vw, 3.75rem)',
              letterSpacing: '-0.038em',
              lineHeight: 1.0,
            }}
          >
            Travel smarter.
            <br />
            <span style={{ color: 'rgba(255,255,255,0.2)' }}>Start in 60 seconds.</span>
          </h2>

          <Link
            href="/plan"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl font-bold text-sm transition-all"
            style={{
              background: '#dc2626',
              color: '#fff',
              letterSpacing: '-0.01em',
              boxShadow: '0 0 60px rgba(220,38,38,0.28)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#ef4444';
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 80px rgba(239,68,68,0.42)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = '#dc2626';
              (e.currentTarget as HTMLElement).style.transform = '';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 0 60px rgba(220,38,38,0.28)';
            }}
          >
            Plan My First Trip →
          </Link>

          <p className="mt-5 text-xs" style={{ color: 'rgba(255,255,255,0.17)' }}>
            Free forever · No account required
          </p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        className="flex items-center justify-between px-8 py-7 text-xs"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.055)',
          backgroundColor: '#080b12',
          color: 'rgba(255,255,255,0.18)',
        }}
      >
        <span className="font-bold" style={{ letterSpacing: '-0.015em' }}>
          Travel<span style={{ color: '#dc2626' }}>OS</span>
        </span>
        <span>AI-powered travel intelligence · 2026</span>
      </footer>
    </main>
  );
}
