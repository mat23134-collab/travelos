'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

const features = [
  {
    icon: '🧠',
    title: 'AI-Powered Intelligence',
    description: 'Claude analyzes your traveler DNA and cross-references 2025–2026 travel data to build itineraries no generic planner can match.',
  },
  {
    icon: '📍',
    title: 'Neighborhood Clustering',
    description: 'Every day is geographically optimized. No more wasting hours in transit between activities on opposite sides of town.',
  },
  {
    icon: '🌐',
    title: 'Live Web Intelligence',
    description: 'Real-time blog data, recent traveler reports, and current crowd levels — we flag tourist traps and surface hidden gems.',
  },
  {
    icon: '💰',
    title: 'Budget-Validated',
    description: 'Every hotel, restaurant, and activity is verified against your budget tier using current 2026 pricing data.',
  },
];

const testimonials = [
  {
    quote: "We did Tokyo in 7 days with two toddlers and zero meltdowns. The family-optimized routing was genuinely brilliant.",
    author: "Sara M.",
    trip: "Tokyo, Japan",
    emoji: "🗼",
  },
  {
    quote: "Replaced three hours of tab-chaos with one click. The 'From the Web' section caught that the museum was under renovation — saved our trip.",
    author: "James K.",
    trip: "Barcelona, Spain",
    emoji: "🏖️",
  },
  {
    quote: "Solo in Morocco, luxury budget. It found a riad most travel sites don't even list. Stayed 2 extra days because of it.",
    author: "Priya V.",
    trip: "Marrakech, Morocco",
    emoji: "🕌",
  },
];

