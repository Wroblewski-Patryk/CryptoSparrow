'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import StrategiesForm from "apps/client/src/features/strategies/components/StrategyForm";
import { StrategyFormState } from "apps/client/src/features/strategies/types/StrategyForm.type";
import { toast } from "sonner";
import { createStrategy } from "apps/client/src/features/strategies/api/strategies.api";

export default function StrategiesPageAdd() {
    const router = useRouter();

    const handleCreate = async (form: StrategyFormState) => {
        try {
            const created = await createStrategy(form);
            toast.success("Strategia utworzona");
            router.push(`/dashboard/strategies/${created.id}`);
        } catch (e: any) {
            toast.error("Błąd tworzenia strategii", { description: e?.response?.data?.message });
        }
    };
    return (
        <section className="bg-base-100 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <PageTitle
                    title="Strategie"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Strategie", href: "/dashboard/strategies" },
                        { label: "Nowa strategia", href: "/dashboard/strategies/add" },
                    ]}
                    onAdd={() => router.push("/dashboard/strategies/add")}
                    addLabel="Nowa strategia"
                />
                <StrategiesForm
                    onSubmit={handleCreate}
                />
            </div>
        </section>
    );
}  