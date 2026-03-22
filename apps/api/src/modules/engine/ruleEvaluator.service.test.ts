import { describe, expect, it } from 'vitest';
import { evaluateRuleGroup } from './ruleEvaluator.service';
import { IndicatorSnapshot, RuleGroup } from './ruleEvaluator.types';

const snapshot: IndicatorSnapshot = {
  '1m': {
    RSI: 62,
    SMA_20: 104,
  },
  '5m': {
    RSI: 54,
    SMA_20: 101,
    EMA_20: 103,
  },
};

describe('rule evaluator', () => {
  it('returns true for AND when all rules pass', () => {
    const group: RuleGroup = {
      logic: 'AND',
      rules: [
        { indicator: 'RSI', timeframe: '1m', operator: '>', value: 60 },
        { indicator: 'SMA_20', timeframe: '5m', operator: '>=', value: 101 },
      ],
    };

    expect(evaluateRuleGroup(group, snapshot)).toBe(true);
  });

  it('returns false for AND when one rule fails', () => {
    const group: RuleGroup = {
      logic: 'AND',
      rules: [
        { indicator: 'RSI', timeframe: '1m', operator: '>', value: 60 },
        { indicator: 'EMA_20', timeframe: '5m', operator: '<', value: 100 },
      ],
    };

    expect(evaluateRuleGroup(group, snapshot)).toBe(false);
  });

  it('returns true for OR when any rule passes across timeframes', () => {
    const group: RuleGroup = {
      logic: 'OR',
      rules: [
        { indicator: 'RSI', timeframe: '5m', operator: '>', value: 70 },
        { indicator: 'EMA_20', timeframe: '5m', operator: '==', value: 103 },
      ],
    };

    expect(evaluateRuleGroup(group, snapshot)).toBe(true);
  });

  it('returns false when timeframe or indicator is missing', () => {
    const group: RuleGroup = {
      logic: 'OR',
      rules: [
        { indicator: 'MACD', timeframe: '1m', operator: '>', value: 0 },
        { indicator: 'RSI', timeframe: '15m', operator: '>', value: 50 },
      ],
    };

    expect(evaluateRuleGroup(group, snapshot)).toBe(false);
  });
});
