import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import OrdersBoard from "@/features/orders/components/OrdersBoard";
import { LuShoppingCart } from "react-icons/lu";

export default function OrdersPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Orders"
        icon={<LuShoppingCart className="h-5 w-5" />}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Orders" },
        ]}
      />
      <OrdersBoard />
    </section>
  );
}


