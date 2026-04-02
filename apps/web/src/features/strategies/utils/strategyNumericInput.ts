import {
  NumericFieldContract,
  getNumericInputAttributes,
  parseNumericInput,
} from "@/lib/numericInput";

export const strategyNumericContracts = {
  integer: {
    kind: "integer",
  } satisfies NumericFieldContract,
  decimal2: {
    kind: "decimal",
    maxDecimals: 2,
  } satisfies NumericFieldContract,
} as const;

export const readNumericInputValue = (raw: string, contract: NumericFieldContract): number | null => {
  const parsed = parseNumericInput(raw, { ...contract, required: false });
  if (!parsed.ok) return null;
  return parsed.value;
};

export const numericInputProps = (contract: NumericFieldContract) => {
  const attrs = getNumericInputAttributes(contract);
  return {
    inputMode: attrs.inputMode,
    step: attrs.step,
  } as const;
};

export const clampToRange = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
