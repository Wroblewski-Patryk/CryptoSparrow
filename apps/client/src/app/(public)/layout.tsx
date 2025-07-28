import { ReactNode } from 'react';
import Header from "../../ui/layout/public/Header";
import Footer from "../../ui/layout/public/Footer";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <Header />
      {children}
      <Footer />
    </main>
  );
}
