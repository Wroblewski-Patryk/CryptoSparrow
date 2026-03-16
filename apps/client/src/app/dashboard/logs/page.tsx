'use client';

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import AuditTrailView from "apps/client/src/features/logs/components/AuditTrailView";
import { useI18n } from "apps/client/src/i18n/I18nProvider";

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
