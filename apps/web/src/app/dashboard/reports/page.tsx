'use client';

import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PerformanceReportsView from "@/features/reports/components/PerformanceReportsView";
import { LuFileChartColumnIncreasing, LuList } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";

export default function ReportsPage() {
  const { t } = useI18n();
  const title = t("dashboard.reports.page.title");
  const breadcrumbLeaf = t("dashboard.reports.page.breadcrumbPerformance");

  return (
    <section className="w-full">
      <PageTitle
        title={title}
        icon={<LuFileChartColumnIncreasing className="h-5 w-5" />}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: title, href: "/dashboard/reports" },
          { label: breadcrumbLeaf, icon: <LuList className="h-3.5 w-3.5" /> },
        ]}
      />
      <PerformanceReportsView />
    </section>
  );
}


