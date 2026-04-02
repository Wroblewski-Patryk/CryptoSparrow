import { BasicProps } from "../../types/StrategyForm.type";
import {
  clampToRange,
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "../../utils/strategyNumericInput";

const leverageInputProps = numericInputProps(strategyNumericContracts.integer);
const walletRiskInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Basic({ data, setData }: BasicProps) {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <div className="w-full md:w-1/2 space-y-6">
        <div className="form-control w-full">
          <label className="label" htmlFor="name">
            <span className="label-text">Nazwa</span>
          </label>
          <input
            id="name"
            type="text"
            className="input input-bordered w-full"
            placeholder="np. RSI+MACD 5m"
            value={data.name}
            onChange={(e) => setData((prev) => ({ ...prev, name: e.target.value }))}
          />
        </div>

        <div className="form-control w-full">
          <label className="label" htmlFor="description">
            <span className="label-text">Opis</span>
          </label>
          <textarea
            id="description"
            className="textarea textarea-bordered w-full"
            placeholder="Opis strategii..."
            rows={3}
            value={data.description}
            onChange={(e) => setData((prev) => ({ ...prev, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="w-full md:w-1/2 space-y-6">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Interwal</span>
          </label>
          <select
            value={data.interval}
            onChange={(e) => setData((prev) => ({ ...prev, interval: e.target.value }))}
            className="select select-bordered w-full"
          >
            <option value="">Wybierz interwal</option>
            <option value="1m">1m</option>
            <option value="5m">5m</option>
            <option value="10m">10m</option>
            <option value="15m">15m</option>
            <option value="30m">30m</option>
            <option value="1h">1h</option>
            <option value="4h">4h</option>
            <option value="1d">1d</option>
          </select>
        </div>

        <div className="form-control w-full">
          <label className="label">Dzwignia</label>
          <div className="flex items-center w-full gap-4">
            <input
              type="range"
              min={1}
              max={75}
              step={1}
              value={data.leverage}
              className="range w-full"
              onChange={(e) => {
                const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, leverage: clampToRange(parsed, 1, 75) }));
              }}
            />
            <input
              type="number"
              min={1}
              max={75}
              value={data.leverage}
              className="input input-bordered w-20"
              inputMode={leverageInputProps.inputMode}
              step={leverageInputProps.step}
              onChange={(e) => {
                const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.integer);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, leverage: clampToRange(parsed, 1, 75) }));
              }}
            />
            <span className="opacity-60">x</span>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">Ryzyko portfela (%)</label>
          <div className="flex items-center w-full gap-4 ">
            <input
              type="range"
              min={0.1}
              max={100}
              step={0.01}
              value={data.walletRisk}
              className="range w-full"
              onChange={(e) => {
                const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, walletRisk: parsed }));
              }}
            />
            <input
              type="number"
              min={0.1}
              max={100}
              step={walletRiskInputProps.step}
              inputMode={walletRiskInputProps.inputMode}
              className="input input-bordered w-20"
              value={data.walletRisk}
              onChange={(e) => {
                const parsed = readNumericInputValue(e.target.value, strategyNumericContracts.decimal2);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, walletRisk: parsed }));
              }}
            />
            <span className="opacity-60">%</span>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">Margin mode (Futures)</span>
          </label>
          <select
            value={data.additional.marginMode}
            onChange={(e) =>
              setData((prev) => ({
                ...prev,
                additional: {
                  ...prev.additional,
                  marginMode: e.target.value as "CROSSED" | "ISOLATED",
                },
              }))
            }
            className="select select-bordered w-full"
          >
            <option value="CROSSED">CROSSED</option>
            <option value="ISOLATED">ISOLATED</option>
          </select>
        </div>
      </div>
    </div>
  );
}
