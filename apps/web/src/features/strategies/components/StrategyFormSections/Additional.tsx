import { useMemo } from "react";
import { LuTrash2 } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";
import { AdditionalProps, DcaLevel, TimeUnit } from "../../types/StrategyForm.type";
import {
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "../../utils/strategyNumericInput";

const getPrimaryDcaLevel = (levels: DcaLevel[]): DcaLevel => levels[0] ?? { percent: -1, multiplier: 2 };
const integerInputProps = numericInputProps(strategyNumericContracts.integer);
const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Additional({ data, setData }: AdditionalProps) {
  const { t } = useI18n();
  const copy = useMemo(() => ({
    positions: t("dashboard.strategies.form.additional.positions"),
    orders: t("dashboard.strategies.form.additional.orders"),
    maxCount: t("dashboard.strategies.form.additional.maxCount"),
    lifetime: t("dashboard.strategies.form.additional.lifetime"),
    unitMin: t("dashboard.strategies.form.additional.unitMin"),
    unitHour: t("dashboard.strategies.form.additional.unitHour"),
    unitDay: t("dashboard.strategies.form.additional.unitDay"),
    unitWeek: t("dashboard.strategies.form.additional.unitWeek"),
    dca: t("dashboard.strategies.form.additional.dca"),
    basic: t("dashboard.strategies.form.additional.basic"),
    advanced: t("dashboard.strategies.form.additional.advanced"),
    times: t("dashboard.strategies.form.additional.times"),
    triggerLevel: t("dashboard.strategies.form.additional.triggerLevel"),
    multiplier: t("dashboard.strategies.form.additional.multiplier"),
    levelPercent: t("dashboard.strategies.form.additional.levelPercent"),
    removeLevel: t("dashboard.strategies.form.additional.removeLevel"),
    addLevel: t("dashboard.strategies.form.additional.addLevel"),
  }), [t]);

  const patch = (changes: Partial<typeof data>) => setData((prev) => ({ ...prev, ...changes }));

  const updateLevel = (idx: number, field: keyof DcaLevel, value: number) =>
    setData((prev) => ({
      ...prev,
      dcaLevels: prev.dcaLevels.map((level, i) => (i === idx ? { ...level, [field]: value } : level)),
      dcaTimes:
        prev.dcaMode === "advanced"
          ? prev.dcaLevels.map((level, i) => (i === idx ? { ...level, [field]: value } : level)).length
          : prev.dcaTimes,
    }));

  const setPrimaryDcaLevel = (changes: Partial<DcaLevel>) =>
    setData((prev) => {
      const current = getPrimaryDcaLevel(prev.dcaLevels);
      const next = { ...current, ...changes };
      const rest = prev.dcaLevels.slice(1);
      return { ...prev, dcaLevels: [next, ...rest] };
    });

  const addLevel = () =>
    setData((prev) => ({
      ...prev,
      dcaLevels: [...prev.dcaLevels, { percent: -1, multiplier: 2 }],
      dcaTimes: prev.dcaMode === "advanced" ? prev.dcaLevels.length + 1 : prev.dcaTimes,
    }));

  const removeLevel = (idx: number) =>
    setData((prev) => ({
      ...prev,
      dcaLevels: prev.dcaLevels.filter((_, i) => i !== idx),
      dcaTimes: prev.dcaMode === "advanced" ? Math.max(0, prev.dcaLevels.length - 1) : prev.dcaTimes,
    }));

  const primaryLevel = getPrimaryDcaLevel(data.dcaLevels);

  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
      <div className="card bg-base-200">
        <div className="card-body space-y-6">
          <div>
            <div className="mb-2 font-semibold">{copy.positions}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="form-control gap-2">
                <label className="label p-0 font-semibold">{copy.maxCount}</label>
                <input
                  type="number"
                  min={1}
                  inputMode={integerInputProps.inputMode}
                  step={integerInputProps.step}
                  className="input input-bordered w-full"
                  value={data.maxPositions}
                  onChange={(event) => {
                    const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                    if (parsed == null) return;
                    patch({ maxPositions: parsed });
                  }}
                />
              </div>
              <div className="form-control gap-2">
                <label className="label p-0 font-semibold">{copy.lifetime}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode={integerInputProps.inputMode}
                    step={integerInputProps.step}
                    className="input input-bordered w-24"
                    value={data.positionLifetime}
                    onChange={(event) => {
                      const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                      if (parsed == null) return;
                      patch({ positionLifetime: parsed });
                    }}
                  />
                  <select
                    className="select select-bordered"
                    value={data.positionUnit}
                    onChange={(event) => patch({ positionUnit: event.target.value as TimeUnit })}
                  >
                    <option value="min">{copy.unitMin}</option>
                    <option value="h">{copy.unitHour}</option>
                    <option value="d">{copy.unitDay}</option>
                    <option value="w">{copy.unitWeek}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 font-semibold">{copy.orders}</div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="form-control gap-2">
                <label className="label p-0 font-semibold">{copy.maxCount}</label>
                <input
                  type="number"
                  min={1}
                  inputMode={integerInputProps.inputMode}
                  step={integerInputProps.step}
                  className="input input-bordered w-full"
                  value={data.maxOrders}
                  onChange={(event) => {
                    const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                    if (parsed == null) return;
                    patch({ maxOrders: parsed });
                  }}
                />
              </div>
              <div className="form-control gap-2">
                <label className="label p-0 font-semibold">{copy.lifetime}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode={integerInputProps.inputMode}
                    step={integerInputProps.step}
                    className="input input-bordered w-24"
                    value={data.orderLifetime}
                    onChange={(event) => {
                      const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                      if (parsed == null) return;
                      patch({ orderLifetime: parsed });
                    }}
                  />
                  <select
                    className="select select-bordered"
                    value={data.orderUnit}
                    onChange={(event) => patch({ orderUnit: event.target.value as TimeUnit })}
                  >
                    <option value="min">{copy.unitMin}</option>
                    <option value="h">{copy.unitHour}</option>
                    <option value="d">{copy.unitDay}</option>
                    <option value="w">{copy.unitWeek}</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card bg-base-200">
        <div className="card-body space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-lg font-semibold">{copy.dca}</div>
            <label className="cursor-pointer">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={data.dcaEnabled}
                onChange={(event) => patch({ dcaEnabled: event.target.checked })}
              />
            </label>
          </div>

          {data.dcaEnabled ? (
            <>
              <div className="flex flex-wrap gap-6">
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="radio radio-primary"
                    name="dcaMode"
                    checked={data.dcaMode === "basic"}
                    onChange={() =>
                      setData((prev) => ({
                        ...prev,
                        dcaMode: "basic",
                        dcaTimes: Math.max(1, prev.dcaTimes || prev.dcaLevels.length || 1),
                      }))
                    }
                  />
                  <span>{copy.basic}</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    className="radio radio-primary"
                    name="dcaMode"
                    checked={data.dcaMode === "advanced"}
                    onChange={() =>
                      setData((prev) => ({
                        ...prev,
                        dcaMode: "advanced",
                        dcaTimes: prev.dcaLevels.length,
                      }))
                    }
                  />
                  <span>{copy.advanced}</span>
                </label>
              </div>

              {data.dcaMode === "basic" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="form-control gap-2">
                    <label className="label p-0 font-semibold">{copy.times}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        inputMode={integerInputProps.inputMode}
                        className="input input-bordered w-20 text-center"
                        value={data.dcaTimes}
                        onChange={(event) => {
                          const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                          if (parsed == null) return;
                          patch({ dcaTimes: parsed });
                        }}
                      />
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        className="range"
                        value={data.dcaTimes}
                        onChange={(event) => {
                          const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                          if (parsed == null) return;
                          patch({ dcaTimes: parsed });
                        }}
                      />
                    </div>
                  </div>

                  <div className="form-control gap-2">
                    <label className="label p-0 font-semibold">{copy.triggerLevel}</label>
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      step={decimalInputProps.step}
                      inputMode={decimalInputProps.inputMode}
                      className="input input-bordered"
                      value={primaryLevel.percent}
                      onChange={(event) => {
                        const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                        if (parsed == null) return;
                        setPrimaryDcaLevel({ percent: parsed });
                      }}
                    />
                  </div>

                  <div className="form-control gap-2">
                    <label className="label p-0 font-semibold">{copy.multiplier}</label>
                    <input
                      type="number"
                      min={1}
                      step={decimalInputProps.step}
                      inputMode={decimalInputProps.inputMode}
                      className="input input-bordered"
                      value={data.dcaMultiplier}
                      onChange={(event) => {
                        const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                        if (parsed == null) return;
                        patch({ dcaMultiplier: parsed });
                        setPrimaryDcaLevel({ multiplier: parsed });
                      }}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {data.dcaLevels.map((level, idx) => (
                      <div key={`dca-level-${idx}`} className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                        <div className="form-control gap-2">
                          <label className="label p-0">{copy.levelPercent}</label>
                          <input
                            type="number"
                            step={decimalInputProps.step}
                            inputMode={decimalInputProps.inputMode}
                            className="input input-bordered"
                            value={level.percent}
                            onChange={(event) => {
                              const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                              if (parsed == null) return;
                              updateLevel(idx, "percent", parsed);
                            }}
                          />
                        </div>
                        <div className="form-control gap-2">
                          <label className="label p-0">{copy.multiplier}</label>
                          <input
                            type="number"
                            min={1}
                            step={decimalInputProps.step}
                            inputMode={decimalInputProps.inputMode}
                            className="input input-bordered"
                            value={level.multiplier}
                            onChange={(event) => {
                              const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                              if (parsed == null) return;
                              updateLevel(idx, "multiplier", parsed);
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => removeLevel(idx)}
                          title={copy.removeLevel}
                        >
                          <LuTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" className="btn btn-outline mt-2" onClick={addLevel}>
                    {copy.addLevel}
                  </button>
                </>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
