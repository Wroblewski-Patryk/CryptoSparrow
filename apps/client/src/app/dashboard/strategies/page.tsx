'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";

import StrategiesList from "apps/client/src/features/strategies/components/StrategiesList";

export default function StrategiesPage() {
    const router = useRouter();

    return (
        <section>
                <PageTitle
                    title="Strategie"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Strategie" }
                    ]}
                    onAdd={() => router.push("/dashboard/strategies/add")}
                    addLabel="Nowa strategia"
                />
                <StrategiesList />
        </section>
    );
}  
