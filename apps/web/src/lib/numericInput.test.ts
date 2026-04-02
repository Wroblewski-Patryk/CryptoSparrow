import { describe, expect, it } from "vitest";
import {
  getNumericInputAttributes,
  normalizeNumericInput,
  numericContracts,
  parseNumericInput,
} from "./numericInput";

describe("numericInput", () => {
  it("normalizes comma decimals and trims spaces", () => {
    expect(normalizeNumericInput("  12,34 ")).toBe("12.34");
    expect(normalizeNumericInput("1 234,56")).toBe("1234.56");
  });

  it("parses decimal value for comma and dot separators", () => {
    const contract = { ...numericContracts.decimal2, min: -100, max: 100 };
    const fromComma = parseNumericInput("12,5", contract);
    const fromDot = parseNumericInput("12.5", contract);

    expect(fromComma).toEqual({ ok: true, value: 12.5, normalized: "12.5" });
    expect(fromDot).toEqual({ ok: true, value: 12.5, normalized: "12.5" });
  });

  it("returns invalid_format for malformed input", () => {
    const contract = numericContracts.decimal2;
    expect(parseNumericInput("1,2.3", contract)).toEqual({
      ok: false,
      value: null,
      normalized: "1.2.3",
      code: "invalid_format",
    });
  });

  it("returns too_many_decimals when precision overflows", () => {
    const contract = numericContracts.decimal2;
    expect(parseNumericInput("3.141", contract)).toEqual({
      ok: false,
      value: null,
      normalized: "3.141",
      code: "too_many_decimals",
    });
  });

  it("enforces integer-only contract", () => {
    const contract = { ...numericContracts.integerRequired, min: 1, max: 75 };
    expect(parseNumericInput("4.2", contract)).toEqual({
      ok: false,
      value: null,
      normalized: "4.2",
      code: "integer_required",
    });
    expect(parseNumericInput("8", contract)).toEqual({
      ok: true,
      value: 8,
      normalized: "8",
    });
  });

  it("enforces min and max bounds", () => {
    const contract = { ...numericContracts.decimal2, min: 0.1, max: 100 };

    expect(parseNumericInput("0.05", contract)).toEqual({
      ok: false,
      value: null,
      normalized: "0.05",
      code: "below_min",
    });

    expect(parseNumericInput("101", contract)).toEqual({
      ok: false,
      value: null,
      normalized: "101",
      code: "above_max",
    });
  });

  it("supports optional empty values", () => {
    const contract = { kind: "decimal", required: false, maxDecimals: 2 } as const;
    expect(parseNumericInput("", contract)).toEqual({
      ok: true,
      value: null,
      normalized: "",
    });
  });

  it("builds input attributes from contract", () => {
    expect(getNumericInputAttributes(numericContracts.decimal2)).toEqual({
      inputMode: "decimal",
      step: "0.01",
      min: undefined,
      max: undefined,
    });
    expect(getNumericInputAttributes({ kind: "integer", required: true, min: 1, max: 10 })).toEqual({
      inputMode: "numeric",
      step: "1",
      min: 1,
      max: 10,
    });
  });
});
