'use client';
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import StrategiesForm from "apps/client/src/features/strategies/components/StrategyForm";
import { getStrategy, updateStrategy } from "apps/client/src/features/strategies/api/strategies.api";

import { StrategyFormState } from "apps/client/src/features/strategies/types/StrategyForm.type";
import { dtoToForm } from "apps/client/src/features/strategies/utils/StrategyForm.map";
import { toast } from "sonner";
import { handleError } from "apps/client/src/lib/handleError";

export default function StrategiesPageEdit() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [initial, setInitial] = useState<StrategyFormState | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const data = await getStrategy(id);
                setInitial(dtoToForm(data));
            } catch (e: unknown) {
                toast.error("Nie znaleziono strategii", { description: handleError(e) });
                router.push("/dashboard/strategies");
            }
        })();
    }, [id]);

    const handleUpdate = async (form: StrategyFormState) => {
        try {
            await updateStrategy(id, form);
            toast.success("Strategia zaktualizowana");
        } catch (e: unknown) {
            toast.error("Błąd zapisu strategii", { description: handleError(e) });
        }
    };

    if (!initial) return null;

    return (
        <section>
                <PageTitle
                    title={initial.name}
                    breadcrumb={[
                        { label: "Dashboard", href: "/dashboard" },
                        { label: "Strategie", href: "/dashboard/strategies" },
                        { label: "Edycja strategii" },
                    ]}
                    onAdd={() => router.push("/dashboard/strategies/add")}
                    addLabel="Nowa strategia"
                />
                <StrategiesForm
                    initial={initial}
                    onSubmit={handleUpdate}
                />
        </section>
    );
}  

