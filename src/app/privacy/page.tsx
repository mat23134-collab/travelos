import { BackButton } from '@/components/BackButton';

export const metadata = {
  title: 'Privacy Policy — SARTO',
};

export default function PrivacyPage() {
  return (
    <main
      className="min-h-screen px-6 py-16"
      style={{ backgroundColor: '#efe3cd', color: '#2b2622' }}
    >
      <div className="mx-auto max-w-3xl">
        <BackButton label="Back" color="#6b6358" className="mb-10" />

        <article className="bg-[#fffdf7] backdrop-blur-md border border-[rgba(43,38,34,0.10)] p-8 rounded-2xl">
          <h1 className="text-3xl font-black text-[#2b2622] mb-2 tracking-tight">Privacy Policy – SARTO</h1>
          <p className="text-sm italic mb-10" style={{ color: '#6b6358' }}>
            Last updated: May 2026
          </p>

          <div className="space-y-6 text-sm leading-relaxed" style={{ color: '#4a4239' }}>
            <p>
              At SARTO, we are committed to protecting your privacy. This document outlines what information we collect and how it is used:
            </p>
            <p>
              <strong className="text-[#2b2622]">1. Information We Collect:</strong> We collect travel preferences, group dynamics, culinary choices, and destinations entered during the onboarding process to generate your bespoke personalized itinerary.
            </p>
            <p>
              <strong className="text-[#2b2622]">2. Third-Party Services:</strong> SARTO uses Supabase for secure data hosting, and Microsoft Clarity for user experience analysis (including heatmaps and session recordings) to improve site performance.
            </p>
            <p>
              <strong className="text-[#2b2622]">3. Affiliate Links &amp; Advertising:</strong> Some outbound links on your itinerary — such as hotel booking links — are affiliate links routed through Commission Junction (CJ Affiliate). If you click one and make a booking, SARTO may earn a commission at no extra cost to you. When you opt in to analytics/marketing cookies, we also load CJ&apos;s page-based tools, which may share aggregated impression data with advertisers and other third parties. These tracking features activate only after you consent, and you can withdraw consent at any time in the cookie settings.
            </p>
            <p>
              <strong className="text-[#2b2622]">4. Data Security:</strong> We implement strict server-side security policies (RLS) to ensure that only you have access to your personal itinerary data.
            </p>
            <p>
              <strong className="text-[#2b2622]">5. Contact Us:</strong> For any questions regarding your data or privacy, contact our support team at travelos23@gmail.com.
            </p>
          </div>
        </article>
      </div>
    </main>
  );
}
