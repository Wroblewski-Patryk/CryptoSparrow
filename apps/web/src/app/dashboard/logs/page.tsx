'use client';

import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import AuditTrailView from "@/features/logs/components/AuditTrailView";
import { useI18n } from "@/i18n/I18nProvider";

export default function LogsPage() {
  const { t } = useI18n();

  return (
    <section className="w-full">
      <PageTitle
        title={t("dashboard.logs.title")}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: t("dashboard.logs.breadcrumbLogs") },
        ]}
      />
      <AuditTrailView />
    </section>
  );
}

