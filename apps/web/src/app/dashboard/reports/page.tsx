'use client';

import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PerformanceReportsView from "@/features/reports/components/PerformanceReportsView";
import { LuFileChartColumnIncreasing, LuList } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";

export default function ReportsPage() {
  const { locale, t } = useI18n();
  const copy = {
    en: { title: "Reports", breadcrumbLeaf: "Performance" },
    pl: { title: "Raporty", breadcrumbLeaf: "Wydajnosc" },
    pt: { title: "Relatorios", breadcrumbLeaf: "Performance" },
  } as const;
  const labels = copy[locale];

  return (
    <section className="w-full">
      <PageTitle
        title={labels.title}
        icon={<LuFileChartColumnIncreasing className="h-5 w-5" />}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: labels.title, href: "/dashboard/reports" },
          { label: labels.breadcrumbLeaf, icon: <LuList className="h-3.5 w-3.5" /> },
        ]}
      />
      <PerformanceReportsView />
    </section>
  );
}


