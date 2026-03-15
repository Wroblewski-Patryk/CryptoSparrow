import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import BotsManagement from "apps/client/src/features/bots/components/BotsManagement";

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

