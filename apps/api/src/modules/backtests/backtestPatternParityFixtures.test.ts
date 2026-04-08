import { describe, expect, it } from 'vitest';
import { decideExecutionAction } from '../engine/sharedExecutionCore';
import { evaluateStrategySignalAtIndex, parseStrategySignalRules } from '../engine/strategySignalEvaluator';
import { ReplayCandle, simulateTradesForSymbolReplay } from './backtestReplayCore';

type Ohlc = { open: number; high: number; low: number; close: number };

const scaleRows = (rows: Ohlc[], multiplier: number): Ohlc[] =>
  rows.map((row) => ({
    open: row.open * multiplier,
    high: row.high * multiplier,
    low: row.low * multiplier,
    close: row.close * multiplier,
  }));

const toReplayCandles = (rows: Ohlc[], seed: number): ReplayCandle[] =>
  rows.map((row, index) => ({
    openTime: 1_720_000_000_000 + seed * 1_000_000 + index * 60_000,
    closeTime: 1_720_000_030_000 + seed * 1_000_000 + index * 60_000,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: 1000 + seed * 10 + index,
  }));

const buildExpectedActions = (
  candles: ReplayCandle[],
  strategyConfig: Record<string, unknown>,
) => {
  const rules = parseStrategySignalRules(strategyConfig);
  if (!rules) return [];

  const cache = new Map<string, Array<number | null>>();
  const actions: Array<{ kind: 'open' | 'close'; side: 'LONG' | 'SHORT' }> = [];
  let openPosition: { side: 'LONG' | 'SHORT'; quantity: number; managementMode: 'BOT_MANAGED' } | null = null;

  for (let index = 1; index < candles.length; index += 1) {
    const direction = evaluateStrategySignalAtIndex(rules, candles, index, cache);
    if (!direction) continue;
    const decision = decideExecutionAction(direction, openPosition);
    if (decision.kind === 'open') {
      actions.push({ kind: 'open', side: decision.positionSide });
      openPosition = { side: decision.positionSide, quantity: 1, managementMode: 'BOT_MANAGED' };
      continue;
    }
    if (decision.kind === 'close' && openPosition) {
      actions.push({ kind: 'close', side: openPosition.side });
      openPosition = null;
    }
  }

  if (openPosition) actions.push({ kind: 'close', side: openPosition.side });
  return actions;
};

const buildReplayActions = (symbol: string, candles: ReplayCandle[], strategyConfig: Record<string, unknown>) =>
  simulateTradesForSymbolReplay({
    symbol,
    candles,
    marketType: 'FUTURES',
    leverage: 2,
    marginMode: 'CROSSED',
    strategyConfig,
  }).events
    .filter((event) => event.type === 'ENTRY' || event.type === 'EXIT')
    .map((event) => ({
      kind: event.type === 'ENTRY' ? ('open' as const) : ('close' as const),
      side: event.side,
    }));

const withRiskDefaults = (open: Record<string, unknown>) =>
  ({
    open,
    close: {
      tp: 99,
      sl: 99,
      tsl: [{ percent: 99, arm: 1 }],
    },
    additional: {
      dcaTimes: 0,
    },
  }) satisfies Record<string, unknown>;

const caseRows: Array<{
  key: string;
  strategyConfig: Record<string, unknown>;
  rows: Ohlc[];
}> = [
  {
    key: 'engulfing',
    strategyConfig: withRiskDefaults({
      direction: 'both',
      indicatorsLong: [{ name: 'BULLISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
      indicatorsShort: [{ name: 'BEARISH_ENGULFING', params: {}, condition: '>', value: 0.5 }],
    }),
    rows: [
      { open: 10, high: 10.2, low: 9, close: 9.2 },
      { open: 9, high: 11.1, low: 8.8, close: 10.9 },
      { open: 10.8, high: 11.2, low: 10.5, close: 11 },
      { open: 11.3, high: 11.4, low: 9.1, close: 9.4 },
    ],
  },
  {
    key: 'hammer_shooting',
    strategyConfig: withRiskDefaults({
      direction: 'both',
      indicatorsLong: [{ name: 'HAMMER', params: {}, condition: '>', value: 0.5 }],
      indicatorsShort: [{ name: 'SHOOTING_STAR', params: {}, condition: '>', value: 0.5 }],
    }),
    rows: [
      { open: 10.6, high: 10.7, low: 10, close: 10.2 },
      { open: 10, high: 10.25, low: 9.2, close: 10.2 },
      { open: 10.2, high: 10.4, low: 10.1, close: 10.35 },
      { open: 10.4, high: 11.2, low: 10.15, close: 10.2 },
    ],
  },
  {
    key: 'doji',
    strategyConfig: withRiskDefaults({
      direction: 'long',
      indicatorsLong: [{ name: 'DOJI', params: { dojiBodyToRangeMax: 0.2 }, condition: '>', value: 0.5 }],
      indicatorsShort: [],
    }),
    rows: [
      { open: 10.4, high: 10.6, low: 9.8, close: 10 },
      { open: 10, high: 10.5, low: 9.5, close: 10.01 },
      { open: 10.05, high: 10.2, low: 9.9, close: 10.1 },
    ],
  },
  {
    key: 'morning_evening',
    strategyConfig: withRiskDefaults({
      direction: 'both',
      indicatorsLong: [{ name: 'MORNING_STAR', params: {}, condition: '>', value: 0.5 }],
      indicatorsShort: [{ name: 'EVENING_STAR', params: {}, condition: '>', value: 0.5 }],
    }),
    rows: [
      { open: 10, high: 10.2, low: 8.8, close: 9 },
      { open: 8.9, high: 9.1, low: 8.7, close: 8.95 },
      { open: 9, high: 9.8, low: 8.9, close: 9.7 },
      { open: 9.75, high: 9.85, low: 9.6, close: 9.7 },
      { open: 9.68, high: 9.72, low: 9.1, close: 9.2 },
    ],
  },
  {
    key: 'inside_outside',
    strategyConfig: withRiskDefaults({
      direction: 'both',
      indicatorsLong: [{ name: 'INSIDE_BAR', params: {}, condition: '>', value: 0.5 }],
      indicatorsShort: [{ name: 'OUTSIDE_BAR', params: {}, condition: '>', value: 0.5 }],
    }),
    rows: [
      { open: 10, high: 11, low: 9, close: 10.3 },
      { open: 10.2, high: 10.5, low: 9.5, close: 10.25 },
      { open: 10.3, high: 11.2, low: 8.8, close: 9.7 },
    ],
  },
];

describe('backtest pattern parity fixtures', () => {
  it('keeps runtime evaluator and replay parity aligned for all candle patterns', () => {
    const multipliers = [1, 2, 3];
    let totalExpectedActions = 0;

    for (const patternCase of caseRows) {
      for (let index = 0; index < multipliers.length; index += 1) {
        const symbol = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'][index];
        const candles = toReplayCandles(scaleRows(patternCase.rows, multipliers[index]), index + 1);
        const expected = buildExpectedActions(candles, patternCase.strategyConfig);
        const replay = buildReplayActions(symbol, candles, patternCase.strategyConfig);
        totalExpectedActions += expected.length;
        expect(replay).toEqual(expected);
      }
    }

    expect(totalExpectedActions).toBeGreaterThan(0);
  });
});
