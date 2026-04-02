import { redirect } from "next/navigation";

import { dashboardRoutes } from "@/ui/layout/dashboard/dashboardRoutes";

export default function BotsLegacyCreateRedirectPage() {
  redirect(dashboardRoutes.bots.create);
}

