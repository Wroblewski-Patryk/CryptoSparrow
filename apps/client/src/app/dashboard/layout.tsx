import { ReactNode } from "react";
import Header from "../../ui/layout/dashboard/Header";
import Footer from "../../ui/layout/dashboard/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-base-100">
      <Header />
      <div className="mx-auto w-full max-w-7xl px-4 py-6">
        {children}
      </div>
      <Footer />
    </main>
  );
}
