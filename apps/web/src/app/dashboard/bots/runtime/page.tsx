import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";
import { LuBot } from "react-icons/lu";

type BotsRuntimePageProps = {
  searchParams?: Promise<{
    botId?: string;
  }>;
};

export default async function BotsRuntimePage({ searchParams }: BotsRuntimePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const preferredBotId = params?.botId?.trim() ? params.botId : null;

  return (
    <section className="w-full space-y-4">
      <PageTitle
        title="Operacje runtime"
        icon={<LuBot className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots", href: "/dashboard/bots" },
          { label: "Runtime" },
        ]}
      />

      <BotsManagement
        initialTab="monitoring"
        lockedTab="monitoring"
        preferredBotId={preferredBotId}
      />
    </section>
  );
}
