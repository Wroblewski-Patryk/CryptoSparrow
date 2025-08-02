import './globals.css';

import type { Metadata } from "next";
import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { AuthProvider } from '../context/AuthContext';

export const metadata: Metadata = {
  title: 'CryptoSparrow',
  description: 'Twój AI bot do handlu na Binance Futures',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pl">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <Toaster position="top-center" richColors />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
