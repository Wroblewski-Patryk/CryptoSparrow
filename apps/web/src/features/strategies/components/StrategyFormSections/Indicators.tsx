import { LuChevronDown, LuChevronRight, LuChevronUp, LuTrash2, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { IndicatorsProps, StrategyConditionOperator } from "../../types/StrategyForm.type";
import { numericInputProps, readNumericInputValue, strategyNumericContracts } from "../../utils/strategyNumericInput";
import {
  IndicatorGroupKey,
  getIndicatorGroupLabel,
  resolveIndicatorGroupKey,
  sortIndicatorGroups,
} from "../../utils/indicatorTaxonomy";
import { getIndicatorDisplayName, getIndicatorParamLabel } from "../../utils/indicatorPresentation";

const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);
const comparatorConditions: StrategyConditionOperator[] = [
  ">",
  ">=",
  "<",
  "<=",
  "==",
  "!=",
];
const crossConditions: StrategyConditionOperator[] = [
  "CROSS_ABOVE",
  "CROSS_BELOW",
];
const rangeConditions: StrategyConditionOperator[] = [
  "IN_RANGE",
  "OUT_OF_RANGE",
];
const allConditionOptions: StrategyConditionOperator[] = [
  ...comparatorConditions,
  ...crossConditions,
  ...rangeConditions,
];
const conditionLabelMap: Record<StrategyConditionOperator, { en: string; pl: string }> = {
  ">": { en: "Greater than (>)", pl: "Wieksze niz (>)" },
  ">=": { en: "Greater than or equal (>=)", pl: "Wieksze lub rowne (>=)" },
  "<": { en: "Less than (<)", pl: "Mniejsze niz (<)" },
  "<=": { en: "Less than or equal (<=)", pl: "Mniejsze lub rowne (<=)" },
  "==": { en: "Equal to (==)", pl: "Rowne (==)" },
  "!=": { en: "Not equal to (!=)", pl: "Rozne (!=)" },
  CROSS_ABOVE: { en: "Cross above", pl: "Przeciecie w gore" },
  CROSS_BELOW: { en: "Cross below", pl: "Przeciecie w dol" },
  IN_RANGE: { en: "In range", pl: "W zakresie" },
  OUT_OF_RANGE: { en: "Out of range", pl: "Poza zakresem" },
};

const resolveConditionOptions = (
  indicatorName: string,
  indicatorType: string | undefined,
): StrategyConditionOperator[] => {
  const normalizedType = (indicatorType ?? "").trim().toLowerCase();
  const normalizedName = indicatorName.trim().toUpperCase();

  if (normalizedType === "pattern" || normalizedName.includes("ENGULFING") || normalizedName.includes("STAR") || normalizedName.includes("HAMMER") || normalizedName.includes("DOJI") || normalizedName.includes("INSIDE_BAR") || normalizedName.includes("OUTSIDE_BAR")) {
    return comparatorConditions;
  }
  if (normalizedType === "trend") {
    return [...comparatorConditions, ...crossConditions];
  }
  if (normalizedType === "oscillator" || normalizedType === "momentum") {
    return [...comparatorConditions, ...crossConditions, ...rangeConditions];
  }
  if (normalizedType === "volatility" || normalizedType === "derivatives") {
    return [...comparatorConditions, ...rangeConditions];
  }
  return allConditionOptions;
};

const resolveConditionLabel = (condition: StrategyConditionOperator, locale: "en" | "pl") =>
  conditionLabelMap[condition][locale];

const isRangeCondition = (condition: StrategyConditionOperator) =>
  condition === "IN_RANGE" || condition === "OUT_OF_RANGE";

const normalizeConditionValue = (
  condition: StrategyConditionOperator,
  rawValue: number | [number, number],
): number | [number, number] => {
  if (isRangeCondition(condition)) {
    if (Array.isArray(rawValue)) {
      const [first = 0, second = first] = rawValue;
      return [first, second];
    }
    return [rawValue, rawValue];
  }

  if (Array.isArray(rawValue)) {
    const [first = 0] = rawValue;
    return first;
  }
  return rawValue;
};

