import { describe, expect, it } from 'vitest';
import { decideExecutionAction } from '../engine/sharedExecutionCore';
import { evaluateStrategySignalAtIndex, parseStrategySignalRules } from '../engine/strategySignalEvaluator';
import { ReplayCandle, simulateTradesForSymbolReplay } from './backtestReplayCore';

const makeCandles = (prices: number[]): ReplayCandle[] =>
  prices.map((close, index) => ({
    openTime: 1_700_000_000_000 + index * 60_000,
    closeTime: 1_700_000_030_000 + index * 60_000,
    open: close,
    high: close * 1.003,
    low: close * 0.997,
    close,
    volume: 1000 + index,
  }));

type ExpectedAction = {
  kind: 'open' | 'close';
  side: 'LONG' | 'SHORT';
};

const buildExpectedActions = (
  candles: ReplayCandle[],
  strategyConfig: Record<string, unknown>,
): ExpectedAction[] => {
  const rules = parseStrategySignalRules(strategyConfig);
  if (!rules) return [];

  const cache = new Map<string, Array<number | null>>();
  const actions: ExpectedAction[] = [];
  let openPosition: { side: 'LONG' | 'SHORT'; quantity: number; managementMode: 'BOT_MANAGED' } | null = null;

  for (let index = 1; index < candles.length; index += 1) {
    const direction = evaluateStrategySignalAtIndex(rules, candles, index, cache);
    if (!direction) continue;
    const decision = decideExecutionAction(direction, openPosition);
    if (decision.kind === 'open') {
      actions.push({ kind: 'open', side: decision.positionSide });
      openPosition = {
        side: decision.positionSide,
        quantity: 1,
        managementMode: 'BOT_MANAGED',
      };
      continue;
    }

    if (decision.kind === 'close' && openPosition) {
      actions.push({ kind: 'close', side: openPosition.side });
      openPosition = null;
    }
  }

  if (openPosition) {
    actions.push({ kind: 'close', side: openPosition.side });
  }

  return actions;
};

const buildReplayActions = (symbol: string, candles: ReplayCandle[], strategyConfig: Record<string, unknown>) => {
  const replay = simulateTradesForSymbolReplay({
    symbol,
    candles,
    marketType: 'FUTURES',
    leverage: 2,
    marginMode: 'CROSSED',
    strategyConfig,
  });

  return replay.events
    .filter((event) => event.type === 'ENTRY' || event.type === 'EXIT')
    .map((event) => ({
      kind: event.type === 'ENTRY' ? ('open' as const) : ('close' as const),
      side: event.side,
    }));
};

const scenarios: Array<{ symbol: string; candles: ReplayCandle[] }> = [
  {
    symbol: 'BTCUSDT',
    candles: makeCandles([100, 101, 102, 103, 102, 101, 100, 99, 100, 101]),
  },
  {
    symbol: 'ETHUSDT',
    candles: makeCandles([200, 199, 198, 197, 198, 199, 200, 201, 200, 199]),
  },
  {
    symbol: 'SOLUSDT',
    candles: makeCandles([50, 50.5, 51, 50.7, 50.4, 50.1, 49.8, 49.5, 49.9, 50.3]),
  },
];

const expectParityForThreeSymbols = (strategyConfig: Record<string, unknown>) => {
  let totalExpectedActions = 0;
  for (const scenario of scenarios) {
    const expected = buildExpectedActions(scenario.candles, strategyConfig);
    const replay = buildReplayActions(scenario.symbol, scenario.candles, strategyConfig);
    totalExpectedActions += expected.length;
    expect(replay).toEqual(expected);
  }

  expect(totalExpectedActions).toBeGreaterThan(0);
};

describe('backtest parity harness (3 symbols)', () => {
  it('keeps EMA decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'EMA', params: { fast: 2, slow: 4 }, condition: '>', value: 1 }],
        indicatorsShort: [{ name: 'EMA', params: { fast: 2, slow: 4 }, condition: '<', value: 1 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps RSI decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'RSI', params: { period: 3 }, condition: '>', value: 52 }],
        indicatorsShort: [{ name: 'RSI', params: { period: 3 }, condition: '<', value: 48 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps MOMENTUM decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'MOMENTUM', params: { period: 1 }, condition: '>', value: 0 }],
        indicatorsShort: [{ name: 'MOMENTUM', params: { period: 1 }, condition: '<', value: 0 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps SMA decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'SMA', params: { period: 3 }, condition: '>', value: 100 }],
        indicatorsShort: [{ name: 'SMA', params: { period: 3 }, condition: '<', value: 100 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps MACD decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'MACD', params: { fast: 2, slow: 4, signal: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [{ name: 'MACD', params: { fast: 2, slow: 4, signal: 3 }, condition: '<', value: 0 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps ROC decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'ROC', params: { period: 2 }, condition: '>', value: 0 }],
        indicatorsShort: [{ name: 'ROC', params: { period: 2 }, condition: '<', value: 0 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps STOCHRSI decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [
          {
            name: 'STOCHRSI',
            params: { period: 3, stochPeriod: 3, smoothK: 2, smoothD: 2 },
            condition: '>',
            value: -1,
          },
        ],
        indicatorsShort: [
          {
            name: 'STOCHRSI',
            params: { period: 3, stochPeriod: 3, smoothK: 2, smoothD: 2 },
            condition: '<',
            value: -1,
          },
        ],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps BOLLINGER decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [
          { name: 'BOLLINGER_BANDS', params: { period: 3, stdDev: 2 }, condition: '>', value: -1 },
        ],
        indicatorsShort: [
          { name: 'BOLLINGER_BANDS', params: { period: 3, stdDev: 2 }, condition: '<', value: -1 },
        ],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });

  it('keeps ATR decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'ATR', params: { period: 3 }, condition: '>', value: -1 }],
        indicatorsShort: [{ name: 'ATR', params: { period: 3 }, condition: '<', value: -1 }],
      },
      close: {
        tp: 99,
        sl: 99,
        tsl: [{ percent: 99, arm: 1 }],
      },
      additional: {
        dcaTimes: 0,
      },
    } satisfies Record<string, unknown>;

    expectParityForThreeSymbols(strategyConfig);
  });
});
