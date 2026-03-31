import Link from "next/link";
import { PageTitle } from "@/ui/layout/dashboard/PageTitle";
import BotsManagement from "@/features/bots/components/BotsManagement";

export default function BotsPage() {
  return (
    <section className="w-full">
      <PageTitle
        title="Bots Operations Center"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Bots Operations" },
        ]}
      />
      <div className="alert mb-4 border border-base-300 bg-base-200 text-sm">
        <span>
          Modul <strong>Bots</strong> sluzy do operacji runtime. Globalny podglad aplikacji i przekroj konta masz w{" "}
          <Link href="/dashboard" className="link link-primary font-medium">
            Dashboard
          </Link>
          .
        </span>
      </div>
      <BotsManagement />
    </section>
  );
}


