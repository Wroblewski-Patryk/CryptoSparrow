'use client';
import { useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import StrategiesForm from "apps/client/src/features/strategies/components/StrategyForm";
import { StrategyFormState } from "apps/client/src/features/strategies/types/StrategyForm.type";
import { toast } from "sonner";
import { createStrategy } from "apps/client/src/features/strategies/api/strategies.api";
import { handleError } from "apps/client/src/lib/handleError";

export default function StrategiesPageAdd() {
    const router = useRouter();

    const handleCreate = async (form: StrategyFormState) => {
        try {
            const created = await createStrategy(form);
            toast.success("Strategia utworzona");
            router.push(`/dashboard/strategies/${created.id}`);
        } catch (e: unknown) {
            toast.error("Błąd tworzenia strategii", { description: handleError(e) });
        }
    };
    return (
        <section>
                <PageTitle
                    title="Nowa strategia"
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Strategie", href: "/dashboard/strategies" },
                        { label: "Nowa strategia" },
                    ]}
                />
                <StrategiesForm
                    onSubmit={handleCreate}
                />
        </section>
    );
}  