const GRAIN_SVG = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <main
      className="min-h-screen text-[#1c1917] overflow-hidden relative"
      style={{ backgroundColor: '#fafaf9' }}
    >
      {/* Paper grain overlay — premium texture */}
      <div
        className="fixed inset-0 pointer-events-none z-0 mix-blend-multiply"
        style={{ backgroundImage: GRAIN_SVG, backgroundSize: '180px 180px', opacity: 0.028 }}
      />

      {/* ── Nav ──────────────────────────────────────────────────────────────── */}
      <nav
        className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 border-b border-[#e7e5e4]"
        style={{ backgroundColor: 'rgba(250,250,249,0.88)', backdropFilter: 'blur(12px)' }}
      >
        <span className="text-lg font-semibold tracking-tight text-[#1c1917]">
          Travel<span className="text-[#ff5a5f]">OS</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/plan"
            className="text-sm font-medium text-[#78716c] hover:text-[#1c1917] transition-colors"
          >
            Start Planning →
          </Link>
          {!loading && (
            user ? (
              <Link
                href="/dashboard"
                className="text-sm font-semibold px-4 py-1.5 rounded-xl text-white transition-all"
                style={{ background: 'linear-gradient(135deg,#ff5a5f,#ff8c5a)', boxShadow: '0 4px 14px -4px rgba(255,90,95,0.45)' }}
              >
                My Trips
              </Link>
            ) : (
              <Link
                href="/auth"
                className="text-sm font-medium px-4 py-1.5 rounded-xl border border-[#e7e5e4] text-[#78716c] hover:border-[#ff5a5f]/40 hover:text-[#ff5a5f] transition-all"
              >
                Log In
              </Link>
            )
          )}
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center overflow-hidden">
        {/* Watercolor orbs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full blur-[160px] pointer-events-none"
          style={{ backgroundColor: 'rgba(255,90,95,0.13)' }} />
        <div className="absolute top-10 left-[15%] w-[480px] h-[480px] rounded-full blur-[140px] pointer-events-none"
          style={{ backgroundColor: 'rgba(139,92,246,0.07)' }} />
        <div className="absolute top-24 right-[12%] w-[320px] h-[320px] rounded-full blur-[120px] pointer-events-none"
          style={{ backgroundColor: 'rgba(0,212,255,0.07)' }} />

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8 border"
            style={{ backgroundColor: 'rgba(255,90,95,0.07)', borderColor: 'rgba(255,90,95,0.22)', color: '#ff5a5f' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse" />
            Powered by Claude AI · 2025–2026 Live Data
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] mb-6 text-[#1c1917]">
            Your squad's next trip,{' '}
            <span
              className="relative inline-block"
              style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundImage: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c5a 60%, #f59e0b 100%)', backgroundClip: 'text' }}
            >
              perfectly
            </span>{' '}
            planned.
          </h1>

          <p className="text-lg sm:text-xl text-[#78716c] max-w-2xl mx-auto mb-10 leading-relaxed">
            Answer 10 questions. Get a hyper-personalized itinerary crafted from real-world data,
            hidden gems, and logistically optimized daily plans — in under 60 seconds.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/plan"
              className="relative w-full sm:w-auto inline-flex items-center justify-center gap-2 px-9 py-4 rounded-2xl text-white font-bold text-base overflow-hidden transition-all duration-200 hover:-translate-y-1"
              style={{
                background: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c5a 100%)',
                boxShadow: '0 8px 32px -4px rgba(255,90,95,0.40), 0 2px 8px -2px rgba(255,90,95,0.25)',
              }}
            >
              {/* Shimmer sweep */}
              <span
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.22) 50%,transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2.4s infinite',
                }}
              />
              <span className="relative">Plan My Trip ✈️</span>
            </Link>
            <span className="text-sm text-[#a8a29e]">Free · No account needed · 60 seconds</span>
          </div>
        </div>

        {/* Destination tiles */}
        <div className="relative mt-20 w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Tokyo',        emoji: '🗼', tag: 'Culture & Food'  },
              { name: 'Amalfi Coast', emoji: '🌊', tag: 'Relaxed Luxury'  },
              { name: 'Marrakech',    emoji: '🕌', tag: 'Hidden Gems'     },
              { name: 'Kyoto',        emoji: '⛩️', tag: 'Slow Travel'     },
            ].map((dest) => (
              <div
                key={dest.name}
                className="rounded-2xl bg-white border border-[#e7e5e4] p-5 hover:-translate-y-1 transition-all duration-200 cursor-default"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px -4px rgba(255,90,95,0.12), 0 1px 4px rgba(0,0,0,0.04)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,90,95,0.25)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e7e5e4';
                }}
              >
                <div className="text-3xl mb-3">{dest.emoji}</div>
                <div className="text-sm font-semibold text-[#1c1917]">{dest.name}</div>
                <div className="text-xs text-[#a8a29e] mt-1">{dest.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-[#1c1917]">Not another generic planner</h2>
            <p className="text-[#78716c] text-lg max-w-xl mx-auto leading-relaxed">
              TravelOS uses a 4-pillar intelligence system to build itineraries that actually work.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-[#fafaf9] border border-[#e7e5e4] transition-all duration-200 group cursor-default"
                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 12px 32px -6px rgba(255,90,95,0.10)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,90,95,0.28)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
                  (e.currentTarget as HTMLDivElement).style.borderColor = '#e7e5e4';
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                }}
              >
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-base mb-2 text-[#1c1917]">{f.title}</h3>
                <p className="text-[#78716c] text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6" style={{ backgroundColor: '#fafaf9' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-16 text-[#1c1917]">Three steps to your dream trip</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Answer 10 questions', desc: 'Tell us where, when, who, and what kind of experience you want.' },
              { step: '02', title: 'AI builds your itinerary', desc: 'Claude cross-references real 2025–2026 travel data to craft your plan.' },
              { step: '03', title: 'Travel with confidence', desc: 'Day-by-day plans with logistics, dining, and live web insights.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="text-4xl font-bold font-mono mb-4" style={{ color: 'rgba(255,90,95,0.22)' }}>{item.step}</div>
                <h3 className="font-semibold mb-2 text-[#1c1917]">{item.title}</h3>
                <p className="text-[#78716c] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3 text-[#1c1917]">What squads are saying</h2>
          <p className="text-center text-[#a8a29e] text-sm mb-12">Real trips. Real results.</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {testimonials.map((t) => (
              <div
                key={t.author}
                className="p-6 rounded-2xl bg-[#fafaf9] border border-[#e7e5e4] transition-all duration-200"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px -4px rgba(0,0,0,0.08)';
                  (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
                  (e.currentTarget as HTMLDivElement).style.transform = '';
                }}
              >
                <div className="text-2xl mb-4">{t.emoji}</div>
                <p className="text-[#57534e] text-sm leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#ff5a5f,#ff8c5a)' }}
                  >
                    {t.author[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-[#1c1917]">{t.author}</div>
                    <div className="text-[#a8a29e] text-xs">{t.trip}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 text-center relative overflow-hidden" style={{ backgroundColor: '#fafaf9' }}>
        {/* Coral watercolor wash */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,90,95,0.07) 0%, transparent 70%)' }} />
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 40% 50% at 80% 30%, rgba(139,92,246,0.05) 0%, transparent 60%)' }} />

        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-4xl mb-5">✈️</div>
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-[#1c1917] tracking-tight">
            Ready to travel smarter?
          </h2>
          <p className="text-[#78716c] mb-8 text-lg">10 questions. 60 seconds. One perfect squad plan.</p>
          <Link
            href="/plan"
            className="relative inline-flex items-center gap-2 px-10 py-4 rounded-2xl text-white font-bold text-base overflow-hidden transition-all duration-200 hover:-translate-y-1"
            style={{
              background: 'linear-gradient(135deg, #ff5a5f 0%, #ff8c5a 100%)',
              boxShadow: '0 8px 32px -4px rgba(255,90,95,0.40)',
            }}
          >
            <span
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.22) 50%,transparent 100%)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 2.4s infinite',
              }}
            />
            <span className="relative">Start for free →</span>
          </Link>
          <p className="mt-4 text-xs text-[#d6d3d1]">No account needed · Free forever · ~60 seconds</p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e7e5e4] py-8 px-6 text-center text-[#a8a29e] text-sm bg-white">
        Travel<span className="text-[#ff5a5f]">OS</span>
        <span className="mx-3 text-[#e7e5e4]">·</span>
        AI-powered trip planning for modern squads
      </footer>
    </main>
  );
}
