import { redirect } from "next/navigation";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";

type BotsAssistantPageProps = {
  searchParams?: Promise<{
    botId?: string;
  }>;
};

export default async function BotsAssistantPage({ searchParams }: BotsAssistantPageProps) {
  const params = searchParams ? await searchParams : undefined;
  const botId = params?.botId?.trim();

  if (botId) {
    redirect(dashboardRoutes.bots.assistant(botId));
  }

  redirect(dashboardRoutes.bots.list);
}
