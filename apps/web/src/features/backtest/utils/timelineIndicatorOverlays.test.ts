import { describe, expect, it } from "vitest";
import {
  getPatternMarkerBias,
  isPatternSeries,
  splitTimelineIndicatorSeriesForRendering,
} from "./timelineIndicatorOverlays";
import { BacktestTimelineIndicatorSeries } from "../types/backtest.type";

const buildSeries = (input: Partial<BacktestTimelineIndicatorSeries> & Pick<BacktestTimelineIndicatorSeries, "key" | "name">): BacktestTimelineIndicatorSeries => ({
  key: input.key,
  name: input.name,
  period: input.period ?? 14,
  panel: input.panel ?? "oscillator",
  points: input.points ?? [
    { candleIndex: 0, value: null },
    { candleIndex: 1, value: 1 },
  ],
});

describe("timelineIndicatorOverlays", () => {
  it("groups multi-channel oscillator families into one overlay panel", () => {
    const split = splitTimelineIndicatorSeriesForRendering([
      buildSeries({ key: "MACD_LINE_12_26_9", name: "MACD LINE" }),
      buildSeries({ key: "MACD_SIGNAL_12_26_9", name: "MACD SIGNAL" }),
      buildSeries({ key: "MACD_HISTOGRAM_12_26_9", name: "MACD HISTOGRAM" }),
      buildSeries({ key: "STOCHASTIC_K_14_3_3", name: "STOCHASTIC K" }),
      buildSeries({ key: "STOCHASTIC_D_14_3_3", name: "STOCHASTIC D" }),
    ]);

    expect(split.oscillatorPanels).toHaveLength(2);
    expect(split.oscillatorPanels[0].series).toHaveLength(3);
    expect(split.oscillatorPanels[1].series).toHaveLength(2);
  });

  it("separates boolean candle-pattern series into marker-only payload", () => {
    const pattern = buildSeries({
      key: "BULLISH_ENGULFING",
      name: "BULLISH_ENGULFING",
      points: [
        { candleIndex: 0, value: 0 },
        { candleIndex: 1, value: 1 },
      ],
    });
    const split = splitTimelineIndicatorSeriesForRendering([
      buildSeries({
        key: "BOLLINGER_BANDS_UPPER_20_2",
        name: "BOLLINGER_BANDS UPPER",
        panel: "price",
      }),
      pattern,
    ]);

    expect(isPatternSeries(pattern)).toBe(true);
    expect(split.priceSeries).toHaveLength(1);
    expect(split.patternSeries).toHaveLength(1);
    expect(split.oscillatorPanels).toHaveLength(0);
  });

  it("returns deterministic marker bias per candle pattern", () => {
    expect(getPatternMarkerBias("BULLISH_ENGULFING")).toBe("bullish");
    expect(getPatternMarkerBias("BEARISH_ENGULFING")).toBe("bearish");
    expect(getPatternMarkerBias("DOJI")).toBe("neutral");
  });
});
