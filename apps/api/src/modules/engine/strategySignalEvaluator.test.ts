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
});

