import { redirect } from "next/navigation";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";

type BotRuntimeRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BotRuntimeRedirectPage({ params }: BotRuntimeRedirectPageProps) {
  const { id } = await params;
  redirect(dashboardRoutes.bots.preview(id));
}
