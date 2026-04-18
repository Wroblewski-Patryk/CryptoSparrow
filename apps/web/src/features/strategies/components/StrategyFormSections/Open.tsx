import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { handleError } from "@/lib/handleError";
import { FormSectionCard, RadioGroupField } from "@/ui/forms";
import { listStrategyIndicators } from "../../api/strategies.api";
import { IndicatorMeta, OpenProps, UserIndicator } from "../../types/StrategyForm.type";
import Indicators from "./Indicators";

export function Open({ data, setData }: OpenProps) {
  const { t } = useI18n();
  const [availableIndicators, setAvailableIndicators] = useState<IndicatorMeta[]>([]);

  const copy = useMemo(() => ({
    title: t("dashboard.strategies.form.open.title"),
    loadIndicatorsFailed: t("dashboard.strategies.form.open.loadIndicatorsFailed"),
    direction: t("dashboard.strategies.form.open.direction"),
    directionLong: t("dashboard.strategies.form.open.directionLong"),
    directionBoth: t("dashboard.strategies.form.open.directionBoth"),
    directionShort: t("dashboard.strategies.form.open.directionShort"),
  }), [t]);

  useEffect(() => {
    (async () => {
      try {
        const fetched = await listStrategyIndicators();
        setAvailableIndicators(fetched);
      } catch (error: unknown) {
        toast.error(copy.loadIndicatorsFailed, { description: handleError(error) });
        setAvailableIndicators([]);
      }
    })();
  }, [copy.loadIndicatorsFailed]);

  const setDirection = (direction: "both" | "long" | "short") =>
    setData((prev) => ({ ...prev, direction }));

  const setIndicatorsLong = (next: UserIndicator[]) =>
    setData((prev) => ({ ...prev, indicatorsLong: next }));

  const setIndicatorsShort = (next: UserIndicator[]) =>
    setData((prev) => ({ ...prev, indicatorsShort: next }));

  const spans = {
    both: { left: "col-span-12 lg:col-span-6", right: "col-span-12 lg:col-span-6" },
    long: { left: "col-span-12 lg:col-span-8", right: "col-span-12 lg:col-span-4 opacity-60 lg:opacity-20" },
    short: { left: "col-span-12 lg:col-span-4 opacity-60 lg:opacity-20", right: "col-span-12 lg:col-span-8" },
  } as const;

  const layout = spans[data.direction];

  return (
    <FormSectionCard title={copy.title}>
      <div className="w-full">
        <RadioGroupField
          id="strategy-open-direction"
          label={copy.direction}
          value={data.direction}
          options={[
            { value: "long", label: copy.directionLong },
            { value: "both", label: copy.directionBoth },
            { value: "short", label: copy.directionShort },
          ]}
          onChange={(value) => setDirection(value as "both" | "long" | "short")}
        />
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-8">
          <div className={`${layout.left} transition-all duration-500 ease-in-out`}>
            <Indicators
              side="LONG"
              indicators={availableIndicators}
              value={data.indicatorsLong}
              setValue={setIndicatorsLong}
            />
          </div>
          <div className={`${layout.right} transition-all duration-500 ease-in-out`}>
            <Indicators
              side="SHORT"
              indicators={availableIndicators}
              value={data.indicatorsShort}
              setValue={setIndicatorsShort}
            />
          </div>
        </div>
      </div>
    </FormSectionCard>
  );
}
