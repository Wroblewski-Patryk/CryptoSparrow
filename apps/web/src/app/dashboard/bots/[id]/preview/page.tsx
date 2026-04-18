import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";
import { LuBot, LuLayoutDashboard } from "react-icons/lu";
import { dashboardShellEn } from "@/i18n/namespaces/dashboard-shell.en";
import { dashboardBotsEn } from "@/i18n/namespaces/dashboard-bots.en";

type BotPreviewPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BotPreviewPage({ params }: BotPreviewPageProps) {
  const { id } = await params;

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title={dashboardShellEn.nav.bots}
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: dashboardShellEn.common.dashboard, href: "/dashboard" },
          { label: dashboardShellEn.nav.bots, href: "/dashboard/bots" },
          { label: dashboardBotsEn.page.breadcrumbPreview, icon: <LuLayoutDashboard className="h-3.5 w-3.5" /> },
        ]}
      />

      <BotsManagement initialTab="monitoring" lockedTab="monitoring" preferredBotId={id} />
    </section>
  );
}
