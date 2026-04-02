import { LuTrash2 } from "react-icons/lu";
import { CloseConditions, CloseProps, Threshold } from "../../types/StrategyForm.type";
import {
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "../../utils/strategyNumericInput";

const decimalInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Close({ data, setData }: CloseProps) {
  const close = data;

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
    value: number
  ) => {
    setClose({
      [type]: (close[type] as Threshold[]).map((threshold, i) =>
        i === idx ? { ...threshold, [field]: value } : threshold
      ),
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-8">
        <label className="cursor-pointer flex items-center gap-2">
          <input
            type="radio"
            name="closeMode"
            className="radio radio-primary"
            checked={close.mode === "basic"}
            onChange={() => setClose({ mode: "basic" })}
          />
          <span>Podstawowe (TP/SL)</span>
        </label>
        <label className="cursor-pointer flex items-center gap-2">
          <input
            type="radio"
            name="closeMode"
            className="radio radio-primary"
            checked={close.mode === "advanced"}
            onChange={() => setClose({ mode: "advanced" })}
          />
          <span>Zaawansowane (TTP/TSL)</span>
        </label>
      </div>

      {close.mode === "basic" && (
        <div className="card bg-base-200">
          <div className="card-body">
            <h4 className="font-semibold mb-6 text-lg">Podstawowe ustawienia zamkniecia</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="form-control">
                <label className="label">Take Profit (%)</label>
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
                <label className="label">Stop Loss (%)</label>
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
            <h4 className="font-semibold mb-6 text-lg">Zaawansowane ustawienia zamkniecia</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <div className="font-semibold mb-2">Trailing Take Profit</div>
                <div className="space-y-2">
                  {close.ttp.map((threshold, idx) => (
                    <div key={`ttp-${idx}`} className="flex gap-2 items-end">
                      <div>
                        <label className="label">Procent (%)</label>
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
                        <label className="label">Ramie</label>
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
                        title="Usun prog"
                        onClick={() => removeThreshold("ttp", idx)}
                      >
                        <LuTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline mt-2"
                  onClick={() => addThreshold("ttp")}
                >
                  + Dodaj prog
                </button>
              </div>

              <div>
                <div className="font-semibold mb-2">Trailing Stop Loss</div>
                <div className="space-y-2">
                  {close.tsl.map((threshold, idx) => (
                    <div key={`tsl-${idx}`} className="flex gap-2 items-end">
                      <div>
                        <label className="label">Procent (%)</label>
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
                        <label className="label">Ramie</label>
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
                        title="Usun prog"
                        onClick={() => removeThreshold("tsl", idx)}
                      >
                        <LuTrash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline mt-2"
                  onClick={() => addThreshold("tsl")}
                >
                  + Dodaj prog
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
