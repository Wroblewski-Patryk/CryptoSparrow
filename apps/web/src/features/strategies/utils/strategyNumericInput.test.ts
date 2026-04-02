import { describe, expect, it } from "vitest";
import {
  clampToRange,
  numericInputProps,
  readNumericInputValue,
  strategyNumericContracts,
} from "./strategyNumericInput";

describe("strategyNumericInput", () => {
  it("parses decimal input with comma separator for strategy fields", () => {
    expect(readNumericInputValue("12,5", strategyNumericContracts.decimal2)).toBe(12.5);
  });

  it("returns null when decimal precision exceeds strategy contract", () => {
    expect(readNumericInputValue("2.345", strategyNumericContracts.decimal2)).toBeNull();
  });

  it("returns null for non-numeric strategy input", () => {
    expect(readNumericInputValue("abc", strategyNumericContracts.decimal2)).toBeNull();
  });

  it("builds deterministic input props for integer and decimal contracts", () => {
    expect(numericInputProps(strategyNumericContracts.integer)).toEqual({
      inputMode: "numeric",
      step: "1",
    });

    expect(numericInputProps(strategyNumericContracts.decimal2)).toEqual({
      inputMode: "decimal",
      step: "0.01",
    });
  });

  it("clamps values to strategy guardrail ranges", () => {
    expect(clampToRange(5, 10, 20)).toBe(10);
    expect(clampToRange(25, 10, 20)).toBe(20);
    expect(clampToRange(15, 10, 20)).toBe(15);
  });
});
