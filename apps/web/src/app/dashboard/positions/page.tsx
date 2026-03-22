import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import PositionsBoard from "@/features/positions/components/PositionsBoard";

export default function PositionsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Positions"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Positions" },
        ]}
      />
      <PositionsBoard />
    </section>
  );
}


