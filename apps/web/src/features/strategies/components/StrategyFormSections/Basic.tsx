import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
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
  const { locale } = useI18n();
  const copy = useMemo(
    () =>
      locale === "pl"
        ? {
            name: "Nazwa",
            namePlaceholder: "np. RSI+MACD 5m",
            description: "Opis",
            descriptionPlaceholder: "Opis strategii...",
            interval: "Interwal",
            intervalPlaceholder: "Wybierz interwal",
            leverage: "Dzwignia",
            walletRisk: "Ryzyko portfela (%)",
            marginMode: "Tryb margin (Futures)",
            marginCrossed: "Crossed",
            marginIsolated: "Isolated",
          }
        : {
            name: "Name",
            namePlaceholder: "e.g. RSI+MACD 5m",
            description: "Description",
            descriptionPlaceholder: "Strategy description...",
            interval: "Interval",
            intervalPlaceholder: "Select interval",
            leverage: "Leverage",
            walletRisk: "Wallet risk (%)",
            marginMode: "Margin mode (Futures)",
            marginCrossed: "Crossed",
            marginIsolated: "Isolated",
          },
    [locale],
  );

  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <div className="w-full space-y-6 md:w-1/2">
        <div className="form-control w-full">
          <label className="label" htmlFor="name">
            <span className="label-text">{copy.name}</span>
          </label>
          <input
            id="name"
            type="text"
            className="input input-bordered w-full"
            placeholder={copy.namePlaceholder}
            value={data.name}
            onChange={(event) => setData((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>

        <div className="form-control w-full">
          <label className="label" htmlFor="description">
            <span className="label-text">{copy.description}</span>
          </label>
          <textarea
            id="description"
            className="textarea textarea-bordered w-full"
            placeholder={copy.descriptionPlaceholder}
            rows={3}
            value={data.description}
            onChange={(event) => setData((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>
      </div>

      <div className="w-full space-y-6 md:w-1/2">
        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">{copy.interval}</span>
          </label>
          <select
            value={data.interval}
            onChange={(event) => setData((prev) => ({ ...prev, interval: event.target.value }))}
            className="select select-bordered w-full"
          >
            <option value="">{copy.intervalPlaceholder}</option>
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
          <label className="label">{copy.leverage}</label>
          <div className="flex w-full items-center gap-4">
            <input
              type="range"
              min={1}
              max={75}
              step={1}
              value={data.leverage}
              className="range w-full"
              onChange={(event) => {
                const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
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
              onChange={(event) => {
                const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.integer);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, leverage: clampToRange(parsed, 1, 75) }));
              }}
            />
            <span className="opacity-60">x</span>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">{copy.walletRisk}</label>
          <div className="flex w-full items-center gap-4">
            <input
              type="range"
              min={0.1}
              max={100}
              step={0.01}
              value={data.walletRisk}
              className="range w-full"
              onChange={(event) => {
                const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
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
              onChange={(event) => {
                const parsed = readNumericInputValue(event.target.value, strategyNumericContracts.decimal2);
                if (parsed == null) return;
                setData((prev) => ({ ...prev, walletRisk: parsed }));
              }}
            />
            <span className="opacity-60">%</span>
          </div>
        </div>

        <div className="form-control w-full">
          <label className="label">
            <span className="label-text">{copy.marginMode}</span>
          </label>
          <select
            value={data.additional.marginMode}
            onChange={(event) =>
              setData((prev) => ({
                ...prev,
                additional: {
                  ...prev.additional,
                  marginMode: event.target.value as "CROSSED" | "ISOLATED",
                },
              }))
            }
            className="select select-bordered w-full"
          >
            <option value="CROSSED">{copy.marginCrossed}</option>
            <option value="ISOLATED">{copy.marginIsolated}</option>
          </select>
        </div>
      </div>
    </div>
  );
}
