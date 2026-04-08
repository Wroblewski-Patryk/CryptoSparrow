import { describe, expect, it } from 'vitest';
import {
  buildIndicatorSeriesForTests,
  parseStrategyIndicatorsForTests,
} from './backtests.service';

const candles = [10, 11, 12, 13].map((close, index) => ({
  openTime: 1_700_000_000_000 + index * 60_000,
  closeTime: 1_700_000_030_000 + index * 60_000,
  open: close,
  high: close + 0.5,
  low: close - 0.5,
  close,
  volume: 1000 + index,
}));

describe('backtest indicator timeline series', () => {
  it('parses SMA from strategy config and builds SMA price series values', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'SMA', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'SMA_3',
      name: 'SMA',
      period: 3,
      panel: 'price',
      source: 'SMA',
      params: { period: 3 },
    });

    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      key: 'SMA_3',
      name: 'SMA',
      period: 3,
      panel: 'price',
    });
    expect(series[0].values).toEqual([null, null, 11, 12]);
  });

  it('builds MACD line/signal/histogram channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [
          { name: 'MACD', params: { fast: 2, slow: 4, signal: 3 }, condition: '>', value: 0 },
        ],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(3);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.map((item) => item.key)).toEqual([
      'MACD_LINE_2_4_3',
      'MACD_SIGNAL_2_4_3',
      'MACD_HISTOGRAM_2_4_3',
    ]);
    expect(series.every((item) => item.panel === 'oscillator')).toBe(true);
  });
});
