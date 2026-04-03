import { ReactNode } from 'react';
import Header from "../../ui/layout/public/Header";
import Footer from "../../ui/layout/public/Footer";
import { I18nProvider } from "../../i18n/I18nProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
          {children}
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}
