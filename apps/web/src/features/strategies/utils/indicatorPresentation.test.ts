import { describe, expect, it } from "vitest";
import { getIndicatorDisplayName, getIndicatorParamLabel } from "./indicatorPresentation";

describe("indicatorPresentation", () => {
  it("returns human-friendly indicator names", () => {
    expect(getIndicatorDisplayName("ORDER_BOOK_IMBALANCE", "en")).toBe("Order Book Imbalance");
    expect(getIndicatorDisplayName("BULLISH_ENGULFING", "pl")).toBe("Objecie hossy");
    expect(getIndicatorDisplayName("RSI", "en")).toBe("RSI(Relative Strength Index)");
  });

  it("falls back to readable labels for unknown keys", () => {
    expect(getIndicatorDisplayName("custom_signal_alpha", "en")).toBe("Custom Signal Alpha");
    expect(getIndicatorParamLabel("entryLookbackBars", "en")).toBe("Entry Lookback Bars");
  });

  it("returns human-friendly parameter names", () => {
    expect(getIndicatorParamLabel("zScorePeriod", "pl")).toBe("Okres Z-score");
    expect(getIndicatorParamLabel("smoothK", "en")).toBe("K smoothing");
  });
});
