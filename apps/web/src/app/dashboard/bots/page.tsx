'use client';

import { useRouter } from "next/navigation";
import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsListTable from "@/features/bots/components/BotsListTable";
import { useI18n } from "@/i18n/I18nProvider";
import { LuBot } from "react-icons/lu";

export default function BotsPage() {
  const { t } = useI18n();
  const router = useRouter();

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={t("dashboard.nav.botsList")}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: t("dashboard.common.dashboard"), href: "/dashboard" },
          { label: t("dashboard.nav.bots"), href: "/dashboard/bots" },
          { label: t("dashboard.nav.botsList") },
        ]}
        onAdd={() => router.push("/dashboard/bots/create")}
        addLabel={t("dashboard.nav.createBot")}
        addButtonClassName="btn mt-4 border-base-content/25 bg-base-100/80 text-base-content hover:border-base-content/35 hover:bg-base-100 md:mt-0"
      />

      <BotsListTable />
    </section>
  );
}


