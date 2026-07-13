import type { Metadata, Viewport } from 'next';
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
import { ClarityScript } from '@/components/ClarityScript';
import * as Sentry from '@sentry/nextjs';

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

// generateMetadata (not a static const) so Sentry.getTraceData() can inject
// per-request trace headers that stitch the browser session to server traces.
export function generateMetadata(): Metadata {
  return {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://sarto.tours'),
  title: 'Sarto — AI Travel Planner',
  description: 'Build a full personalized travel itinerary in minutes with AI.',
  applicationName: 'Sarto',
  openGraph: {
    type: 'website',
    siteName: 'Sarto',
    title: 'Sarto — AI Travel Planner',
    description: 'Build a full personalized travel itinerary in minutes with AI.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sarto — AI Travel Planner',
    description: 'Build a full personalized travel itinerary in minutes with AI.',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Sarto',
  },
  icons: {
    icon: { url: '/icons/icon-192x192.png', type: 'image/png' },
    apple: '/icons/apple-touch-icon.png',
    shortcut: '/icons/icon-192x192.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    ...Sentry.getTraceData(),
  },
  };
}

export const viewport: Viewport = {
  themeColor: '#0a2748',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover', // lets content extend behind notch / Dynamic Island
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
        {/* PWA — register service worker for offline shell + install prompt */}
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(function() {});
            });
            var refreshing = false;
            navigator.serviceWorker.addEventListener('controllerchange', function() {
              if (refreshing) return;
              refreshing = true;
              window.location.reload();
            });
          }
        `}</Script>

        {/* Microsoft Clarity — consent-gated (heatmaps + session recordings) */}
        <ClarityScript />
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
