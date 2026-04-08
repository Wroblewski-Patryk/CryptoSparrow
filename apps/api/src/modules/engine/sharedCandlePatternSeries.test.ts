import { describe, expect, it } from 'vitest';
import {
  CandlePatternName,
  computeCandlePatternSeries,
  OhlcPatternCandle,
} from './sharedCandlePatternSeries';

const fixtures: OhlcPatternCandle[] = [
  { open: 10, high: 11, low: 9, close: 9.2 },
  { open: 9, high: 11.4, low: 8.8, close: 11.2 },
  { open: 11.1, high: 11.3, low: 9.5, close: 10.8 },
  { open: 10.8, high: 11.9, low: 10.7, close: 11.8 },
  { open: 11.9, high: 12.1, low: 11.85, close: 11.92 },
  { open: 11.6, high: 12, low: 10.9, close: 11.95 },
  { open: 12.1, high: 12.5, low: 11.2, close: 11.3 },
];

const patterns: CandlePatternName[] = [
  'BULLISH_ENGULFING',
  'BEARISH_ENGULFING',
  'HAMMER',
  'SHOOTING_STAR',
  'DOJI',
  'MORNING_STAR',
  'EVENING_STAR',
  'INSIDE_BAR',
  'OUTSIDE_BAR',
];

describe('sharedCandlePatternSeries', () => {
  it('returns boolean series with the same length as candles for all patterns', () => {
    for (const pattern of patterns) {
      const series = computeCandlePatternSeries(fixtures, pattern);
      expect(series).toHaveLength(fixtures.length);
      expect(series.every((value) => typeof value === 'boolean')).toBe(true);
    }
  });

  it('detects basic engulfing fixtures', () => {
    const bullish = computeCandlePatternSeries(fixtures, 'BULLISH_ENGULFING');
    const bearish = computeCandlePatternSeries(fixtures, 'BEARISH_ENGULFING');

    expect(bullish[1]).toBe(true);
    expect(bearish[6]).toBe(true);
  });
});