export default function Indicators({ side, indicators, value, setValue }: IndicatorsProps) {
  const { locale } = useI18n();
  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            collapse: "Zwin",
            expand: "Rozwin",
            moveUp: "Wyzej",
            moveDown: "Nizej",
            removeIndicator: "Usun wskaznik",
            group: "Grupa",
            indicator: "Wskaznik",
            indicatorParams: "Parametry wskaznika",
            condition: "Warunek",
            value: "Wartosc",
            valueFrom: "Wartosc od",
            valueTo: "Wartosc do",
            weight: "Waga",
            addIndicator: "+ Dodaj wskaznik",
            sideLong: "Long",
            sideShort: "Short",
          }
        : {
            collapse: "Collapse",
            expand: "Expand",
            moveUp: "Move up",
            moveDown: "Move down",
            removeIndicator: "Remove indicator",
            group: "Group",
            indicator: "Indicator",
            indicatorParams: "Indicator parameters",
            condition: "Condition",
            value: "Value",
            valueFrom: "Value from",
            valueTo: "Value to",
            weight: "Weight",
            addIndicator: "+ Add indicator",
            sideLong: "Long",
            sideShort: "Short",
          },
    [locale],
  );
  const normalizedIndicators = indicators.map((indicator) => ({
    ...indicator,
    group: resolveIndicatorGroupKey({
      indicatorName: indicator.name,
      group: indicator.group,
    }),
  }));
  const normalizedValue = value.map((indicator) => {
    const normalizedGroup = resolveIndicatorGroupKey({
      indicatorName: indicator.name,
      group: indicator.group,
    });
    const meta = normalizedIndicators.find((entry) => entry.name === indicator.name);
    const conditionOptions = resolveConditionOptions(indicator.name, meta?.type);
    const condition = conditionOptions.includes(indicator.condition)
      ? indicator.condition
      : (conditionOptions[0] ?? ">");

    return {
      ...indicator,
      group: normalizedGroup,
      condition,
      value: normalizeConditionValue(condition, indicator.value),
    };
  });
  const indicatorGroups = sortIndicatorGroups(
    Array.from(
      new Set<IndicatorGroupKey>([
        ...normalizedIndicators.map((indicator) => indicator.group),
        ...normalizedValue.map((indicator) => indicator.group),
      ]),
    ),
  );

  const addIndicator = () => {
    if (normalizedIndicators.length === 0) return;
    const group = indicatorGroups[0];
    if (!group) return;
    const indicatorsInGroup = normalizedIndicators.filter((indicator) => indicator.group === group);
    const meta = indicatorsInGroup[0];
    if (!meta) return;
    const defaultCondition = resolveConditionOptions(meta.name, meta.type)[0] ?? ">";
    setValue([
      ...normalizedValue,
      {
        group,
        name: meta.name,
        params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
        condition: defaultCondition,
        value: normalizeConditionValue(defaultCondition, 0),
        weight: 1,
        expanded: true,
      },
    ]);
  };

  const updateGroup = (idx: number, group: IndicatorGroupKey) => {
    const indicatorsInGroup = normalizedIndicators.filter((indicator) => indicator.group === group);
    const meta = indicatorsInGroup[0];
    if (!meta) {
      setValue(normalizedValue.map((entry, index) => (index === idx ? { ...entry, group } : entry)));
      return;
    }
    setValue(
      normalizedValue.map((entry, index) =>
        index === idx
          ? (() => {
              const nextConditionOptions = resolveConditionOptions(meta.name, meta.type);
              const nextCondition = nextConditionOptions.includes(entry.condition)
                ? entry.condition
                : (nextConditionOptions[0] ?? ">");
              return {
                ...entry,
                group,
                name: meta.name,
                params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
                condition: nextCondition,
                value: normalizeConditionValue(nextCondition, entry.value),
              };
            })()
          : entry,
      ),
    );
  };

  const updateIndicatorType = (idx: number, name: string) => {
    const meta = normalizedIndicators.find((indicator) => indicator.name === name);
    if (!meta) return;
    setValue(
      normalizedValue.map((entry, index) =>
        index === idx
          ? (() => {
              const nextConditionOptions = resolveConditionOptions(meta.name, meta.type);
              const nextCondition = nextConditionOptions.includes(entry.condition)
                ? entry.condition
                : (nextConditionOptions[0] ?? ">");
              return {
                ...entry,
                group: meta.group,
                name,
                params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
                condition: nextCondition,
                value: normalizeConditionValue(nextCondition, entry.value),
              };
            })()
          : entry,
      ),
    );
  };

  const updateParam = (idx: number, param: string, paramValue: number) => {
    setValue(
      normalizedValue.map((entry, index) =>
        index === idx
          ? { ...entry, params: { ...entry.params, [param]: paramValue } }
          : entry,
      ),
    );
  };

  const updateCondition = (idx: number, condition: StrategyConditionOperator) => {
    setValue(
      normalizedValue.map((entry, index) =>
        index === idx
          ? {
              ...entry,
              condition,
              value: normalizeConditionValue(condition, entry.value),
            }
          : entry,
      ),
    );
  };

  const updateValue = (idx: number, nextValue: number) => {
    setValue(
      normalizedValue.map((entry, index) => (index === idx ? { ...entry, value: nextValue } : entry)),
    );
  };

  const updateRangeValue = (idx: number, bound: "low" | "high", nextValue: number) => {
    setValue(
      normalizedValue.map((entry, index) => {
        if (index !== idx) return entry;
        const normalized = normalizeConditionValue(entry.condition, entry.value);
        const [low = 0, high = low] = Array.isArray(normalized) ? normalized : [normalized, normalized];
        return {
          ...entry,
          value: bound === "low" ? [nextValue, high] : [low, nextValue],
        };
      }),
    );
  };

  const updateWeight = (idx: number, nextValue: number) => {
    setValue(
      normalizedValue.map((entry, index) => (index === idx ? { ...entry, weight: nextValue } : entry)),
    );
  };

  const toggleExpand = (idx: number) => {
    setValue(
      normalizedValue.map((entry, index) =>
        index === idx ? { ...entry, expanded: !entry.expanded } : entry,
      ),
    );
  };

  const removeIndicator = (idx: number) => {
    setValue(normalizedValue.filter((_, index) => index !== idx));
  };

  const moveIndicator = (idx: number, direction: "up" | "down") => {
    const next = [...normalizedValue];
    if (direction === "up" && idx > 0) [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    if (direction === "down" && idx < next.length - 1) [next[idx + 1], next[idx]] = [next[idx], next[idx + 1]];
    setValue(next);
  };

  return (
    <div>
      <h3
        className={`text-xl mb-4 flex items-center gap-2 ${
          side === "LONG" ? "text-success" : "text-error"
        }`}
      >
        {side === "LONG" ? (
          <LuTrendingUp className="w-4 h-4 mt-1" />
        ) : (
          <LuTrendingDown className="w-4 h-4" />
        )}
        {side === "LONG" ? copy.sideLong : copy.sideShort}
      </h3>

      {normalizedValue.map((indicator, idx) => {
        const indicatorsInGroup = normalizedIndicators.filter((entry) => entry.group === indicator.group);
        const meta = normalizedIndicators.find((entry) => entry.name === indicator.name);
        const indicatorOptions =
          indicatorsInGroup.length > 0
            ? indicatorsInGroup
            : [{ name: indicator.name, group: indicator.group, type: "custom", params: [] }];
        const conditionOptions = resolveConditionOptions(indicator.name, meta?.type);

        return (
          <div key={idx} className="card bg-base-200 shadow-md mb-6">
            <div className="flex justify-between items-center pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-square"
                  onClick={() => toggleExpand(idx)}
                  title={indicator.expanded ? copy.collapse : copy.expand}
                >
                  {indicator.expanded ? (
                    <LuChevronUp className="w-4 h-4" />
                  ) : (
                    <LuChevronDown className="w-4 h-4" />
                  )}
                </button>
                <div className="text-sm flex items-center gap-2">
                  <span className="text-base-content/80">{getIndicatorGroupLabel(indicator.group, locale)}</span>
                  <LuChevronRight className="text-base-content/60" />
                  <span className="text-base-content">{getIndicatorDisplayName(indicator.name, locale)}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="join">
                  <button
                    type="button"
                    className="btn btn-xs btn-square join-item"
                    disabled={idx === 0}
                    onClick={() => moveIndicator(idx, "up")}
                    title={copy.moveUp}
                  >
                    <LuChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-square join-item"
                    disabled={idx === normalizedValue.length - 1}
                    onClick={() => moveIndicator(idx, "down")}
                    title={copy.moveDown}
                  >
                    <LuChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-square text-error"
                  onClick={() => removeIndicator(idx)}
                  title={copy.removeIndicator}
                >
                  <LuTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {indicator.expanded && (
              <div className="card-body pt-2 pb-2">
                <div className="flex flex-col md:flex-row gap-6 mb-2">
                  <div className="flex-1">
                    <label className="label">{copy.group}</label>
                    <select
                      className="select select-bordered w-full"
                      value={indicator.group}
                      onChange={(event) => updateGroup(idx, event.target.value as IndicatorGroupKey)}
                    >
                      {indicatorGroups.map((group) => (
                        <option key={group} value={group}>
                          {getIndicatorGroupLabel(group, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="label">{copy.indicator}</label>
                    <select
                      className="select select-bordered w-full"
                      value={indicator.name}
                      onChange={(event) => updateIndicatorType(idx, event.target.value)}
                    >
                      {indicatorOptions.map((entry) => (
                        <option key={entry.name} value={entry.name}>
                          {getIndicatorDisplayName(entry.name, locale)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div
                  data-testid={`indicator-layout-${idx}`}
                  className={`grid grid-cols-1 gap-6 ${meta?.params.length ? "md:grid-cols-2" : ""}`}
                >
                  {meta?.params.length ? (
                    <div>
                      <div className="font-semibold text-base-content/80 mb-2 flex items-center gap-2">
                        {copy.indicatorParams}
                      </div>
                      <div className="space-y-2">
                        {meta.params.map((param) => (
                          <div key={param.name} className="form-control mb-4">
                            <label className="label">
                              <span className="label-text">{getIndicatorParamLabel(param.name, locale)}</span>
                            </label>
                            <input
                              type="number"
                              className="input input-bordered"
                              min={param.min}
                              max={param.max}
                              inputMode={Number.isInteger(param.default) ? "numeric" : decimalInputProps.inputMode}
                              step={Number.isInteger(param.default) ? "1" : decimalInputProps.step}
                              value={indicator.params[param.name]}
                              onChange={(event) => {
                                const contract = Number.isInteger(param.default)
                                  ? strategyNumericContracts.integer
                                  : strategyNumericContracts.decimal2;
                                const parsed = readNumericInputValue(event.target.value, contract);
                                if (parsed == null) return;
                                updateParam(idx, param.name, parsed);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-6">
                    <div>
                      <div className={`grid gap-4 items-end ${isRangeCondition(indicator.condition) ? "grid-cols-1 md:grid-cols-3" : "grid-cols-2"}`}>
                        <div>
                          <label className="label mb-1 font-semibold">{copy.condition}</label>
                          <select
                            className="select select-bordered w-full"
                            value={indicator.condition}
                            onChange={(event) => updateCondition(idx, event.target.value as StrategyConditionOperator)}
                          >
                            {conditionOptions.map((operator) => (
                              <option key={operator} value={operator}>
                                {resolveConditionLabel(operator, locale)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {isRangeCondition(indicator.condition) ? (
                          <>
                            <div>
                              <label className="label mb-1 font-semibold">{copy.valueFrom}</label>
                              <input
                                type="number"
                                inputMode={decimalInputProps.inputMode}
                                step={decimalInputProps.step}
                                className="input input-bordered w-full"
                                value={
                                  Array.isArray(indicator.value)
                                    ? indicator.value[0]
                                    : indicator.value
                                }
                                onChange={(event) => {
                                  const parsed = readNumericInputValue(
                                    event.target.value,
                                    strategyNumericContracts.decimal2,
                                  );
                                  if (parsed == null) return;
                                  updateRangeValue(idx, "low", parsed);
                                }}
                              />
                            </div>
                            <div>
                              <label className="label mb-1 font-semibold">{copy.valueTo}</label>
                              <input
                                type="number"
                                inputMode={decimalInputProps.inputMode}
                                step={decimalInputProps.step}
                                className="input input-bordered w-full"
                                value={
                                  Array.isArray(indicator.value)
                                    ? indicator.value[1]
                                    : indicator.value
                                }
                                onChange={(event) => {
                                  const parsed = readNumericInputValue(
                                    event.target.value,
                                    strategyNumericContracts.decimal2,
                                  );
                                  if (parsed == null) return;
                                  updateRangeValue(idx, "high", parsed);
                                }}
                              />
                            </div>
                          </>
                        ) : (
                          <div>
                            <label className="label mb-1 font-semibold">{copy.value}</label>
                            <input
                              type="number"
                              inputMode={decimalInputProps.inputMode}
                              step={decimalInputProps.step}
                              className="input input-bordered w-full"
                              value={Array.isArray(indicator.value) ? indicator.value[0] : indicator.value}
                              onChange={(event) => {
                                const parsed = readNumericInputValue(
                                  event.target.value,
                                  strategyNumericContracts.decimal2,
                                );
                                if (parsed == null) return;
                                updateValue(idx, parsed);
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="label font-semibold">
                        <span className="label-text flex items-center gap-1">{copy.weight}</span>
                      </label>
                      <div className="flex items-center gap-4">
                        <div className="w-full max-w-xs">
                          <input
                            className="range range-xs"
                            type="range"
                            min={0}
                            max="1"
                            value={indicator.weight}
                            onChange={(event) => {
                              const parsed = readNumericInputValue(
                                event.target.value,
                                strategyNumericContracts.decimal2,
                              );
                              if (parsed == null) return;
                              updateWeight(idx, parsed);
                            }}
                            step="0.2"
                          />
                          <div className="flex justify-between px-2.5 mt-2 text-xs">
                            <span>0</span>
                            <span>0.2</span>
                            <span>0.4</span>
                            <span>0.6</span>
                            <span>0.8</span>
                            <span>1</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button type="button" className="btn btn-outline mt-2" onClick={addIndicator}>
        {copy.addIndicator}
      </button>
    </div>
  );
}
