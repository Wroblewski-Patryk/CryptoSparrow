import './globals.css';

import type { Metadata, Viewport } from "next";
import { ReactNode } from 'react';
import { Lato, Titillium_Web } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '../context/AuthContext';
import ServiceWorkerRegistration from '../ui/pwa/ServiceWorkerRegistration';
import SkipToContentLink from '../ui/components/SkipToContentLink';
import { themeBootstrapScript } from '../security/themeBootstrap';

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
  applicationName: 'Soar',
  title: 'Soar',
  description: 'Twoj AI bot do handlu spot i futures',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'Soar',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: [{ url: '/icons/icon-192.png', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
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
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <script
          dangerouslySetInnerHTML={{
            __html: themeBootstrapScript,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${lato.variable} ${titilliumWeb.variable} font-body`}
      >
        <SkipToContentLink />
        <Toaster position="bottom-center" duration={2500} closeButton richColors />
        <ServiceWorkerRegistration />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
