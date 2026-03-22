import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PerformanceReportsView from "@/features/reports/components/PerformanceReportsView";

export default function ReportsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Reports Performance"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports" },
        ]}
      />
      <PerformanceReportsView />
    </section>
  );
}


