import { ReactNode } from "react";
import Header from "../../ui/layout/dashboard/Header";
import Footer from "../../ui/layout/dashboard/Footer";
import { I18nProvider } from "../../i18n/I18nProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <div className="dashboard-shell min-h-screen bg-base-100 text-base-content flex flex-col">
        <Header />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:py-6">
          {children}
        </main>
        <Footer />
      </div>
    </I18nProvider>
  );
}
