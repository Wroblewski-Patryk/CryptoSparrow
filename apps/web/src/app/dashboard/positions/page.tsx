import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PositionsBoard from "@/features/positions/components/PositionsBoard";
import { LuPackageOpen } from "react-icons/lu";

export default function PositionsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Positions"
        icon={<LuPackageOpen className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Positions" },
        ]}
      />
      <PositionsBoard />
    </section>
  );
}


