import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { Toasts } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hussayn Alpha | Premium Crypto Insights',
  description: 'Get exclusive crypto trading signals, market analysis, and proven strategies from a top trader. Join the premium community.',
  keywords: ['crypto', 'trading', 'signals', 'hussayn', 'solana', 'premium'],
  openGraph: {
    title: 'Hussayn Alpha | Premium Crypto Insights',
    description: 'Exclusive crypto trading signals and market analysis.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Hussayn Alpha | Premium Crypto Insights',
    description: 'Exclusive crypto trading signals and market analysis.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-16 md:pt-20">
          {children}
        </main>
        <Footer />
        <Toasts />
      </body>
    </html>
  );
}

