import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { VersionStamp } from '@/components/VersionStamp';
import { AuthProvider } from '@/lib/auth-context';

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
        <VersionStamp />
      </body>
    </html>
  );
}
