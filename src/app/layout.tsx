import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
import { VersionStamp } from '@/components/VersionStamp';
import { AuthProvider } from '@/lib/auth-context';
import { MotionProvider } from '@/components/MotionProvider';
import { LegalConsentBanner } from '@/components/LegalConsentBanner';
import dynamic from 'next/dynamic';

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
        background: '#071629',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-5 text-center sm:flex-row sm:text-left">
        <p className="text-xs tracking-wide" style={{ color: 'rgba(255,255,255,0.34)' }}>
          © 2026 SARTO. All rights reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-xs font-semibold">
          <Link className="transition-colors hover:text-white" href="/privacy" style={{ color: 'rgba(255,255,255,0.52)' }}>
            Privacy Policy
          </Link>
          <Link className="transition-colors hover:text-white" href="/terms" style={{ color: 'rgba(255,255,255,0.52)' }}>
            Terms of Service
          </Link>
          <a
            className="transition-colors hover:text-white"
            href="mailto:travelos23@gmail.com?subject=SARTO%20Support%20Request"
            style={{ color: 'rgba(255,255,255,0.52)' }}
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
    <html lang="en" className={`${inter.variable} ${brandSerif.variable} h-full`}>
      <body className="min-h-full antialiased">
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
