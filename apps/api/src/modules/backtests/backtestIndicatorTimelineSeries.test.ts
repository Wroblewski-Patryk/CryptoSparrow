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

  it('builds CCI oscillator series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'CCI', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'CCI_3',
      name: 'CCI',
      panel: 'oscillator',
      source: 'CCI',
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

  it('builds DONCHIAN upper/middle/lower channels for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'DONCHIAN_CHANNELS', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(3);
    expect(specs.map((item) => item.key)).toEqual([
      'DONCHIAN_CHANNELS_UPPER_3',
      'DONCHIAN_CHANNELS_MIDDLE_3',
      'DONCHIAN_CHANNELS_LOWER_3',
    ]);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.every((item) => item.panel === 'price')).toBe(true);
  });

  it('builds FUNDING_RATE raw series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'FUNDING_RATE', params: {}, condition: '<', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'FUNDING_RATE_RAW',
      source: 'FUNDING',
      channel: 'RAW',
      panel: 'oscillator',
    });

    const series = buildIndicatorSeriesForTests(candles, specs, {
      fundingRates: [
        { timestamp: candles[0].openTime, fundingRate: 0.0001 },
        { timestamp: candles[2].openTime, fundingRate: -0.0002 },
      ],
      openInterest: [],
    });
    expect(series[0].values).toEqual([0.0001, 0.0001, -0.0002, -0.0002]);
  });

  it('builds FUNDING_RATE_ZSCORE series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'FUNDING_RATE_ZSCORE', params: { zScorePeriod: 3 }, condition: '>', value: 1 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      source: 'FUNDING',
      channel: 'ZSCORE',
      period: 3,
    });

    const series = buildIndicatorSeriesForTests(candles, specs, {
      fundingRates: [
        { timestamp: candles[0].openTime, fundingRate: 0.0001 },
        { timestamp: candles[1].openTime, fundingRate: 0.00015 },
        { timestamp: candles[2].openTime, fundingRate: 0.0002 },
        { timestamp: candles[3].openTime, fundingRate: 0.0008 },
      ],
      openInterest: [],
    });
    expect(series[0].values[0]).toBeNull();
    expect(series[0].values[1]).toBeNull();
    expect(series[0].values[3]).toBeGreaterThan(1);
  });

  it('builds OPEN_INTEREST raw/delta/ma/zscore series for timeline overlays', () => {
    const rawSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'OPEN_INTEREST', params: {}, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });
    const deltaSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'OPEN_INTEREST_DELTA', params: {}, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });
    const maSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'OPEN_INTEREST_MA', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });
    const zScoreSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'OPEN_INTEREST_ZSCORE', params: { zScorePeriod: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [],
      },
    });

    expect(rawSpecs[0]).toMatchObject({ source: 'OPEN_INTEREST', channel: 'RAW' });
    expect(deltaSpecs[0]).toMatchObject({ source: 'OPEN_INTEREST', channel: 'DELTA' });
    expect(maSpecs[0]).toMatchObject({ source: 'OPEN_INTEREST', channel: 'MA', period: 3 });
    expect(zScoreSpecs[0]).toMatchObject({ source: 'OPEN_INTEREST', channel: 'ZSCORE', period: 3 });

    const supplemental = {
      fundingRates: [],
      openInterest: [
        { timestamp: candles[0].openTime, openInterest: 1000 },
        { timestamp: candles[1].openTime, openInterest: 1100 },
        { timestamp: candles[2].openTime, openInterest: 1300 },
        { timestamp: candles[3].openTime, openInterest: 1800 },
      ],
    };

    const rawSeries = buildIndicatorSeriesForTests(candles, rawSpecs, supplemental);
    const deltaSeries = buildIndicatorSeriesForTests(candles, deltaSpecs, supplemental);
    const maSeries = buildIndicatorSeriesForTests(candles, maSpecs, supplemental);
    const zScoreSeries = buildIndicatorSeriesForTests(candles, zScoreSpecs, supplemental);

    expect(rawSeries[0].values).toEqual([1000, 1100, 1300, 1800]);
    expect(deltaSeries[0].values).toEqual([null, 100, 200, 500]);
    expect(maSeries[0].values[0]).toBeNull();
    expect(maSeries[0].values[2]).toBeCloseTo((1000 + 1100 + 1300) / 3, 10);
    expect(zScoreSeries[0].values[0]).toBeNull();
    expect(zScoreSeries[0].values[3]).toBeGreaterThan(1);
  });

  it('builds ORDER_BOOK series for timeline overlays', () => {
    const imbalanceSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ORDER_BOOK_IMBALANCE', params: {}, condition: '>', value: 0.2 }],
        indicatorsShort: [],
      },
    });
    const spreadSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ORDER_BOOK_SPREAD_BPS', params: {}, condition: '<', value: 6 }],
        indicatorsShort: [],
      },
    });
    const ratioSpecs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'ORDER_BOOK_DEPTH_RATIO', params: {}, condition: '>', value: 1.4 }],
        indicatorsShort: [],
      },
    });

    expect(imbalanceSpecs[0]).toMatchObject({ source: 'ORDER_BOOK', channel: 'IMBALANCE' });
    expect(spreadSpecs[0]).toMatchObject({ source: 'ORDER_BOOK', channel: 'SPREAD_BPS' });
    expect(ratioSpecs[0]).toMatchObject({ source: 'ORDER_BOOK', channel: 'DEPTH_RATIO' });

    const supplemental = {
      fundingRates: [],
      openInterest: [],
      orderBook: [
        { timestamp: candles[0].openTime, imbalance: 0.1, spreadBps: 8, depthRatio: 1.1 },
        { timestamp: candles[2].openTime, imbalance: 0.25, spreadBps: 5, depthRatio: 1.6 },
      ],
    };

    const imbalanceSeries = buildIndicatorSeriesForTests(candles, imbalanceSpecs, supplemental);
    const spreadSeries = buildIndicatorSeriesForTests(candles, spreadSpecs, supplemental);
    const ratioSeries = buildIndicatorSeriesForTests(candles, ratioSpecs, supplemental);

    expect(imbalanceSeries[0].values).toEqual([0.1, 0.1, 0.25, 0.25]);
    expect(spreadSeries[0].values).toEqual([8, 8, 5, 5]);
    expect(ratioSeries[0].values).toEqual([1.1, 1.1, 1.6, 1.6]);
  });

  it('builds engulfing pattern boolean series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'BULLISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'BEARISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.source)).toEqual(['PATTERN', 'PATTERN']);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series.every((item) => item.panel === 'oscillator')).toBe(true);
    expect(series[0].values.every((value) => value === 0 || value === 1)).toBe(true);
  });

  it('builds hammer/shooting-star pattern boolean series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'HAMMER', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'SHOOTING_STAR', params: {}, condition: '>', value: 0.5 }],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.source)).toEqual(['PATTERN', 'PATTERN']);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[1].values.every((value) => value === 0 || value === 1)).toBe(true);
  });

  it('builds doji pattern boolean series with threshold params for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'DOJI', params: { dojiBodyToRangeMax: 0.2 }, condition: '>', value: 0.5 }],
        indicatorsShort: [],
      },
    });

    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({
      key: 'DOJI_0.2',
      source: 'PATTERN',
      params: { dojiBodyToRangeMax: 0.2 },
    });
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[0].values.every((value) => value === 0 || value === 1)).toBe(true);
  });

  it('builds morning/evening-star pattern boolean series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'MORNING_STAR', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'EVENING_STAR', params: {}, condition: '>', value: 0.5 }],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.source)).toEqual(['PATTERN', 'PATTERN']);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[0].values.every((value) => value === 0 || value === 1)).toBe(true);
  });

  it('builds inside/outside-bar pattern boolean series for timeline overlays', () => {
    const specs = parseStrategyIndicatorsForTests({
      open: {
        indicatorsLong: [{ name: 'INSIDE_BAR', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'OUTSIDE_BAR', params: {}, condition: '>', value: 0.5 }],
      },
    });

    expect(specs).toHaveLength(2);
    expect(specs.map((item) => item.source)).toEqual(['PATTERN', 'PATTERN']);
    const series = buildIndicatorSeriesForTests(candles, specs);
    expect(series[0].values.every((value) => value === 0 || value === 1)).toBe(true);
  });
});
