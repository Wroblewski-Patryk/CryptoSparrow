import { ReactNode } from "react";
import { I18nProvider } from "../../i18n/I18nProvider";
import AppLogoLink from "../../ui/components/AppLogoLink";
import FooterPreferencesSwitchers from "../../ui/components/FooterPreferencesSwitchers";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
        <header className="sticky top-0 z-40 border-b border-base-300/60 bg-base-100/80 backdrop-blur">
          <div className="navbar max-w-7xl mx-auto px-4 min-h-16">
            <AppLogoLink href="/" className="text-lg text-base-content" />
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-base-300/60 bg-base-200/70 py-4 text-base-content/80">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4">
            <p className="text-sm">&copy; {new Date().getFullYear()} Soar.</p>
            <FooterPreferencesSwitchers />
          </div>
        </footer>
      </div>
    </I18nProvider>
  );
}
