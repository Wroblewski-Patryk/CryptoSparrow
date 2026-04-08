import { useMemo } from "react";
import { LuTrash2 } from "react-icons/lu";
import { useI18n } from "@/i18n/I18nProvider";
import { CloseConditions, CloseProps, Threshold } from "../../types/StrategyForm.type";
import {
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "../../utils/strategyNumericInput";

const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Close({ data, setData }: CloseProps) {
  const { locale } = useI18n();
  const close = data;

  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            modeBasic: "Podstawowe (TP/SL)",
            modeAdvanced: "Zaawansowane (TTP/TSL)",
            basicTitle: "Podstawowe ustawienia zamkniecia",
            advancedTitle: "Zaawansowane ustawienia zamkniecia",
            takeProfit: "Take Profit (%)",
            stopLoss: "Stop Loss (%)",
            ttp: "Trailing Take Profit",
            tsl: "Trailing Stop Loss",
            percent: "Procent (%)",
            arm: "Ramie",
            removeThreshold: "Usun prog",
            addThreshold: "+ Dodaj prog",
          }
        : {
            modeBasic: "Basic (TP/SL)",
            modeAdvanced: "Advanced (TTP/TSL)",
            basicTitle: "Basic close settings",
            advancedTitle: "Advanced close settings",
            takeProfit: "Take Profit (%)",
            stopLoss: "Stop Loss (%)",
            ttp: "Trailing Take Profit",
            tsl: "Trailing Stop Loss",
            percent: "Percent (%)",
            arm: "Arm",
            removeThreshold: "Remove threshold",
            addThreshold: "+ Add threshold",
          },
    [locale],
  );

  const setClose = (changes: Partial<CloseConditions>) =>
    setData((prev) => ({ ...prev, ...changes }));

  const addThreshold = (type: "ttp" | "tsl") => {
    setClose({
      [type]: [...(close[type] as Threshold[]), { percent: 0, arm: 0 }],
    });
  };

  const removeThreshold = (type: "ttp" | "tsl", idx: number) => {
    setClose({
      [type]: (close[type] as Threshold[]).filter((_, i) => i !== idx),
    });
  };

  const updateThreshold = (
    type: "ttp" | "tsl",
    idx: number,
    field: "percent" | "arm",
    value: number,
  ) => {
    setClose({
      [type]: (close[type] as Threshold[]).map((threshold, i) =>
        i === idx ? { ...threshold, [field]: value } : threshold,
      ),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-8">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="closeMode"
            className="radio radio-primary"
            checked={close.mode === "basic"}
            onChange={() => setClose({ mode: "basic" })}
          />
          <span>{copy.modeBasic}</span>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="closeMode"
            className="radio radio-primary"
            checked={close.mode === "advanced"}
            onChange={() => setClose({ mode: "advanced" })}
          />
          <span>{copy.modeAdvanced}</span>
        </label>
      </div>

      {close.mode === "basic" && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h4 className="mb-6 text-lg font-semibold">{copy.basicTitle}</h4>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="form-control">
                <label className="label">{copy.takeProfit}</label>
                <input
                  type="number"
                  inputMode={decimalInputProps.inputMode}
                  step={decimalInputProps.step}
                  className="input input-bordered w-full"
                  value={close.tp}
                  onChange={(event) => {
                    const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                    if (parsed == null) return;
                    setClose({ tp: parsed });
                  }}
                />
              </div>
              <div className="form-control">
                <label className="label">{copy.stopLoss}</label>
                <input
                  type="number"
                  inputMode={decimalInputProps.inputMode}
                  step={decimalInputProps.step}
                  className="input input-bordered w-full"
                  value={close.sl}
                  onChange={(event) => {
                    const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                    if (parsed == null) return;
                    setClose({ sl: parsed });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {close.mode === "advanced" && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h4 className="mb-6 text-lg font-semibold">{copy.advancedTitle}</h4>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div>
                <div className="mb-2 font-semibold">{copy.ttp}</div>
                <div className="space-y-2">
                  {close.ttp.map((threshold, idx) => (
                    <div key={`ttp-${idx}`} className="flex items-end gap-2">
                      <div>
                        <label className="label">{copy.percent}</label>
                        <input
                          type="number"
                          inputMode={decimalInputProps.inputMode}
                          step={decimalInputProps.step}
                          className="input input-bordered"
                          value={threshold.percent}
                          onChange={(event) => {
                            const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                            if (parsed == null) return;
                            updateThreshold("ttp", idx, "percent", parsed);
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">{copy.arm}</label>
                        <input
                          type="number"
                          inputMode={decimalInputProps.inputMode}
                          step={decimalInputProps.step}
                          className="input input-bordered"
                          value={threshold.arm}
                          onChange={(event) => {
                            const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                            if (parsed == null) return;
                            updateThreshold("ttp", idx, "arm", parsed);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        title={copy.removeThreshold}
                        onClick={() => removeThreshold("ttp", idx)}
                      >
                        <LuTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-outline mt-2" onClick={() => addThreshold("ttp")}>
                  {copy.addThreshold}
                </button>
              </div>

              <div>
                <div className="mb-2 font-semibold">{copy.tsl}</div>
                <div className="space-y-2">
                  {close.tsl.map((threshold, idx) => (
                    <div key={`tsl-${idx}`} className="flex items-end gap-2">
                      <div>
                        <label className="label">{copy.percent}</label>
                        <input
                          type="number"
                          inputMode={decimalInputProps.inputMode}
                          step={decimalInputProps.step}
                          className="input input-bordered"
                          value={threshold.percent}
                          onChange={(event) => {
                            const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                            if (parsed == null) return;
                            updateThreshold("tsl", idx, "percent", parsed);
                          }}
                        />
                      </div>
                      <div>
                        <label className="label">{copy.arm}</label>
                        <input
                          type="number"
                          inputMode={decimalInputProps.inputMode}
                          step={decimalInputProps.step}
                          className="input input-bordered"
                          value={threshold.arm}
                          onChange={(event) => {
                            const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                            if (parsed == null) return;
                            updateThreshold("tsl", idx, "arm", parsed);
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        title={copy.removeThreshold}
                        onClick={() => removeThreshold("tsl", idx)}
                      >
                        <LuTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-outline mt-2" onClick={() => addThreshold("tsl")}>
                  {copy.addThreshold}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
