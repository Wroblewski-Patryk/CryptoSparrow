import { describe, expect, it } from 'vitest';
import { DefaultIndicatorAdapter } from './indicatorAdapter.service';
import { OhlcvCandle } from './marketData.types';

const candles: OhlcvCandle[] = [100, 102, 101, 104, 106, 108, 110, 109].map((close, idx) => ({
  timestamp: 1_700_000_000_000 + idx * 60_000,
  open: close - 1,
  high: close + 1,
  low: close - 2,
  close,
  volume: 1000 + idx * 10,
}));

describe('DefaultIndicatorAdapter', () => {
  it('calculates SMA and pads initial values with null', () => {
    const adapter = new DefaultIndicatorAdapter();
    const result = adapter.calculate({ kind: 'SMA', period: 3 }, candles);

    expect(result).toHaveLength(candles.length);
    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(101);
    expect(result[7].value).not.toBeNull();
  });

  it('calculates EMA with SMA seed', () => {
    const adapter = new DefaultIndicatorAdapter();
    const result = adapter.calculate({ kind: 'EMA', period: 3 }, candles);

    expect(result[0].value).toBeNull();
    expect(result[1].value).toBeNull();
    expect(result[2].value).toBe(101);
    expect(result[3].value).toBe(102.5);
  });

  it('calculates RSI between 0 and 100 after warmup', () => {
    const adapter = new DefaultIndicatorAdapter();
    const result = adapter.calculate({ kind: 'RSI', period: 3 }, candles);

    expect(result[0].value).toBeNull();
    expect(result[2].value).toBeNull();
    expect(result[3].value).not.toBeNull();
    expect((result[7].value as number) >= 0).toBe(true);
    expect((result[7].value as number) <= 100).toBe(true);
  });
});
