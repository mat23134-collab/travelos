import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — SARTO',
};

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ backgroundColor: '#071629', color: 'rgba(255,255,255,0.80)' }}
    >
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm mb-10 transition-colors"
          style={{ color: 'rgba(255,255,255,0.40)' }}
        >
          ← Back
        </Link>

        <article className="bg-white/[0.02] backdrop-blur-md border border-white/[0.05] p-8 rounded-2xl">
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Privacy Policy – SARTO</h1>
          <p className="text-sm italic mb-10" style={{ color: 'rgba(255,255,255,0.42)' }}>
            Last updated: May 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.68)' }}>
            <p>
              At SARTO, we are committed to protecting your privacy. This document outlines what information we collect and how it is used:
            </p>
            <p>
              <strong className="text-white">1. Information We Collect:</strong> We collect travel preferences, group dynamics, culinary choices, and destinations entered during the onboarding process to generate your bespoke personalized itinerary.
            </p>
            <p>
              <strong className="text-white">2. Third-Party Services:</strong> SARTO uses Supabase for secure data hosting, and Microsoft Clarity for user experience analysis (including heatmaps and session recordings) to improve site performance.
            </p>
            <p>
              <strong className="text-white">3. Data Security:</strong> We implement strict server-side security policies (RLS) to ensure that only you have access to your personal itinerary data.
            </p>
            <p>
              <strong className="text-white">4. Contact Us:</strong> For any questions regarding your data or privacy, contact our support team at travelos23@gmail.com.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
