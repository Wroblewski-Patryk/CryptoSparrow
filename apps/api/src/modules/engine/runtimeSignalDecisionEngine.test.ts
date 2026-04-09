import { describe, expect, it } from 'vitest';
import { RuntimeSignalDecisionEngine } from './runtimeSignalDecisionEngine';

type RuntimeCandle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const baseStrategy = {
  strategyId: 'strategy-1',
  strategyInterval: '1m',
  strategyLeverage: 3,
  walletRisk: 5,
  priority: 10,
  weight: 1,
};

const candles: RuntimeCandle[] = Array.from({ length: 5 }, (_, index) => ({
  openTime: index * 60_000,
  closeTime: index * 60_000 + 59_000,
  open: 100 + index,
  high: 101 + index,
  low: 99 + index,
  close: 100 + index,
  volume: 1_000 + index,
}));

describe('RuntimeSignalDecisionEngine', () => {
  it('evaluates FUNDING_RATE long signal from derivatives series', () => {
    const engine = new RuntimeSignalDecisionEngine({
      getSeries: () => candles,
      resolveFundingRateSeriesForCandles: () => [0.0002, 0.0001, 0.0001, 0.00005, -0.0003],
      resolveOpenInterestSeriesForCandles: () => null,
      resolveOrderBookSeriesForCandles: () => null,
    });

    const evaluation = engine.evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: {
        ...baseStrategy,
        strategyId: 'strategy-funding-long',
        strategyConfig: {
          open: {
            indicatorsLong: [{ name: 'FUNDING_RATE', params: {}, condition: '<', value: 0 }],
            indicatorsShort: [],
          },
        },
      },
      decisionOpenTime: candles[candles.length - 1].openTime,
    });

    expect(evaluation.direction).toBe('LONG');
    expect(evaluation.indicatorSummary).toContain('FUNDING_RATE');
  });

  it('evaluates OPEN_INTEREST_ZSCORE short signal from derivatives series', () => {
    const engine = new RuntimeSignalDecisionEngine({
      getSeries: () => candles,
      resolveFundingRateSeriesForCandles: () => null,
      resolveOpenInterestSeriesForCandles: () => [100, 102, 101, 104, 165],
      resolveOrderBookSeriesForCandles: () => null,
    });

    const evaluation = engine.evaluateStrategy({
      marketType: 'FUTURES',
      symbol: 'BTCUSDT',
      strategy: {
        ...baseStrategy,
        strategyId: 'strategy-open-interest-short',
        strategyConfig: {
          open: {
            indicatorsLong: [],
            indicatorsShort: [
              {
                name: 'OPEN_INTEREST_ZSCORE',
                params: { zScorePeriod: 3 },
                condition: '>',
                value: 1,
              },
            ],
          },
        },
      },
      decisionOpenTime: candles[candles.length - 1].openTime,
    });

    expect(evaluation.direction).toBe('SHORT');
    expect(evaluation.indicatorSummary).toContain('OPEN_INTEREST');
  });
});
