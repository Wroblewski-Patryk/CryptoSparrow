import { useMemo } from "react";
import { useI18n } from "@/i18n/I18nProvider";
import { FormGrid, FormSectionCard, NumberField, RangeField, SelectField, TextField, TextareaField } from "@/ui/forms";
import { BasicProps } from "../../types/StrategyForm.type";
import {
  clampToRange,
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "../../utils/strategyNumericInput";

const leverageInputProps = numericInputProps(strategyNumericContracts.integer);
const walletRiskInputProps = numericInputProps(strategyNumericContracts.decimal2);

export function Basic({ data, setData, errors }: BasicProps) {
  const { t } = useI18n();
  const copy = useMemo(() => ({
    title: t("dashboard.strategies.form.basic.title"),
    name: t("dashboard.strategies.form.basic.name"),
    namePlaceholder: t("dashboard.strategies.form.basic.namePlaceholder"),
    description: t("dashboard.strategies.form.basic.description"),
    descriptionPlaceholder: t("dashboard.strategies.form.basic.descriptionPlaceholder"),
    interval: t("dashboard.strategies.form.basic.interval"),
    intervalPlaceholder: t("dashboard.strategies.form.basic.intervalPlaceholder"),
    leverage: t("dashboard.strategies.form.basic.leverage"),
    walletRisk: t("dashboard.strategies.form.basic.walletRisk"),
    marginMode: t("dashboard.strategies.form.basic.marginMode"),
    marginCrossed: t("dashboard.strategies.form.basic.marginCrossed"),
    marginIsolated: t("dashboard.strategies.form.basic.marginIsolated"),
  }), [t]);

  const intervalOptions = useMemo(
    () => [
      { value: "", label: copy.intervalPlaceholder },
      { value: "1m", label: "1m" },
      { value: "5m", label: "5m" },
      { value: "10m", label: "10m" },
      { value: "15m", label: "15m" },
      { value: "30m", label: "30m" },
      { value: "1h", label: "1h" },
      { value: "4h", label: "4h" },
      { value: "1d", label: "1d" },
    ],
    [copy.intervalPlaceholder]
  );
  const marginModeOptions = useMemo(
    () => [
      { value: "CROSSED", label: copy.marginCrossed },
      { value: "ISOLATED", label: copy.marginIsolated },
    ],
    [copy.marginCrossed, copy.marginIsolated]
  );

  return (
    <FormSectionCard title={copy.title}>
      <FormGrid columns={2}>
        <TextField
          id="strategy-name"
          label={copy.name}
          placeholder={copy.namePlaceholder}
          value={data.name}
          onChange={(value) => setData((prev) => ({ ...prev, name: value }))}
          error={errors?.name}
        />

        <TextareaField
          id="strategy-description"
          label={copy.description}
          placeholder={copy.descriptionPlaceholder}
          rows={3}
          value={data.description}
          onChange={(value) => setData((prev) => ({ ...prev, description: value }))}
        />

        <SelectField
          id="strategy-interval"
          label={copy.interval}
          value={data.interval}
          options={intervalOptions}
          onChange={(value) => setData((prev) => ({ ...prev, interval: value }))}
          error={errors?.interval}
        />

        <div className="space-y-3">
          <RangeField
            id="strategy-leverage-range"
            label={copy.leverage}
            min={1}
            max={75}
            step={1}
            value={data.leverage}
            showValue={false}
            onChange={(value) => setData((prev) => ({ ...prev, leverage: clampToRange(value, 1, 75) }))}
          />
          <NumberField
            id="strategy-leverage"
            label={copy.leverage}
            min={1}
            max={75}
            value={data.leverage}
            inputMode={leverageInputProps.inputMode}
            step={Number(leverageInputProps.step)}
            onChange={(value) => {
              const parsed = readNumericInputValue(value, strategyNumericContracts.integer);
              if (parsed == null) return;
              setData((prev) => ({ ...prev, leverage: clampToRange(parsed, 1, 75) }));
            }}
          />
        </div>

        <div className="space-y-3">
          <RangeField
            id="strategy-wallet-risk-range"
            label={copy.walletRisk}
            min={0.1}
            max={100}
            step={0.01}
            value={data.walletRisk}
            showValue={false}
            onChange={(value) => setData((prev) => ({ ...prev, walletRisk: value }))}
          />
          <NumberField
            id="strategy-wallet-risk"
            label={copy.walletRisk}
            min={0.1}
            max={100}
            value={data.walletRisk}
            inputMode={walletRiskInputProps.inputMode}
            step={Number(walletRiskInputProps.step)}
            onChange={(value) => {
              const parsed = readNumericInputValue(value, strategyNumericContracts.decimal2);
              if (parsed == null) return;
              setData((prev) => ({ ...prev, walletRisk: parsed }));
            }}
          />
        </div>

        <SelectField
          id="strategy-margin-mode"
          label={copy.marginMode}
          value={data.additional.marginMode}
          options={marginModeOptions}
          onChange={(value) =>
            setData((prev) => ({
              ...prev,
              additional: {
                ...prev.additional,
                marginMode: value as "CROSSED" | "ISOLATED",
              },
            }))
          }
        />
      </FormGrid>
    </FormSectionCard>
  );
}
