import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — SARTO',
};

export default function TermsPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ backgroundColor: '#efe3cd', color: '#2b2622' }}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-10 transition-colors"
          style={{ color: '#6b6358' }}
        >
          ← Back
        </Link>

        <article className="bg-[#fffdf7] backdrop-blur-md border border-[rgba(43,38,34,0.10)] p-8 rounded-2xl">
          <h1 className="text-3xl font-black text-[#2b2622] mb-2 tracking-tight">Terms of Service – SARTO</h1>
          <p className="text-sm italic mb-10" style={{ color: '#6b6358' }}>
            Last updated: May 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#4a4239' }}>
            <p>
              Welcome to SARTO (&quot;the Platform&quot; or &quot;the Service&quot;). By accessing our website, you agree to comply with the following terms:
            </p>
            <p>
              <strong className="text-[#2b2622]">1. Nature of Service:</strong> SARTO is an AI-powered concierge platform that curates bespoke travel itineraries, experiences, and fine-dining recommendations based on user input.
            </p>
            <p>
              <strong className="text-[#2b2622]">2. Limitation of Liability:</strong> Itineraries and recommendations (including restaurants, nightlife, and attractions) are generated using AI models and dynamic live inventory. SARTO is not responsible for sudden changes in operating hours, location availability, booking issues, or the quality of the experience. Users are advised to independently verify specific constraints.
            </p>
            <p>
              <strong className="text-[#2b2622]">3. Intellectual Property:</strong> The design, logo, source code, and custom algorithms of the platform are the exclusive property of SARTO developers. Unauthorized commercial use or copying is strictly prohibited.
            </p>
            <p>
              <strong className="text-[#2b2622]">4. Service Modifications:</strong> We reserve the right to update, modify, or discontinue features on the platform at any time to optimize user experience.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
