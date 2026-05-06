import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { VersionStamp } from '@/components/VersionStamp';
import { AuthProvider } from '@/lib/auth-context';
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

export const metadata: Metadata = {
  title: 'TravelOS — AI-Powered Trip Planning',
  description: 'Transform your travel dreams into hyper-personalized, data-validated itineraries crafted by AI with real-world intelligence.',
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
        <CanvasShell />
        <VersionStamp />
      </body>
    </html>
  );
}
