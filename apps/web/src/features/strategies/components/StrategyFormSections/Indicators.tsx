import { LuChevronDown, LuChevronRight, LuChevronUp, LuTrash2, LuTrendingDown, LuTrendingUp } from "react-icons/lu";
import { IndicatorsProps, StrategyConditionOperator } from "../../types/StrategyForm.type";
import { numericInputProps, readNumericInputValue, strategyNumericContracts } from "../../utils/strategyNumericInput";
import {
  IndicatorGroupKey,
  getIndicatorGroupLabel,
  resolveIndicatorGroupKey,
  sortIndicatorGroups,
} from "../../utils/indicatorTaxonomy";

const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);
const conditionOptions: StrategyConditionOperator[] = [
  ">",
  ">=",
  "<",
  "<=",
  "==",
  "!=",
  "CROSS_ABOVE",
  "CROSS_BELOW",
  "IN_RANGE",
  "OUT_OF_RANGE",
];

const resolveLocale = (): "en" | "pl" => {
  if (typeof document === "undefined") return "en";
  return document.documentElement.lang === "pl" ? "pl" : "en";
};

export default function Indicators({ side, indicators, value, setValue }: IndicatorsProps) {
  const locale = resolveLocale();
  const normalizedIndicators = indicators.map((indicator) => ({
    ...indicator,
    group: resolveIndicatorGroupKey({
      indicatorName: indicator.name,
      group: indicator.group,
    }),
  }));
  const normalizedValue = value.map((indicator) => ({
    ...indicator,
    group: resolveIndicatorGroupKey({
      indicatorName: indicator.name,
      group: indicator.group,
    }),
  }));
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
    setValue([
      ...normalizedValue,
      {
        group,
        name: meta.name,
        params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
        condition: ">",
        value: 0,
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
          ? {
              ...entry,
              group,
              name: meta.name,
              params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
            }
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
          ? {
              ...entry,
              group: meta.group,
              name,
              params: Object.fromEntries(meta.params.map((param) => [param.name, param.default])),
            }
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
      normalizedValue.map((entry, index) => (index === idx ? { ...entry, condition } : entry)),
    );
  };

  const updateValue = (idx: number, nextValue: number) => {
    setValue(
      normalizedValue.map((entry, index) => (index === idx ? { ...entry, value: nextValue } : entry)),
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
        {side}
      </h3>

      {normalizedValue.map((indicator, idx) => {
        const indicatorsInGroup = normalizedIndicators.filter((entry) => entry.group === indicator.group);
        const meta = normalizedIndicators.find((entry) => entry.name === indicator.name);
        const indicatorOptions =
          indicatorsInGroup.length > 0
            ? indicatorsInGroup
            : [{ name: indicator.name, group: indicator.group, type: "custom", params: [] }];

        return (
          <div key={idx} className="card bg-base-200 shadow-md mb-6">
            <div className="flex justify-between items-center pb-2 px-4 pt-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-xs btn-square"
                  onClick={() => toggleExpand(idx)}
                  title={indicator.expanded ? "Zwin" : "Rozwin"}
                >
                  {indicator.expanded ? (
                    <LuChevronUp className="w-4 h-4" />
                  ) : (
                    <LuChevronDown className="w-4 h-4" />
                  )}
                </button>
                <div className="text-lg flex items-center gap-2">
                  <span className="text-base-content/80">{getIndicatorGroupLabel(indicator.group, locale)}</span>
                  <LuChevronRight className="text-base-content/60" />
                  <span className="text-base-content">{indicator.name}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <div className="join">
                  <button
                    type="button"
                    className="btn btn-xs btn-square join-item"
                    disabled={idx === 0}
                    onClick={() => moveIndicator(idx, "up")}
                    title="Wyzej"
                  >
                    <LuChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="btn btn-xs btn-square join-item"
                    disabled={idx === normalizedValue.length - 1}
                    onClick={() => moveIndicator(idx, "down")}
                    title="Nizej"
                  >
                    <LuChevronDown className="w-4 h-4" />
                  </button>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-square text-error"
                  onClick={() => removeIndicator(idx)}
                  title="Usun wskaznik"
                >
                  <LuTrash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {indicator.expanded && (
              <div className="card-body pt-2 pb-2">
                <div className="flex flex-col md:flex-row gap-6 mb-2">
                  <div className="flex-1">
                    <label className="label">Grupa</label>
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
                    <label className="label">Wskaznik</label>
                    <select
                      className="select select-bordered w-full"
                      value={indicator.name}
                      onChange={(event) => updateIndicatorType(idx, event.target.value)}
                    >
                      {indicatorOptions.map((entry) => (
                        <option key={entry.name} value={entry.name}>
                          {entry.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="font-semibold text-base-content/80 mb-2 flex items-center gap-2">
                      Parametry wskaznika
                    </div>
                    <div className="space-y-2">
                      {meta?.params.map((param) => (
                        <div key={param.name} className="form-control mb-4">
                          <label className="label">
                            <span className="label-text">{param.name}</span>
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
                  <div className="flex flex-col gap-6">
                    <div>
                      <div className="grid grid-cols-2 gap-4 items-center">
                        <div>
                          <label className="label mb-1 font-semibold">Warunek</label>
                          <select
                            className="select select-bordered w-full"
                            value={indicator.condition}
                            onChange={(event) => updateCondition(idx, event.target.value as StrategyConditionOperator)}
                          >
                            {conditionOptions.map((operator) => (
                              <option key={operator} value={operator}>
                                {operator}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="label mb-1 font-semibold">Wartosc</label>
                          <input
                            type="number"
                            inputMode={decimalInputProps.inputMode}
                            step={decimalInputProps.step}
                            className="input input-bordered w-full"
                            value={indicator.value}
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
                      </div>
                    </div>

                    <div>
                      <label className="label font-semibold">
                        <span className="label-text flex items-center gap-1">Waga</span>
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
        {" "}
        + Dodaj wskaznik
      </button>
    </div>
  );
}
