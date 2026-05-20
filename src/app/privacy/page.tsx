import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — TravelOS',
};

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ backgroundColor: '#091f36', color: 'rgba(255,255,255,0.80)' }}
    >
      <div className="max-w-2xl mx-auto">
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 text-sm mb-10 transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          ← Back
        </Link>

        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Privacy Policy</h1>
        <p className="text-sm mb-10" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Last updated: May 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)' }}>
          <section>
            <h2 className="text-base font-bold text-white mb-2">1. Information We Collect</h2>
            <p>
              We collect information you provide directly: email address, username, travel preferences
              (destination, dates, group type, budget, interests), and any hotel details you enter.
              We also collect usage data such as pages visited and features used.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">2. How We Use Your Information</h2>
            <p>
              Your data is used to generate personalized travel itineraries, improve our AI model,
              send account-related emails, and provide customer support. We do not sell your personal
              data to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">3. Data Storage</h2>
            <p>
              Your account and itinerary data is stored securely using Supabase (PostgreSQL),
              hosted on infrastructure compliant with industry-standard security practices. Data is
              encrypted at rest and in transit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">4. Third-Party Services</h2>
            <p>
              TravelOS uses the following third-party services: Google Gemini (AI generation),
              Supabase (database and authentication), OpenStreetMap Nominatim (hotel geocoding),
              and Unsplash/Google Places (destination photos). Each service has its own privacy
              policy governing their data use.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">5. Cookies and Local Storage</h2>
            <p>
              We use browser local storage to save your onboarding progress and preferences. We use
              session cookies for authentication. We do not use tracking or advertising cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data at any time. To
              request data deletion, contact us at the email below. We will process your request
              within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">7. Data Retention</h2>
            <p>
              We retain your account data for as long as your account is active. Itineraries are
              stored indefinitely unless you delete them. You can delete your account at any time
              from the dashboard settings.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">8. Children's Privacy</h2>
            <p>
              TravelOS is not intended for children under 13. We do not knowingly collect personal
              information from children under 13. If you believe a child has provided us data,
              please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-base font-bold text-white mb-2">9. Contact</h2>
            <p>
              For privacy-related questions or data requests, contact us at{' '}
              <a
                href="mailto:privacy@travelos.app"
                className="underline underline-offset-2"
                style={{ color: '#9e363a' }}
              >
                privacy@travelos.app
              </a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
