import { ReactNode } from "react";
import AppLogoLink from "../../ui/components/AppLogoLink";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base-100 text-base-content flex flex-col">
      <header className="sticky top-0 z-40 border-b border-base-300/60 bg-base-100/80 backdrop-blur">
        <div className="navbar max-w-7xl mx-auto px-4 min-h-16">
          <AppLogoLink href="/" className="text-lg text-base-content" />
        </div>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
