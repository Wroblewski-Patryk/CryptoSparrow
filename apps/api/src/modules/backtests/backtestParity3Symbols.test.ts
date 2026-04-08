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

const makePatternCandles = (rows: Array<{ open: number; high: number; low: number; close: number }>): ReplayCandle[] =>
  rows.map((row, index) => ({
    openTime: 1_710_000_000_000 + index * 60_000,
    closeTime: 1_710_000_030_000 + index * 60_000,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: 2000 + index,
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

  it('keeps CCI decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'CCI', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [{ name: 'CCI', params: { period: 3 }, condition: '<', value: 0 }],
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

  it('keeps ADX decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'ADX', params: { period: 3 }, condition: '>', value: -1 }],
        indicatorsShort: [{ name: 'ADX', params: { period: 3 }, condition: '<', value: -1 }],
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

  it('keeps STOCHASTIC decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'STOCHASTIC', params: { period: 3, smoothK: 2, smoothD: 2 }, condition: '>', value: -1 }],
        indicatorsShort: [{ name: 'STOCHASTIC', params: { period: 3, smoothK: 2, smoothD: 2 }, condition: '<', value: -1 }],
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

  it('keeps DONCHIAN decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'DONCHIAN_CHANNELS', params: { period: 3 }, condition: '>', value: 0 }],
        indicatorsShort: [{ name: 'DONCHIAN_CHANNELS', params: { period: 3 }, condition: '<', value: 0 }],
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

  it('keeps engulfing pattern decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'BULLISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'BEARISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
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

    const patternScenarios: Array<{ symbol: string; candles: ReplayCandle[] }> = [
      {
        symbol: 'BTCUSDT',
        candles: makePatternCandles([
          { open: 10, high: 10.2, low: 9, close: 9.2 },
          { open: 9, high: 11.1, low: 8.8, close: 10.9 },
          { open: 10.8, high: 11.2, low: 10.5, close: 11 },
          { open: 11.3, high: 11.4, low: 9.1, close: 9.4 },
        ]),
      },
      {
        symbol: 'ETHUSDT',
        candles: makePatternCandles([
          { open: 20, high: 20.2, low: 19.1, close: 19.2 },
          { open: 19, high: 21.4, low: 18.8, close: 21.2 },
          { open: 21.1, high: 21.3, low: 20.7, close: 21.25 },
          { open: 21.5, high: 21.6, low: 19, close: 19.3 },
        ]),
      },
      {
        symbol: 'SOLUSDT',
        candles: makePatternCandles([
          { open: 30, high: 30.2, low: 29, close: 29.1 },
          { open: 28.9, high: 31.3, low: 28.7, close: 31 },
          { open: 31.1, high: 31.4, low: 30.8, close: 31.2 },
          { open: 31.5, high: 31.6, low: 28.9, close: 29.2 },
        ]),
      },
    ];

    let totalExpectedActions = 0;
    for (const scenario of patternScenarios) {
      const expected = buildExpectedActions(scenario.candles, strategyConfig);
      const replay = buildReplayActions(scenario.symbol, scenario.candles, strategyConfig);
      totalExpectedActions += expected.length;
      expect(replay).toEqual(expected);
    }

    expect(totalExpectedActions).toBeGreaterThan(0);
  });

  it('keeps hammer/shooting-star pattern decision trace aligned with shared strategy/runtime core for three symbols', () => {
    const strategyConfig = {
      open: {
        direction: 'both',
        indicatorsLong: [{ name: 'HAMMER', params: {}, condition: '>', value: 0.5 }],
        indicatorsShort: [{ name: 'SHOOTING_STAR', params: {}, condition: '>', value: 0.5 }],
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

    const patternScenarios: Array<{ symbol: string; candles: ReplayCandle[] }> = [
      {
        symbol: 'BTCUSDT',
        candles: makePatternCandles([
          { open: 10.6, high: 10.7, low: 10, close: 10.2 },
          { open: 10, high: 10.25, low: 9.2, close: 10.2 },
          { open: 10.2, high: 10.4, low: 10.1, close: 10.35 },
          { open: 10.4, high: 11.2, low: 10.15, close: 10.2 },
        ]),
      },
      {
        symbol: 'ETHUSDT',
        candles: makePatternCandles([
          { open: 20.8, high: 20.9, low: 20, close: 20.3 },
          { open: 20.1, high: 20.35, low: 19.2, close: 20.3 },
          { open: 20.3, high: 20.5, low: 20.2, close: 20.45 },
          { open: 20.5, high: 21.4, low: 20.3, close: 20.2 },
        ]),
      },
      {
        symbol: 'SOLUSDT',
        candles: makePatternCandles([
          { open: 30.9, high: 31, low: 30.1, close: 30.4 },
          { open: 30.2, high: 30.45, low: 29.1, close: 30.4 },
          { open: 30.4, high: 30.6, low: 30.3, close: 30.55 },
          { open: 30.6, high: 31.5, low: 30.35, close: 30.25 },
        ]),
      },
    ];

    let totalExpectedActions = 0;
    for (const scenario of patternScenarios) {
      const expected = buildExpectedActions(scenario.candles, strategyConfig);
      const replay = buildReplayActions(scenario.symbol, scenario.candles, strategyConfig);
      totalExpectedActions += expected.length;
      expect(replay).toEqual(expected);
    }

    expect(totalExpectedActions).toBeGreaterThan(0);
  });
});
