import './globals.css';

import type { Metadata, Viewport } from "next";
import { ReactNode } from 'react';
import { Lato, Titillium_Web } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '../context/AuthContext';
import ServiceWorkerRegistration from '../ui/pwa/ServiceWorkerRegistration';

const titilliumWeb = Titillium_Web({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  display: 'swap',
  variable: '--font-heading',
});

const lato = Lato({
  subsets: ['latin'],
  weight: ['300', '400', '700'],
  display: 'swap',
  variable: '--font-body',
});

export const metadata: Metadata = {
  title: 'CryptoSparrow',
  description: 'Twoj AI bot do handlu spot i futures',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'CryptoSparrow',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" data-theme="cryptosparrow" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (() => {
                const fallback = 'cryptosparrow';
                const normalize = (value) => {
                  if (!value || value === 'default') return fallback;
                  return value;
                };
                const stored = normalize(localStorage.getItem('themePreference') || localStorage.getItem('theme'));
                const preference = stored || fallback;
                const resolved = preference === 'system'
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : preference;
                document.documentElement.setAttribute('data-theme', resolved);
                const locale = localStorage.getItem('cryptosparrow-locale');
                if (locale === 'pl' || locale === 'en') {
                  document.documentElement.lang = locale;
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${lato.variable} ${titilliumWeb.variable} font-body`}>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Toaster position="top-center" duration={2500} closeButton richColors />
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
