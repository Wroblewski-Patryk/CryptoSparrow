import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n/I18nProvider";
import { handleError } from "@/lib/handleError";
import { listStrategyIndicators } from "../../api/strategies.api";
import { IndicatorMeta, OpenProps, UserIndicator } from "../../types/StrategyForm.type";
import Indicators from "./Indicators";

export function Open({ data, setData }: OpenProps) {
  const { locale } = useI18n();
  const [availableIndicators, setAvailableIndicators] = useState<IndicatorMeta[]>([]);

  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            loadIndicatorsFailed: "Nie udalo sie pobrac listy wskaznikow",
            direction: "Kierunek",
            directionLong: "Long",
            directionBoth: "Oba",
            directionShort: "Short",
          }
        : {
            loadIndicatorsFailed: "Could not load indicators list",
            direction: "Direction",
            directionLong: "Long",
            directionBoth: "Both",
            directionShort: "Short",
          },
    [locale],
  );

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
    both: { left: "col-span-6", right: "col-span-6" },
    long: { left: "col-span-8", right: "col-span-4 opacity-20" },
    short: { left: "col-span-4 opacity-20", right: "col-span-8" },
  } as const;

  const layout = spans[data.direction];

  return (
    <div className="w-full">
      <div className="form-control mb-6">
        <label className="label mb-2">
          <span className="label-text">{copy.direction}</span>
        </label>
        <div className="flex flex-row gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="direction"
              className="radio radio-success"
              checked={data.direction === "long"}
              onChange={() => setDirection("long")}
            />
            <span className="label-text">{copy.directionLong}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="direction"
              className="radio radio-primary"
              checked={data.direction === "both"}
              onChange={() => setDirection("both")}
            />
            <span className="label-text">{copy.directionBoth}</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="direction"
              className="radio radio-error"
              checked={data.direction === "short"}
              onChange={() => setDirection("short")}
            />
            <span className="label-text">{copy.directionShort}</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-8">
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
  );
}
