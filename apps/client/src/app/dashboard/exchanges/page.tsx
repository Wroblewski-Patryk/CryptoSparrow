import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import ExchangeConnectionsView from "apps/client/src/features/exchanges/components/ExchangeConnectionsView";

export default function ExchangesPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Exchange Connections"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Exchanges" },
        ]}
      />
      <ExchangeConnectionsView />
    </section>
  );
}

