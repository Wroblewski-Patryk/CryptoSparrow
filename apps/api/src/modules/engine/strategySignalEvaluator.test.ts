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
