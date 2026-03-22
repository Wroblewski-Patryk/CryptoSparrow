import { ReactNode } from 'react';
import Header from "../../ui/layout/public/Header";
import Footer from "../../ui/layout/public/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
