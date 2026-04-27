import Link from 'next/link';

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
  },
  {
    quote: "Replaced three hours of tab-chaos with one click. The 'From the Web' section caught that the museum was under renovation — saved our trip.",
    author: "James K.",
    trip: "Barcelona, Spain",
  },
  {
    quote: "Solo in Morocco, luxury budget. It found a riad most travel sites don't even list. Stayed 2 extra days because of it.",
    author: "Priya V.",
    trip: "Marrakech, Morocco",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0f1117] text-white overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4 bg-[#0f1117]/90 backdrop-blur-sm border-b border-white/5">
        <span className="text-lg font-semibold tracking-tight">
          Travel<span className="text-[#ff5a5f]">OS</span>
        </span>
        <Link
          href="/plan"
          className="text-sm font-medium text-white/70 hover:text-white transition-colors"
        >
          Start Planning →
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 flex flex-col items-center text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#ff5a5f]/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff5a5f] animate-pulse" />
            Powered by Claude AI · 2025–2026 Data
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-tight mb-6">
            Your next trip,{' '}
            <span className="text-[#ff5a5f]">strategically</span>{' '}
            planned.
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            Answer 10 questions. Get a hyper-personalized itinerary crafted from real-world data,
            hidden gems, and logistically optimized daily plans — in under 60 seconds.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/plan"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-[#ff5a5f]/25 hover:shadow-[#ff5a5f]/40 hover:-translate-y-0.5"
            >
              Plan My Trip →
            </Link>
            <span className="text-sm text-white/30">Free · No account needed · 60 seconds</span>
          </div>
        </div>

        {/* Destination tiles */}
        <div className="relative mt-20 w-full max-w-5xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Tokyo', emoji: '🗼', tag: 'Culture & Food' },
              { name: 'Amalfi Coast', emoji: '🌊', tag: 'Relaxed Luxury' },
              { name: 'Marrakech', emoji: '🕌', tag: 'Hidden Gems' },
              { name: 'Kyoto', emoji: '⛩️', tag: 'Slow Travel' },
            ].map((dest) => (
              <div
                key={dest.name}
                className="rounded-2xl bg-white/5 border border-white/10 p-5 hover:bg-white/8 hover:border-white/20 transition-all duration-200"
              >
                <div className="text-3xl mb-3">{dest.emoji}</div>
                <div className="text-sm font-semibold">{dest.name}</div>
                <div className="text-xs text-white/40 mt-1">{dest.tag}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Not another generic planner</h2>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              TravelOS uses a 4-pillar intelligence system to build itineraries that actually work.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.15] transition-colors"
              >
                <div className="text-2xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-16">Three steps to your dream trip</h2>
          <div className="grid sm:grid-cols-3 gap-8">
            {[
              { step: '01', title: 'Answer 10 questions', desc: 'Tell us where, when, who, and what kind of experience you want.' },
              { step: '02', title: 'AI builds your itinerary', desc: 'Claude cross-references real 2025–2026 travel data to craft your plan.' },
              { step: '03', title: 'Travel with confidence', desc: 'Day-by-day plans with logistics, dining, and live web insights.' },
            ].map((item) => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="text-4xl font-bold text-[#ff5a5f]/30 mb-4 font-mono">{item.step}</div>
                <h3 className="font-semibold mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 px-6 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">From real travelers</h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.author} className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
                <p className="text-white/70 text-sm leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div>
                  <div className="font-semibold text-sm">{t.author}</div>
                  <div className="text-white/40 text-xs mt-0.5">{t.trip}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-4xl font-bold mb-4">Ready to travel smarter?</h2>
          <p className="text-white/50 mb-8">10 questions. 60 seconds. One perfect itinerary.</p>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-[#ff5a5f] hover:bg-[#e04a4f] text-white font-semibold text-base transition-all duration-200 shadow-lg shadow-[#ff5a5f]/25 hover:-translate-y-0.5"
          >
            Start for free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8 px-6 text-center text-white/30 text-sm">
        Travel<span className="text-[#ff5a5f]/70">OS</span>
        <span className="mx-3">·</span>
        AI-powered trip planning for the modern traveler
      </footer>
    </main>
  );
}
