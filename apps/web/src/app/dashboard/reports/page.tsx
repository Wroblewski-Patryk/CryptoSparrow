import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PerformanceReportsView from "@/features/reports/components/PerformanceReportsView";
import { LuFileChartColumnIncreasing, LuList } from "react-icons/lu";

export default function ReportsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Reports"
        icon={<LuFileChartColumnIncreasing className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports", href: "/dashboard/reports" },
          { label: "Performance", icon: <LuList className="h-3.5 w-3.5" /> },
        ]}
      />
      <PerformanceReportsView />
    </section>
  );
}


