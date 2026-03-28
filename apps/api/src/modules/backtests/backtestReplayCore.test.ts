import { describe, expect, it } from 'vitest';
import { simulateTradesForSymbolReplay } from './backtestReplayCore';

const candle = (index: number, close: number) => ({
  openTime: 1_700_000_000_000 + index * 60_000,
  closeTime: 1_700_000_030_000 + index * 60_000,
  open: close,
  high: close * 1.001,
  low: close * 0.999,
  close,
  volume: 1000,
});

describe('simulateTradesForSymbolReplay', () => {
  it('opens/closes using shared decision thresholds and no-flip behavior', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102), // LONG
      candle(2, 101.9), // EXIT
      candle(3, 99), // SHORT
      candle(4, 99.05), // EXIT
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.trades.length).toBeGreaterThanOrEqual(2);
    expect(result.trades[0].side).toBe('LONG');
    expect(result.trades[0].entryPrice).toBe(102);
    expect(result.trades[1].side).toBe('SHORT');
    expect(result.liquidations).toBe(0);
    expect(result.eventCounts.ENTRY).toBeGreaterThanOrEqual(2);
  });

  it('counts isolated liquidation when adverse move exceeds leverage threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.2), // LONG open
      candle(2, 80), // forced EXIT + liquidation region for lev=5
      candle(3, 80),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 10,
      marginMode: 'ISOLATED',
    });

    expect(result.liquidations).toBeGreaterThanOrEqual(1);
    expect(result.eventCounts.LIQUIDATION).toBeGreaterThanOrEqual(1);
  });

  it('emits lifecycle actions (DCA/TRAILING/EXIT) for timeline/reporting', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 100.2), // DCA
      candle(3, 102.4), // favorable move
      candle(4, 102.35), // neutral -> EXIT from signal band
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'ADAUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.ENTRY).toBeGreaterThan(0);
    expect(result.eventCounts.DCA).toBeGreaterThanOrEqual(1);
    expect(result.eventCounts.TRAILING).toBeGreaterThanOrEqual(1);
    expect(result.eventCounts.EXIT + result.eventCounts.TP + result.eventCounts.SL + result.eventCounts.TRAILING + result.eventCounts.LIQUIDATION).toBe(result.trades.length);
  });

  it('emits take-profit lifecycle event when favorable move crosses TP threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 102.9), // TP
      candle(3, 102.88),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.TP).toBeGreaterThanOrEqual(1);
  });

  it('emits stop-loss lifecycle event when adverse move breaches SL threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.4), // open LONG
      candle(2, 98), // SL (still below threshold after one DCA reprice)
      candle(3, 97.98),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'SOLUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.SL).toBeGreaterThanOrEqual(1);
  });

  it('emits trailing exit lifecycle event once pullback crosses trailing threshold', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101.5), // open LONG
      candle(2, 100.2), // DCA
      candle(3, 102.4), // favorable move
      candle(4, 102.35), // trailing exit
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'XRPUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    expect(result.eventCounts.TRAILING).toBeGreaterThanOrEqual(1);
  });

  it('uses strategy rules to suppress fallback threshold signals when indicators do not match', () => {
    const candles = [
      candle(0, 100),
      candle(1, 104),
      candle(2, 98),
      candle(3, 105),
      candle(4, 97),
      candle(5, 106),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'long',
          indicatorsLong: [
            {
              name: 'RSI',
              condition: '>',
              value: 99,
              params: { period: 14 },
            },
          ],
          indicatorsShort: [],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it('does not fallback to percent-threshold signals when strategy payload has no valid indicator rules', () => {
    const candles = [
      candle(0, 100),
      candle(1, 104),
      candle(2, 99),
      candle(3, 105),
      candle(4, 98),
      candle(5, 106),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'both',
          indicatorsLong: [],
          indicatorsShort: [],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBe(0);
    expect(result.trades).toHaveLength(0);
  });

  it('evaluates strategy EMA rules per candle and can generate directional trades', () => {
    const candles = [
      candle(0, 100),
      candle(1, 101),
      candle(2, 102),
      candle(3, 103),
      candle(4, 104),
      candle(5, 103),
      candle(6, 102),
      candle(7, 101),
      candle(8, 100),
      candle(9, 99),
      candle(10, 98),
      candle(11, 99),
      candle(12, 100),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'ETHUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 3,
      marginMode: 'CROSSED',
      strategyConfig: {
        openConditions: {
          direction: 'both',
          indicatorsLong: [
            {
              name: 'EMA',
              condition: '>',
              value: 1,
              params: { fast: 2, slow: 4 },
            },
          ],
          indicatorsShort: [
            {
              name: 'EMA',
              condition: '<',
              value: 1,
              params: { fast: 2, slow: 4 },
            },
          ],
        },
      },
    });

    expect(result.eventCounts.ENTRY).toBeGreaterThan(0);
    expect(result.trades.length).toBeGreaterThan(0);
    expect(new Set(result.trades.map((trade) => trade.side))).toContain('LONG');
  });

  it('emits parity decision-trace mismatch diagnostics with timestamp/side/trigger/reason', () => {
    const candles = [
      candle(0, 100),
      candle(1, 102), // LONG open
      candle(2, 99), // SHORT signal while LONG open => no_flip_with_open_position
      candle(3, 99.1),
    ];

    const result = simulateTradesForSymbolReplay({
      symbol: 'BTCUSDT',
      candles,
      marketType: 'FUTURES',
      leverage: 2,
      marginMode: 'CROSSED',
    });

    const mismatch = result.decisionTrace.find(
      (entry) => entry.mismatchReason === 'no_flip_with_open_position',
    );
    expect(mismatch).toBeDefined();
    expect(mismatch?.side).toBe('LONG');
    expect(mismatch?.trigger).toBe('THRESHOLD');
    expect(mismatch?.timestamp).toBeInstanceOf(Date);
  });
});
