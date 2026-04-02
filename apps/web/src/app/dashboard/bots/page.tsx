'use client';

import Link from "next/link";
import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";
import { useI18n } from "@/i18n/I18nProvider";

export default function BotsPage() {
  const { t } = useI18n();

  return (
    <section className="w-full">
      <PageTitle
        title={t("dashboard.bots.page.title")}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: t("dashboard.bots.page.breadcrumb") },
        ]}
      />
      <div className="alert mb-4 border border-base-300 bg-base-200 text-sm">
        <span>
          {t("dashboard.bots.page.alertPrefix")} <strong>{t("dashboard.nav.bots")}</strong> {t("dashboard.bots.page.alertMiddle")}{" "}
          <Link href="/dashboard" className="link link-primary font-medium">
            {t("dashboard.common.dashboard")}
          </Link>
          {t("dashboard.bots.page.alertSuffix")}
        </span>
      </div>
      <BotsManagement />
    </section>
  );
}


