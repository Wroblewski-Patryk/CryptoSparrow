import { describe, expect, it } from "vitest";
import {
  getIndicatorGroupLabel,
  resolveIndicatorGroupKey,
  sortIndicatorGroups,
} from "./indicatorTaxonomy";

describe("indicatorTaxonomy", () => {
  it("maps indicators to canonical taxonomy groups", () => {
    expect(resolveIndicatorGroupKey({ indicatorName: "EMA", group: "Analiza techniczna" })).toBe("TREND");
    expect(resolveIndicatorGroupKey({ indicatorName: "RSI", group: "Analiza techniczna" })).toBe("MOMENTUM_OSCILLATOR");
    expect(resolveIndicatorGroupKey({ indicatorName: "ATR", group: "Analiza techniczna" })).toBe("VOLATILITY");
    expect(resolveIndicatorGroupKey({ indicatorName: "BULLISH_ENGULFING", group: "Formacje swiecowe" })).toBe("CANDLE_PATTERNS");
    expect(resolveIndicatorGroupKey({ indicatorName: "ORDER_BOOK_IMBALANCE", group: "Filtry derywatow" })).toBe("DERIVATIVES");
  });

  it("returns EN/PL labels and stable display order", () => {
    expect(getIndicatorGroupLabel("MOMENTUM_OSCILLATOR", "en")).toBe("Momentum / Oscillators");
    expect(getIndicatorGroupLabel("MOMENTUM_OSCILLATOR", "pl")).toBe("Momentum / Oscylatory");

    expect(
      sortIndicatorGroups(["DERIVATIVES", "TREND", "CANDLE_PATTERNS"]),
    ).toEqual(["TREND", "CANDLE_PATTERNS", "DERIVATIVES"]);
  });
});
