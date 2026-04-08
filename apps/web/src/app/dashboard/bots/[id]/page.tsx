import { redirect } from "next/navigation";
import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";

type BotDetailsRedirectPageProps = {
  params: Promise<{ id: string }>;
};

export default async function BotDetailsRedirectPage({ params }: BotDetailsRedirectPageProps) {
  const { id } = await params;
  redirect(dashboardRoutes.bots.preview(id));
}
