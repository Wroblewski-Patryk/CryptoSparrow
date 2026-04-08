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

    expect(specs).toEqual([
      {
        key: 'SMA_3',
        name: 'SMA',
        period: 3,
        panel: 'price',
      },
    ]);

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
});

