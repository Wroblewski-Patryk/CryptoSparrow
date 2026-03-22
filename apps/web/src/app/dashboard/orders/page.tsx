import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import OrdersBoard from "apps/client/src/features/orders/components/OrdersBoard";

export default function OrdersPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Orders"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Orders" },
        ]}
      />
      <OrdersBoard />
    </section>
  );
}

