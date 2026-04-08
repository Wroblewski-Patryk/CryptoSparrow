import { describe, expect, it } from 'vitest';
import {
  evaluateStrategySignalAtIndex,
  parseStrategySignalRules,
} from './strategySignalEvaluator';

const candles = [100, 101, 102].map((close) => ({ close }));

describe('strategySignalEvaluator', () => {
  it('defaults to HOLD when no strategy rule is matched', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: 10_000, params: { period: 1 } }],
        indicatorsShort: [{ name: 'MOMENTUM', condition: '<', value: -10_000, params: { period: 1 } }],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(rules, candles, 2, new Map());
    expect(direction).toBeNull();
  });

  it('supports explicit EXIT on no-match via open.noMatchAction', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'both',
        noMatchAction: 'EXIT',
        indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: 10_000, params: { period: 1 } }],
        indicatorsShort: [{ name: 'MOMENTUM', condition: '<', value: -10_000, params: { period: 1 } }],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(rules, candles, 2, new Map());
    expect(direction).toBe('EXIT');
  });

  it('normalizes constant operand and evaluates comparator rules', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: '>', value: 0, params: { period: 1 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    expect(rules.longRules[0].operand).toEqual({ kind: 'constant', value: 0 });

    const direction = evaluateStrategySignalAtIndex(rules, [{ close: 100 }, { close: 101 }, { close: 103 }], 2, new Map());
    expect(direction).toBe('LONG');
  });

  it('normalizes EMA legacy rule to series operand (slow EMA)', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'EMA', condition: '>', value: 0, params: { fast: 3, slow: 7 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    expect(rules.longRules[0].operand).toEqual({
      kind: 'series',
      indicator: 'EMA',
      params: { period: 7 },
    });
  });

  it('supports SMA comparator evaluation', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'SMA', condition: '>', value: 11, params: { period: 3 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [{ close: 10 }, { close: 11 }, { close: 12 }, { close: 13 }],
      3,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports MACD comparator evaluation', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [
          { name: 'MACD', condition: '>', value: 0, params: { fast: 2, slow: 4, signal: 3 } },
        ],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [{ close: 10 }, { close: 11 }, { close: 12 }, { close: 13 }, { close: 14 }, { close: 15 }],
      5,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports ROC comparator evaluation', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'ROC', condition: '>', value: 0.5, params: { period: 2 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [{ close: 100 }, { close: 101 }, { close: 103 }, { close: 105 }],
      3,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports STOCHRSI comparator evaluation', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [
          {
            name: 'STOCHRSI',
            condition: '>',
            value: -1,
            params: { period: 3, stochPeriod: 3, smoothK: 2, smoothD: 2 },
          },
        ],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100 },
        { close: 99 },
        { close: 100 },
        { close: 101 },
        { close: 102 },
        { close: 101 },
        { close: 103 },
        { close: 104 },
      ],
      7,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports BOLLINGER comparator evaluation via percentB default channel', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [
          {
            name: 'BOLLINGER_BANDS',
            condition: '>',
            value: -1,
            params: { period: 3, stdDev: 2 },
          },
        ],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [{ close: 100 }, { close: 101 }, { close: 102 }, { close: 103 }, { close: 104 }],
      4,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports ATR comparator evaluation with OHLC candles', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'ATR', condition: '>', value: 0.5, params: { period: 3 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100, high: 101, low: 99 },
        { close: 101, high: 103, low: 100 },
        { close: 99, high: 102, low: 97 },
        { close: 102, high: 104, low: 98 },
        { close: 103, high: 105, low: 101 },
      ],
      4,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports CCI comparator evaluation with OHLC candles', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'CCI', condition: '>', value: -200, params: { period: 3 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100, high: 101, low: 99 },
        { close: 102, high: 103, low: 100 },
        { close: 101, high: 104, low: 100 },
        { close: 104, high: 106, low: 102 },
        { close: 105, high: 107, low: 103 },
      ],
      4,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports ADX comparator evaluation with OHLC candles', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'ADX', condition: '>', value: -1, params: { period: 3 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100, high: 101, low: 99 },
        { close: 102, high: 104, low: 100 },
        { close: 101, high: 103, low: 99 },
        { close: 103, high: 106, low: 101 },
        { close: 104, high: 107, low: 102 },
        { close: 106, high: 109, low: 104 },
        { close: 107, high: 110, low: 105 },
      ],
      6,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports STOCHASTIC comparator evaluation with OHLC candles', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'STOCHASTIC', condition: '>', value: -1, params: { period: 3, smoothK: 2, smoothD: 2 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100, high: 101, low: 99 },
        { close: 102, high: 103, low: 100 },
        { close: 101, high: 104, low: 99 },
        { close: 103, high: 105, low: 101 },
        { close: 104, high: 106, low: 102 },
        { close: 105, high: 108, low: 103 },
      ],
      5,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports DONCHIAN comparator evaluation with OHLC candles', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'DONCHIAN_CHANNELS', condition: '>', value: -1, params: { period: 3 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { close: 100, high: 101, low: 99 },
        { close: 102, high: 103, low: 100 },
        { close: 101, high: 104, low: 99 },
        { close: 103, high: 105, low: 101 },
        { close: 104, high: 106, low: 102 },
      ],
      4,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports engulfing candle-pattern comparator evaluation', () => {
    const longRules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'BULLISH_ENGULFING', condition: '>', value: 0.5, params: {} }],
        indicatorsShort: [],
      },
    });

    expect(longRules).not.toBeNull();
    if (!longRules) return;

    const longDirection = evaluateStrategySignalAtIndex(
      longRules,
      [
        { open: 10, close: 9.2, high: 10.2, low: 9 },
        { open: 9, close: 10.9, high: 11, low: 8.8 },
      ],
      1,
      new Map(),
    );
    expect(longDirection).toBe('LONG');

    const shortRules = parseStrategySignalRules({
      open: {
        direction: 'short',
        indicatorsLong: [],
        indicatorsShort: [{ name: 'BEARISH_ENGULFING', condition: '>', value: 0.5, params: {} }],
      },
    });

    expect(shortRules).not.toBeNull();
    if (!shortRules) return;

    const shortDirection = evaluateStrategySignalAtIndex(
      shortRules,
      [
        { open: 9.2, close: 10.1, high: 10.3, low: 9 },
        { open: 10.4, close: 9.1, high: 10.5, low: 8.9 },
      ],
      1,
      new Map(),
    );
    expect(shortDirection).toBe('SHORT');
  });

  it('supports hammer and shooting-star candle-pattern comparator evaluation', () => {
    const longRules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'HAMMER', condition: '>', value: 0.5, params: {} }],
        indicatorsShort: [],
      },
    });

    expect(longRules).not.toBeNull();
    if (!longRules) return;

    const longDirection = evaluateStrategySignalAtIndex(
      longRules,
      [
        { open: 10.5, close: 10.1, high: 10.55, low: 9.7 },
        { open: 10, close: 10.2, high: 10.25, low: 9.2 },
      ],
      1,
      new Map(),
    );
    expect(longDirection).toBe('LONG');

    const shortRules = parseStrategySignalRules({
      open: {
        direction: 'short',
        indicatorsLong: [],
        indicatorsShort: [{ name: 'SHOOTING_STAR', condition: '>', value: 0.5, params: {} }],
      },
    });

    expect(shortRules).not.toBeNull();
    if (!shortRules) return;

    const shortDirection = evaluateStrategySignalAtIndex(
      shortRules,
      [
        { open: 10, close: 10.3, high: 10.5, low: 9.9 },
        { open: 10.2, close: 10, high: 11.1, low: 9.95 },
      ],
      1,
      new Map(),
    );
    expect(shortDirection).toBe('SHORT');
  });

  it('supports doji candle-pattern comparator evaluation with threshold params', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'DOJI', condition: '>', value: 0.5, params: { dojiBodyToRangeMax: 0.2 } }],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [
        { open: 10.2, close: 10, high: 10.3, low: 9.9 },
        { open: 10, close: 10.01, high: 10.5, low: 9.5 },
      ],
      1,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('supports CROSS_ABOVE and CROSS_BELOW operators', () => {
    const crossAbove = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: 'CROSS_ABOVE', value: 0, params: { period: 2 } }],
        indicatorsShort: [],
      },
    });

    expect(crossAbove).not.toBeNull();
    if (!crossAbove) return;

    const crossAboveDirection = evaluateStrategySignalAtIndex(
      crossAbove,
      [{ close: 10 }, { close: 9 }, { close: 8 }, { close: 11 }],
      3,
      new Map(),
    );
    expect(crossAboveDirection).toBe('LONG');

    const crossBelow = parseStrategySignalRules({
      open: {
        direction: 'short',
        indicatorsLong: [],
        indicatorsShort: [{ name: 'MOMENTUM', condition: 'CROSS_BELOW', value: 0, params: { period: 2 } }],
      },
    });

    expect(crossBelow).not.toBeNull();
    if (!crossBelow) return;

    const crossBelowDirection = evaluateStrategySignalAtIndex(
      crossBelow,
      [{ close: 10 }, { close: 12 }, { close: 14 }, { close: 11 }],
      3,
      new Map(),
    );
    expect(crossBelowDirection).toBe('SHORT');
  });

  it('supports IN_RANGE and OUT_OF_RANGE band operators', () => {
    const inRange = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: 'IN_RANGE', value: [1.5, 2.5], params: { period: 2 } }],
        indicatorsShort: [],
      },
    });

    expect(inRange).not.toBeNull();
    if (!inRange) return;

    expect(inRange.longRules[0].operand).toEqual({ kind: 'band', low: 1.5, high: 2.5 });
    const inRangeDirection = evaluateStrategySignalAtIndex(
      inRange,
      [{ close: 100 }, { close: 101 }, { close: 102 }, { close: 103 }],
      3,
      new Map(),
    );
    expect(inRangeDirection).toBe('LONG');

    const outOfRange = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: 'OUT_OF_RANGE', value: [-0.2, 0.2], params: { period: 2 } }],
        indicatorsShort: [],
      },
    });

    expect(outOfRange).not.toBeNull();
    if (!outOfRange) return;

    const outOfRangeDirection = evaluateStrategySignalAtIndex(
      outOfRange,
      [{ close: 100 }, { close: 101 }, { close: 102 }, { close: 103 }],
      3,
      new Map(),
    );
    expect(outOfRangeDirection).toBe('LONG');
  });

  it('supports series-vs-series operand comparisons', () => {
    const rules = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [
          {
            name: 'MOMENTUM',
            condition: '<',
            operand: {
              kind: 'series',
              indicator: 'MOMENTUM',
              params: { period: 3 },
            },
            params: { period: 2 },
          },
        ],
        indicatorsShort: [],
      },
    });

    expect(rules).not.toBeNull();
    if (!rules) return;

    const direction = evaluateStrategySignalAtIndex(
      rules,
      [{ close: 10 }, { close: 11 }, { close: 13 }, { close: 14 }, { close: 15 }],
      4,
      new Map(),
    );
    expect(direction).toBe('LONG');
  });

  it('rejects invalid operator and invalid band payloads', () => {
    const invalidOperator = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: 'SOMETHING_ELSE', value: 1, params: { period: 1 } }],
        indicatorsShort: [],
      },
    });
    expect(invalidOperator).toBeNull();

    const invalidBand = parseStrategySignalRules({
      open: {
        direction: 'long',
        indicatorsLong: [{ name: 'MOMENTUM', condition: 'IN_RANGE', value: [1], params: { period: 1 } }],
        indicatorsShort: [],
      },
    });
    expect(invalidBand).toBeNull();
  });
});
