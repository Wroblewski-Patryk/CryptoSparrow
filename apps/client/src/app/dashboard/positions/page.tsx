import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import PositionsBoard from "apps/client/src/features/positions/components/PositionsBoard";

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

