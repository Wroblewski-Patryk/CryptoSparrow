import { ReactNode } from "react";
import Header from "../../ui/layout/dashboard/Header";
import Footer from "../../ui/layout/dashboard/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <Header />
      {children}
      <Footer />
    </main>
  );
}
