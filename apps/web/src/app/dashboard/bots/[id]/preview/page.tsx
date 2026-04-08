import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";
import { LuBot, LuLayoutDashboard } from "react-icons/lu";

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
        title="Bots"
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots", href: "/dashboard/bots" },
          { label: "Preview", icon: <LuLayoutDashboard className="h-3.5 w-3.5" /> },
        ]}
      />

      <BotsManagement initialTab="monitoring" lockedTab="monitoring" preferredBotId={id} />
    </section>
  );
}
