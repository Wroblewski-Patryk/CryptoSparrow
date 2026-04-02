export type NumericValueKind = "decimal" | "integer";

export type NumericValidationCode =
  | "empty"
  | "invalid_format"
  | "invalid_number"
  | "too_many_decimals"
  | "integer_required"
  | "below_min"
  | "above_max";

export type NumericFieldContract = {
  kind: NumericValueKind;
  required?: boolean;
  maxDecimals?: number;
  min?: number;
  max?: number;
};

export type NumericParseResult =
  | {
      ok: true;
      value: number | null;
      normalized: string;
    }
  | {
      ok: false;
      value: null;
      normalized: string;
      code: NumericValidationCode;
    };

export type NumericInputAttributes = {
  inputMode: "numeric" | "decimal";
  step: string;
  min?: number;
  max?: number;
};

const NUMERIC_PATTERN = /^[+-]?(?:\d+\.?\d*|\.\d+)$/;

const countDecimals = (normalized: string) => {
  const dotIndex = normalized.indexOf(".");
  if (dotIndex < 0) return 0;
  return normalized.length - dotIndex - 1;
};

const sanitize = (raw: string) => raw.replace(/\s+/g, "").trim();

export const normalizeNumericInput = (raw: string) => sanitize(raw).replace(/,/g, ".");

const resolveMaxDecimals = (contract: NumericFieldContract) =>
  contract.kind === "integer" ? 0 : contract.maxDecimals ?? 2;

const stepFromDecimals = (decimals: number) => {
  if (decimals <= 0) return "1";
  return `0.${"0".repeat(Math.max(0, decimals - 1))}1`;
};

export const parseNumericInput = (raw: string, contract: NumericFieldContract): NumericParseResult => {
  const normalized = normalizeNumericInput(raw);

  if (!normalized.length) {
    if (contract.required) {
      return { ok: false, value: null, normalized, code: "empty" };
    }
    return { ok: true, value: null, normalized };
  }

  if (!NUMERIC_PATTERN.test(normalized)) {
    return { ok: false, value: null, normalized, code: "invalid_format" };
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return { ok: false, value: null, normalized, code: "invalid_number" };
  }

  const maxDecimals = resolveMaxDecimals(contract);
  if (contract.kind === "decimal" && countDecimals(normalized) > maxDecimals) {
    return { ok: false, value: null, normalized, code: "too_many_decimals" };
  }

  if (contract.kind === "integer" && !Number.isInteger(parsed)) {
    return { ok: false, value: null, normalized, code: "integer_required" };
  }

  if (typeof contract.min === "number" && parsed < contract.min) {
    return { ok: false, value: null, normalized, code: "below_min" };
  }

  if (typeof contract.max === "number" && parsed > contract.max) {
    return { ok: false, value: null, normalized, code: "above_max" };
  }

  return { ok: true, value: parsed, normalized };
};

export const getNumericInputAttributes = (contract: NumericFieldContract): NumericInputAttributes => {
  const maxDecimals = resolveMaxDecimals(contract);
  return {
    inputMode: contract.kind === "integer" ? "numeric" : "decimal",
    step: stepFromDecimals(maxDecimals),
    min: contract.min,
    max: contract.max,
  };
};

export const numericContracts = {
  decimal2: {
    kind: "decimal",
    required: true,
    maxDecimals: 2,
  } satisfies NumericFieldContract,
  integerRequired: {
    kind: "integer",
    required: true,
  } satisfies NumericFieldContract,
} as const;
