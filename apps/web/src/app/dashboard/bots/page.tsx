import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";

export default function BotsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Bots Management"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots" },
        ]}
      />
      <BotsManagement />
    </section>
  );
}


