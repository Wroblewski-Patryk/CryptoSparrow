'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";

import StrategiesList from "apps/client/src/features/strategies/components/StrategiesList";

export default function StrategiesPage() {
    const router = useRouter();

    return (
        <section className="bg-base-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <PageTitle
                    title="Strategie"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Strategie", href: "/dashboard/strategies" }
                    ]}
                    onAdd={() => router.push("/dashboard/strategies/add")}
                    addLabel="Nowa strategia"
                />
                <StrategiesList />
            </div>
        </section>
    );
}  