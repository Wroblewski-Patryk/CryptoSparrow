import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PerformanceReportsView from "@/features/reports/components/PerformanceReportsView";
import { LuFileChartColumnIncreasing } from "react-icons/lu";

export default function ReportsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Reports Performance"
        icon={<LuFileChartColumnIncreasing className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports" },
        ]}
      />
      <PerformanceReportsView />
    </section>
  );
}


