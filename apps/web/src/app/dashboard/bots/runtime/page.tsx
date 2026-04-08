import { redirect } from "next/navigation";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";

type BotsRuntimePageProps = {
  searchParams?: Promise<{
    botId?: string;
  }>;
};

export default async function BotsRuntimePage({ searchParams }: BotsRuntimePageProps) {
  const params = searchParams ? await searchParams : undefined;
  const botId = params?.botId?.trim();

  if (botId) {
    redirect(dashboardRoutes.bots.preview(botId));
  }

  redirect(dashboardRoutes.bots.list);
}
