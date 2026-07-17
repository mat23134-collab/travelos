import Link from 'next/link';

export const metadata = {
  title: 'Cookie Policy — TravelOS',
};

export default function CookiePolicyPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ backgroundColor: '#091f36', color: '#2b2622' }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-10 transition-colors"
          style={{ color: '#6b6358' }}
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-black text-[#2b2622] mb-2 tracking-tight">Cookie Policy</h1>
        <p className="text-sm mb-10" style={{ color: '#6b6358' }}>
          Last updated: May 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: '#4a4239' }}>
          <section>
            <h2 className="text-base font-bold text-[#2b2622] mb-2">1. What We Use</h2>
            <p>
              TravelOS uses essential cookies and browser local storage to keep you signed in,
              remember onboarding progress, store language preferences, and generate trips reliably.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#2b2622] mb-2">2. Essential Storage</h2>
            <p>
              Essential storage is required for authentication, account security, trip drafts, and
              the legal consent record. Without it, core parts of the service may not work.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#2b2622] mb-2">3. Preference Storage</h2>
            <p>
              Preference storage remembers choices such as trip language, onboarding answers, and
              whether you already accepted this policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#2b2622] mb-2">4. Analytics</h2>
            <p>
              Analytics cookies are optional and off by default in the consent banner. We do not use
              advertising cookies or sell personal data.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-[#2b2622] mb-2">5. Updating Your Choice</h2>
            <p>
              You can clear browser storage to reset your consent choice. A future account settings
              screen may expose these preferences directly.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
