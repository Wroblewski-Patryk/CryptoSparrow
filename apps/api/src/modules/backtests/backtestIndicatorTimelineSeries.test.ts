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

  it('builds ROC oscillator series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ROC', params: { period: 2 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'ROC_2',
      name: 'ROC',
      panel: 'oscillator',
      source: 'ROC',
    });

    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[0].values).toEqual([null, null, 20, 18.181818181818183]);
  });

  it('builds STOCHRSI K/D channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [
          {
            name: 'STOCHRSI',
            params: { period: 3, stochPeriod: 3, smoothK: 2, smoothD: 2 },
            condition: '>',
            value: 50,
          },
        ],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.key)).toEqual([
      'STOCHRSI_K_3_3_2_2',
      'STOCHRSI_D_3_3_2_2',
    ]);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.every((item) => item.panel === 'oscillator')).toBe(true);
  });

  it('builds BOLLINGER upper/middle/lower/bandwidth/percentB channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [
          { name: 'BOLLINGER_BANDS', params: { period: 3, stdDev: 2 }, condition: '>', value: 0 },
        ],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(5);
    expect(specs.map((item) => item.key)).toEqual([
      'BOLLINGER_BANDS_UPPER_3_2',
      'BOLLINGER_BANDS_MIDDLE_3_2',
      'BOLLINGER_BANDS_LOWER_3_2',
      'BOLLINGER_BANDS_BANDWIDTH_3_2',
      'BOLLINGER_BANDS_PERCENT_B_3_2',
    ]);
  });

  it('builds ATR oscillator series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ATR', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'ATR_3',
      name: 'ATR',
      panel: 'oscillator',
      source: 'ATR',
    });
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[0].values[0]).toBeNull();
    expect(series[0].values[1]).toBeNull();
  });

  it('builds ADX and DI channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ADX', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(3);
    expect(specs.map((item) => item.key)).toEqual([
      'ADX_ADX_3',
      'ADX_DI_PLUS_3',
      'ADX_DI_MINUS_3',
    ]);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.every((item) => item.panel === 'oscillator')).toBe(true);
  });

  it('builds STOCHASTIC K/D channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'STOCHASTIC', params: { period: 3, smoothK: 2, smoothD: 2 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.key)).toEqual([
      'STOCHASTIC_K_3_2_2',
      'STOCHASTIC_D_3_2_2',
    ]);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.every((item) => item.panel === 'oscillator')).toBe(true);
  });
});
