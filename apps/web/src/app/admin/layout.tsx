import { ReactNode } from "react";
import { I18nProvider } from "../../i18n/I18nProvider";
import AdminLayoutShell from "@/features/admin/layout/AdminLayoutShell";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AdminLayoutShell>{children}</AdminLayoutShell>
    </I18nProvider>
  );
}
