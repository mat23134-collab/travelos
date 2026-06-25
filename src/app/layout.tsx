import type { Metadata } from 'next';
import Script from 'next/script';
import { Assistant, Cormorant_Garamond, Fraunces, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { VersionStamp } from '@/components/VersionStamp';
import { AuthProvider } from '@/lib/auth-context';
import { MotionProvider } from '@/components/MotionProvider';
import { LegalConsentBanner } from '@/components/LegalConsentBanner';
import dynamic from 'next/dynamic';
import { SiteBackground } from '@/components/SiteBackground';

// CanvasShell uses WebGL — must be client-only (no SSR).
const CanvasShell = dynamic(
  () => import('@/three/CanvasShell').then((m) => ({ default: m.CanvasShell })),
  { ssr: false }
);

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const brandSerif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-brand-serif',
  display: 'swap',
});

const display = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

// Body typeface — Assistant: an elegant Hebrew-first humanist sans (Latin +
// Hebrew), warmer and more characterful than Inter, pairs with Fraunces.
const body = Assistant({
  subsets: ['latin', 'hebrew'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TravelOS — AI-Powered Trip Planning',
  description: 'Transform your travel dreams into hyper-personalized, data-validated itineraries crafted by AI with real-world intelligence.',
  icons: { icon: { url: '/icon.svg', type: 'image/svg+xml' } },
};

function Footer() {
  return (
    <footer
      className="px-6 py-8"
      style={{
        background: '#e7dbc2',
        borderTop: '1px solid rgba(43,38,34,0.08)',
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <p className="text-xs tracking-wide" style={{ color: '#6b6358' }}>
          © 2026 SARTO. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold">
          <Link className="transition-colors hover:text-[#2b2622]" href="/privacy" style={{ color: '#6b6358' }}>
            Privacy Policy
          </Link>
          <Link className="transition-colors hover:text-[#2b2622]" href="/terms" style={{ color: '#6b6358' }}>
            Terms of Service
          </Link>
          <a
            className="transition-colors hover:text-[#2b2622]"
            href="mailto:travelos23@gmail.com?subject=SARTO%20Support%20Request"
            style={{ color: '#6b6358' }}
          >
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${body.variable} ${brandSerif.variable} ${display.variable} h-full`}>
      <body className="min-h-full antialiased">
        {/* Microsoft Clarity — UX analytics (heatmaps + session recordings) */}
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "xcnbnwmi2y");`}
        </Script>
        <SiteBackground />
        <MotionProvider>
          <AuthProvider>
            {children}
            <Footer />
            <LegalConsentBanner />
          </AuthProvider>
        </MotionProvider>
        <CanvasShell />
        <VersionStamp />
      </body>
    </html>
  );
}
