'use client';

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageTitle } from "apps/client/src/ui/layout/dashboard/PageTitle";
import StrategiesForm from "apps/client/src/features/strategies/components/StrategyForm";
import StrategyPresetPicker from "apps/client/src/features/strategies/components/StrategyPresetPicker";
import { createStrategy } from "apps/client/src/features/strategies/api/strategies.api";
import { strategyPresets } from "apps/client/src/features/strategies/presets/strategyPresets";
import { StrategyFormState } from "apps/client/src/features/strategies/types/StrategyForm.type";

const getErrorMessage = (err: unknown) => {
  if (typeof err === "object" && err && "response" in err) {
    const maybeResponse = err as { response?: { data?: { message?: string } } };
    return maybeResponse.response?.data?.message;
  }
  return undefined;
};

export default function BuilderPage() {
  const router = useRouter();
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null);

  const activePreset = useMemo(
    () => strategyPresets.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId]
  );

  const handleCreate = async (form: StrategyFormState) => {
    try {
      const created = await createStrategy(form);
      toast.success("Strategia utworzona");
      router.push(`/dashboard/strategies/${created.id}/edit`);
    } catch (err: unknown) {
      toast.error("Nie udalo sie utworzyc strategii", {
        description: getErrorMessage(err),
      });
    }
  };

  return (
    <section className="space-y-5">
      <PageTitle
        title="Builder strategii"
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Builder" },
        ]}
      />

      <StrategyPresetPicker
        presets={strategyPresets}
        selectedPresetId={selectedPresetId}
        onSelect={setSelectedPresetId}
        onClear={() => setSelectedPresetId(null)}
      />

      <StrategiesForm
        key={selectedPresetId ?? "builder-default"}
        initial={activePreset?.form}
        onSubmit={handleCreate}
      />
    </section>
  );
}
