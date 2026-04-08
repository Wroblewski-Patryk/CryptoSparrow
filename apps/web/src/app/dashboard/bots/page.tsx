'use client';

import { useRouter } from "next/navigation";
import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsListTable from "@/features/bots/components/BotsListTable";
import { useI18n } from "@/i18n/I18nProvider";
import { LuBot, LuList } from "react-icons/lu";

export default function BotsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const listLabel = locale === "pl" ? "Lista" : "List";
  const createLabel = "Create";

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={t("dashboard.nav.bots")}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: t("dashboard.nav.bots"), href: "/dashboard/bots" },
          { label: listLabel, icon: <LuList className="h-3.5 w-3.5" /> },
        ]}
        onAdd={() => router.push("/dashboard/bots/create")}
        addLabel={createLabel}
      />

      <BotsListTable />
    </section>
  );
}


