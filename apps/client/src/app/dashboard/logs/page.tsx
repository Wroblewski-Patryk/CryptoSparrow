import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import AuditTrailView from "apps/client/src/features/logs/components/AuditTrailView";

export default function LogsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Audit Trail"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Logs" },
        ]}
      />
      <AuditTrailView />
    </section>
  );
}

