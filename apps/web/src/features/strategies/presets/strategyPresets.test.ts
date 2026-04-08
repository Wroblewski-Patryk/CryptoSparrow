import { describe, expect, it } from "vitest";
import { strategyPresets } from "./strategyPresets";

describe("strategyPresets", () => {
  it("contains canonical trader archetypes", () => {
    const ids = strategyPresets.map((preset) => preset.id);
    expect(ids).toContain("scalp-rsi-stochastic");
    expect(ids).toContain("day-trend-ema-adx");
    expect(ids).toContain("swing-macd-rsi");
    expect(ids).toContain("mean-reversion-rsi-bb");
    expect(ids).toContain("breakout-roc-adx");
    expect(ids).toContain("perp-bias-derivatives");
  });

  it("includes derivatives filters in perp-bias archetype", () => {
    const perp = strategyPresets.find((preset) => preset.id === "perp-bias-derivatives");
    expect(perp).toBeDefined();
    if (!perp) return;
    const longNames = perp.form.openConditions.indicatorsLong.map((indicator) => indicator.name);
    const shortNames = perp.form.openConditions.indicatorsShort.map((indicator) => indicator.name);

    expect(longNames).toEqual(
      expect.arrayContaining(["FUNDING_RATE", "OPEN_INTEREST_DELTA", "ORDER_BOOK_IMBALANCE"]),
    );
    expect(shortNames).toEqual(
      expect.arrayContaining(["FUNDING_RATE_ZSCORE", "OPEN_INTEREST_ZSCORE", "ORDER_BOOK_IMBALANCE"]),
    );
  });
});
